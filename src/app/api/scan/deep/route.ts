import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { createPaymentRequestHash, paymentRequiredResponse, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { runDeepScan } from '@/lib/scan-service';
import { scanRequestSchema } from '@/lib/validation';

/**
 * POST /api/scan/deep
 * 
 * Tier 1 — Deep Scan (1 USDT)
 * Comprehensive security report for the OKX AI Marketplace.
 */
export async function POST(req: Request) {
  try {
    const input = scanRequestSchema.parse(await req.json());
    const rateLimitKey = getRateLimitKey(req, input.agentWallet);
    if (isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 scans per minute.' },
        { status: 429 },
      );
    }

    const requestHash = createPaymentRequestHash({
      endpoint: '/api/scan/deep',
      tier: 'deep',
      input,
    });
    const payment = await requirePayment(req, SCAN_PRICING_USDT.deep, 'Tier 1 - Deep Scan', requestHash);
    if (!payment.ok) return paymentRequiredResponse(payment.failure);

    const deepReport = await runDeepScan(input);

    return setPaymentResponseHeader(
      NextResponse.json({ success: true, data: deepReport }),
      payment.receipt,
    );
  } catch (error: unknown) {
    console.error('Deep scan error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
