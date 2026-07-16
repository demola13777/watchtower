import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getActivePaymentNetwork, getRequiredPaymentNetwork } from '@/config/network';
import { db } from '@/lib/db';
import { payments } from '@/lib/db/schema';
import {
  buildPaymentRequired,
  extractPaymentPayload,
  verifyAndSettle,
  encodePaymentRequired,
  encodePaymentResponse,
  getX402Network,
  type PaymentRequired as X402PaymentRequired,
  type SettleResponse,
} from '@/lib/x402';
import { logger } from '@/lib/logger';

const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';
const PAYMENT_INTENT_TTL_MS = 10 * 60 * 1000;

export interface PaymentRequest {
  request: Request;
  costUsdt: number;
  tier: string;
  requestHash?: string;
}

export interface PaymentReceipt {
  mode: 'x402-facilitator' | 'demo';
  tier: string;
  amountUsdt: number;
  currency: string;
  network: string;
  chainId: number;
  payer: string;
  settlementTxHash: string;
  paymentId: string;
  requestHash?: string;
}

export interface PaymentFailure {
  status: 402 | 401 | 409 | 503;
  error: 'Payment Required' | 'Unauthorized' | 'Conflict' | 'Service Unavailable';
  message: string;
  tier: string;
  price: string;
  paymentRequired?: X402PaymentRequired;
}

export type PaymentResult =
  | { ok: true; receipt: PaymentReceipt }
  | { ok: false; failure: PaymentFailure };

export interface PaymentService {
  validatePayment(input: PaymentRequest): Promise<PaymentResult>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }

  return value;
}

export function createPaymentRequestHash(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function failure(
  status: PaymentFailure['status'],
  error: PaymentFailure['error'],
  message: string,
  tier: string,
  price: string,
  paymentRequired?: X402PaymentRequired,
): PaymentResult {
  return { ok: false, failure: { status, error, message, tier, price, paymentRequired } };
}

async function createPaymentIntent(
  request: Request,
  costUsdt: number,
  tier: string,
  requestHash?: string,
): Promise<X402PaymentRequired> {
  const paymentId = crypto.randomUUID();
  const network = getRequiredPaymentNetwork();

  // Build the standard x402 PaymentRequired challenge via the SDK
  const paymentRequired = await buildPaymentRequired(
    request,
    costUsdt,
    `WatchTower ${tier} scan`,
  );

  const now = Date.now();

  await db.insert(payments).values({
    paymentId,
    status: 'pending',
    tier,
    amount: paymentRequired.accepts[0]?.amount ?? costUsdt.toString(),
    currency: network.token.symbol,
    network: getX402Network(),
    scheme: 'exact',
    payTo: network.treasuryAddress.toLowerCase(),
    resource: new URL(request.url).pathname,
    method: request.method.toUpperCase(),
    requestHash: requestHash ?? '',
    requirement: JSON.stringify(paymentRequired),
    createdAt: now,
    expiresAt: now + PAYMENT_INTENT_TTL_MS,
  });

  logger.payment('intent_created', {
    paymentId,
    tier,
    amount: paymentRequired.accepts[0]?.amount ?? costUsdt.toString(),
    currency: network.token.symbol,
    network: getX402Network(),
    scheme: 'exact',
  });

  return paymentRequired;
}

async function getPaymentIntent(paymentId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);
  return payment ?? null;
}

// ─── x402 Standard Payment Service ──────────────────────────────────────────

