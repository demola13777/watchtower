const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
const PAYMENT_ID_HEADER = 'X-WatchTower-Payment-Id';

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
  paymentId?: string;
  requestHash?: string;
  minConfirmations?: number;
  instructions: string;
}

export interface WatchTowerPaymentPolicy {
  /** Exact API origin that is allowed to request automatic settlement. */
  apiOrigin: string;
  /** Exact EVM chain accepted for automatic settlement. */
  chainId: number;
  /** Exact ERC-20 contract accepted for automatic settlement. */
  tokenAddress: string;
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
  /** Required when paymentPrivateKey is supplied so automatic settlement is pinned to a trusted policy. */
  paymentPolicy?: WatchTowerPaymentPolicy;
}

export interface WatchTowerRequestOptions {
  chainId?: string | number;
  paymentTxHash?: string;
  paymentId?: string;
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
  public requirement: Web3PaymentRequirement;

  constructor(requirement: Web3PaymentRequirement) {
    super(
      `WatchTower payment required: transfer ${requirement.amount} ${requirement.currency} to ${requirement.payTo} on chain ${requirement.chainId}, then retry with Authorization: L402 <tx_hash>.`,
    );
    this.name = 'WatchTowerPaymentRequiredError';
    this.requirement = requirement;
  }
}

export class WatchTowerPaymentFundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WatchTowerPaymentFundingError';
  }
}

export class WatchTowerClient {
  private apiUrl: string;
  private agentWallet: string;
  private threshold: number;
  private chainId: string | undefined;
  private paymentTxHash: string | undefined;
  private paymentPrivateKey: string | undefined;
  private paymentRpcUrl: string | undefined;
  private paymentPolicy: WatchTowerPaymentPolicy | undefined;

  constructor(config: WatchTowerConfig) {
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

    const { data, success, error } = (await res.json()) as ScanResponse;

    if (!success || !data) {
      throw new Error(error || 'Failed to scan token');
    }

    // A settlement hash authorizes exactly one request. Never carry it into a
    // later scan made by the same long-lived client instance.
    this.paymentTxHash = undefined;

    // Configurable Kill Switch — use client-side threshold, not just server recommendation
    if (data.threatScore > this.threshold) {
      throw new WatchTowerAbortError(
        `WatchTower blocked execution on ${targetTokenAddress} (score ${data.threatScore} > threshold ${this.threshold}). Reasons: ${data.reasoning.join(', ')}`,
        data.threatScore,
        data.confidence,
        data.reasoning,
        data.scanHash,
      );
    }

    return data;
  }

  /**
   * Deep Scan — Tier 1 (1 USDT)
   * Returns a comprehensive threat report with on-chain attestation.
   * Unlike guardTransaction(), this does NOT throw on high threat scores.
   */
  async deepScan(
    targetTokenAddress: string,
    chainIdOrOptions: string | number | WatchTowerRequestOptions | undefined = this.chainId,
  ): Promise<DeepScanResponse> {
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

    return data as DeepScanResponse;
  }

  private normalizeOptions(
    chainIdOrOptions: string | number | WatchTowerRequestOptions | undefined,
  ): { chainId?: string; paymentTxHash?: string; paymentId?: string } {
    const normalized: { chainId?: string; paymentTxHash?: string; paymentId?: string } = {};

    if (typeof chainIdOrOptions === 'object' && chainIdOrOptions !== null) {
      const chainId = chainIdOrOptions.chainId === undefined ? this.chainId : String(chainIdOrOptions.chainId);
      const paymentTxHash = chainIdOrOptions.paymentTxHash ?? this.paymentTxHash;
      const paymentId = chainIdOrOptions.paymentId;
      if (chainId !== undefined) normalized.chainId = chainId;
      if (paymentTxHash !== undefined) normalized.paymentTxHash = paymentTxHash;
      if (paymentId !== undefined) normalized.paymentId = paymentId;
      return normalized;
    }

    if (chainIdOrOptions !== undefined) normalized.chainId = String(chainIdOrOptions);
    if (this.paymentTxHash !== undefined) normalized.paymentTxHash = this.paymentTxHash;
    return normalized;
  }

  private createHeaders(paymentTxHash?: string, paymentId?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (paymentTxHash) {
      headers.Authorization = `L402 ${paymentTxHash}`;
    }
    if (paymentId) headers[PAYMENT_ID_HEADER] = paymentId;
    return headers;
  }

  private async readPaymentRequirement(res: Response): Promise<Web3PaymentRequirement> {
    const header = res.headers.get(PAYMENT_REQUIRED_HEADER);
    if (header) {
      const requirement = decodeBase64Json<Web3PaymentRequirement>(header);
      if (requirement) return requirement;
    }

    const body = await res.json().catch(() => null) as { paymentRequired?: Web3PaymentRequirement } | null;
    if (body?.paymentRequired) return body.paymentRequired;
    throw new Error('WatchTower payment challenge did not include a PAYMENT-REQUIRED requirement.');
  }

  private getPaymentRpcUrl(requirement: Web3PaymentRequirement): string {
    if (this.paymentRpcUrl) return this.paymentRpcUrl;
    if (requirement.chainId === 196) return 'https://rpc.xlayer.tech';
    if (requirement.chainId === 1952) return 'https://testrpc.xlayer.tech';
    throw new Error(`No payment RPC configured for chain ${requirement.chainId}. Pass paymentRpcUrl to WatchTowerClient.`);
  }

  private async settlePayment(requirement: Web3PaymentRequirement): Promise<string> {
    if (!this.paymentPrivateKey) {
      throw new WatchTowerPaymentRequiredError(requirement);
    }

    const [{ createPublicClient, createWalletClient, defineChain, formatUnits, http, parseUnits }, { privateKeyToAccount }] = await Promise.all([
      import('viem'),
      import('viem/accounts'),
    ]);

    const policy = this.paymentPolicy;
    if (!policy) throw new Error('Automatic settlement requires a paymentPolicy.');
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
      ? this.paymentPrivateKey as `0x${string}`
      : `0x${this.paymentPrivateKey}` as `0x${string}`;
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
    ] as const;
    const amount = requestedAmount;
    const tokenBalance = await publicClient.readContract({
      address: requirement.tokenAddress as `0x${string}`,
      abi: erc20TransferAbi,
      functionName: 'balanceOf',
      args: [account.address],
    });

    if (tokenBalance < amount) {
      throw new WatchTowerPaymentFundingError(
        `Payment wallet ${account.address} has ${formatUnits(tokenBalance, requirement.tokenDecimals)} ${requirement.currency}, but ${requirement.amount} ${requirement.currency} is required.`,
      );
    }

    const nativeBalance = await publicClient.getBalance({ address: account.address });
    const gas = await publicClient.estimateContractGas({
      account,
      address: requirement.tokenAddress as `0x${string}`,
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [
        requirement.payTo as `0x${string}`,
        amount,
      ],
    });
    const gasPrice = await publicClient.getGasPrice();
    const requiredNativeBalance = gas * gasPrice;

    if (nativeBalance < requiredNativeBalance) {
      throw new WatchTowerPaymentFundingError(
        `Payment wallet ${account.address} has ${formatUnits(nativeBalance, 18)} native gas token, but at least ${formatUnits(requiredNativeBalance, 18)} is required for the x402 payment transaction.`,
      );
    }

    const txHash = await walletClient.writeContract({
      address: requirement.tokenAddress as `0x${string}`,
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [
        requirement.payTo as `0x${string}`,
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
