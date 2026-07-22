import type {
  Network as X402Network,
  PaymentRequired as X402PaymentRequired,
  PaymentRequirements as X402PaymentRequirements,
} from '@okxweb3/x402-core/types';
import {
  DefaultAuthorizationPolicy,
  verificationOptionsFromPolicy,
  verifyExecutionAuthorization,
  type AuthorizationDecision,
  type AuthorizationVerification,
  type ExecutionAuthorization,
  type ExecutionAuthorizationVerificationOptions,
  type ExecutionPermitDomain,
  type WatchTowerAuthorizationPolicy,
} from './permit.js';

const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAID_REPLAY_TIMEOUT_MS = 25_000;
const PAID_REPLAY_MAX_DURATION_MS = 90_000;
const PAID_REPLAY_MAX_ATTEMPTS = 6;

export type AuthorizationAttestation =
  | {
    status: 'pending';
    permitHash: string;
    txHash?: null;
    chain?: string;
    reason?: string;
  }
  | {
    status: 'confirmed';
    permitHash: string;
    txHash: string;
    chain: string;
    reason?: string;
  }
  | {
    status: 'failed';
    permitHash: string;
    txHash?: null;
    chain?: string;
    reason: string;
  };

export interface WatchTowerPaymentPolicy {
  /** Exact API origin that is allowed to request automatic settlement. */
  apiOrigin: string;
  /** Exact EVM chain accepted for automatic settlement. */
  chainId: number;
  /** Exact ERC-20 contract accepted for automatic settlement. */
  tokenAddress: string;
  /** Payment token decimals used to compare maxAmount against atomic x402 requirements. Default: 6. */
  tokenDecimals?: number;
  /** Exact WatchTower treasury address accepted for automatic settlement. */
  treasuryAddress: string;
  /** Per-request ceiling, expressed in the configured token's display units. */
  maxAmount: string;
}

function decodeBase64Json<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, fallbackMs: number): number {
  const header = response.headers.get('Retry-After');
  if (!header) return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 15_000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 15_000);
  return fallbackMs;
}

