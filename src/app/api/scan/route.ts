import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { claimPaymentProcessing, completePayment, createPaymentRequestHash, hasPaymentSignature, isDemoReceipt, paymentDiscoveryResponse, paymentRequiredResponse, releasePaymentProcessing, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { ChainResolutionError, resolveScanChain, runFirewallScan } from '@/lib/scan-service';
import { InvalidJsonBodyError, parseJsonBody, scanRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Route Handler — Tier 2: API Firewall (0.5 USDT)
// ---------------------------------------------------------------------------
const firewallServiceInfo = {
  ok: true,
  inputRequired: true,
  service: 'Firewall Scan',
  endpoint: '/api/scan',
  method: 'POST',
  payment: 'x402',
  price: `${SCAN_PRICING_USDT.firewall} USDT`,
  description: 'Fast token risk check that returns a machine-readable verdict and threat score.',
  requiredInput: {
    tokenAddress: 'EVM token contract address',
    chainId: 'Optional token scan chain id; omit to auto-detect. Payments settle on X Layer separately.',
  },
  fields: [
    {
      name: 'tokenAddress',
      type: 'string',
      description: 'EVM token contract address to scan.',
      required: true,
    },
    {
      name: 'chainId',
      type: 'string',
      description: 'Optional token scan chain id. If omitted, WatchTower attempts chain auto-detection. This is not the x402 payment network.',
      required: false,
    },
  ],
};

export async function GET(req: Request) {
  return paymentDiscoveryResponse(req, SCAN_PRICING_USDT.firewall, 'Tier 2 - API Firewall', firewallServiceInfo);
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
    const input = scanRequestSchema.parse(await parseJsonBody(req));
    const chainResolution = await resolveScanChain(input);
    // F2: Rate limit by IP first, then agentWallet fallback
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
      endpoint: '/api/scan',
      tier: 'firewall',
      input: paymentIdentityInput,
    });
    const payment = await requirePayment(req, SCAN_PRICING_USDT.firewall, 'Tier 2 - API Firewall', requestHash, { allowDemoBypass: true });
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

    const data = await runFirewallScan({
      ...input,
      agentWallet: payment.receipt.payer,
      chainResolution,
    });
    const responseBody = { success: true, data };
    if (!isDemoReceipt(payment.receipt)) {
      await completePayment(payment.receipt.paymentId, JSON.stringify(responseBody));
    }

    return setPaymentResponseHeader(NextResponse.json(responseBody), payment.receipt);
  } catch (error: unknown) {
    if (claimedPaymentId) {
      await releasePaymentProcessing(claimedPaymentId, error instanceof Error ? error.message : 'Scan processing failed.').catch(() => undefined);
    }
    console.error('Scan error:', error);
    if (error instanceof ZodError || error instanceof InvalidJsonBodyError) {
      // If there's no payment signature, the client hasn't paid yet.
      // Return 402 with the x402 challenge so they know how to pay.
      // This is required by the x402 spec: unpaid requests → 402.
      if (!hasPaymentSignature(req)) {
        return paymentDiscoveryResponse(req, SCAN_PRICING_USDT.firewall, 'Tier 2 - API Firewall', firewallServiceInfo);
      }
      // If they DO have a payment signature but invalid input, return 400
      if (error instanceof ZodError) {
        return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid request body', message: error.message }, { status: 400 });
    }
    if (error instanceof ChainResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PAYMENT, PAYMENT-SIGNATURE',
      'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
      'Access-Control-Max-Age': '86400',
    },
  });
}
