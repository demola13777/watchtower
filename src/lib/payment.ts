import { and, eq } from 'drizzle-orm';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getActivePaymentNetwork, getRequiredPaymentNetwork } from '@/config/network';
import { db } from '@/lib/db';
import { payments, usedPaymentTransactions } from '@/lib/db/schema';
import { verifyPaymentTransaction, type PaymentVerificationSuccess } from '@/services/paymentVerifier';
import { logger } from '@/lib/logger';

const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';
const PAYMENT_ID_HEADER = 'X-WatchTower-Payment-Id';
const PAYMENT_INTENT_TTL_MS = 10 * 60 * 1000;

export interface PaymentRequest {
  request: Request;
  costUsdt: number;
  tier: string;
  requestHash?: string;
}

export interface Web3PaymentRequirement {
  x402Version: number;
  scheme: 'evm-erc20-transfer';
  network: string;
  chainId: number;
  currency: string;
  tokenAddress: string;
  tokenDecimals: number;
  amount: string;
  payTo: string;
  resource: string;
  method: string;
  tier: string;
  paymentId: string;
  requestHash?: string;
  minConfirmations: number;
  instructions: string;
}

export interface PaymentReceipt {
  mode: 'self-hosted-web3-verification';
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
  paymentRequired?: Web3PaymentRequirement;
}

export type PaymentResult =
  | { ok: true; receipt: PaymentReceipt }
  | { ok: false; failure: PaymentFailure };

export interface PaymentService {
  validatePayment(input: PaymentRequest): Promise<PaymentResult>;
}

function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
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

function extractL402TxHash(request: Request): string | null {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = authorization.match(/^L402\s+(0x[a-fA-F0-9]{64})$/);
  return match?.[1] ?? null;
}

function extractPaymentId(request: Request): string | null {
  const paymentId = request.headers.get(PAYMENT_ID_HEADER) ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)
    ? paymentId
    : null;
}

function getPaymentMinConfirmations(): number {
  const configured = process.env.PAYMENT_MIN_CONFIRMATIONS;
  if (!configured) return 1;
  if (!/^\d+$/.test(configured)) {
    throw new Error('PAYMENT_MIN_CONFIRMATIONS must be a non-negative integer.');
  }
  return Number(configured);
}

export function createPaymentRequestHash(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function createRequirement(
  request: Request,
  costUsdt: number,
  tier: string,
  paymentId: string,
  requestHash?: string,
): Web3PaymentRequirement {
  const network = getRequiredPaymentNetwork();
  const url = new URL(request.url);

  return {
    x402Version: 2,
    scheme: 'evm-erc20-transfer',
    network: network.name,
    chainId: network.chainId,
    currency: network.token.symbol,
    tokenAddress: network.token.address,
    tokenDecimals: network.token.decimals,
    amount: costUsdt.toString(),
    payTo: network.treasuryAddress,
    resource: url.pathname,
    method: request.method.toUpperCase(),
    tier,
    paymentId,
    requestHash,
    minConfirmations: getPaymentMinConfirmations(),
    instructions: 'Transfer the required token amount to payTo on the configured chain, wait for the required confirmation depth, then retry with Authorization: L402 <transaction_hash> and X-WatchTower-Payment-Id <payment_id>.',
  };
}

function failure(
  status: PaymentFailure['status'],
  error: PaymentFailure['error'],
  message: string,
  tier: string,
  price: string,
  paymentRequired?: Web3PaymentRequirement,
): PaymentResult {
  return { ok: false, failure: { status, error, message, tier, price, paymentRequired } };
}

async function createPaymentIntent(
  request: Request,
  costUsdt: number,
  tier: string,
  requestHash?: string,
): Promise<Web3PaymentRequirement> {
  const paymentId = crypto.randomUUID();
  const requirement = createRequirement(request, costUsdt, tier, paymentId, requestHash);
  const now = Date.now();

  await db.insert(payments).values({
    paymentId,
    status: 'pending',
    tier,
    amount: requirement.amount,
    currency: requirement.currency,
    network: requirement.network,
    scheme: requirement.scheme,
    payTo: requirement.payTo.toLowerCase(),
    resource: requirement.resource,
    method: requirement.method,
    requestHash: requestHash ?? '',
    requirement: JSON.stringify(requirement),
    createdAt: now,
    expiresAt: now + PAYMENT_INTENT_TTL_MS,
  });

  logger.payment('intent_created', { paymentId, tier, amount: requirement.amount, currency: requirement.currency, network: requirement.network });

  return requirement;
}

async function getPaymentIntent(paymentId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);
  return payment ?? null;
}

function intentMatchesRequest(
  intent: NonNullable<Awaited<ReturnType<typeof getPaymentIntent>>>,
  request: Request,
  costUsdt: number,
  tier: string,
  requestHash?: string,
): boolean {
  const network = getActivePaymentNetwork();
  return intent.tier === tier
    && intent.amount === costUsdt.toString()
    && intent.network === network.name
    && intent.resource === new URL(request.url).pathname
    && intent.method === request.method.toUpperCase()
    && intent.requestHash === (requestHash ?? '');
}

async function isReplay(txHash: string): Promise<boolean> {
  const [existing] = await db
    .select({ txHash: usedPaymentTransactions.txHash })
    .from(usedPaymentTransactions)
    .where(eq(usedPaymentTransactions.txHash, txHash.toLowerCase()))
    .limit(1);

  return Boolean(existing);
}

