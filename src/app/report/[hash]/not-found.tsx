import { Shield } from "lucide-react";
import Link from "next/link";

export default function ReportNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-900 border border-slate-800 mb-6">
          <Shield className="h-8 w-8 text-slate-600" />
        </div>
        <h1 className="text-2xl font-black text-white mb-3">Report Not Found</h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          This scan report doesn&apos;t exist or the hash is invalid. Reports are generated when a deep scan completes successfully.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
        >
          Back to Network Explorer
        </Link>
      </div>
    </div>
  );
}