function isRetryablePaidResponse(response: Response): boolean {
  return response.status === 408
    || response.status === 409
    || response.status === 425
    || response.status === 429
    || response.status === 502
    || response.status === 503
    || response.status === 504;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface ScanResponse {
  success: boolean;
  data?: GuardScanData;
  error?: string;
}

export interface GuardScanData {
  tokenAddress: string;
  chainId: string;
  chainResolution: {
    chainId: string;
    chainName: string;
    confidence: string;
    source: string;
    reason: string;
    candidates: Array<{
      chainId: string;
      name: string;
      confidenceScore: number;
      signals: string[];
    }>;
  };
  threatScore: number;
  confidence: number;
  recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
  reasoning: string[];
  modules: Array<{
    name: string;
    score: number;
    maxScore: number;
    signals: string[];
    status: 'active' | 'unavailable' | 'coming_soon';
  }>;
  scanHash: string;
}

type RawScanData = Partial<GuardScanData> & {
  target?: {
    tokenAddress?: string;
    chainId?: string;
    chainResolution?: GuardScanData['chainResolution'];
  };
  verdict?: {
    threatScore?: number;
    confidence?: number;
    recommendation?: GuardScanData['recommendation'];
  };
  intelligenceModules?: GuardScanData['modules'];
  verification?: {
    scanHash?: string;
  };
};

function normalizeScanData(data: RawScanData): GuardScanData {
  const normalized = {
    tokenAddress: data.tokenAddress ?? data.target?.tokenAddress,
    chainId: data.chainId ?? data.target?.chainId,
    chainResolution: data.chainResolution ?? data.target?.chainResolution,
    threatScore: data.threatScore ?? data.verdict?.threatScore,
    confidence: data.confidence ?? data.verdict?.confidence,
    recommendation: data.recommendation ?? data.verdict?.recommendation,
    reasoning: data.reasoning,
    modules: data.modules ?? data.intelligenceModules,
    scanHash: data.scanHash ?? data.verification?.scanHash,
  };

  if (
    !normalized.tokenAddress
    || !normalized.chainId
    || !normalized.chainResolution
    || normalized.threatScore === undefined
    || normalized.confidence === undefined
    || !normalized.recommendation
    || !normalized.reasoning
    || !normalized.modules
    || !normalized.scanHash
  ) {
    throw new Error('WatchTower API returned an incomplete scan response.');
  }

  return normalized as GuardScanData;
}

export interface WatchTowerConfig {
  /** WatchTower API base URL */
  apiUrl: string;
  /** The calling agent's wallet address (for reputation tracking) */
  agentWallet: string;
  /** Custom threat score threshold (0-100). Scores above this trigger ABORT. Default: 70 */
  threshold?: number;
  /** Optional default EVM chain id override. If omitted, WatchTower auto-detects the chain. */
  chainId?: string | number;
  /** Optional agent payment private key. Enables automatic x402 PAYMENT-SIGNATURE creation on 402 challenges. */
  paymentPrivateKey?: `0x${string}` | string;
  /** Optional payment RPC override. Defaults to X Layer RPC for known WatchTower payment chains. */
  paymentRpcUrl?: string;
  /** Required when paymentPrivateKey is supplied so automatic settlement is pinned to a trusted policy. */
  paymentPolicy?: WatchTowerPaymentPolicy;
  /** Advanced: override the default WatchTower Mainnet permit trust policy for enterprise/self-hosted deployments. */
  authorizationPolicy?: WatchTowerAuthorizationPolicy;
}

export interface WatchTowerRequestOptions {
  chainId?: string | number;
  paymentSignature?: string;
}

export class WatchTowerAbortError extends Error {
  public threatScore: number;
  public confidence: number;
  public reasoning: string[];
  public scanHash: string;

  constructor(message: string, threatScore: number, confidence: number, reasoning: string[], scanHash: string) {
    super(message);
    this.name = 'WatchTowerAbortError';
    this.threatScore = threatScore;
    this.confidence = confidence;
    this.reasoning = reasoning;
    this.scanHash = scanHash;
  }
}

export class WatchTowerPaymentRequiredError extends Error {
  public paymentRequired: unknown;

  constructor(paymentRequired: unknown) {
    super(
      'WatchTower payment required. Configure paymentPrivateKey and paymentPolicy to sign the x402 PAYMENT-SIGNATURE automatically, or create the signature externally and retry with paymentSignature.',
    );
    this.name = 'WatchTowerPaymentRequiredError';
    this.paymentRequired = paymentRequired;
  }
}

export class WatchTowerPaymentFundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WatchTowerPaymentFundingError';
  }
}

export class WatchTowerAuthorizationError extends Error {
  public authorization?: ExecutionAuthorization | null;
  public verification?: AuthorizationVerification | null;

  constructor(message: string, details?: {
    authorization?: ExecutionAuthorization | null;
    verification?: AuthorizationVerification | null;
  }) {
    super(message);
    this.name = 'WatchTowerAuthorizationError';
    this.authorization = details?.authorization ?? null;
    this.verification = details?.verification ?? null;
  }
}

export class WatchTowerClient {
  private apiUrl: string;
  private agentWallet: string;
  private threshold: number;
  private chainId: string | undefined;
  private paymentPrivateKey: string | undefined;
  private paymentRpcUrl: string | undefined;
  private paymentPolicy: WatchTowerPaymentPolicy | undefined;
  private authorizationPolicy: WatchTowerAuthorizationPolicy;

  constructor(config: WatchTowerConfig) {
    this.apiUrl = config.apiUrl;
    this.agentWallet = config.agentWallet;
    this.threshold = config.threshold ?? 70;
    this.chainId = config.chainId === undefined ? undefined : String(config.chainId);
    this.paymentPrivateKey = config.paymentPrivateKey;
    this.paymentRpcUrl = config.paymentRpcUrl;
    this.paymentPolicy = config.paymentPolicy;
    this.authorizationPolicy = config.authorizationPolicy ?? DefaultAuthorizationPolicy;

    if (this.paymentPrivateKey && !this.paymentPolicy) {
      throw new Error('paymentPolicy is required when paymentPrivateKey enables automatic settlement.');
    }
  }

