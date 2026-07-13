import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { claimPaymentProcessing, completePayment, createPaymentRequestHash, isDemoReceipt, paymentRequiredResponse, releasePaymentProcessing, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { ChainResolutionError, resolveScanChain, runFirewallScan } from '@/lib/scan-service';
import { scanRequestSchema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// Route Handler — Tier 2: API Firewall (0.5 USDT)
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  let claimedPaymentId: string | null = null;
  try {
    const input = scanRequestSchema.parse(await req.json());
    const chainResolution = await resolveScanChain(input);
    // F2: Rate limit by IP first, then agentWallet fallback
    const rateLimitKey = getRateLimitKey(req, input.agentWallet);
    if (await isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 scans per minute.' },
        { status: 429 },
      );
    }

    const requestHash = createPaymentRequestHash({
      endpoint: '/api/scan',
      tier: 'firewall',
      input,
    });
    const payment = await requirePayment(req, SCAN_PRICING_USDT.firewall, 'Tier 2 - API Firewall', requestHash);
    if (!payment.ok) return paymentRequiredResponse(payment.failure);

    // Claim payment processing — skip DB operations for demo receipts
    if (!isDemoReceipt(payment.receipt)) {
      const claim = await claimPaymentProcessing(payment.receipt.paymentId);
      if (claim.state === 'completed') {
        return setPaymentResponseHeader(NextResponse.json(JSON.parse(claim.responsePayload)), payment.receipt);
      }
      if (claim.state === 'processing') {
        return NextResponse.json(
          { error: 'Your paid scan is already processing. Retry this same request shortly.' },
          { status: 409, headers: { 'Retry-After': '2' } },
        );
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
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    if (error instanceof ChainResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
