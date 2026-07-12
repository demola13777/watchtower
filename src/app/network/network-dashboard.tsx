"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldAlert, Activity, Zap, Hexagon, Server, Database, Search, Fingerprint, Users, MessageCircle, ExternalLink, Loader2, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AgentRelayPanel } from "@/components/agent-relay-panel";

const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const erc20BalanceAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Module animation stages
const SCAN_MODULES = [
  { name: 'Liquidity Intelligence', icon: 'activity', color: 'text-cyan-400', bgColor: 'bg-cyan-400' },
  { name: 'Contract DNA Scanner', icon: 'fingerprint', color: 'text-purple-400', bgColor: 'bg-purple-400' },
  { name: 'Whale Intelligence', icon: 'users', color: 'text-amber-400', bgColor: 'bg-amber-400' },
  { name: 'Social Threat Radar', icon: 'message', color: 'text-emerald-400', bgColor: 'bg-emerald-400' },
];

interface Web3PaymentRequirement {
  x402Version: number;
  scheme: string;
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
  minConfirmations?: number;
  instructions: string;
}

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function decodeBase64Json<T>(value: string): T | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

function isConfirmationDepthError(message?: string): boolean {
  return Boolean(message?.match(/confirmation\(s\).+required/i));
}

function getChainMetadata(requirement: Web3PaymentRequirement) {
  const isTestnet = requirement.chainId === 1952;
  return {
    chainId: `0x${requirement.chainId.toString(16)}`,
    chainName: requirement.network || (isTestnet ? 'X Layer Testnet' : 'X Layer Mainnet'),
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: [isTestnet ? 'https://testrpc.xlayer.tech' : 'https://rpc.xlayer.tech'],
    blockExplorerUrls: [isTestnet ? 'https://www.oklink.com/xlayer-test' : 'https://www.oklink.com/xlayer'],
  };
}

async function ensureWalletChain(provider: EthereumProvider, requirement: Web3PaymentRequirement) {
  const chain = getChainMetadata(requirement);
  const currentChainId = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
  if (currentChainId?.toLowerCase() === chain.chainId.toLowerCase()) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chain.chainId }],
    });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? Number((error as { code: unknown }).code)
      : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [chain],
    });
  }
}

async function waitForWalletReceipt(
  provider: EthereumProvider,
  txHash: string,
  minConfirmations = 1,
  onProgress?: (message: string) => void,
) {
  const startedAt = Date.now();
  const requiredConfirmations = Math.max(1, Math.floor(minConfirmations));
  const timeoutMs = 180_000;

  while (Date.now() - startedAt < timeoutMs) {
    const receipt = await provider.request<{ status?: string; blockNumber?: string } | null>({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    }).catch(() => null);

    if (receipt?.status === '0x0') {
      throw new Error('Wallet payment transaction failed on-chain.');
    }
    if (receipt?.status === '0x1' && receipt.blockNumber) {
      const currentBlockHex = await provider.request<string>({ method: 'eth_blockNumber' }).catch(() => null);
      if (currentBlockHex) {
        const minedBlock = BigInt(receipt.blockNumber);
        const currentBlock = BigInt(currentBlockHex);
        const confirmations = currentBlock >= minedBlock ? Number(currentBlock - minedBlock + BigInt(1)) : 0;
        if (confirmations >= requiredConfirmations) return;
        onProgress?.(`Payment confirmed on-chain. Waiting for ${requiredConfirmations - confirmations} more confirmation(s)...`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error('Wallet payment was submitted, but confirmation timed out. Please try again once the transaction has enough confirmations.');
}

async function settlePaymentWithWallet(
  requirement: Web3PaymentRequirement,
  onProgress?: (message: string) => void,
): Promise<string> {
  const provider = window.ethereum;
  if (!provider) {
    throw new Error('No EVM wallet detected. Open this page in a browser with MetaMask, OKX Wallet, or another EVM wallet.');
  }

  const [account] = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  if (!account) throw new Error('No wallet account selected.');

  await ensureWalletChain(provider, requirement);

  const { encodeFunctionData, formatUnits, parseUnits } = await import('viem');
  const amount = parseUnits(requirement.amount, requirement.tokenDecimals);
  const balanceCallData = encodeFunctionData({
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: [account as `0x${string}`],
  });
  const [tokenBalanceHex, nativeBalanceHex] = await Promise.all([
    provider.request<string>({
      method: 'eth_call',
      params: [{ to: requirement.tokenAddress, data: balanceCallData }, 'latest'],
    }),
    provider.request<string>({ method: 'eth_getBalance', params: [account, 'latest'] }),
  ]);

  const tokenBalance = BigInt(tokenBalanceHex);
  if (tokenBalance < amount) {
    throw new Error(
      `Selected wallet has ${formatUnits(tokenBalance, requirement.tokenDecimals)} ${requirement.currency}, but ${requirement.amount} ${requirement.currency} is required.`,
    );
  }
  if (BigInt(nativeBalanceHex) === BigInt(0)) {
    throw new Error('Selected wallet has no OKB for the X Layer network fee. Add a small amount of native gas and try again.');
  }

  const data = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: 'transfer',
    args: [requirement.payTo as `0x${string}`, amount],
  });

  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [{
      from: account,
      to: requirement.tokenAddress,
      data,
      value: '0x0',
    }],
  });

  onProgress?.('Payment submitted. Waiting for on-chain confirmation...');
  await waitForWalletReceipt(provider, txHash, requirement.minConfirmations, onProgress);
  return txHash;
}