  /**
   * Core Middleware Interceptor.
   * Queries WatchTower, pays x402 automatically,
   * and throws WatchTowerAbortError if the threat score exceeds the configured threshold.
   */
  async guardTransaction(
    targetTokenAddress: string,
    chainIdOrOptions: string | number | WatchTowerRequestOptions | undefined = this.chainId,
  ): Promise<ScanResponse['data']> {
    const options = this.normalizeOptions(chainIdOrOptions);
    const payload: {
      tokenAddress: string;
      agentWallet: string;
      chainId?: string;
    } = {
      tokenAddress: targetTokenAddress,
      agentWallet: this.agentWallet,
    };
    if (options.chainId) payload.chainId = options.chainId;

    const headers = this.createHeaders(options.paymentSignature);

    let res = await fetch(`${this.apiUrl}/api/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 402) {
      const requirement = await this.readPaymentRequirement(res);
      const paymentHeaders = await this.createPaymentSignatureHeaders(requirement);
      res = await this.retryPaidRequest('/api/scan', payload, paymentHeaders);
    }

    if (!res.ok) {
      throw new Error(`WatchTower API error: ${res.statusText}`);
    }

    const { data, success, error } = (await res.json()) as { success: boolean; data?: RawScanData; error?: string };

    if (!success || !data) {
      throw new Error(error || 'Failed to scan token');
    }
    const normalizedData = normalizeScanData(data);

    // Configurable Kill Switch — use client-side threshold, not just server recommendation
    if (normalizedData.threatScore > this.threshold) {
      throw new WatchTowerAbortError(
        `WatchTower blocked execution on ${targetTokenAddress} (score ${normalizedData.threatScore} > threshold ${this.threshold}). Reasons: ${normalizedData.reasoning.join(', ')}`,
        normalizedData.threatScore,
        normalizedData.confidence,
        normalizedData.reasoning,
        normalizedData.scanHash,
      );
    }

    return normalizedData;
  }

  /**
   * @deprecated Use authorize(). Execution Authorization is the premium
   * Permission to Execute experience. This method remains as a compatibility
   * alias for existing /api/scan/deep integrations.
   */
  async deepScan(
    targetTokenAddress: string,
    chainIdOrOptions: string | number | WatchTowerRequestOptions | undefined = this.chainId,
  ): Promise<ExecutionAuthorizationCompatibilityResponse> {
    const options = this.normalizeOptions(chainIdOrOptions);
    const payload: {
      tokenAddress: string;
      agentWallet: string;
      chainId?: string;
    } = {
      tokenAddress: targetTokenAddress,
      agentWallet: this.agentWallet,
    };
    if (options.chainId) payload.chainId = options.chainId;

    const headers = this.createHeaders(options.paymentSignature);

    let res = await fetch(`${this.apiUrl}/api/scan/deep`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 402) {
      const requirement = await this.readPaymentRequirement(res);
      const paymentHeaders = await this.createPaymentSignatureHeaders(requirement);
      res = await this.retryPaidRequest('/api/scan/deep', payload, paymentHeaders);
    }

    if (!res.ok) {
      throw new Error(`WatchTower API error: ${res.statusText}`);
    }

    const { data, success, error } = await res.json();

    if (!success || !data) {
      throw new Error(error || 'Failed to run Execution Authorization compatibility report');
    }

    return data as ExecutionAuthorizationCompatibilityResponse;
  }

  /**
   * Execution Authorization — the evolution.
   *
   * Evaluates a proposed transaction through the full WatchTower threat analysis
   * pipeline and returns a cryptographically signed Execution Authorization.
   *
   * Unlike guardTransaction(), this does NOT throw on DENIED — the caller decides.
   * The SDK verifies the EIP-712 signature locally before returning. When
   * executable is true, the Execution Permit is already valid; X Layer
   * attestation is informational audit metadata and may still be pending.
   *
   * Every autonomous action now carries a cryptographically verifiable
   * execution authorization.
   */
  async authorize(input: {
    action?: string;
    token: string;
    amountUsd?: number;
    chainId?: string | number;
    recipient?: string;
    spender?: string;
    calldata?: string;
    executionHash?: string;
    paymentSignature?: string;
  }): Promise<AuthorizationResponse> {
    const authOptions: WatchTowerRequestOptions = {};
    if (input.chainId !== undefined) authOptions.chainId = input.chainId;
    if (input.paymentSignature !== undefined) authOptions.paymentSignature = input.paymentSignature;
    const options = this.normalizeOptions(
      Object.keys(authOptions).length > 0 ? authOptions : this.chainId,
    );

    const payload: Record<string, unknown> = {
      tokenAddress: input.token,
      agentWallet: this.agentWallet,
      action: input.action || 'transaction',
    };
    if (options.chainId) payload.chainId = options.chainId;
    if (input.amountUsd !== undefined) payload.amountUsd = input.amountUsd;
    if (input.recipient !== undefined) payload.recipient = input.recipient;
    if (input.spender !== undefined) payload.spender = input.spender;
    if (input.calldata !== undefined) payload.calldata = input.calldata;
    if (input.executionHash !== undefined) payload.executionHash = input.executionHash;

    const headers = this.createHeaders(options.paymentSignature);

    let res = await fetch(`${this.apiUrl}/api/authorize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.status === 402) {
      const requirement = await this.readPaymentRequirement(res);
      const paymentHeaders = await this.createPaymentSignatureHeaders(requirement);
      res = await this.retryPaidRequest('/api/authorize', payload, paymentHeaders);
    }

    if (!res.ok) {
      throw new Error(`WatchTower API error: ${res.statusText}`);
    }

    const { data, success, error } = await res.json();
    if (!success || !data) {
      throw new Error(error || 'Failed to run authorization');
    }

    const result = data as AuthorizationResponse;

    if (result.decision !== 'AUTHORIZED' || result.verdict !== 'EXECUTE') {
      return { ...result, executable: false };
    }

    if (!result.authorization) {
      throw new WatchTowerAuthorizationError('WatchTower returned AUTHORIZED without an Execution Permit.', {
        authorization: null,
        verification: result.verification ?? null,
      });
    }

    const verification = await WatchTowerClient.verifyAuthorization(result.authorization, this.authorizationPolicy);
    result.verification = verification;
    if (!verification.authorized) {
      throw new WatchTowerAuthorizationError(
        `WatchTower Execution Permit verification failed: ${verification.reason ?? 'invalid permit'}`,
        { authorization: result.authorization, verification },
      );
    }

    return { ...result, verification, executable: true };
  }

