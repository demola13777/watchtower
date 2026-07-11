"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ children, language = "bash" }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCode = (code: string) => {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    if (language === "bash") {
      return escapedCode.split('\n').map((line, i) => {
        const highlighted = line
          .replace(/^(npm|cd|cp)/, '<span class="text-cyan-400">$1</span>')
          .replace(/(install|build|run|dev)/, '<span class="text-purple-400">$1</span>');
        
        return <span key={i} className="block" dangerouslySetInnerHTML={{ __html: highlighted || ' ' }} />;
      });
    }
    
    // JS/TS Fallback
    return escapedCode.split('\n').map((line, i) => {
      const highlighted = line
        .replace(/\b(const|let|var|import|from|try|catch|if|else|await|async|new|throw)\b/g, '<span class="text-purple-400">$1</span>')
        .replace(/\b(function|return|console|process|navigator)\b/g, '<span class="text-cyan-400">$1</span>')
        .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '<span class="text-emerald-400">$&</span>')
        .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-amber-400">$1</span>')
        // Basic comment highlighting
        .replace(/(\/\/.*$)/, '<span class="text-slate-500">$1</span>');

      return (
        <span key={i} className="block" dangerouslySetInnerHTML={{ __html: highlighted || ' ' }} />
      );
    });
  };

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      {/* macOS Style Header */}
      <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-slate-700/50 border border-slate-600/50 group-hover:bg-rose-500/80 transition-colors"></div>
            <div className="h-3 w-3 rounded-full bg-slate-700/50 border border-slate-600/50 group-hover:bg-amber-500/80 transition-colors"></div>
            <div className="h-3 w-3 rounded-full bg-slate-700/50 border border-slate-600/50 group-hover:bg-emerald-500/80 transition-colors"></div>
          </div>
        </div>
        
        <button
          onClick={handleCopy}
          className="flex items-center justify-center rounded-md p-1.5 text-slate-500 transition-all hover:bg-slate-800 hover:text-slate-300 active:scale-95"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />}
        </button>
      </div>
      
      <div className="overflow-x-auto p-4">
        <pre className="font-mono text-sm leading-relaxed text-slate-300">
          <code>{renderCode(children)}</code>
        </pre>
      </div>
    </div>
  );
}
