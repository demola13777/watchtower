/**
 * x402 Payment Server Singleton
 *
 * Initializes the OKX x402 payment infrastructure:
 *   1. OKXFacilitatorClient – talks to the OKX facilitator for verify + settle
 *   2. x402ResourceServer    – registered with ExactEvmScheme for X Layer (eip155:196)
 *
 * All imports use @okxweb3/x402-core (the base package) to avoid type
 * conflicts with @okxweb3/x402-evm which also depends on x402-core.
 * The @okxweb3/app-x402-core re-exports from a separate copy, causing
 * private-property type mismatches — so we import directly from x402-core.
 *
 * The server is initialized once at module load and reused across all requests.
 */

import { OKXFacilitatorClient } from '@okxweb3/x402-core/facilitator';
import { x402ResourceServer } from '@okxweb3/x402-core/server';
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  decodePaymentSignatureHeader,
} from '@okxweb3/x402-core/http';
import { registerExactEvmScheme } from '@okxweb3/x402-evm/exact/server';
import { getRequiredPaymentNetwork } from '@/config/network';
import { logger } from '@/lib/logger';
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
  Network,
} from '@okxweb3/x402-core/types';

// ─── Environment ─────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ─── OKX Facilitator Client ──────────────────────────────────────────────────

let _facilitatorClient: OKXFacilitatorClient | null = null;

export function getFacilitatorClient(): OKXFacilitatorClient {
  if (!_facilitatorClient) {
    _facilitatorClient = new OKXFacilitatorClient({
      apiKey: requireEnv('OKX_API_KEY'),
      secretKey: requireEnv('OKX_SECRET_KEY'),
      passphrase: requireEnv('OKX_PASSPHRASE'),
      // syncSettle: true means the facilitator waits for on-chain confirmation
      // before returning, so we don't need to poll for settlement status.
      syncSettle: true,
    });
  }
  return _facilitatorClient;
}

// ─── x402 Resource Server ────────────────────────────────────────────────────

let _resourceServer: x402ResourceServer | null = null;
let _initPromise: Promise<void> | null = null;

export async function getResourceServer(): Promise<x402ResourceServer> {
  if (!_resourceServer) {
    const facilitator = getFacilitatorClient();
    const server = new x402ResourceServer(facilitator);

    // Register the EVM exact scheme for all EIP-155 networks.
    // The facilitator will determine which specific networks it supports.
    registerExactEvmScheme(server);

    _resourceServer = server;

    // initialize() fetches the facilitator's supported kinds (schemes + networks).
    // Without this, buildPaymentRequirements() throws because it cannot find
    // the supported kind for exact/eip155:196. The promise is cached so
    // concurrent requests share the same initialization.
    _initPromise = server.initialize().catch((err) => {
      const causeMsg = err instanceof Error && err.cause 
          ? (err.cause as Error).message ?? String(err.cause)
          : undefined;

      // Log the root cause (auth failure, network error, etc.) for diagnostics
      logger.payment('x402_init_failed', {
        error: err instanceof Error ? err.message : String(err),
        cause: causeMsg,
      });

      // Reset so the next request retries rather than permanently failing
      _resourceServer = null;
      _initPromise = null;
      
      // Throw a new error with the detailed cause attached so it surfaces to the HTTP response
      throw new Error(`x402 init failed: ${err.message}. Cause: ${causeMsg || 'unknown'}`);
    });
  }
  await _initPromise;
  return _resourceServer!;
}

// ─── Network Helper ──────────────────────────────────────────────────────────

export function getX402Network(): Network {
  const config = getRequiredPaymentNetwork();
  return `eip155:${config.chainId}` as Network;
}

// ─── Payment Requirement Builder ─────────────────────────────────────────────

/**
 * Build the standard x402 PaymentRequired challenge for a given route.
 *
 * This produces the JSON that gets base64-encoded into the PAYMENT-REQUIRED
 * header on a 402 response. The structure follows x402 v2:
 *
 *   {
 *     x402Version: 2,
 *     resource: { url, description },
 *     accepts: [{ scheme: "exact", network: "eip155:196", ... }]
 *   }
 */
export async function buildPaymentRequired(
  request: Request,
  costUsdt: number,
  description?: string,
  extra?: Record<string, unknown>,
): Promise<PaymentRequired> {
  const network = getX402Network();
  const paymentNetwork = getRequiredPaymentNetwork();
  const server = await getResourceServer();
  const url = new URL(request.url);

  // Build the payment requirements through the SDK's scheme system.
  // ResourceConfig: { scheme, payTo, price, network, maxTimeoutSeconds? }
  // Price accepts a plain number (Money type) — the scheme converts to asset amount.
  const requirements = await server.buildPaymentRequirements({
    scheme: 'exact',
    payTo: paymentNetwork.treasuryAddress,
    price: costUsdt, // Money type — plain number
    network,
    maxTimeoutSeconds: 600, // 10 minutes
    extra: {
      decimals: paymentNetwork.token.decimals,
      ...extra,
    },
  });

  // Build the full PaymentRequired response with resource info
  const paymentRequired = await server.createPaymentRequiredResponse(
    requirements,
    {
      url: url.pathname,
      description: description ?? `WatchTower scan at ${url.pathname}`,
    },
  );

  return paymentRequired;
}

