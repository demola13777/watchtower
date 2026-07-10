"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronDown, Copy, Fingerprint, Network, Sparkles, Wallet } from "lucide-react";

export interface AgentRelayPaymentRequirement {
  network: string;
  chainId: number;
  currency: string;
  tokenAddress: string;
  tokenDecimals: number;
  amount: string;
  payTo: string;
  tier: string;
}

const ACTIVE_HALO_MESSAGES = [
  { text: "Target detected. Agent Relay listening...", icon: <Bot className="h-3.5 w-3.5 text-cyan-400" /> },
  { text: "Autonomous Agent Scan Recommended", icon: <Bot className="h-3.5 w-3.5 text-emerald-400" /> },
  { text: "Claude / MCP clients support single-flow execution", icon: <Sparkles className="h-3.5 w-3.5 text-amber-400" /> },
];

function shorten(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string; }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-900/60 px-3 py-2.5 border border-slate-800/50">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="truncate font-mono text-xs text-slate-300" title={value}>{shorten(value)}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800 text-slate-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors"
      >
        {copied ? <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function AgentRelayPanel({ requirement }: { requirement?: AgentRelayPaymentRequirement }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Entrance animation delay
    const enterTimeout = setTimeout(() => setIsVisible(true), 50);
    const interval = setInterval(() => {
      setMessageIndex((index) => (index + 1) % ACTIVE_HALO_MESSAGES.length);
    }, 3500); // Premium, slower cycle
    return () => {
      clearTimeout(enterTimeout);
      clearInterval(interval);
    };
  }, []);



  return (
    <div className={`mt-4 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
      {/* Active Halo Bar */}
      <div className="relative overflow-hidden rounded-full border border-slate-800 bg-slate-950/90 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(6,182,212,0.2)] flex items-center justify-between p-1.5 sm:p-2 pr-4 z-10 transition-colors duration-500 hover:border-slate-700/80">
        
        {/* Left: The Halo Core */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center flex-none">
            {/* Spinning Rings */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-[spin_8s_linear_infinite]" />
            <div className="absolute inset-0.5 rounded-full border border-emerald-500/20 animate-[spin_12s_linear_infinite_reverse]" />
            <div className="absolute inset-[5px] rounded-full border border-dashed border-cyan-400/30 animate-[spin_20s_linear_infinite]" />
            
            {/* Glowing Core */}
            <div className="absolute h-6 w-6 rounded-full bg-cyan-500/20 blur-md animate-pulse" />
            
            {/* Center Icon */}
            <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.2)]">
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            
            {/* Active Status Dot */}
            <div className="absolute bottom-0 right-0 sm:bottom-0.5 sm:right-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] border border-slate-950" />
          </div>

          {/* Center: Dynamic Messaging */}
          <div className="relative h-6 flex items-center flex-1 min-w-0">
            {ACTIVE_HALO_MESSAGES.map((msg, i) => (
              <div 
                key={i}
                className={`absolute inset-0 flex items-center gap-2 sm:gap-2.5 transition-all duration-700 ease-out ${
                  messageIndex === i 
                    ? 'opacity-100 translate-y-0 scale-100 blur-none' 
                    : 'opacity-0 translate-y-3 scale-95 blur-[2px] pointer-events-none'
                }`}
              >
                <div className="flex-none bg-slate-900 border border-slate-800 rounded-full p-1 hidden sm:flex">
                  {msg.icon}
                </div>
                <span className="text-xs sm:text-sm font-medium text-slate-200 truncate pr-2">
                  {msg.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: x402 context toggle */}
        <button
          onClick={() => setDetailsOpen(!detailsOpen)}
          className={`flex-none flex items-center gap-1.5 pl-3 sm:pl-4 border-l border-slate-800 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${
            requirement ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <span className="hidden sm:inline">Payment Details</span>
          <span className="sm:hidden">Details</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] ${detailsOpen ? 'rotate-180 text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* x402 challenge details dropdown */}
      <div 
        className={`grid transition-all duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] relative z-0 ${
          detailsOpen ? 'grid-rows-[1fr] opacity-100 -mt-2' : 'grid-rows-[0fr] opacity-0 -mt-8 pointer-events-none'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-5 pb-1 px-1">
            {requirement ? (
                <div className="grid gap-2 sm:grid-cols-2 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-2 sm:p-3 shadow-inner">
                  <DetailRow icon={<Wallet className="h-3.5 w-3.5" />} label="Amount" value={`${requirement.amount} ${requirement.currency}`} />
                  <DetailRow icon={<Network className="h-3.5 w-3.5" />} label="Chain" value={`${requirement.network} (${requirement.chainId})`} />
                  <DetailRow icon={<Fingerprint className="h-3.5 w-3.5" />} label="Token Contract" value={requirement.tokenAddress} />
                  <DetailRow icon={<Wallet className="h-3.5 w-3.5" />} label="Treasury" value={requirement.payTo} />
                </div>
            ) : (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-xs text-slate-500">
                Run a scan to generate a live x402 payment challenge. No placeholder invoice is shown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