async function validateChecksummedEvmAddress(value: string): Promise<{ ok: true; address: string } | { ok: false; message: string }> {
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { ok: false, message: 'Invalid address format. Enter a 0x-prefixed 42-character hex address.' };
  }

  try {
    const { getAddress } = await import("viem");
    const checksummed = getAddress(trimmed);
    return { ok: true, address: checksummed };
  } catch {
    return { ok: false, message: 'Invalid EVM address.' };
  }
}

const ModuleIcon = ({ type, className }: { type: string, className: string }) => {
  switch(type) {
    case 'activity': return <Activity className={className} />;
    case 'fingerprint': return <Fingerprint className={className} />;
    case 'users': return <Users className={className} />;
    case 'message': return <MessageCircle className={className} />;
    default: return <Zap className={className} />;
  }
};

interface TelemetryScan {
  id: number;
  chainId: string;
  tokenAddress: string;
  threatScore: number;
  recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
  scanHash: string;
  agentWallet: string | null;
  tier: string | null;
  timestamp: number;
}

interface LeaderboardAgent {
  agentWallet: string | null;
  totalScans: number;
  threatsDetected: number;
  cautionsRaised: number;
  lastActive: number;
}

interface TelemetryData {
  totalScans: number;
  threatsBlocked: number;
  revenue: number;
  activeAgents: number;
  latestScans: TelemetryScan[];
  leaderboard: LeaderboardAgent[];
}

interface ScanResult {
  chainId: string;
  chainResolution: {
    chainId: string;
    chainName: string;
    confidence: string;
    source: string;
    reason: string;
  };
  tokenAddress: string;
  verdict: {
    threatScore: number;
    confidence: number;
    recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
    summary: string;
  };
  verification: {
    scanHash: string;
    txHash: string | null;
  };
}

interface DeepScanApiResult {
  target?: {
    tokenAddress?: string;
    chainId?: string;
    chainResolution?: ScanResult['chainResolution'];
  };
  verdict?: ScanResult['verdict'];
  verification?: ScanResult['verification'];
}

function normalizeScanResult(value: unknown): ScanResult | null {
  const result = value as DeepScanApiResult;
  if (!result?.target?.tokenAddress || !result.target.chainId || !result.target.chainResolution || !result.verdict || !result.verification?.scanHash) {
    return null;
  }

  return {
    tokenAddress: result.target.tokenAddress,
    chainId: result.target.chainId,
    chainResolution: result.target.chainResolution,
    verdict: result.verdict,
    verification: {
      scanHash: result.verification.scanHash,
      txHash: result.verification.txHash ?? null,
    },
  };
}