  /**
   * Verify an Execution Authorization signature locally.
   *
   * Uses EIP-712 typed data verification to confirm the authorization
   * was genuinely signed by the WatchTower signer.
   */
  static async verifyAuthorization(
    authorization: ExecutionAuthorization,
    policy: WatchTowerAuthorizationPolicy = DefaultAuthorizationPolicy,
  ): Promise<AuthorizationVerification> {
    return verifyExecutionAuthorization(authorization, verificationOptionsFromPolicy(policy));
  }

  private normalizeOptions(
    chainIdOrOptions: string | number | WatchTowerRequestOptions | undefined,
  ): { chainId?: string; paymentSignature?: string } {
    const normalized: { chainId?: string; paymentSignature?: string } = {};

    if (typeof chainIdOrOptions === 'object' && chainIdOrOptions !== null) {
      const chainId = chainIdOrOptions.chainId === undefined ? this.chainId : String(chainIdOrOptions.chainId);
      if (chainId !== undefined) normalized.chainId = chainId;
      if (chainIdOrOptions.paymentSignature !== undefined) normalized.paymentSignature = chainIdOrOptions.paymentSignature;
      return normalized;
    }

    if (chainIdOrOptions !== undefined) normalized.chainId = String(chainIdOrOptions);
    return normalized;
  }