export class X402PaymentService implements PaymentService {
  async validatePayment({ request, costUsdt, tier, requestHash }: PaymentRequest): Promise<PaymentResult> {
    const activeNetwork = getActivePaymentNetwork();

    // Step 1: Check if the request carries a payment signature
    const paymentPayload = extractPaymentPayload(request);

    if (!paymentPayload) {
      // No payment — create a challenge and return 402
      let paymentRequired: X402PaymentRequired;
      try {
        paymentRequired = await createPaymentIntent(request, costUsdt, tier, requestHash);
      } catch (error) {
        return failure(
          503,
          'Service Unavailable',
          error instanceof Error ? error.message : 'Payment network configuration is incomplete.',
          tier,
          `${costUsdt} ${activeNetwork.token.symbol}`,
        );
      }

      return failure(
        402,
        'Payment Required',
        `x402 payment required. Sign a payment of ${costUsdt} ${activeNetwork.token.symbol} using the exact scheme and retry with the PAYMENT-SIGNATURE header.`,
        tier,
        `${costUsdt} ${activeNetwork.token.symbol}`,
        paymentRequired,
      );
    }

    // Step 2: We have a payment payload — extract the accepted requirements
    const paymentRequirements = paymentPayload.accepted;
    if (!paymentRequirements) {
      return failure(
        401,
        'Unauthorized',
        'Invalid payment payload: missing accepted payment requirements.',
        tier,
        `${costUsdt} ${activeNetwork.token.symbol}`,
      );
    }

    // Step 3: Verify the payment payload matches a known intent.
    // In x402, the paymentPayload carries the full accepted requirements so we
    // can match against what we asked for. We verify amount/payTo/network/scheme.
    const network = getX402Network();
    if (paymentRequirements.network !== network) {
      return failure(
        401,
        'Unauthorized',
        `Payment network mismatch. Expected ${network}, got ${paymentRequirements.network}.`,
        tier,
        `${costUsdt} ${activeNetwork.token.symbol}`,
      );
    }

    if (paymentRequirements.scheme !== 'exact') {
      return failure(
        401,
        'Unauthorized',
        `Unsupported payment scheme: ${paymentRequirements.scheme}. Only "exact" is supported.`,
        tier,
        `${costUsdt} ${activeNetwork.token.symbol}`,
      );
    }

    // Step 4: Verify and settle via the OKX facilitator
    const settlement = await verifyAndSettle(paymentPayload, paymentRequirements);

    if (!settlement.ok) {
      logger.payment('verification_failed', {
        tier,
        reason: settlement.reason,
        statusCode: settlement.statusCode,
      });
      return failure(
        settlement.statusCode as PaymentFailure['status'],
        settlement.statusCode === 402 ? 'Payment Required' : 'Unauthorized',
        settlement.reason,
        tier,
        `${costUsdt} ${activeNetwork.token.symbol}`,
      );
    }

    // Step 5: Record the settlement in our database
    const paymentId = crypto.randomUUID();
    try {
      await db.insert(payments).values({
        paymentId,
        status: 'settled',
        tier,
        amount: settlement.amount,
        currency: activeNetwork.token.symbol,
        network: settlement.network,
        scheme: 'exact',
        payer: settlement.payer.toLowerCase(),
        payTo: paymentRequirements.payTo.toLowerCase(),
        resource: new URL(request.url).pathname,
        method: request.method.toUpperCase(),
        requestHash: requestHash ?? '',
        requirement: JSON.stringify(paymentRequirements),
        paymentPayload: JSON.stringify(paymentPayload),
        settlementTxHash: settlement.transaction,
        createdAt: Date.now(),
        expiresAt: Date.now() + PAYMENT_INTENT_TTL_MS,
        settledAt: Date.now(),
      });
    } catch (error) {
      // If insert fails (e.g. duplicate), the payment was likely already processed
      logger.payment('settlement_db_error', {
        error: error instanceof Error ? error.message : String(error),
        tx: settlement.transaction,
      });
    }

    logger.payment('settled', {
      paymentId,
      tier,
      amount: settlement.amount,
      currency: activeNetwork.token.symbol,
      txHash: settlement.transaction,
      payer: settlement.payer,
    });

    return {
      ok: true,
      receipt: {
        mode: 'x402-facilitator',
        tier,
        amountUsdt: costUsdt,
        currency: activeNetwork.token.symbol,
        network: settlement.network,
        chainId: getRequiredPaymentNetwork().chainId,
        payer: settlement.payer,
        settlementTxHash: settlement.transaction,
        paymentId,
        requestHash,
      },
    };
  }
}

// ─── Demo Mode ────────────────────────────────────────────────────────────────
// When WATCHTOWER_DEMO_MODE=true, the payment middleware simulates a successful
// x402 authorization. The full request path is exercised (validation, chain
// resolution, MCP server, scan engine) — only the blockchain payment is skipped.
// Production behavior is completely unchanged when the flag is absent or false.
// ──────────────────────────────────────────────────────────────────────────────

const IS_DEMO_MODE = process.env.WATCHTOWER_DEMO_MODE === 'true';

export function isDemoReceipt(receipt: PaymentReceipt): boolean {
  return receipt.mode === 'demo';
}

class DemoPaymentService implements PaymentService {
  async validatePayment({ costUsdt, tier, requestHash }: PaymentRequest): Promise<PaymentResult> {
    logger.payment('demo_bypass', {
      tier,
      amount: costUsdt.toString(),
      note: 'WATCHTOWER_DEMO_MODE active — simulating successful x402 authorization',
    });

    return {
      ok: true,
      receipt: {
        mode: 'demo',
        tier,
        amountUsdt: costUsdt,
        currency: 'USDT0',
        network: 'X Layer Mainnet (Demo)',
        chainId: 196,
        payer: '0x0000000000000000000000000000000000000000',
        settlementTxHash: '0x' + '0'.repeat(64),
        paymentId: crypto.randomUUID(),
        requestHash,
      },
    };
  }
}

