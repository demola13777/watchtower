import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { claimPaymentProcessing, completePayment, createPaymentRequestHash, isDemoReceipt, paymentRequiredResponse, releasePaymentProcessing, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { ChainResolutionError, resolveScanChain, runDeepScan } from '@/lib/scan-service';
import { scanRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/scan/deep
 * 
 * Tier 1 — Deep Scan (1 USDT)
 * Comprehensive security report for the OKX AI Marketplace.
 */
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
    const payment = await requirePayment(req, SCAN_PRICING_USDT.deep, 'Tier 1 - Deep Scan', requestHash, { allowDemoBypass: true });
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

    const deepReport = await runDeepScan({
      ...input,
      agentWallet: payment.receipt.payer,
      chainResolution,
    });
    const responseBody = { success: true, data: deepReport };
    if (!isDemoReceipt(payment.receipt)) {
      await completePayment(payment.receipt.paymentId, JSON.stringify(responseBody));
    }

    return setPaymentResponseHeader(
      NextResponse.json(responseBody),
      payment.receipt,
    );
  } catch (error: unknown) {
    if (claimedPaymentId) {
      await releasePaymentProcessing(claimedPaymentId, error instanceof Error ? error.message : 'Deep scan processing failed.').catch(() => undefined);
    }
    console.error('Deep scan error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    if (error instanceof ChainResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
