import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { createPaymentRequestHash, paymentRequiredResponse, requirePayment, setPaymentResponseHeader } from '@/lib/payment';
import { runFirewallScan } from '@/lib/scan-service';
import { scanRequestSchema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// Route Handler — Tier 2: API Firewall (0.5 USDT)
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const input = scanRequestSchema.parse(await req.json());
    // F2: Rate limit by IP first, then agentWallet fallback
    const rateLimitKey = getRateLimitKey(req, input.agentWallet);
    if (isRateLimited(rateLimitKey)) {
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

    const data = await runFirewallScan(input);

    return setPaymentResponseHeader(NextResponse.json({
      success: true,
      data,
    }), payment.receipt);
  } catch (error: unknown) {
    console.error('Scan error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