const realPaymentService = new X402PaymentService();
const demoPaymentService = new DemoPaymentService();

// Default export for backward compatibility — always the real service.
// Use requirePayment() with allowDemoBypass for controlled demo access.
export const paymentService: PaymentService = realPaymentService;

export async function requirePayment(
  request: Request,
  costUsdt: number,
  tier: string,
  requestHash?: string,
  options?: { allowDemoBypass?: boolean },
): Promise<PaymentResult> {
  const service = (options?.allowDemoBypass && IS_DEMO_MODE)
    ? demoPaymentService
    : realPaymentService;
  return service.validatePayment({ request, costUsdt, tier, requestHash });
}

export async function getCompletedPaymentResponse(paymentId: string): Promise<string | null> {
  const intent = await getPaymentIntent(paymentId);
  return intent?.status === 'completed' ? intent.responsePayload ?? null : null;
}

export type PaymentProcessingClaim =
  | { state: 'claimed' }
  | { state: 'completed'; responsePayload: string }
  | { state: 'processing' };

export async function claimPaymentProcessing(paymentId: string): Promise<PaymentProcessingClaim> {
  const intent = await getPaymentIntent(paymentId);
  if (!intent) return { state: 'processing' };
  if (intent.status === 'completed' && intent.responsePayload) {
    return { state: 'completed', responsePayload: intent.responsePayload };
  }
  if (intent.status === 'processing') return { state: 'processing' };
  if (intent.status !== 'settled') return { state: 'processing' };

  const claimed = await db.update(payments)
    .set({ status: 'processing' })
    .where(and(eq(payments.paymentId, paymentId), eq(payments.status, 'settled')))
    .returning({ paymentId: payments.paymentId });

  if (claimed.length > 0) return { state: 'claimed' };

  const latest = await getPaymentIntent(paymentId);
  if (latest?.status === 'completed' && latest.responsePayload) {
    return { state: 'completed', responsePayload: latest.responsePayload };
  }
  return { state: 'processing' };
}

export async function completePayment(
  paymentId: string,
  responsePayload: string,
): Promise<void> {
  await db.update(payments)
    .set({ status: 'completed', responsePayload, completedAt: Date.now() })
    .where(and(eq(payments.paymentId, paymentId), eq(payments.status, 'processing')));
  logger.payment('completed', { paymentId });
}

export async function releasePaymentProcessing(paymentId: string, reason: string): Promise<void> {
  await db.update(payments)
    .set({ status: 'settled', failureReason: reason })
    .where(and(eq(payments.paymentId, paymentId), eq(payments.status, 'processing')));
  logger.payment('processing_released', { paymentId, reason });
}

export function paymentRequiredResponse(failure: PaymentFailure): NextResponse {
  const headers: Record<string, string> = {};
  if (failure.paymentRequired) {
    // Standard x402 v2 headers
    headers[PAYMENT_REQUIRED_HEADER] = encodePaymentRequired(failure.paymentRequired);
  }

  return NextResponse.json(
    {
      error: failure.error,
      message: failure.message,
      tier: failure.tier,
      price: failure.price,
      paymentRequired: failure.paymentRequired,
    },
    {
      status: failure.status,
      headers,
    },
  );
}

export function paymentResponseHeader(receipt: PaymentReceipt): string {
  // For demo receipts, return a simple base64 JSON (not from the SDK)
  if (receipt.mode === 'demo') {
    return Buffer.from(JSON.stringify({
      x402Version: 2,
      success: true,
      status: 'success',
      payer: receipt.payer,
      transaction: receipt.settlementTxHash,
      network: `eip155:${receipt.chainId}`,
    }), 'utf8').toString('base64url');
  }

  // For real payments, encode the settle response via the SDK
  return encodePaymentResponse({
    success: true,
    status: 'success',
    payer: receipt.payer,
    transaction: receipt.settlementTxHash,
    network: `eip155:${receipt.chainId}`,
  } as SettleResponse);
}

export function setPaymentResponseHeader(response: Response, receipt: PaymentReceipt): Response {
  response.headers.set(PAYMENT_RESPONSE_HEADER, paymentResponseHeader(receipt));
  return response;
}
