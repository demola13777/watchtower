"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchTowerClient = exports.WatchTowerPaymentFundingError = exports.WatchTowerPaymentRequiredError = exports.WatchTowerAbortError = void 0;
const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAYMENT_ID_HEADER = 'X-WatchTower-Payment-Id';
function decodeBase64Json(value) {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    }
    catch {
        return null;
    }
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
    requirement;
    constructor(requirement) {
        super(`WatchTower payment required: transfer ${requirement.amount} ${requirement.currency} to ${requirement.payTo} on chain ${requirement.chainId}, then retry with Authorization: L402 <tx_hash>.`);
        this.name = 'WatchTowerPaymentRequiredError';
        this.requirement = requirement;
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
    paymentTxHash;
    paymentPrivateKey;
    paymentRpcUrl;
    paymentPolicy;
    constructor(config) {
        this.apiUrl = config.apiUrl;
        this.agentWallet = config.agentWallet;
        this.threshold = config.threshold ?? 70;
        this.chainId = config.chainId === undefined ? undefined : String(config.chainId);
        this.paymentTxHash = config.paymentTxHash;
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
        const headers = this.createHeaders(options.paymentTxHash, options.paymentId);
        let res = await fetch(`${this.apiUrl}/api/scan`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        if (res.status === 402) {
            const requirement = await this.readPaymentRequirement(res);
            const txHash = await this.settlePayment(requirement);
            res = await fetch(`${this.apiUrl}/api/scan`, {
                method: 'POST',
                headers: this.createHeaders(txHash, requirement.paymentId),
                body: JSON.stringify(payload),
            });
        }
        if (!res.ok) {
            throw new Error(`WatchTower API error: ${res.statusText}`);
        }
        const { data, success, error } = (await res.json());
        if (!success || !data) {
            throw new Error(error || 'Failed to scan token');
        }
        // A settlement hash authorizes exactly one request. Never carry it into a
        // later scan made by the same long-lived client instance.
        this.paymentTxHash = undefined;
        // Configurable Kill Switch — use client-side threshold, not just server recommendation
        if (data.threatScore > this.threshold) {
            throw new WatchTowerAbortError(`WatchTower blocked execution on ${targetTokenAddress} (score ${data.threatScore} > threshold ${this.threshold}). Reasons: ${data.reasoning.join(', ')}`, data.threatScore, data.confidence, data.reasoning, data.scanHash);
        }
        return data;
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
        const headers = this.createHeaders(options.paymentTxHash, options.paymentId);
        let res = await fetch(`${this.apiUrl}/api/scan/deep`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        if (res.status === 402) {
            const requirement = await this.readPaymentRequirement(res);
            const txHash = await this.settlePayment(requirement);
            res = await fetch(`${this.apiUrl}/api/scan/deep`, {
                method: 'POST',
                headers: this.createHeaders(txHash, requirement.paymentId),
                body: JSON.stringify(payload),
            });
        }
        if (!res.ok) {
            throw new Error(`WatchTower API error: ${res.statusText}`);
        }
        const { data, success, error } = await res.json();
        if (!success || !data) {
            throw new Error(error || 'Failed to run deep scan');
        }
        this.paymentTxHash = undefined;
        return data;
    }
    normalizeOptions(chainIdOrOptions) {
        const normalized = {};
        if (typeof chainIdOrOptions === 'object' && chainIdOrOptions !== null) {
            const chainId = chainIdOrOptions.chainId === undefined ? this.chainId : String(chainIdOrOptions.chainId);
            const paymentTxHash = chainIdOrOptions.paymentTxHash ?? this.paymentTxHash;
            const paymentId = chainIdOrOptions.paymentId;
            if (chainId !== undefined)
                normalized.chainId = chainId;
            if (paymentTxHash !== undefined)
                normalized.paymentTxHash = paymentTxHash;
            if (paymentId !== undefined)
                normalized.paymentId = paymentId;
            return normalized;
        }
        if (chainIdOrOptions !== undefined)
            normalized.chainId = String(chainIdOrOptions);
        if (this.paymentTxHash !== undefined)
            normalized.paymentTxHash = this.paymentTxHash;
        return normalized;
    }
    createHeaders(paymentTxHash, paymentId) {
        const headers = { 'Content-Type': 'application/json' };
        if (paymentTxHash) {
            headers.Authorization = `L402 ${paymentTxHash}`;
        }
        if (paymentId)
            headers[PAYMENT_ID_HEADER] = paymentId;
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
    getPaymentRpcUrl(requirement) {
        if (this.paymentRpcUrl)
            return this.paymentRpcUrl;
        if (requirement.chainId === 196)
            return 'https://rpc.xlayer.tech';
        if (requirement.chainId === 1952)
            return 'https://testrpc.xlayer.tech';
        throw new Error(`No payment RPC configured for chain ${requirement.chainId}. Pass paymentRpcUrl to WatchTowerClient.`);
    }
    async settlePayment(requirement) {
        if (!this.paymentPrivateKey) {
            throw new WatchTowerPaymentRequiredError(requirement);
        }
        const [{ createPublicClient, createWalletClient, defineChain, formatUnits, http, parseUnits }, { privateKeyToAccount }] = await Promise.all([
            import('viem'),
            import('viem/accounts'),
        ]);
        const policy = this.paymentPolicy;
        if (!policy)
            throw new Error('Automatic settlement requires a paymentPolicy.');
        if (new URL(this.apiUrl).origin !== new URL(policy.apiOrigin).origin) {
            throw new Error('WatchTower API origin does not match the configured payment policy.');
        }
        if (requirement.scheme !== 'evm-erc20-transfer' || requirement.chainId !== policy.chainId) {
            throw new Error('Payment challenge does not match the configured chain or scheme.');
        }
        if (requirement.tokenAddress.toLowerCase() !== policy.tokenAddress.toLowerCase()) {
            throw new Error('Payment challenge token does not match the configured payment policy.');
        }
        if (requirement.payTo.toLowerCase() !== policy.treasuryAddress.toLowerCase()) {
            throw new Error('Payment challenge treasury does not match the configured payment policy.');
        }
        if (!requirement.paymentId) {
            throw new Error('Payment challenge is missing a request-bound payment id.');
        }
        const maxAmount = parseUnits(policy.maxAmount, requirement.tokenDecimals);
        const requestedAmount = parseUnits(requirement.amount, requirement.tokenDecimals);
        if (requestedAmount > maxAmount) {
            throw new Error(`Payment challenge exceeds the configured maximum of ${policy.maxAmount} ${requirement.currency}.`);
        }
        const rpcUrl = this.getPaymentRpcUrl(requirement);
        const chain = defineChain({
            id: requirement.chainId,
            name: requirement.network,
            nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
            rpcUrls: { default: { http: [rpcUrl] } },
        });
        const privateKey = this.paymentPrivateKey.startsWith('0x')
            ? this.paymentPrivateKey
            : `0x${this.paymentPrivateKey}`;
        const account = privateKeyToAccount(privateKey);
        const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
        const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
        const erc20TransferAbi = [
            {
                type: 'function',
                name: 'transfer',
                inputs: [
                    { name: 'to', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                ],
                outputs: [{ name: '', type: 'bool' }],
                stateMutability: 'nonpayable',
            },
            {
                type: 'function',
                name: 'balanceOf',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
            },
        ];
        const amount = requestedAmount;
        const tokenBalance = await publicClient.readContract({
            address: requirement.tokenAddress,
            abi: erc20TransferAbi,
            functionName: 'balanceOf',
            args: [account.address],
        });
        if (tokenBalance < amount) {
            throw new WatchTowerPaymentFundingError(`Payment wallet ${account.address} has ${formatUnits(tokenBalance, requirement.tokenDecimals)} ${requirement.currency}, but ${requirement.amount} ${requirement.currency} is required.`);
        }
        const nativeBalance = await publicClient.getBalance({ address: account.address });
        const gas = await publicClient.estimateContractGas({
            account,
            address: requirement.tokenAddress,
            abi: erc20TransferAbi,
            functionName: 'transfer',
            args: [
                requirement.payTo,
                amount,
            ],
        });
        const gasPrice = await publicClient.getGasPrice();
        const requiredNativeBalance = gas * gasPrice;
        if (nativeBalance < requiredNativeBalance) {
            throw new WatchTowerPaymentFundingError(`Payment wallet ${account.address} has ${formatUnits(nativeBalance, 18)} native gas token, but at least ${formatUnits(requiredNativeBalance, 18)} is required for the x402 payment transaction.`);
        }
        const txHash = await walletClient.writeContract({
            address: requirement.tokenAddress,
            abi: erc20TransferAbi,
            functionName: 'transfer',
            args: [
                requirement.payTo,
                amount,
            ],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
            throw new Error('Payment transaction reverted on-chain.');
        }
        // Wait for sufficient confirmations before retrying.
        const requiredConfirmations = Math.max(1, Math.floor(requirement.minConfirmations ?? 2));
        let currentBlock = await publicClient.getBlockNumber();
        while (currentBlock - receipt.blockNumber + 1n < BigInt(requiredConfirmations)) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            currentBlock = await publicClient.getBlockNumber();
        }
        return txHash;
    }
}
exports.WatchTowerClient = WatchTowerClient;
//# sourceMappingURL=index.js.map