export default function NetworkDashboard() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [now, setNow] = useState(() => Date.now());
  
  // "Try It" scanner state
  const [scanAddress, setScanAddress] = useState('');
  const [paymentRequirement, setPaymentRequirement] = useState<Web3PaymentRequirement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');
  const [activeModule, setActiveModule] = useState(-1); // For animated progress

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch(`/api/telemetry?page=${currentPage}&limit=${pageSize}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch telemetry", err);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    const timeout = setTimeout(fetchTelemetry, 0);
    const interval = setInterval(fetchTelemetry, 10000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [fetchTelemetry]);

  // "Try It" scanner handler
  const handleScan = async () => {
    const addressValidation = await validateChecksummedEvmAddress(scanAddress);
    if (!addressValidation.ok) {
      setScanError(addressValidation.message);
      return;
    }

    setScanning(true);
    setScanResult(null);
    setScanError('');
    setActiveModule(0);

    // Animate through modules as scan runs
    const moduleTimer = setInterval(() => {
      setActiveModule(prev => {
        if (prev >= 3) { clearInterval(moduleTimer); return 3; }
        return prev + 1;
      });
    }, 1200);

    try {
      const payload = JSON.stringify({
        tokenAddress: addressValidation.address,
        agentWallet: '0x000000000000000000000000000000000000dA5b',
      });

      const submitDeepScan = (paymentTxHash?: string, paymentId?: string) => fetch('/api/scan/deep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(paymentTxHash ? { Authorization: `L402 ${paymentTxHash}` } : {}),
          ...(paymentId ? { 'X-WatchTower-Payment-Id': paymentId } : {}),
        },
        body: payload,
      });

      const retryPaidDeepScan = async (paymentTxHash: string, paymentId: string) => {
        const startedAt = Date.now();
        const timeoutMs = 180_000;

        while (Date.now() - startedAt < timeoutMs) {
          const paidResponse = await submitDeepScan(paymentTxHash, paymentId);
          const paidData = await paidResponse.json().catch(() => null) as { success?: boolean; message?: string; error?: string; data?: unknown } | null;
          const message = paidData?.message || paidData?.error;

          if (paidResponse.status !== 401 || !isConfirmationDepthError(message)) {
            return { response: paidResponse, data: paidData };
          }

          setScanError(`${message} Waiting for the verification RPC to catch up...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        throw new Error('Payment is confirmed, but server-side confirmation verification timed out. Retry the same scan shortly; the payment id remains bound to this request.');
      };

      let res = await submitDeepScan();
      let data: { success?: boolean; message?: string; error?: string; data?: unknown } | null = null;

      if (res.status === 402) {
        const encodedRequirement = res.headers.get('PAYMENT-REQUIRED');
        const requirement = encodedRequirement ? decodeBase64Json<Web3PaymentRequirement>(encodedRequirement) : null;
        if (!requirement) {
          throw new Error('Payment challenge missing PAYMENT-REQUIRED details.');
        }
        if (!requirement.paymentId) {
          throw new Error('Payment challenge is missing its request-bound payment id. Refresh and try again.');
        }
        setPaymentRequirement(requirement);
        setScanError(`Confirm ${requirement.amount} ${requirement.currency} in your wallet to unlock this Deep Scan.`);
        const txHash = await settlePaymentWithWallet(requirement, setScanError);
        setScanError('Payment confirmed. Finalizing scan...');
        const paidResult = await retryPaidDeepScan(txHash, requirement.paymentId);
        res = paidResult.response;
        data = paidResult.data as typeof data;
      }
      data ??= await res.json();
      clearInterval(moduleTimer);
      setActiveModule(4); // All complete

      const normalizedResult = data?.success ? normalizeScanResult(data.data) : null;
      if (normalizedResult) {
        setScanResult(normalizedResult);
        setScanError('');
        fetchTelemetry(); // Refresh stats
      } else {
        setScanError(data?.message || data?.error || 'Scan failed');
      }
    } catch (error) {
      clearInterval(moduleTimer);
      const walletErrorCode = typeof error === 'object' && error !== null && 'code' in error
        ? Number((error as { code: unknown }).code)
        : undefined;
      setScanError(
        walletErrorCode === 4001
          ? 'Payment approval was cancelled in your wallet.'
          : error instanceof Error ? error.message : 'Network error - is the server running?',
      );
    } finally {
      clearInterval(moduleTimer);
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-300 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.7)] transition-all">
                <Hexagon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">WatchTower</span>
            </Link>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">
              Network Explorer
            </span>
          </div>
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${telemetry ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${telemetry ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                <span className="text-slate-400 text-xs">API Status: <span className={telemetry ? 'text-emerald-400' : 'text-rose-400'}>{telemetry ? 'Online' : 'Connecting...'}</span></span>
              </div>
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fade-in-up delay-100">
        
        {/* "Try It" Scanner */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md hover:border-cyan-500/30 transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Search className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Scan a Token</h2>
              <p className="text-xs text-slate-500">Paste any EVM token contract address to auto-detect its chain and run a deep threat analysis</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              type="text"
              value={scanAddress}
              onChange={(e) => { setScanAddress(e.target.value.trim()); setScanError(''); setPaymentRequirement(null); }}
              placeholder="0x... (e.g. 0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D)"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all"
              disabled={scanning}
              onKeyDown={(e) => e.key === 'Enter' && !scanning && handleScan()}
            />
            <button
              onClick={handleScan}
              disabled={scanning || !scanAddress}
              className="w-full justify-center lg:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {scanning ? 'Scanning...' : 'Try It'}
            </button>
          </div>

          {scanError && (
            <div className="mt-3 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg px-4 py-2">
              {scanError}
            </div>
          )}

          {scanAddress.length >= 40 && !scanning && !scanResult && (
            <AgentRelayPanel requirement={paymentRequirement || undefined} />
          )}

          {/* Animated Module Progress */}
          {scanning && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SCAN_MODULES.map((mod, i) => (
                <div
                  key={mod.name}
                  className={`p-3 rounded-xl border transition-all duration-500 ${
                    activeModule > i
                      ? 'bg-slate-900/80 border-emerald-500/30'
                      : activeModule === i
                      ? 'bg-slate-900/80 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-950/50 border-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <ModuleIcon type={mod.icon} className={`h-4 w-4 ${activeModule >= i ? mod.color : 'text-slate-600'} transition-colors`} />
                    <span className={`text-xs font-medium ${activeModule >= i ? 'text-slate-300' : 'text-slate-600'} transition-colors`}>
                      {mod.name}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        activeModule > i ? 'w-full bg-emerald-500' : activeModule === i ? 'w-2/3 bg-cyan-500 animate-pulse' : 'w-0'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scan Result Card */}
          {scanResult && !scanning && (
            <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                    scanResult.verdict.recommendation === 'ABORT' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                    scanResult.verdict.recommendation === 'CAUTION' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    {scanResult.verdict.recommendation === 'ABORT' || scanResult.verdict.recommendation === 'CAUTION'
                      ? <ShieldAlert className="h-4 w-4" />
                      : <Shield className="h-4 w-4" />
                    }
                    {scanResult.verdict.recommendation}
                  </div>
                  <span className={`text-2xl font-black ${
                    scanResult.verdict.threatScore > 70 ? 'text-rose-500' :
                    scanResult.verdict.threatScore > 35 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {scanResult.verdict.threatScore}<span className="text-sm text-slate-600 font-normal">/100</span>
                  </span>
                </div>
                <Link
                  href={`/report/${scanResult.verification.scanHash}`}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all group"
                >
                  View Full Report
                  <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
              <p className="text-sm text-slate-400">{scanResult.verdict.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 font-medium text-cyan-300">
                  Detected: {scanResult.chainResolution.chainName} ({scanResult.chainId})
                </span>
                <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-400">
                  Confidence: {scanResult.chainResolution.confidence}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up delay-200">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/30 hover:shadow-[0_4px_20px_rgba(6,182,212,0.1)] transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <Activity className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium mb-1">Total Intercepts</div>
            <div className="text-3xl font-black text-white">{telemetry?.totalScans || 0}</div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md relative overflow-hidden group hover:border-rose-500/30 hover:shadow-[0_4px_20px_rgba(244,63,94,0.1)] transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-rose-500" />
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium mb-1">Threats Blocked</div>
            <div className="text-3xl font-black text-rose-500">{telemetry?.threatsBlocked || 0}</div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 hover:shadow-[0_4px_20px_rgba(16,185,129,0.1)] transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium mb-1">x402 Revenue (USDT)</div>
            <div className="text-3xl font-black text-emerald-400">{telemetry?.revenue?.toFixed(2) || "0.00"}</div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md relative overflow-hidden group hover:border-purple-500/30 hover:shadow-[0_4px_20px_rgba(168,85,247,0.1)] transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <Server className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium mb-1">Active Agents</div>
            <div className="text-3xl font-black text-purple-400">{telemetry?.activeAgents || 0}</div>
          </div>
        </div>



        {/* Live Feed */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md min-h-[400px] animate-fade-in-up delay-300">
           <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
             <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-cyan-400" />
              Live Intercept Feed
             </h2>
             <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
               <Activity className="h-3 w-3 animate-pulse" />
               Polling Database...
             </div>
           </div>

           {!telemetry?.latestScans?.length ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                <Activity className="h-8 w-8 mb-3 opacity-50" />
                <p>Awaiting agent traffic...</p>
                <p className="text-xs mt-1 opacity-60">Use the scanner above or run an agent script.</p>
              </div>
           ) : (
             <div className="space-y-3">
               <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-800">
                 <div className="col-span-2">Action</div>
                 <div className="col-span-4">Target Contract</div>
                 <div className="col-span-2">Agent</div>
                 <div className="col-span-2">Threat</div>
                 <div className="col-span-1">Tier</div>
                 <div className="col-span-1 text-right">Time</div>
               </div>
               
               {telemetry.latestScans.map((scan) => (
                 <div key={scan.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 py-4 items-start md:items-center rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-900/80 transition-colors shadow-inner group">
                   <div className="md:col-span-2">
                     <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Action</div>
                     <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${scan.recommendation === 'ABORT' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : scan.recommendation === 'CAUTION' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                       {scan.recommendation === 'ABORT' && <ShieldAlert className="h-3 w-3" />}
                       {scan.recommendation === 'CAUTION' && <ShieldAlert className="h-3 w-3" />}
                       {scan.recommendation === 'TRADE' && <Shield className="h-3 w-3" />}
                       {scan.recommendation}
                     </div>
                   </div>
                   
                   <div className="md:col-span-4 font-mono text-sm text-slate-300 break-all">
                     <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Target Contract</div>
                     {scan.tokenAddress}
                     {scan.tier === 'deep' && (
                       <Link href={`/report/${scan.scanHash}`} className="text-[10px] text-cyan-500 mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-cyan-400">
                         <ExternalLink className="h-2.5 w-2.5" /> View Report
                       </Link>
                     )}
                     {scan.tier !== 'deep' && (
                       <div className="text-[10px] text-slate-600 mt-0.5 break-all opacity-0 group-hover:opacity-100 transition-opacity">Hash: {scan.scanHash.substring(0,32)}...</div>
                     )}
                   </div>
                   
                   <div className="md:col-span-2 font-mono text-sm text-cyan-400 break-all">
                     <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Agent</div>
                     {scan.agentWallet ? `${scan.agentWallet.substring(0,10)}...` : 'Unknown'}
                   </div>
                   
                   <div className="md:col-span-2">
                     <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Threat</div>
                     <div className={`text-lg font-bold ${scan.threatScore > 80 ? 'text-rose-500' : scan.threatScore > 40 ? 'text-amber-500' : 'text-emerald-500'}`}>
                       {scan.threatScore}<span className="text-xs text-slate-600 font-normal">/100</span>
                     </div>
                   </div>

                   <div className="md:col-span-1">
                     <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Tier</div>
                     <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${scan.tier === 'deep' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-800 text-slate-500'}`}>
                       {scan.tier === 'deep' ? 'Deep' : 'API'}
                     </span>
                   </div>
                   
                   <div className="md:col-span-1 md:text-right text-xs text-slate-500">
                     <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Time</div>
                     {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </div>
                 </div>
               ))}
             </div>
           )}

           {/* Pagination Controls */}
           {(telemetry?.latestScans?.length ?? 0) > 0 && (
             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl">
               <div className="flex items-center gap-2 text-sm text-slate-400">
                 <span>Show:</span>
                 <select 
                   className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                   value={pageSize}
                   onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                 >
                   <option value={10}>10</option>
                   <option value={25}>25</option>
                   <option value={50}>50</option>
                   <option value={100}>100</option>
                 </select>
                 <span>Records</span>
               </div>
               
               <div className="flex flex-wrap items-center gap-1">
                 <button 
                   onClick={() => setCurrentPage(1)} 
                   disabled={currentPage === 1}
                   className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50 hover:bg-slate-800 transition-colors"
                 >
                   First
                 </button>
                 <button 
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                   disabled={currentPage === 1}
                   className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50 hover:bg-slate-800 transition-colors flex items-center justify-center"
                 >
                   <ChevronLeft className="h-4 w-4" />
                 </button>
                 <span className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-slate-300">
                   Page {currentPage} of {Math.max(1, Math.ceil((telemetry?.totalScans || 0) / pageSize))}
                 </span>
                 <button 
                   onClick={() => setCurrentPage(prev => Math.min(Math.ceil((telemetry?.totalScans || 0) / pageSize), prev + 1))} 
                   disabled={currentPage === Math.ceil((telemetry?.totalScans || 0) / pageSize) || !telemetry?.totalScans}
                   className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50 hover:bg-slate-800 transition-colors flex items-center justify-center"
                 >
                   <ChevronRight className="h-4 w-4" />
                 </button>
                 <button 
                   onClick={() => setCurrentPage(Math.ceil((telemetry?.totalScans || 0) / pageSize))} 
                   disabled={currentPage === Math.ceil((telemetry?.totalScans || 0) / pageSize) || !telemetry?.totalScans}
                   className="px-3 py-1.5 rounded-lg text-sm bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-50 hover:bg-slate-800 transition-colors"
                 >
                   Last
                 </button>
               </div>
             </div>
           )}
        </div>

        {/* Agent Leaderboard */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md animate-fade-in-up delay-400">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                Agent Leaderboard
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                Top 3 agents by volume
              </span>
            </div>

            {(telemetry?.leaderboard?.length ?? 0) === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                <Trophy className="h-8 w-8 mb-3 opacity-50" />
                <p>No agent activity yet.</p>
                <p className="text-xs mt-1 opacity-60">Agents will appear here after successful scans.</p>
              </div>
            ) : (
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Agent</div>
                <div className="col-span-2 text-center">Scans</div>
                <div className="col-span-2 text-center">Threats</div>
                <div className="col-span-1 text-center">Cautions</div>
                <div className="col-span-2 text-right">Last Active</div>
              </div>

              {telemetry?.leaderboard.map((agent, index) => {
                const rankColors = [
                  'text-amber-400',   // Gold
                  'text-slate-300',   // Silver
                  'text-amber-600',   // Bronze
                ];
                const rankColor = index < 3 ? rankColors[index] : 'text-slate-500';
                const isTopThree = index < 3;

                // Calculate relative time
                const secondsAgo = Math.floor((now - agent.lastActive) / 1000);
                let timeAgo: string;
                if (secondsAgo < 60) timeAgo = 'Just now';
                else if (secondsAgo < 3600) timeAgo = `${Math.floor(secondsAgo / 60)}m ago`;
                else if (secondsAgo < 86400) timeAgo = `${Math.floor(secondsAgo / 3600)}h ago`;
                else timeAgo = `${Math.floor(secondsAgo / 86400)}d ago`;

                return (
                  <div
                    key={agent.agentWallet}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 py-4 items-start md:items-center rounded-xl border transition-colors shadow-inner group ${
                      isTopThree
                        ? 'bg-slate-950/80 border-slate-700 hover:border-amber-500/40 hover:bg-slate-900/90'
                        : 'bg-slate-950/40 border-slate-800/50 hover:border-cyan-500/30 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="md:col-span-1">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Rank</div>
                      <div className={`flex items-center gap-1.5 font-bold text-sm ${rankColor}`}>
                        {isTopThree && <Trophy className="h-3 w-3" />}
                        <span>#{index + 1}</span>
                      </div>
                    </div>

                    <div className="md:col-span-4 min-w-0">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Agent</div>
                      <div className="font-mono text-sm text-cyan-400 break-all">
                        {agent.agentWallet ? `${agent.agentWallet.substring(0,10)}...` : 'Unknown'}
                      </div>
                    </div>

                    <div className="md:col-span-2 md:text-center">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Scans</div>
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-sm font-mono font-medium text-white bg-slate-900 border border-slate-800">
                        {agent.totalScans}
                      </span>
                    </div>

                    <div className="md:col-span-2 md:text-center">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Threats</div>
                      {agent.threatsDetected > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <ShieldAlert className="h-3 w-3" />
                          {agent.threatsDetected}
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-slate-600">-</span>
                      )}
                    </div>

                    <div className="md:col-span-1 md:text-center">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Cautions</div>
                      {agent.cautionsRaised > 0 ? (
                        <div className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {agent.cautionsRaised}
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-slate-600">-</span>
                      )}
                    </div>

                    <div className="md:col-span-2 md:text-right text-xs text-slate-500 font-mono">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:hidden">Last Active</div>
                      {timeAgo}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

      </main>
    </div>
  );
}
