import { db } from '@/lib/db';
import { scans } from '@/lib/db/schema';
import { REGISTRY_CHAIN_ID } from '@/lib/config';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shield, ShieldAlert, Activity, Zap, Hexagon, Fingerprint, Users, MessageCircle, Target, CheckCircle, ExternalLink } from "lucide-react";

// M3: Pre-defined complete Tailwind class names (no dynamic interpolation)
const STATUS_STYLES = {
  rose: {
    headerBg: 'from-rose-500/20 to-rose-900/5',
    text: 'text-rose-500',
    border: 'border-rose-500/30',
    iconBg: 'bg-rose-500/10',
    iconBorder: 'border-rose-500/20',
    bar: 'bg-rose-500',
  },
  amber: {
    headerBg: 'from-amber-500/20 to-amber-900/5',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/10',
    iconBorder: 'border-amber-500/20',
    bar: 'bg-amber-500',
  },
  emerald: {
    headerBg: 'from-emerald-500/20 to-emerald-900/5',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/10',
    iconBorder: 'border-emerald-500/20',
    bar: 'bg-emerald-500',
  },
} as const;

const REGISTRY_EXPLORER_PREFIX = REGISTRY_CHAIN_ID === '196'
  ? 'https://www.oklink.com/xlayer/tx'
  : 'https://www.oklink.com/xlayer-test/tx';

interface ReportModule {
  name: string;
  score: number;
  maxScore: number;
  signals: string[];
  status: 'active' | 'unavailable' | 'coming_soon';
}

interface DeepScanReportView {
  generatedAt: string;
  chainId?: string;
  tokenAddress: string;
  verdict: {
    threatScore: number;
    confidence: number;
    recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
    summary: string;
  };
  intelligenceModules: ReportModule[];
  recommendations: string[];
  verification?: {
    scanHash?: string;
    txHash?: string | null;
  };
}