  private createHeaders(paymentSignature?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (paymentSignature) headers['PAYMENT-SIGNATURE'] = paymentSignature;
    return headers;
  }

  private async readPaymentRequirement(res: Response): Promise<X402PaymentRequired> {
    const header = res.headers.get(PAYMENT_REQUIRED_HEADER);
    if (header) {
      const requirement = decodeBase64Json<X402PaymentRequired>(header);
      if (requirement) return requirement;
    }

    const body = await res.json().catch(() => null) as { paymentRequired?: X402PaymentRequired } | null;
    if (body?.paymentRequired) return body.paymentRequired;
    throw new Error('WatchTower payment challenge did not include a PAYMENT-REQUIRED requirement.');
  }

  private async retryPaidRequest(
    path: '/api/scan' | '/api/scan/deep' | '/api/authorize',
    payload: unknown,
    paymentHeaders: Record<string, string>,
  ): Promise<Response> {
    const startedAt = Date.now();
    let attempt = 0;
    let lastError: unknown;

    while (attempt < PAID_REPLAY_MAX_ATTEMPTS && Date.now() - startedAt < PAID_REPLAY_MAX_DURATION_MS) {
      attempt += 1;
      try {
        const response = await fetchWithTimeout(`${this.apiUrl}${path}`, {
          method: 'POST',
          headers: { ...this.createHeaders(), ...paymentHeaders },
          body: JSON.stringify(payload),
        }, PAID_REPLAY_TIMEOUT_MS);

        if (!isRetryablePaidResponse(response)) return response;

        const waitMs = retryAfterMs(response, Math.min(1000 * attempt, 5000));
        if (Date.now() - startedAt + waitMs >= PAID_REPLAY_MAX_DURATION_MS || attempt >= PAID_REPLAY_MAX_ATTEMPTS) {
          return response;
        }
        await delay(waitMs);
      } catch (error) {
        lastError = error;
        const waitMs = Math.min(1000 * attempt, 5000);
        if (Date.now() - startedAt + waitMs >= PAID_REPLAY_MAX_DURATION_MS || attempt >= PAID_REPLAY_MAX_ATTEMPTS) {
          break;
        }
        await delay(waitMs);
      }
    }

    throw new Error(
      `WatchTower paid request did not complete after retrying with the same signed payment. Retry the same request shortly. Last error: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
    );
  }

  private getPaymentRpcUrl(chainId: number): string {
    if (this.paymentRpcUrl) return this.paymentRpcUrl;
    if (chainId === 196) return 'https://rpc.xlayer.tech';
    if (chainId === 1952) return 'https://testrpc.xlayer.tech';
    throw new Error(`No payment RPC configured for chain ${chainId}. Pass paymentRpcUrl to WatchTowerClient.`);
  }

  private async createPaymentSignatureHeaders(paymentRequired: X402PaymentRequired): Promise<Record<string, string>> {
    if (!this.paymentPrivateKey) {
      throw new WatchTowerPaymentRequiredError(paymentRequired);
    }

    const [
      { x402Client, x402HTTPClient },
      { registerExactEvmScheme },
      { toClientEvmSigner },
      { createPublicClient, defineChain, http, parseUnits },
      { privateKeyToAccount },
    ] = await Promise.all([
      import('@okxweb3/x402-core/client'),
      import('@okxweb3/x402-evm/exact/client'),
      import('@okxweb3/x402-evm'),
      import('viem'),
      import('viem/accounts'),
    ]);

    const policy = this.paymentPolicy;
    if (!policy) throw new Error('Automatic settlement requires a paymentPolicy.');
    if (new URL(this.apiUrl).origin !== new URL(policy.apiOrigin).origin) {
      throw new Error('WatchTower API origin does not match the configured payment policy.');
    }
    const network = `eip155:${policy.chainId}` as X402Network;
    const rpcUrl = this.getPaymentRpcUrl(policy.chainId);
    const chain = defineChain({
      id: policy.chainId,
      name: policy.chainId === 196 ? 'X Layer Mainnet' : 'X Layer',
      nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });
    const privateKey = this.paymentPrivateKey.startsWith('0x')
      ? this.paymentPrivateKey as `0x${string}`
      : `0x${this.paymentPrivateKey}` as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const signer = toClientEvmSigner(account, publicClient);
    const maxAtomicAmount = parseUnits(policy.maxAmount, policy.tokenDecimals ?? 6);

    const client = new x402Client();
    registerExactEvmScheme(client, {
      signer,
      networks: [network],
      schemeOptions: { [policy.chainId]: { rpcUrl } },
    });
    client.registerPolicy((_version: number, requirements: X402PaymentRequirements[]) => requirements.filter((requirement) => {
      if (requirement.scheme !== 'exact') return false;
      if (requirement.network !== network) return false;
      if (requirement.asset.toLowerCase() !== policy.tokenAddress.toLowerCase()) return false;
      if (requirement.payTo.toLowerCase() !== policy.treasuryAddress.toLowerCase()) return false;
      return BigInt(requirement.amount) <= maxAtomicAmount;
    }));

    const httpClient = new x402HTTPClient(client);
    const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    return httpClient.encodePaymentSignatureHeader(paymentPayload);
  }
}

export interface ExecutionAuthorizationCompatibilityResponse {
  reportType: string;
  tier: string;
  price: string;
  generatedAt: string;
  target: {
    tokenAddress: string;
    chainId: string;
    chainResolution: {
      chainId: string;
      chainName: string;
      confidence: string;
      source: string;
      reason: string;
      candidates: Array<{
        chainId: string;
        name: string;
        confidenceScore: number;
        signals: string[];
      }>;
    };
  };
  verdict: {
    threatScore: number;
    confidence: number;
    recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
    summary: string;
  };
  intelligenceModules: Array<{
    name: string;
    score: number;
    maxScore: number;
    signals: string[];
    status: 'active' | 'unavailable' | 'coming_soon';
  }>;
  reasoning: string[];
  verification: {
    scanHash: string;
    txHash: string | null;
    registryContract: string;
    chain: string;
    status: string;
  };
  recommendations: string[];
}

/** @deprecated Use ExecutionAuthorizationCompatibilityResponse. */
export type DeepScanResponse = ExecutionAuthorizationCompatibilityResponse;

// ---------------------------------------------------------------------------
// Execution Authorization Types
// ---------------------------------------------------------------------------

export interface AuthorizationResponse {
  decision: AuthorizationDecision;
  verdict: 'EXECUTE' | 'REVIEW' | 'ABORT';
  riskScore: number;
  confidence: number;
  reasoning: string[];
  authorization: ExecutionAuthorization | null;
  attestation: {
    status?: 'pending' | 'confirmed' | 'failed';
    permitHash: string;
    txHash?: string | null;
    chain?: string;
    reason?: string;
  } | null;
  /** Populated by the SDK after client-side signature verification */
  verification?: AuthorizationVerification;
  /** True only when WatchTower returned AUTHORIZED and the permit verified locally. Does not depend on attestation status. */
  executable?: boolean;
  scan?: {
    /** Threat-analysis content hash. Preserved as scanHash for backward compatibility. */
    analysisHash?: string;
    /** @deprecated Use analysisHash for threat-analysis content, or reportHash for the public report URL key. */
    scanHash: string;
    /** Hash used by /report/[hash]. For authorized permits this is usually the permitHash. */
    reportHash?: string;
    /** Execution Permit hash, when a permit was issued. */
    permitHash?: string | null;
    reportUrl: string;
  };
}

export type {
  AuthorizationDecision,
  AuthorizationVerification,
  ExecutionAuthorization,
  ExecutionAuthorizationVerificationOptions,
  ExecutionPermitDomain,
  WatchTowerAuthorizationPolicy,
};
export {
  DefaultAuthorizationPolicy,
  WatchTowerPolicy,
  createExecutionHash,
  createPermitDigest,
  createPermitDomain,
  verifyExecutionAuthorization,
  verificationOptionsFromPolicy,
} from './permit.js';
