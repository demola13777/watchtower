import { db } from '@/lib/db';
import { scans } from '@/lib/db/schema';
import { REGISTRY_CHAIN_ID } from '@/lib/config';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Shield, ShieldAlert, Activity, Zap, Hexagon, Fingerprint, Users, MessageCircle, Target, CheckCircle, ExternalLink } from "lucide-react";

// M3: Pre-defined complete Tailwind class names (no dynamic interpolation)
const STATUS_STYLES = {
  rose: {
    headerBg: 'from-rose-500/20 to-rose-900/5',
    text: 'text-rose-500',
    border: 'border-rose-500/40',
    iconBg: 'bg-rose-500/10',
    iconBorder: 'border-rose-500/30',
    bar: 'bg-rose-500',
    glow: 'shadow-[0_0_30px_rgba(244,63,94,0.2)]',
  },
  amber: {
    headerBg: 'from-amber-500/20 to-amber-900/5',
    text: 'text-amber-500',
    border: 'border-amber-500/40',
    iconBg: 'bg-amber-500/10',
    iconBorder: 'border-amber-500/30',
    bar: 'bg-amber-500',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]',
  },
  emerald: {
    headerBg: 'from-emerald-500/20 to-emerald-900/5',
    text: 'text-emerald-500',
    border: 'border-emerald-500/40',
    iconBg: 'bg-emerald-500/10',
    iconBorder: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]',
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
  tokenAddress?: string;
  target?: {
    tokenAddress: string;
    chainId?: string;
  };
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
    if (name.includes('Liquidity')) return <Activity className="h-4 w-4 text-cyan-400" />;
    if (name.includes('Contract')) return <Fingerprint className="h-4 w-4 text-purple-400" />;
    if (name.includes('Whale')) return <Users className="h-4 w-4 text-amber-400" />;
    if (name.includes('Social')) return <MessageCircle className="h-4 w-4 text-emerald-400" />;
    return <Zap className="h-4 w-4 text-slate-400" />;
  };

  // SVG Gauge calculations (reduced size for tighter layout)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (report.verdict.threatScore / 100) * circumference;

  return (
    <div className="min-h-screen text-slate-300 font-sans overflow-x-hidden flex flex-col relative transform-gpu">

      {/* Navbar (Tighter) */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md flex-none shadow-lg transform-gpu">
        <div className="max-w-[1400px] w-full mx-auto px-4 py-2 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <Image src="/watchtower_logo.png" alt="WatchTower Logo" width={24} height={24} className="rounded" />
            <span className="text-lg font-black text-white tracking-wide">WatchTower</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
            <div className="text-xs text-cyan-500/70 font-mono tracking-wider">
              {new Date(report.generatedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC'}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Tightened to fit on one screen */}
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col xl:flex-row gap-4 xl:min-h-[calc(100vh-3rem)] relative z-10">
        
        {/* Left Column: Hero & Details */}
        <div className="xl:w-[360px] flex flex-col gap-4 xl:min-h-0 animate-fade-in-up transform-gpu">
          {/* Executive Summary Hero */}
          <div className={`xl:flex-1 p-5 rounded-3xl bg-gradient-to-b ${styles.headerBg} border ${styles.border} relative overflow-hidden backdrop-blur-md ${styles.glow} transition-all flex flex-col items-center text-center justify-center transform-gpu`}>
            
            {/* SVG Circular Gauge */}
            <div className="relative w-32 h-32 flex items-center justify-center mb-4 group">
              <div className={`absolute inset-0 rounded-full blur-xl opacity-20 bg-current ${styles.text} group-hover:opacity-40 transition-opacity duration-700`} />
              <svg className="w-full h-full transform -rotate-90 relative z-10 drop-shadow-xl" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="transparent"
                  className="text-slate-800/40"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={`${styles.text} transition-all duration-1000 ease-out`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-black ${styles.text} leading-none tracking-tighter drop-shadow-md`}>
                  {report.verdict.threatScore}
                </span>
                <span className="text-xs text-slate-400/80 font-bold uppercase tracking-widest mt-0.5">
                  Score
                </span>
              </div>
            </div>

            <div className="relative z-10 w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${styles.iconBg} border ${styles.iconBorder}`}>
                  {isAbort || isCaution ? <ShieldAlert className={`h-5 w-5 ${styles.text}`} /> : <Shield className={`h-5 w-5 ${styles.text}`} />}
                </div>
                <h1 className="text-2xl font-black text-white uppercase tracking-wider">
                  {report.verdict.recommendation}
                </h1>
              </div>
              <p className="text-slate-300/90 text-sm leading-relaxed mb-4 px-2">
                {report.verdict.summary}
              </p>

              <div className="flex justify-between items-center text-xs text-slate-400 font-mono bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                <span>SAFE</span>
                <span className="text-cyan-400 font-bold">CONF:{' '}{(report.verdict.confidence * 100).toFixed(0)}%</span>
                <span>CRIT</span>
              </div>
            </div>
          </div>

          {/* Target Details */}
          <div className="p-4 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all flex-none relative overflow-hidden group transform-gpu">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Fingerprint className="h-16 w-16 text-cyan-500" />
            </div>
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-1.5 relative z-10">
              <Fingerprint className="h-3.5 w-3.5 text-cyan-400" /> Target Identity
            </h3>
            <div className="font-mono text-sm relative z-10">
              <span className="text-slate-500 block mb-1.5 text-[10px] sm:text-xs tracking-wider">CONTRACT ADDRESS</span>
              <div className="bg-slate-950/80 p-3 rounded-lg text-cyan-400 break-all border border-slate-800 hover:border-cyan-500/50 transition-colors shadow-inner text-xs">
                {report.target?.tokenAddress || report.tokenAddress || 'Unknown'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Modules & Action Plan */}
        <div className="flex-1 flex flex-col gap-4 xl:min-h-0">
          
          {/* Intelligence Modules (2x2 Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:flex-1">
            {report.intelligenceModules.map((module, i) => {
              const progressPct = Math.min((module.score / module.maxScore) * 100, 100);
              const scoreColor = module.score > (module.maxScore * 0.7) ? 'text-rose-400 bg-rose-500' : module.score > (module.maxScore * 0.3) ? 'text-amber-400 bg-amber-500' : 'text-emerald-400 bg-emerald-500';
              const textOnlyColor = module.score > (module.maxScore * 0.7) ? 'text-rose-400' : module.score > (module.maxScore * 0.3) ? 'text-amber-400' : 'text-emerald-400';
              const delayClass = `delay-${(i % 4) * 100 + 100}`;

              return (
              <div key={module.name} className={`animate-fade-in-up ${delayClass} p-4 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-cyan-500/40 hover:bg-slate-900/80 hover:shadow-[0_4px_20px_rgba(6,182,212,0.1)] transition-all group flex flex-col h-full cursor-default relative overflow-hidden transform-gpu`}>
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3 relative z-10">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80 group-hover:border-cyan-500/50 transition-colors">
                      {getModuleIcon(module.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 tracking-wide text-sm group-hover:text-cyan-50 transition-colors">{module.name}</h3>
                      {module.status === 'unavailable' && (
                        <span className="text-[10px] text-amber-500/90 uppercase tracking-wider font-semibold">Unavailable</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Fixed Typography/Alignment for Scores */}
                  <div className="flex flex-col items-end gap-1.5">
                    <div className={`text-xs font-bold font-mono tracking-wider tabular-nums ${textOnlyColor}`}>
                      {module.score} <span className="text-slate-500">/ {module.maxScore}</span>
                    </div>
                    <div className="w-12 bg-slate-950/80 rounded-full h-1 border border-slate-800/80 overflow-hidden shadow-inner">
                      <div className={`h-full rounded-full ${scoreColor.split(' ')[1]}`} style={{ width: `${progressPct}%` }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center relative z-10">
                  {module.signals && module.signals.length > 0 ? (
                    <ul className="space-y-2">
                      {module.signals.map((sig: string, idx: number) => (
                        <li key={idx} className="text-xs sm:text-sm text-slate-300/90 flex items-start gap-2">
                          <span className={`${textOnlyColor} mt-0.5 flex-shrink-0`}>•</span>
                          <span className="leading-snug">{sig}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs sm:text-sm text-emerald-400/90 flex items-center gap-2 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 shadow-inner">
                      <CheckCircle className="h-4 w-4 text-emerald-500" /> 
                      <span className="font-medium tracking-wide">No threat signals detected.</span>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
          
          {/* Action Plan */}
          <div className="animate-fade-in-up delay-400 p-4 sm:p-5 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 transition-all flex-none relative overflow-hidden transform-gpu">
             <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 hover:opacity-100 transition-opacity" />
            <h3 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2 relative z-10">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Target className="h-4 w-4 text-amber-400" />
              </div>
              Strategic Action Plan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
              {report.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex gap-3 text-sm text-slate-200 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 transition-colors group/item">
                  <div className="flex-shrink-0 mt-0.5">
                    <CheckCircle className="h-4 w-4 text-cyan-500 opacity-60 group-hover/item:opacity-100 transition-opacity" />
                  </div>
                  <span className="leading-snug">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Footer */}
          <footer className="animate-fade-in-up delay-400 flex-none relative z-10">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono transition-all transform-gpu">
              <div className={`flex items-center gap-2 ${hasOnChainProof ? 'text-emerald-400' : 'text-slate-400'}`}>
                {hasOnChainProof ? (
                  <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                    {/* Fix for blink artifact: reduced spread, removed absolute ping overlapping container bounds */}
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                  </div>
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
                <span className="tracking-wide font-semibold">{hasOnChainProof ? 'Verified On-Chain Attestation' : 'Off-Chain Hash (Blockchain pending)'}</span>
              </div>
              {hasOnChainProof ? (
                <a 
                  href={`${REGISTRY_EXPLORER_PREFIX}/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 text-slate-300 hover:text-cyan-400 bg-slate-950/90 px-4 py-2 rounded-lg border border-slate-800 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all cursor-pointer group"
                >
                  <Fingerprint className="h-3 w-3 opacity-70 group-hover:text-cyan-400 transition-colors" />
                  <span className="hidden sm:inline text-slate-500 tracking-widest text-[10px]">TX</span>
                  <span className="truncate max-w-[200px] sm:max-w-none font-medium">{txHash}</span>
                  <ExternalLink className="h-3 w-3 ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : (
                <div className="flex items-center gap-2 text-slate-400 bg-slate-950/90 px-4 py-2 rounded-lg border border-slate-800">
                  <Fingerprint className="h-3 w-3 opacity-50" />
                  <span className="hidden sm:inline text-slate-500 tracking-widest text-[10px]">HASH</span>
                  <span className="truncate max-w-[200px] sm:max-w-none font-medium">{report.verification?.scanHash || hash}</span>
                </div>
              )}
            </div>
          </footer>

          {/* Navigation Links */}
          <div className="flex-none flex justify-center gap-6 text-xs mt-1 mb-2 font-medium tracking-wide">
            <Link href="/network" className="text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1">
              <span className="mb-0.5">←</span> Network Explorer
            </Link>
            {txHash && (
              <Link href={`/verify?tx=${txHash}`} className="text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1">
                Verify This Scan <span className="mb-0.5">→</span>
              </Link>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}

