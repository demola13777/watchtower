import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getActivePaymentNetwork, getRequiredPaymentNetwork } from '@/config/network';
import { db } from '@/lib/db';
import { usedPaymentTransactions } from '@/lib/db/schema';
import { verifyPaymentTransaction, type PaymentVerificationSuccess } from '@/services/paymentVerifier';

const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';

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
  requestHash?: string;
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
    requestHash,
    instructions: 'Transfer the required token amount to payTo on the configured chain, then retry with Authorization: L402 <transaction_hash>. SDK/facilitator integrations should bind the payment to the requestHash.',
  };
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
        paymentRequired = createRequirement(request, costUsdt, tier, requestHash);
      } catch (error) {
        return {
          ok: false,
          failure: {
            status: 503,
            error: 'Service Unavailable',
            message: error instanceof Error ? error.message : 'Payment network configuration is incomplete.',
            tier,
            price: `${costUsdt} ${activeNetwork.token.symbol}`,
          },
        };
      }

      return {
        ok: false,
        failure: {
          status: 402,
          error: 'Payment Required',
          message: `x402 payment required. Transfer ${costUsdt} ${activeNetwork.token.symbol} and retry with Authorization: L402 <tx_hash>.`,
          tier,
          price: `${costUsdt} ${activeNetwork.token.symbol}`,
          paymentRequired,
        },
      };
    }

    if (await isReplay(txHash)) {
      return {
        ok: false,
        failure: {
          status: 409,
          error: 'Conflict',
          message: 'Payment transaction hash has already been used.',
          tier,
          price: `${costUsdt} ${activeNetwork.token.symbol}`,
        },
      };
    }

    const verification = await verifyPaymentTransaction({
      txHash,
      requiredAmount: costUsdt.toString(),
    }).catch((error: unknown) => ({
      ok: false as const,
      reason: error instanceof Error ? error.message : 'Payment verification failed.',
    }));

    if (!verification.ok) {
      return {
        ok: false,
        failure: {
          status: 401,
          error: 'Unauthorized',
          message: verification.reason,
          tier,
          price: `${costUsdt} ${activeNetwork.token.symbol}`,
        },
      };
    }

    try {
      await recordUsedTransaction(verification, tier, requestHash);
    } catch {
      return {
        ok: false,
        failure: {
          status: 409,
          error: 'Conflict',
          message: 'Payment transaction hash has already been used.',
          tier,
          price: `${costUsdt} ${activeNetwork.token.symbol}`,
        },
      };
    }

    return {
      ok: true,
      receipt: {
        mode: 'self-hosted-web3-verification',
        tier,
        amountUsdt: costUsdt,
        currency: activeNetwork.token.symbol,
        network: activeNetwork.name,
        chainId: verification.chainId,
        payer: verification.payer,
        settlementTxHash: verification.txHash,
        requestHash,
      },
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
    requestHash: receipt.requestHash,
    status: 'verified',
    verifiedAt: Date.now(),
  });
}

export function setPaymentResponseHeader(response: Response, receipt: PaymentReceipt): Response {
  response.headers.set(PAYMENT_RESPONSE_HEADER, paymentResponseHeader(receipt));
  return response;
}
