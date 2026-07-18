"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchTowerClient = exports.WatchTowerPaymentFundingError = exports.WatchTowerPaymentRequiredError = exports.WatchTowerAbortError = void 0;
const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAID_REPLAY_TIMEOUT_MS = 25_000;
const PAID_REPLAY_MAX_DURATION_MS = 90_000;
const PAID_REPLAY_MAX_ATTEMPTS = 6;
function decodeBase64Json(value) {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    }
    catch {
        return null;
    }
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function retryAfterMs(response, fallbackMs) {
    const header = response.headers.get('Retry-After');
    if (!header)
        return fallbackMs;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0)
        return Math.min(seconds * 1000, 15_000);
    const date = Date.parse(header);
    if (Number.isFinite(date))
        return Math.min(Math.max(date - Date.now(), 0), 15_000);
    return fallbackMs;
}
function isRetryablePaidResponse(response) {
    return response.status === 408
        || response.status === 409
        || response.status === 425
        || response.status === 429
        || response.status === 502
        || response.status === 503
        || response.status === 504;
}
async function fetchWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timeout);
    }
}
function normalizeScanData(data) {
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
    if (!normalized.tokenAddress
        || !normalized.chainId
        || !normalized.chainResolution
        || normalized.threatScore === undefined
        || normalized.confidence === undefined
        || !normalized.recommendation
        || !normalized.reasoning
        || !normalized.modules
        || !normalized.scanHash) {
        throw new Error('WatchTower API returned an incomplete scan response.');
    }
    return normalized;
}
class WatchTowerAbortError extends Error {
    threatScore;
    confidence;
    reasoning;
    scanHash;
    constructor(message, threatScore, confidence, reasoning, scanHash) {
        super(message);
        this.name = 'WatchTowerAbortError';
        this.threatScore = threatScore;
        this.confidence = confidence;
        this.reasoning = reasoning;
        this.scanHash = scanHash;
    }
}
exports.WatchTowerAbortError = WatchTowerAbortError;
class WatchTowerPaymentRequiredError extends Error {
    paymentRequired;
    constructor(paymentRequired) {
        super('WatchTower payment required. Configure paymentPrivateKey and paymentPolicy to sign the x402 PAYMENT-SIGNATURE automatically, or create the signature externally and retry with paymentSignature.');
        this.name = 'WatchTowerPaymentRequiredError';
        this.paymentRequired = paymentRequired;
    }
}
exports.WatchTowerPaymentRequiredError = WatchTowerPaymentRequiredError;
class WatchTowerPaymentFundingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WatchTowerPaymentFundingError';
    }
}
exports.WatchTowerPaymentFundingError = WatchTowerPaymentFundingError;
class WatchTowerClient {
    apiUrl;
    agentWallet;
    threshold;
    chainId;
    paymentPrivateKey;
    paymentRpcUrl;
    paymentPolicy;
    constructor(config) {
        this.apiUrl = config.apiUrl;
        this.agentWallet = config.agentWallet;
        this.threshold = config.threshold ?? 70;
        this.chainId = config.chainId === undefined ? undefined : String(config.chainId);
        this.paymentPrivateKey = config.paymentPrivateKey;
        this.paymentRpcUrl = config.paymentRpcUrl;
        this.paymentPolicy = config.paymentPolicy;
        if (this.paymentPrivateKey && !this.paymentPolicy) {
            throw new Error('paymentPolicy is required when paymentPrivateKey enables automatic settlement.');
        }
    }
    /**
     * Core Middleware Interceptor.
     * Queries WatchTower, pays x402 automatically,
     * and throws WatchTowerAbortError if the threat score exceeds the configured threshold.
     */
    async guardTransaction(targetTokenAddress, chainIdOrOptions = this.chainId) {
        const options = this.normalizeOptions(chainIdOrOptions);
        const payload = {
            tokenAddress: targetTokenAddress,
            agentWallet: this.agentWallet,
        };
        if (options.chainId)
            payload.chainId = options.chainId;
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
        const { data, success, error } = (await res.json());
        if (!success || !data) {
            throw new Error(error || 'Failed to scan token');
        }
        const normalizedData = normalizeScanData(data);
        // Configurable Kill Switch — use client-side threshold, not just server recommendation
        if (normalizedData.threatScore > this.threshold) {
            throw new WatchTowerAbortError(`WatchTower blocked execution on ${targetTokenAddress} (score ${normalizedData.threatScore} > threshold ${this.threshold}). Reasons: ${normalizedData.reasoning.join(', ')}`, normalizedData.threatScore, normalizedData.confidence, normalizedData.reasoning, normalizedData.scanHash);
        }
        return normalizedData;
    }
    /**
     * Deep Scan — Tier 1 (1 USDT)
     * Returns a comprehensive threat report with on-chain attestation.
     * Unlike guardTransaction(), this does NOT throw on high threat scores.
     */
    async deepScan(targetTokenAddress, chainIdOrOptions = this.chainId) {
        const options = this.normalizeOptions(chainIdOrOptions);
        const payload = {
            tokenAddress: targetTokenAddress,
            agentWallet: this.agentWallet,
        };
        if (options.chainId)
            payload.chainId = options.chainId;
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
            throw new Error(error || 'Failed to run deep scan');
        }
        return data;
    }
    normalizeOptions(chainIdOrOptions) {
        const normalized = {};
        if (typeof chainIdOrOptions === 'object' && chainIdOrOptions !== null) {
            const chainId = chainIdOrOptions.chainId === undefined ? this.chainId : String(chainIdOrOptions.chainId);
            if (chainId !== undefined)
                normalized.chainId = chainId;
            if (chainIdOrOptions.paymentSignature !== undefined)
                normalized.paymentSignature = chainIdOrOptions.paymentSignature;
            return normalized;
        }
        if (chainIdOrOptions !== undefined)
            normalized.chainId = String(chainIdOrOptions);
        return normalized;
    }
    createHeaders(paymentSignature) {
        const headers = { 'Content-Type': 'application/json' };
        if (paymentSignature)
            headers['PAYMENT-SIGNATURE'] = paymentSignature;
        return headers;
    }
    async readPaymentRequirement(res) {
        const header = res.headers.get(PAYMENT_REQUIRED_HEADER);
        if (header) {
            const requirement = decodeBase64Json(header);
            if (requirement)
                return requirement;
        }
        const body = await res.json().catch(() => null);
        if (body?.paymentRequired)
            return body.paymentRequired;
        throw new Error('WatchTower payment challenge did not include a PAYMENT-REQUIRED requirement.');
    }
    async retryPaidRequest(path, payload, paymentHeaders) {
        const startedAt = Date.now();
        let attempt = 0;
        let lastError;
        while (attempt < PAID_REPLAY_MAX_ATTEMPTS && Date.now() - startedAt < PAID_REPLAY_MAX_DURATION_MS) {
            attempt += 1;
            try {
                const response = await fetchWithTimeout(`${this.apiUrl}${path}`, {
                    method: 'POST',
                    headers: { ...this.createHeaders(), ...paymentHeaders },
                    body: JSON.stringify(payload),
                }, PAID_REPLAY_TIMEOUT_MS);
                if (!isRetryablePaidResponse(response))
                    return response;
                const waitMs = retryAfterMs(response, Math.min(1000 * attempt, 5000));
                if (Date.now() - startedAt + waitMs >= PAID_REPLAY_MAX_DURATION_MS || attempt >= PAID_REPLAY_MAX_ATTEMPTS) {
                    return response;
                }
                await delay(waitMs);
            }
            catch (error) {
                lastError = error;
                const waitMs = Math.min(1000 * attempt, 5000);
                if (Date.now() - startedAt + waitMs >= PAID_REPLAY_MAX_DURATION_MS || attempt >= PAID_REPLAY_MAX_ATTEMPTS) {
                    break;
                }
                await delay(waitMs);
            }
        }
        throw new Error(`WatchTower paid request did not complete after retrying with the same signed payment. Retry the same request shortly. Last error: ${lastError instanceof Error ? lastError.message : 'unknown'}`);
    }
    getPaymentRpcUrl(chainId) {
        if (this.paymentRpcUrl)
            return this.paymentRpcUrl;
        if (chainId === 196)
            return 'https://rpc.xlayer.tech';
        if (chainId === 1952)
            return 'https://testrpc.xlayer.tech';
        throw new Error(`No payment RPC configured for chain ${chainId}. Pass paymentRpcUrl to WatchTowerClient.`);
    }
    async createPaymentSignatureHeaders(paymentRequired) {
        if (!this.paymentPrivateKey) {
            throw new WatchTowerPaymentRequiredError(paymentRequired);
        }
        const [{ x402Client, x402HTTPClient }, { registerExactEvmScheme }, { toClientEvmSigner }, { createPublicClient, defineChain, http, parseUnits }, { privateKeyToAccount },] = await Promise.all([
            import('@okxweb3/x402-core/client'),
            import('@okxweb3/x402-evm/exact/client'),
            import('@okxweb3/x402-evm'),
            import('viem'),
            import('viem/accounts'),
        ]);
        const policy = this.paymentPolicy;
        if (!policy)
            throw new Error('Automatic settlement requires a paymentPolicy.');
        if (new URL(this.apiUrl).origin !== new URL(policy.apiOrigin).origin) {
            throw new Error('WatchTower API origin does not match the configured payment policy.');
        }
        const network = `eip155:${policy.chainId}`;
        const rpcUrl = this.getPaymentRpcUrl(policy.chainId);
        const chain = defineChain({
            id: policy.chainId,
            name: policy.chainId === 196 ? 'X Layer Mainnet' : 'X Layer',
            nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
            rpcUrls: { default: { http: [rpcUrl] } },
        });
        const privateKey = this.paymentPrivateKey.startsWith('0x')
            ? this.paymentPrivateKey
            : `0x${this.paymentPrivateKey}`;
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
        client.registerPolicy((_version, requirements) => requirements.filter((requirement) => {
            if (requirement.scheme !== 'exact')
                return false;
            if (requirement.network !== network)
                return false;
            if (requirement.asset.toLowerCase() !== policy.tokenAddress.toLowerCase())
                return false;
            if (requirement.payTo.toLowerCase() !== policy.treasuryAddress.toLowerCase())
                return false;
            return BigInt(requirement.amount) <= maxAtomicAmount;
        }));
        const httpClient = new x402HTTPClient(client);
        const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
        return httpClient.encodePaymentSignatureHeader(paymentPayload);
    }
}
exports.WatchTowerClient = WatchTowerClient;
//# sourceMappingURL=index.js.map