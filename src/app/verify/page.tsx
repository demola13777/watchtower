"use client";

import { useEffect, useState } from "react";
import { Shield, ShieldAlert, Hexagon, Search, CheckCircle, XCircle, ExternalLink, Loader2, Fingerprint } from "lucide-react";
import Link from 'next/link';
import { createPublicClient, decodeEventLog, http, defineChain, parseAbiItem } from 'viem';
import { REGISTRY_ADDRESS, REGISTRY_CHAIN_ID } from '@/lib/config';

const registryChain = defineChain({
  id: Number(REGISTRY_CHAIN_ID),
  name: REGISTRY_CHAIN_ID === '196' ? 'X Layer Mainnet' : 'X Layer Testnet',
  network: REGISTRY_CHAIN_ID === '196' ? 'xlayer-mainnet' : 'xlayer-testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_REGISTRY_RPC_URL ||
        (REGISTRY_CHAIN_ID === '196' ? 'https://rpc.xlayer.tech' : 'https://testrpc.xlayer.tech'),
      ],
    },
  },
});

interface VerifiedScan {
  tokenAddress: string;
  chainId: number;
  scanHash: string;
  threatScore: number;
  timestamp: number;
  txHash: string;
  blockNumber: bigint;
}

type VerifyStatus = 'idle' | 'verified' | 'not_found';

const scanRecordedEvent = parseAbiItem(
  'event ScanRecorded(uint256 indexed chainId, address indexed tokenAddress, string scanHash, uint256 threatScore, uint256 timestamp)',
);

export default function VerifyPage() {
  const [txHash, setTxHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifiedScan | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<VerifyStatus>('idle');

  useEffect(() => {
    const timeout = setTimeout(() => {
      const tx = new URLSearchParams(window.location.search).get('tx');
      if (tx && /^0x[a-fA-F0-9]{64}$/.test(tx)) {
        setTxHash(tx);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  const handleVerify = async () => {
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      setError('Invalid transaction hash. Enter a 0x-prefixed 64-character hex hash.');
      setStatus('idle');
      return;
    }

    setVerifying(true);
    setResult(null);
    setError('');
    setStatus('idle');

    try {
      const client = createPublicClient({ chain: registryChain, transport: http() });

      // Fetch the transaction receipt to get the event logs
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);

      if (!receipt) {
        setStatus('not_found');
        return;
      }

      if (receipt.status !== 'success') {
        setStatus('not_found');
        return;
      }

      let verifiedScan: VerifiedScan | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== REGISTRY_ADDRESS.toLowerCase()) continue;

        try {
          const decoded = decodeEventLog({
            abi: [scanRecordedEvent],
            data: log.data,
            topics: log.topics,
          });
          const args = decoded.args as {
            tokenAddress?: `0x${string}`;
            chainId?: bigint;
            scanHash?: string;
            threatScore?: bigint;
            timestamp?: bigint;
          };

          if (args.chainId === undefined || !args.tokenAddress || !args.scanHash || args.threatScore === undefined || args.timestamp === undefined) {
            continue;
          }

          verifiedScan = {
            tokenAddress: args.tokenAddress,
            chainId: Number(args.chainId),
            scanHash: args.scanHash,
            threatScore: Number(args.threatScore),
            timestamp: Number(args.timestamp),
            txHash,
            blockNumber: receipt.blockNumber,
          };
          break;
        } catch {
          continue;
        }
      }

      if (!verifiedScan) {
        setStatus('not_found');
        return;
      }

      setResult(verifiedScan);
      setStatus('verified');
    } catch (err: unknown) {
      console.error('Verification error:', err);
      setError('Unable to reach X Layer Testnet right now. Please try again.');
      setStatus('idle');
    } finally {
      setVerifying(false);
    }
  };

  const recommendation = result 
    ? result.threatScore > 70 ? 'ABORT' : result.threatScore > 35 ? 'CAUTION' : 'TRADE'
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-cyan-500/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">WatchTower</span>
          </Link>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
            Verification
          </span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-6">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Independent Verification</h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Verify any WatchTower scan directly on the X Layer blockchain. No trust is required because the data is immutable and independently auditable.
          </p>
        </div>

        {/* Search */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm mb-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={txHash}
              onChange={(e) => { setTxHash(e.target.value.trim()); setError(''); setStatus('idle'); }}
              placeholder="Enter transaction hash (0x...)"
              className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all"
              disabled={verifying}
              onKeyDown={(e) => e.key === 'Enter' && !verifying && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={verifying || !txHash}
              className="w-full justify-center sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg px-4 py-2.5">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {status === 'not_found' && (
          <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
              <Fingerprint className="h-7 w-7 text-amber-400" />
            </div>
            <h2 className="mb-2 text-xl font-black text-white">Attestation Not Found</h2>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-400">
              This transaction exists neither as a successful WatchTowerRegistry attestation nor as a readable scan event on {registryChain.name}. Check that the hash is from a completed WatchTower scan transaction.
            </p>
          </div>
        )}

        {/* Result */}
        {status === 'verified' && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Verification Badge */}
            <div className="p-5 sm:p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
                <span className="text-lg font-bold text-emerald-400">Scan Verified On-Chain</span>
              </div>
              <p className="text-sm text-slate-400">
                This scan record was independently verified from the X Layer blockchain. The data below was read directly from the WatchTowerRegistry smart contract event logs rather than the WatchTower server.
              </p>
            </div>

            {/* Scan Details */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5 sm:mb-6">Attested Scan Data</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Scanned Token</div>
                  <div className="font-mono text-sm text-cyan-400 bg-slate-950 p-3 rounded-xl border border-slate-800 break-all">
                    Chain {result.chainId} · {result.tokenAddress}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">Verdict</div>
                  <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                      recommendation === 'ABORT' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                      recommendation === 'CAUTION' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}>
                      {recommendation === 'TRADE' ? <Shield className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                      {recommendation}
                    </div>
                    <span className={`text-2xl font-black ${
                      result.threatScore > 70 ? 'text-rose-500' : result.threatScore > 35 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {result.threatScore}<span className="text-sm text-slate-600 font-normal">/100</span>
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">Scan Hash (Content Fingerprint)</div>
                  <div className="font-mono text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 break-all">
                    {result.scanHash}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">Attested At</div>
                  <div className="text-sm text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {new Date(result.timestamp * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'}
                    <div className="text-xs text-slate-500 mt-1">Block #{result.blockNumber.toString()}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <a
                  href={`https://www.oklink.com/xlayer-test/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors group"
                >
                  <Fingerprint className="h-4 w-4" />
                  View on OKLink Explorer
                  <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>


          </div>
        )}
      </main>
    </div>
  );
}
