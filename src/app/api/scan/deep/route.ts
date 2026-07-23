import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { claimPaymentProcessing, completePayment, createPaymentRequestHash, isDemoReceipt, paymentRequiredResponse, releasePaymentProcessing, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { ChainResolutionError, resolveScanChain } from '@/lib/scan-service';
import { runAuthorization } from '@/lib/authorize-service';
import { scanRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const authorizationCompatibilityInfo = {
  ok: true,
  service: 'Authorization',
  endpoint: '/api/scan/deep',
  method: 'POST',
  payment: 'x402',
  price: `${SCAN_PRICING_USDT.deep} USDT`,
  description: 'Legacy marketplace endpoint for Execution Authorization and signed Permission to Execute reports.',
  requiredInput: {
    tokenAddress: 'EVM token contract address',
    chainId: 'Optional EVM chain id',
  },
  compatibility: 'This endpoint preserves the former Deep Scan marketplace wiring while returning the current Authorization experience.',
};

/**
 * POST /api/scan/deep
 * 
 * Legacy compatibility route for Execution Authorization (1 USDT).
 * Keeps existing OKX Marketplace endpoint wiring intact while returning the
 * evolved Permission to Execute report.
 */
export async function GET() {
  return NextResponse.json(authorizationCompatibilityInfo);
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
    const input = scanRequestSchema.parse(await req.json());
    const chainResolution = await resolveScanChain(input);
    const rateLimitKey = getRateLimitKey(req, input.agentWallet);
    if (await isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 scans per minute.' },
        { status: 429 },
      );
    }

    const { agentWallet: _agentWallet, ...paymentIdentityInput } = input;
    void _agentWallet;
    const requestHash = createPaymentRequestHash({
      endpoint: '/api/scan/deep',
      tier: 'deep',
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
          { error: 'Your paid scan is already processing. Retry this same request shortly.' },
          { status: 409, headers: { 'Retry-After': '2' } },
        ), payment.receipt);
      }
      claimedPaymentId = payment.receipt.paymentId;
    }

    const authorization = await runAuthorization({
      ...input,
      agentWallet: payment.receipt.payer,
      chainResolution,
    });
    const responseBody = { success: true, data: authorization.report };
    if (!isDemoReceipt(payment.receipt)) {
      await completePayment(payment.receipt.paymentId, JSON.stringify(responseBody));
    }

    return setPaymentResponseHeader(
      NextResponse.json(responseBody),
      payment.receipt,
    );
  } catch (error: unknown) {
    if (claimedPaymentId) {
      await releasePaymentProcessing(claimedPaymentId, error instanceof Error ? error.message : 'Execution Authorization processing failed.').catch(() => undefined);
    }
    console.error('Execution Authorization compatibility route error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    if (error instanceof ChainResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
