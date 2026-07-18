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
export declare class WatchTowerClient {
    private apiUrl;
    private agentWallet;
    private threshold;
    private chainId;
    private paymentPrivateKey;
    private paymentRpcUrl;
    private paymentPolicy;
    constructor(config: WatchTowerConfig);
    /**
     * Core Middleware Interceptor.
     * Queries WatchTower, pays x402 automatically,
     * and throws WatchTowerAbortError if the threat score exceeds the configured threshold.
     */
    guardTransaction(targetTokenAddress: string, chainIdOrOptions?: string | number | WatchTowerRequestOptions | undefined): Promise<ScanResponse['data']>;
    /**
     * Deep Scan — Tier 1 (1 USDT)
     * Returns a comprehensive threat report with on-chain attestation.
     * Unlike guardTransaction(), this does NOT throw on high threat scores.
     */
    deepScan(targetTokenAddress: string, chainIdOrOptions?: string | number | WatchTowerRequestOptions | undefined): Promise<DeepScanResponse>;
    private normalizeOptions;
    private createHeaders;
    private readPaymentRequirement;
    private retryPaidRequest;
    private getPaymentRpcUrl;
    private createPaymentSignatureHeaders;
}
export interface DeepScanResponse {
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
//# sourceMappingURL=index.d.ts.map