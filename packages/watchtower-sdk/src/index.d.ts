import { type AuthorizationDecision, type AuthorizationVerification, type ExecutionAuthorization, type ExecutionAuthorizationVerificationOptions, type ExecutionPermitDomain, type WatchTowerAuthorizationPolicy } from './permit.js';
export type AuthorizationAttestation = {
    status: 'pending';
    permitHash: string;
    txHash?: null;
    chain?: string;
    reason?: string;
} | {
    status: 'confirmed';
    permitHash: string;
    txHash: string;
    chain: string;
    reason?: string;
} | {
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
export declare class WatchTowerAbortError extends Error {
    threatScore: number;
    confidence: number;
    reasoning: string[];
    scanHash: string;
    constructor(message: string, threatScore: number, confidence: number, reasoning: string[], scanHash: string);
}
export declare class WatchTowerPaymentRequiredError extends Error {
    paymentRequired: unknown;
    constructor(paymentRequired: unknown);
}
export declare class WatchTowerPaymentFundingError extends Error {
    constructor(message: string);
}
export declare class WatchTowerAuthorizationError extends Error {
    authorization?: ExecutionAuthorization | null;
    verification?: AuthorizationVerification | null;
    constructor(message: string, details?: {
        authorization?: ExecutionAuthorization | null;
        verification?: AuthorizationVerification | null;
    });
}
export declare class WatchTowerClient {
    private apiUrl;
    private agentWallet;
    private threshold;
    private chainId;
    private paymentPrivateKey;
    private paymentRpcUrl;
    private paymentPolicy;
    private authorizationPolicy;
    constructor(config: WatchTowerConfig);
    /**
     * Core Middleware Interceptor.
     * Queries WatchTower, pays x402 automatically,
     * and throws WatchTowerAbortError if the threat score exceeds the configured threshold.
     */
    guardTransaction(targetTokenAddress: string, chainIdOrOptions?: string | number | WatchTowerRequestOptions | undefined): Promise<ScanResponse['data']>;
    /**
     * @deprecated Use authorize(). Execution Authorization is the premium
     * Permission to Execute experience. This method remains as a compatibility
     * alias for existing /api/scan/deep integrations.
     */
    deepScan(targetTokenAddress: string, chainIdOrOptions?: string | number | WatchTowerRequestOptions | undefined): Promise<ExecutionAuthorizationCompatibilityResponse>;
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
    authorize(input: {
        action?: string;
        token: string;
        amountUsd?: number;
        chainId?: string | number;
        recipient?: string;
        spender?: string;
        calldata?: string;
        executionHash?: string;
        paymentSignature?: string;
    }): Promise<AuthorizationResponse>;
    /**
     * Verify an Execution Authorization signature locally.
     *
     * Uses EIP-712 typed data verification to confirm the authorization
     * was genuinely signed by the WatchTower signer.
     */
    static verifyAuthorization(authorization: ExecutionAuthorization, policy?: WatchTowerAuthorizationPolicy): Promise<AuthorizationVerification>;
    private normalizeOptions;
    private createHeaders;
    private readPaymentRequirement;
    private retryPaidRequest;
    private getPaymentRpcUrl;
    private createPaymentSignatureHeaders;
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
export type { AuthorizationDecision, AuthorizationVerification, ExecutionAuthorization, ExecutionAuthorizationVerificationOptions, ExecutionPermitDomain, WatchTowerAuthorizationPolicy, };
export { DefaultAuthorizationPolicy, WatchTowerPolicy, createExecutionHash, createPermitDigest, createPermitDomain, verifyExecutionAuthorization, verificationOptionsFromPolicy, } from './permit.js';
//# sourceMappingURL=index.d.ts.map