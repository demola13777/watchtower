interface Web3PaymentRequirement {
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
    instructions: string;
}
export interface ScanResponse {
    success: boolean;
    data?: {
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
    };
    error?: string;
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
    /** Optional settlement transaction hash to send as Authorization: L402 <tx_hash>. */
    paymentTxHash?: string;
    /** Optional agent payment private key. Enables automatic ERC-20 x402 settlement on 402 challenges. */
    paymentPrivateKey?: `0x${string}` | string;
    /** Optional payment RPC override. Defaults to X Layer RPC for known WatchTower payment chains. */
    paymentRpcUrl?: string;
}
export interface WatchTowerRequestOptions {
    chainId?: string | number;
    paymentTxHash?: string;
}
export declare class WatchTowerAbortError extends Error {
    threatScore: number;
    confidence: number;
    reasoning: string[];
    scanHash: string;
    constructor(message: string, threatScore: number, confidence: number, reasoning: string[], scanHash: string);
}
export declare class WatchTowerPaymentRequiredError extends Error {
    requirement: Web3PaymentRequirement;
    constructor(requirement: Web3PaymentRequirement);
}
export declare class WatchTowerPaymentFundingError extends Error {
    constructor(message: string);
}
export declare class WatchTowerClient {
    private apiUrl;
    private agentWallet;
    private threshold;
    private chainId;
    private paymentTxHash;
    private paymentPrivateKey;
    private paymentRpcUrl;
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
    private getPaymentRpcUrl;
    private settlePayment;
}
export interface DeepScanResponse {
    reportType: string;
    tier: string;
    price: string;
    generatedAt: string;
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
    tokenAddress: string;
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
export {};
//# sourceMappingURL=index.d.ts.map