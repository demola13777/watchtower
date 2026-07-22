"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles } from "lucide-react";

const ACTIVE_HALO_MESSAGES = [
  { text: "Target detected. Agent Relay listening...", icon: <Bot className="h-3.5 w-3.5 text-cyan-400" /> },
  { text: "Autonomous Agent Scan Recommended", icon: <Bot className="h-3.5 w-3.5 text-emerald-400" /> },
  { text: "Claude / MCP clients support single-flow execution", icon: <Sparkles className="h-3.5 w-3.5 text-amber-400" /> },
];

export function AgentRelayPanel() {
  const [messageIndex, setMessageIndex] = useState(0);
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
      </div>
    </div>
  );
}
