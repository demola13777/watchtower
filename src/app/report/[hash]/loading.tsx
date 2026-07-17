import { Hexagon } from "lucide-react";
import Image from "next/image";

export default function ReportLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md h-16 flex-none">
        <div className="max-w-[1400px] w-full mx-auto px-6 h-full flex items-center">
          <div className="flex items-center gap-2">
            <Image src="/watchtower_logo.png" alt="WatchTower Logo" width={32} height={32} className="rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
            <span className="text-xl font-bold text-white">WatchTower</span>
          </div>
        </div>
      </nav>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading threat report...</p>
        </div>
      </div>
    </div>
  );
}