// ─── Payment Verification & Settlement ───────────────────────────────────────

export interface X402VerifyAndSettleResult {
  ok: true;
  payer: string;
  transaction: string;
  network: string;
  amount: string;
  settleResponse: SettleResponse;
  paymentId?: string;
}

export interface X402VerifyAndSettleFailure {
  ok: false;
  reason: string;
  statusCode: number;
}

export type X402SettlementResult = X402VerifyAndSettleResult | X402VerifyAndSettleFailure;

/**
 * Verify and settle a payment using the OKX facilitator.
 *
 * This replaces the old on-chain verification flow:
 *   Old: WatchTower reads tx receipt via viem → verifies Transfer event
 *   New: OKX facilitator verifies signature + on-chain state → settles transfer
 */
export async function verifyAndSettle(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  options?: {
    beforeSettle?: (verified: { payer: string }) => Promise<X402VerifyAndSettleResult | null>;
  },
): Promise<X402SettlementResult> {
  const facilitator = getFacilitatorClient();

  // Step 1: Verify the payment signature and on-chain state
  let verifyResult: VerifyResponse;
  try {
    verifyResult = await facilitator.verify(paymentPayload, paymentRequirements);
  } catch (error) {
    logger.payment('x402_verify_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      reason: `Payment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      statusCode: 401,
    };
  }

  if (!verifyResult.isValid) {
    logger.payment('x402_verify_invalid', {
      reason: verifyResult.invalidReason,
      message: verifyResult.invalidMessage,
      payer: verifyResult.payer,
    });
    return {
      ok: false,
      reason: verifyResult.invalidMessage || verifyResult.invalidReason || 'Payment verification failed',
      statusCode: 401,
    };
  }

  const payer = verifyResult.payer ?? '0x0000000000000000000000000000000000000000';
  const resumed = await options?.beforeSettle?.({ payer });
  if (resumed) {
    logger.payment('x402_settlement_reused', {
      payer: resumed.payer,
      tx: resumed.transaction,
      network: resumed.network,
      amount: resumed.amount,
      paymentId: resumed.paymentId,
    });
    return resumed;
  }

  // Step 2: Settle the payment (execute the on-chain transfer via facilitator)
  let settleResult: SettleResponse;
  try {
    settleResult = await facilitator.settle(paymentPayload, paymentRequirements);
  } catch (error) {
    logger.payment('x402_settle_error', {
      error: error instanceof Error ? error.message : String(error),
      payer: verifyResult.payer,
    });
    return {
      ok: false,
      reason: `Payment settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      statusCode: 402,
    };
  }

  if (!settleResult.success) {
    logger.payment('x402_settle_failed', {
      reason: settleResult.errorReason,
      message: settleResult.errorMessage,
      payer: settleResult.payer,
      tx: settleResult.transaction,
    });
    return {
      ok: false,
      reason: settleResult.errorMessage || settleResult.errorReason || 'Payment settlement failed',
      statusCode: 402,
    };
  }

  logger.payment('x402_settled', {
    payer: settleResult.payer,
    tx: settleResult.transaction,
    network: settleResult.network,
    amount: settleResult.amount,
    status: settleResult.status,
  });

  return {
    ok: true,
    payer: settleResult.payer ?? payer,
    transaction: settleResult.transaction,
    network: settleResult.network,
    amount: settleResult.amount ?? paymentRequirements.amount,
    settleResponse: settleResult,
  };
}

// ─── Header Utilities ────────────────────────────────────────────────────────

/**
 * Extract and decode the PAYMENT-SIGNATURE header from a request.
 * Returns null if the header is not present or invalid.
 */
export function extractPaymentPayload(request: Request): PaymentPayload | null {
  // Check for the standard x402 v2 header
  const paymentSig = request.headers.get('PAYMENT-SIGNATURE')
    ?? request.headers.get('payment-signature')
    ?? request.headers.get('X-PAYMENT')
    ?? request.headers.get('x-payment');

  if (!paymentSig) return null;

  try {
    return decodePaymentSignatureHeader(paymentSig);
  } catch {
    return null;
  }
}

/**
 * Encode a PaymentRequired object into the PAYMENT-REQUIRED header value.
 */
export function encodePaymentRequired(paymentRequired: PaymentRequired): string {
  return encodePaymentRequiredHeader(paymentRequired);
}

/**
 * Encode a SettleResponse into the PAYMENT-RESPONSE header value.
 */
export function encodePaymentResponse(settleResponse: SettleResponse): string {
  return encodePaymentResponseHeader(settleResponse);
}

// Re-export types for convenience
export type { PaymentPayload, PaymentRequired, PaymentRequirements, SettleResponse, VerifyResponse };