async function recordUsedTransaction(
  verification: PaymentVerificationSuccess,
  tier: string,
  paymentId: string,
  requestHash?: string,
) {
  await db.insert(usedPaymentTransactions).values({
    txHash: verification.txHash.toLowerCase(),
    network: getActivePaymentNetwork().name,
    chainId: verification.chainId,
    tokenAddress: verification.tokenAddress.toLowerCase(),
    treasuryAddress: verification.recipient.toLowerCase(),
    payer: verification.payer.toLowerCase(),
    amount: verification.amount.toString(),
    tier,
    paymentId,
    requestHash: requestHash ?? null,
    createdAt: Date.now(),
  });
}

export class SelfHostedWeb3PaymentService implements PaymentService {
  async validatePayment({ request, costUsdt, tier, requestHash }: PaymentRequest): Promise<PaymentResult> {
    const txHash = extractL402TxHash(request);
    const activeNetwork = getActivePaymentNetwork();

    if (!txHash) {
      let paymentRequired: Web3PaymentRequirement;
      try {
        paymentRequired = await createPaymentIntent(request, costUsdt, tier, requestHash);
      } catch (error) {
        return failure(503, 'Service Unavailable', error instanceof Error ? error.message : 'Payment network configuration is incomplete.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
      }

      return failure(402, 'Payment Required', `x402 payment required. Transfer ${costUsdt} ${activeNetwork.token.symbol} and retry with the payment id from this challenge.`, tier, `${costUsdt} ${activeNetwork.token.symbol}`, paymentRequired);
    }

    const paymentId = extractPaymentId(request);
    if (!paymentId) {
      return failure(401, 'Unauthorized', 'A valid X-WatchTower-Payment-Id is required with a payment transaction hash.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
    }

    const intent = await getPaymentIntent(paymentId);
    if (!intent || !intentMatchesRequest(intent, request, costUsdt, tier, requestHash)) {
      return failure(401, 'Unauthorized', 'Payment intent does not match this request.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
    }
    if (intent.status === 'pending' && intent.expiresAt < Date.now()) {
      return failure(409, 'Conflict', 'Payment intent has expired. Request a new payment challenge before settling.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
    }
    if (intent.settlementTxHash) {
      if (intent.settlementTxHash.toLowerCase() !== txHash.toLowerCase() || !intent.payer) {
        return failure(409, 'Conflict', 'Payment intent has already been settled with a different transaction.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
      }
      return {
        ok: true,
        receipt: {
          mode: 'self-hosted-web3-verification',
          tier,
          amountUsdt: costUsdt,
          currency: activeNetwork.token.symbol,
          network: activeNetwork.name,
          chainId: getRequiredPaymentNetwork().chainId,
          payer: intent.payer,
          settlementTxHash: intent.settlementTxHash,
          paymentId,
          requestHash,
        },
      };
    }

    if (await isReplay(txHash)) {
      return failure(409, 'Conflict', 'Payment transaction hash has already been used for another request.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
    }

    const verification = await verifyPaymentTransaction({
      txHash,
      requiredAmount: costUsdt.toString(),
    }).catch((error: unknown) => ({
      ok: false as const,
      reason: error instanceof Error ? error.message : 'Payment verification failed.',
    }));

    if (!verification.ok) {
      logger.payment('verification_failed', { paymentId, txHash, reason: verification.reason, tier });
      return failure(401, 'Unauthorized', verification.reason, tier, `${costUsdt} ${activeNetwork.token.symbol}`);
    }

    try {
      await recordUsedTransaction(verification, tier, paymentId, requestHash);
      await db.update(payments)
        .set({
          status: 'settled',
          payer: verification.payer.toLowerCase(),
          settlementTxHash: verification.txHash.toLowerCase(),
          settledAt: Date.now(),
        })
        .where(eq(payments.paymentId, paymentId));
    } catch {
      return failure(409, 'Conflict', 'Payment transaction hash has already been used.', tier, `${costUsdt} ${activeNetwork.token.symbol}`);
    }

    return {
      ok: true,
      receipt: (() => {
        const receipt = {
          mode: 'self-hosted-web3-verification' as const,
          tier,
          amountUsdt: costUsdt,
          currency: activeNetwork.token.symbol,
          network: activeNetwork.name,
          chainId: verification.chainId,
          payer: verification.payer,
          settlementTxHash: verification.txHash,
          paymentId,
          requestHash,
        };
        logger.payment('settled', { paymentId, tier, amount: costUsdt.toString(), currency: activeNetwork.token.symbol, txHash: verification.txHash, payer: verification.payer });
        return receipt;
      })(),
    };
  }
}

export const paymentService: PaymentService = new SelfHostedWeb3PaymentService();

export async function requirePayment(
  request: Request,
  costUsdt: number,
  tier: string,
  requestHash?: string,
): Promise<PaymentResult> {
  return paymentService.validatePayment({ request, costUsdt, tier, requestHash });
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
    headers[PAYMENT_REQUIRED_HEADER] = encodeBase64Json(failure.paymentRequired);
    headers['WWW-Authenticate'] = `L402 realm="WatchTower", network="${failure.paymentRequired.network}", chainId="${failure.paymentRequired.chainId}", token="${failure.paymentRequired.tokenAddress}", amount="${failure.paymentRequired.amount}"`;
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
  return encodeBase64Json({
    x402Version: 2,
    scheme: 'evm-erc20-transfer',
    network: receipt.network,
    chainId: receipt.chainId,
    currency: receipt.currency,
    amount: receipt.amountUsdt.toString(),
    payer: receipt.payer,
    settlementTxHash: receipt.settlementTxHash,
    paymentId: receipt.paymentId,
    requestHash: receipt.requestHash,
    status: 'verified',
    verifiedAt: Date.now(),
  });
}

export function setPaymentResponseHeader(response: Response, receipt: PaymentReceipt): Response {
  response.headers.set(PAYMENT_RESPONSE_HEADER, paymentResponseHeader(receipt));
  return response;
}
