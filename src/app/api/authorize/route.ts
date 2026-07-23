import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { claimPaymentProcessing, completePayment, createPaymentRequestHash, isDemoReceipt, paymentDiscoveryResponse, paymentRequiredResponse, releasePaymentProcessing, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { ChainResolutionError, resolveScanChain } from '@/lib/scan-service';
import { runAuthorization } from '@/lib/authorize-service';
import { authorizeRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const authorizationServiceInfo = {
  ok: true,
  inputRequired: true,
  service: 'Authorization',
  endpoint: '/api/authorize',
  method: 'POST',
  payment: 'x402',
  price: `${SCAN_PRICING_USDT.deep} USDT`,
  description: 'Permission to Execute endpoint that analyzes risk, evaluates policy, and returns a verified Execution Permit when approved.',
  requiredInput: {
    tokenAddress: 'EVM token contract address',
    action: 'Autonomous action being authorized',
    chainId: 'Optional EVM chain id',
  },
  fields: [
    {
      name: 'tokenAddress',
      type: 'string',
      description: 'EVM token contract address to authorize.',
      required: true,
    },
    {
      name: 'action',
      type: 'string',
      description: 'Autonomous action being authorized, for example swap.',
      required: true,
    },
    {
      name: 'chainId',
      type: 'string',
      description: 'Optional EVM chain id. If omitted, WatchTower attempts chain auto-detection.',
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Route Handler — Execution Authorization (1 USDT)
//
// Evaluates a proposed action through the full WatchTower threat analysis
// pipeline and returns a cryptographically signed Execution Authorization
// when the action is deemed safe.
//
// Every autonomous action now carries a cryptographically verifiable
// execution authorization.
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  return paymentDiscoveryResponse(req, SCAN_PRICING_USDT.deep, 'Execution Authorization', authorizationServiceInfo);
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(req: Request) {
  let claimedPaymentId: string | null = null;
  try {
    const input = authorizeRequestSchema.parse(await req.json());
    const chainResolution = await resolveScanChain(input);

    const rateLimitKey = getRateLimitKey(req, input.agentWallet);
    if (await isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 requests per minute.' },
        { status: 429 },
      );
    }

    const { agentWallet: _agentWallet, ...paymentIdentityInput } = input;
    void _agentWallet;
    const requestHash = createPaymentRequestHash({
      endpoint: '/api/authorize',
      tier: 'authorize',
      input: paymentIdentityInput,
    });
    const payment = await requirePayment(req, SCAN_PRICING_USDT.deep, 'Execution Authorization', requestHash, { allowDemoBypass: true });
    if (!payment.ok) return paymentRequiredResponse(payment.failure);

    // Claim payment processing — skip DB operations for demo receipts
    if (!isDemoReceipt(payment.receipt)) {
      const claim = await claimPaymentProcessing(payment.receipt.paymentId);
      if (claim.state === 'completed') {
        return setPaymentResponseHeader(NextResponse.json(JSON.parse(claim.responsePayload)), payment.receipt);
      }
      if (claim.state === 'processing') {
        return setPaymentResponseHeader(NextResponse.json(
          { error: 'Your authorization request is already processing. Retry this same request shortly.' },
          { status: 409, headers: { 'Retry-After': '2' } },
        ), payment.receipt);
      }
      claimedPaymentId = payment.receipt.paymentId;
    }

    const result = await runAuthorization({
      ...input,
      agentWallet: payment.receipt.payer,
      chainResolution,
    });

    const responseBody = { success: true, data: result };
    if (!isDemoReceipt(payment.receipt)) {
      await completePayment(payment.receipt.paymentId, JSON.stringify(responseBody));
    }

    return setPaymentResponseHeader(NextResponse.json(responseBody), payment.receipt);
  } catch (error: unknown) {
    if (claimedPaymentId) {
      await releasePaymentProcessing(claimedPaymentId, error instanceof Error ? error.message : 'Authorization processing failed.').catch(() => undefined);
    }
    console.error('Authorization error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    if (error instanceof ChainResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
