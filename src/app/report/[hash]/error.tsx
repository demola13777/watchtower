"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ReportError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-900/10 border border-rose-500/30">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Report Unavailable</h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Something went wrong loading this report. The scan data may be corrupted or the report may no longer exist.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all text-sm font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
