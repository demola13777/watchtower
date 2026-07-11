"use client";

import { useEffect, useState } from "react";
import { Hexagon, Search, CheckCircle, XCircle, ExternalLink, Loader2, Fingerprint } from "lucide-react";
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

const registryExplorerPrefix = REGISTRY_CHAIN_ID === '196'
  ? 'https://www.oklink.com/xlayer/tx'
  : 'https://www.oklink.com/xlayer-test/tx';

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
      setError('Unable to reach the configured X Layer network right now. Please try again.');
      setStatus('idle');
    } finally {
      setVerifying(false);
    }
  };

  const recommendation = result 
    ? result.threatScore > 70 ? 'ABORT' : result.threatScore > 35 ? 'CAUTION' : 'TRADE'
    : null;

  return (
    <div className="min-h-screen text-slate-300 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">WatchTower</span>
          </Link>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
            Verification
          </span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-24 animate-fade-in-up delay-100">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 drop-shadow-sm">Manual Verification</h1>
          <p className="text-slate-400">Enter a Watch Tower Report Hash to verify its cryptographic authenticity.</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/50 backdrop-blur-md p-6 sm:p-10 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={txHash}
              onChange={(e) => { setTxHash(e.target.value.trim()); setError(''); setStatus('idle'); }}
              placeholder="Enter transaction hash (0x...)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 font-mono text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all"
              disabled={verifying}
              onKeyDown={(e) => e.key === 'Enter' && !verifying && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={verifying || !txHash}
              className="w-full sm:w-auto px-8 py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:hover:shadow-none"
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
          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
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
          <div className="space-y-6 mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Verification Badge */}
            <div className={`p-6 rounded-2xl border shadow-[0_0_30px_rgba(16,185,129,0.1)] bg-emerald-500/5 border-emerald-500/30`}>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/50">
                          <div className="text-xs text-slate-500 mb-1 font-mono uppercase tracking-wider">Chain ID</div>
                          <div className="font-mono text-sm text-slate-300">{result.chainId}</div>
                        </div>
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/50">
                          <div className="text-xs text-slate-500 mb-1 font-mono uppercase tracking-wider">Target Token</div>
                          <div className="font-mono text-sm text-slate-300 truncate" title={result.tokenAddress}>
                            {result.tokenAddress}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800/50 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-500 mb-1 font-mono uppercase tracking-wider">Verdict</div>
                          <div className={`font-black text-lg ${
                            recommendation === 'ABORT' ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 
                            recommendation === 'CAUTION' ? 'text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                            'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                          }`}>
                            {recommendation}
                          </div>
                        </div>
                        <div className="text-right">
                           <div className="text-xs text-slate-500 mb-1 font-mono uppercase tracking-wider">Threat Score</div>
                           <div className="font-mono text-xl text-white font-bold">{result.threatScore}/100</div>
                        </div>
                      </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">Scan Hash (Content Fingerprint)</div>
                  <div className="font-mono text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 break-all">
                    {result.scanHash}
                  </div>
                  <div className="text-sm text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {new Date(result.timestamp * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'}
                    <div className="text-xs text-slate-500 mt-1">Block #{result.blockNumber.toString()}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <a
                  href={`${registryExplorerPrefix}/${result.txHash}`}
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