export default async function ReportPage({ params }: { params: Promise<{ hash: string }> }) {
  const resolvedParams = await params;
  const hash = resolvedParams.hash;

  const [scan] = await db.select({
    reportData: scans.reportData,
    txHash: scans.txHash,
  })
    .from(scans)
    .where(eq(scans.scanHash, hash))
    .limit(1);

  if (!scan || !scan.reportData) {
    return notFound();
  }

  // M5: Safe JSON parsing
  let report: DeepScanReportView;
  try {
    report = JSON.parse(scan.reportData) as DeepScanReportView;
  } catch {
    return notFound();
  }

  const isAbort = report.verdict.recommendation === 'ABORT';
  const isCaution = report.verdict.recommendation === 'CAUTION';
  
  const statusKey = isAbort ? 'rose' : isCaution ? 'amber' : 'emerald';
  const styles = STATUS_STYLES[statusKey];

  // C6: Determine if we have a real on-chain transaction hash
  const txHash = report.verification?.txHash || scan.txHash;
  const hasOnChainProof = !!txHash;

  const getModuleIcon = (name: string) => {
    if (name.includes('Liquidity')) return <Activity className="h-5 w-5 text-cyan-400" />;
    if (name.includes('Contract')) return <Fingerprint className="h-5 w-5 text-purple-400" />;
    if (name.includes('Whale')) return <Users className="h-5 w-5 text-amber-400" />;
    if (name.includes('Social')) return <MessageCircle className="h-5 w-5 text-emerald-400" />;
    return <Zap className="h-5 w-5 text-slate-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-cyan-500/30 overflow-x-hidden flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md min-h-16 flex-none">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-3 sm:h-16 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">WatchTower</span>
          </div>
          {/* M8: Consistent UTC date formatting */}
          <div className="text-xs text-slate-500 font-mono break-all sm:break-normal">
            {new Date(report.generatedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'}
          </div>
        </div>
      </nav>

      {/* Main Content - Designed for Single Viewport */}
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col xl:flex-row gap-6 xl:min-h-[calc(100vh-4rem)]">
        
        {/* Left Column: Hero & Details */}
        <div className="xl:w-[380px] flex flex-col gap-5 xl:min-h-0">
          {/* Executive Summary Hero */}
          <div className={`xl:flex-1 p-4 sm:p-6 rounded-3xl bg-gradient-to-b ${styles.headerBg} border ${styles.border} relative overflow-hidden backdrop-blur-xl shadow-2xl hover:shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-1 flex flex-col justify-center`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${styles.iconBg} border ${styles.iconBorder}`}>
                  {isAbort || isCaution ? <ShieldAlert className={`h-10 w-10 ${styles.text}`} /> : <Shield className={`h-10 w-10 ${styles.text}`} />}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 mb-1 uppercase tracking-widest font-bold">Threat Score</div>
                  <div className={`text-5xl font-black ${styles.text} leading-none tracking-tighter`}>
                    {report.verdict.threatScore}
                  </div>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase mb-3">
                {report.verdict.recommendation}
              </h1>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                {report.verdict.summary}
              </p>

              <div className="w-full bg-slate-900/80 rounded-full h-3 mb-2 border border-slate-800/50 overflow-hidden">
                <div className={`h-full rounded-full ${styles.bar} transition-all duration-1000 ease-out`} style={{ width: `${report.verdict.threatScore}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>Safe</span>
                <span>Confidence: {report.verdict.confidence * 100}%</span>
                <span>Critical</span>
              </div>
            </div>
          </div>

          {/* Target Details */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/50 backdrop-blur-md border border-slate-800/50 hover:border-slate-700 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 flex-none">
            <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest flex items-center gap-2">
              <Fingerprint className="h-4 w-4" /> Target Identity
            </h3>
            <div className="font-mono text-sm">
              <span className="text-slate-500 block mb-2 text-[10px]">Contract Address</span>
              <div className="bg-slate-900/80 p-3 rounded-xl text-cyan-400 break-all border border-slate-800/80 hover:border-cyan-500/30 transition-colors shadow-inner text-xs md:text-sm">
                {report.tokenAddress}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Modules & Action Plan */}
        <div className="flex-1 flex flex-col gap-5 xl:min-h-0">
          
          {/* Intelligence Modules (2x2 Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 xl:flex-1">
            {report.intelligenceModules.map((module) => {
              // Calculate width for the progress bar based on score vs maxScore
              const progressPct = Math.min((module.score / module.maxScore) * 100, 100);
              const scoreColor = module.score > (module.maxScore * 0.7) ? 'text-rose-400 bg-rose-500' : module.score > (module.maxScore * 0.3) ? 'text-amber-400 bg-amber-500' : 'text-emerald-400 bg-emerald-500';
              const textOnlyColor = module.score > (module.maxScore * 0.7) ? 'text-rose-400' : module.score > (module.maxScore * 0.3) ? 'text-amber-400' : 'text-emerald-400';

              return (
              <div key={module.name} className="p-4 sm:p-5 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-slate-800/60 hover:border-cyan-500/30 hover:bg-slate-900/60 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)] transition-all duration-500 group flex flex-col h-full cursor-default">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 group-hover:border-cyan-500/40 group-hover:scale-110 transition-transform duration-500 shadow-lg">
                      {getModuleIcon(module.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 tracking-wide text-sm sm:text-base">{module.name}</h3>
                      {module.status === 'unavailable' && (
                        <span className="text-[10px] text-amber-500/80 uppercase tracking-wider font-semibold">Unavailable</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Fixed Typography/Alignment for Scores */}
                  <div className="flex flex-col items-end gap-1.5">
                    <div className={`text-sm font-bold font-mono tracking-wider tabular-nums ${textOnlyColor}`}>
                      {module.score} <span className="text-slate-600">/ {module.maxScore}</span>
                    </div>
                    <div className="w-16 bg-slate-950 rounded-full h-1.5 border border-slate-800/50">
                      <div className={`h-full rounded-full ${scoreColor.split(' ')[1]}`} style={{ width: `${progressPct}%` }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center">
                  {module.signals && module.signals.length > 0 ? (
                    <ul className="space-y-3">
                      {module.signals.map((sig: string, i: number) => (
                        <li key={i} className="text-sm text-slate-400 flex items-start gap-3">
                          <span className="text-rose-500 mt-1 flex-shrink-0">•</span>
                          <span className="leading-relaxed">{sig}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-emerald-500/80 flex items-center gap-2 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                      <CheckCircle className="h-5 w-5" /> No threat signals detected.
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
          
          {/* Action Plan */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/40 backdrop-blur-md border border-slate-800/60 hover:border-slate-700 hover:-translate-y-1 hover:shadow-2xl transition-all duration-500 flex-none">
            <h3 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
              </div>
              Strategic Action Plan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {report.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex gap-4 text-sm text-slate-300 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 hover:border-cyan-500/20 transition-colors group">
                  <div className="flex-shrink-0 mt-0.5">
                    <CheckCircle className="h-5 w-5 text-cyan-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="leading-relaxed">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Footer — C6: Conditional explorer link */}
          <footer className="flex-none">
            <div className="p-4 rounded-2xl bg-slate-900/30 backdrop-blur-xl border border-slate-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs font-mono hover:border-slate-700/50 hover:shadow-lg transition-all duration-500">
              <div className={`flex items-center gap-2 ${hasOnChainProof ? 'text-emerald-500/80' : 'text-slate-500'}`}>
                <Shield className="h-4 w-4" />
                {hasOnChainProof ? 'Verified On-Chain Attestation' : 'Off-Chain Hash (Blockchain pending)'}
              </div>
              {hasOnChainProof ? (
                <a 
                  href={`${REGISTRY_EXPLORER_PREFIX}/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800/80 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all duration-300 cursor-pointer group"
                >
                  <Fingerprint className="h-3 w-3 opacity-70 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">Tx: </span>
                  <span className="truncate max-w-[200px] sm:max-w-none">{txHash}</span>
                  <ExternalLink className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </a>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800/80">
                  <Fingerprint className="h-3 w-3 opacity-70" />
                  <span className="hidden sm:inline">Content Hash: </span>
                  <span className="truncate max-w-[200px] sm:max-w-none">{report.verification?.scanHash || hash}</span>
                </div>
              )}
            </div>
          </footer>

          {/* Navigation Links */}
          <div className="flex-none flex justify-center gap-4 text-xs mt-4">
            <Link href="/" className="text-slate-500 hover:text-cyan-400 transition-colors">← Network Explorer</Link>
            {txHash && (
              <Link href={`/verify?tx=${txHash}`} className="text-slate-500 hover:text-emerald-400 transition-colors">Verify This Scan →</Link>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}
