import Link from "next/link";
import { 
  Shield, 
  Terminal, 
  Zap, 
  Hexagon, 
  ChevronRight,
  Activity, 
  Fingerprint, 
  Users, 
  MessageCircle,
  Code2,
  Lock,
  ArrowRight,
  Database
} from "lucide-react";

const GITHUB_URL = "https://github.com/demola13777/watchtower";

export default function Home() {
  return (
    <div className="min-h-screen text-slate-300 font-sans overflow-hidden">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">WatchTower</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-sm font-medium text-slate-400 hover:text-white transition-colors">
              GitHub
            </Link>
            <Link href="/docs" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Docs
            </Link>
            <Link href="#integrate" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              SDK
            </Link>
            <Link href="/network" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium hover:border-cyan-500/50 hover:bg-slate-800 transition-all group">
              X Layer Mainnet
              <Activity className="h-3.5 w-3.5 text-emerald-500 group-hover:animate-pulse" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative">
        {/* Background glow */}
        <div className="absolute top-0 inset-x-0 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* 1. Hero Section */}
        <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center animate-fade-in-up delay-100">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs font-bold mb-8 shadow-sm">
            <Terminal className="h-4 w-4 text-emerald-400" /> <span className="opacity-70 text-slate-500">$</span> npm i okx-watchtower-middleware
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-black text-white mb-6 leading-tight drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
            Pre-Execution Security for <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              Autonomous Trading Agents.
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            WatchTower is an API-native intelligence oracle. We run low-latency, multi-layer threat scans to block honeypots and malicious contracts <strong className="text-white">before</strong> your agent signs the transaction.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/docs" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-2">
                Read the Docs
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link 
              href="/network" 
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-white font-bold hover:bg-slate-800 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
            >
              Explore the Network
              <Activity className="h-4 w-4 text-emerald-400 group-hover:animate-pulse" />
            </Link>
          </div>
        </section>

        {/* 2. Developer Integration (Split Section) */}
        <section id="integrate" className="relative z-10 animate-fade-in-up delay-200">
          <div className="max-w-7xl mx-auto px-4 pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-6">A security gate your agent can enforce before execution.</h2>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  No dashboards in the execution path. WatchTower pairs a machine-readable verdict with a self-hosted x402-style payment boundary, so agents can acquire threat intelligence per scan on X Layer Mainnet.
                </p>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-6 w-6 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Zap className="h-3 w-3 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Synchronous API</h4>
                      <p className="text-sm text-slate-500">Fast request-response checks for automated trading and risk agents.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-6 w-6 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Code2 className="h-3 w-3 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Native MCP Server</h4>
                      <p className="text-sm text-slate-500">Expose the same threat intelligence to MCP-compatible agent runtimes through one protected tool surface.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Snippet Block */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/50" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/50" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/50" />
                  </div>
                  <span className="text-xs text-slate-500 font-mono ml-2">agent.ts</span>
                </div>
                <div className="p-6 overflow-x-auto text-sm font-mono leading-relaxed relative z-10">
                  <pre>
                    <code className="text-slate-300">
<span className="text-purple-400">import</span> {'{ WatchTowerClient }'} <span className="text-purple-400">from</span> <span className="text-emerald-400">&apos;okx-watchtower-middleware&apos;</span>;{'\n\n'}
<span className="text-slate-500">{"// Pin automatic settlement to your X Layer Mainnet policy"}</span>{'\n'}
<span className="text-purple-400">const</span> wt = <span className="text-purple-400">new</span> WatchTowerClient({'{'}{'\n'}
{'  '}apiUrl: <span className="text-emerald-400">&apos;https://watchtowr.xyz&apos;</span>,{'\n'}
{'  '}agentWallet: <span className="text-emerald-400">&apos;0xYourAgent...&apos;</span>,{'\n'}
{'  '}chainId: <span className="text-purple-400">196</span>,{'\n'}
{'  '}paymentPrivateKey: process.env.AGENT_PAYMENT_KEY,{'\n'}
{'  '}paymentPolicy: {'{'}{'\n'}
{'    '}apiOrigin: <span className="text-emerald-400">&apos;https://watchtowr.xyz&apos;</span>,{'\n'}
{'    '}chainId: <span className="text-purple-400">196</span>,{'\n'}
{'    '}tokenAddress: process.env.MAINNET_USDT_ADDRESS,{'\n'}
{'    '}treasuryAddress: process.env.MAINNET_TREASURY_ADDRESS,{'\n'}
{'    '}maxAmount: <span className="text-emerald-400">&apos;1&apos;</span>,{'\n'}
{'  }'}, {'\n'}
{'}'});{'\n\n'}
<span className="text-purple-400">async function</span> <span className="text-blue-400">executeTrade</span>(targetToken) {'{'}{'\n'}
{'  '}<span className="text-slate-500">{"// 1. Run the Firewall Scan (Costs 0.5 USDT via x402)"}</span>{'\n'}
{'  '}<span className="text-purple-400">const</span> intel = <span className="text-purple-400">await</span> wt.guardTransaction(targetToken);{'\n\n'}
{'  '}<span className="text-slate-500">{"// 2. Enforce strict safety thresholds"}</span>{'\n'}
{'  '}<span className="text-purple-400">if</span> (intel.recommendation === <span className="text-emerald-400">&apos;ABORT&apos;</span>) {'{'}{'\n'}
{'    '}console.log(<span className="text-emerald-400">`Trade blocked. Score: ${'{'}intel.threatScore{'}'}`</span>);{'\n'}
{'    '}<span className="text-purple-400">return</span>;{'\n'}
{'  }'}{'\n\n'}
{'  '}<span className="text-slate-500">{"// 3. Safe to execute"}</span>{'\n'}
{'  '}<span className="text-purple-400">await</span> router.swap(targetToken);{'\n'}
{'}'}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Agent Flow Graphic */}
        <section className="max-w-5xl mx-auto px-4 pb-24 animate-fade-in-up delay-300">
          <div className="p-1 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden shadow-2xl">
            <div className="bg-slate-950/90 backdrop-blur-xl rounded-[22px] p-6 sm:p-10 border border-slate-800/50 relative z-10 flex flex-col md:flex-row gap-8 items-center">
              
              {/* Intent */}
              <div className="flex-1 w-full bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl overflow-hidden shadow-lg group hover:shadow-[0_0_20px_rgba(148,163,184,0.1)] transition-all">
                <div className="bg-slate-800/50 px-4 py-2 text-xs font-mono text-slate-500 border-b border-slate-800 flex items-center justify-between">
                  <span>1. Agent Intent</span>
                  <Code2 className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div className="p-4 font-mono text-sm leading-relaxed">
                  <span className="text-slate-400">{'{'}</span><br/>
                  <span className="text-cyan-400 ml-4">&quot;action&quot;</span><span className="text-slate-400">: </span><span className="text-emerald-400">&quot;swap&quot;</span><span className="text-slate-400">,</span><br/>
                  <span className="text-cyan-400 ml-4">&quot;target&quot;</span><span className="text-slate-400">: </span><span className="text-emerald-400">&quot;0x123...&quot;</span><br/>
                  <span className="text-slate-400">{'}'}</span>
                </div>
              </div>

              <div className="text-slate-600 hidden md:block">
                <ArrowRight className="h-6 w-6" />
              </div>

              {/* Oracle */}
              <div className="flex-1 w-full flex flex-col items-center">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/50 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                  <Hexagon className="h-8 w-8 text-cyan-400" />
                </div>
                <div className="w-full space-y-2">
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-400 w-full animate-pulse"></div></div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-purple-400 w-full animate-pulse delay-75"></div></div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-400 w-full animate-pulse delay-150"></div></div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 w-full animate-pulse delay-200"></div></div>
                </div>
                <div className="mt-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                  WatchTower Oracle <br/> 4 Threat Modules
                </div>
              </div>

              <div className="text-slate-600 hidden md:block">
                <ArrowRight className="h-6 w-6" />
              </div>

              {/* Verdict */}
              <div className="flex-1 w-full bg-slate-900/60 backdrop-blur-md border border-rose-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(244,63,94,0.1)] group hover:shadow-[0_0_30px_rgba(244,63,94,0.2)] transition-all">
                <div className="bg-rose-500/10 px-4 py-2 text-xs font-mono text-rose-400 border-b border-rose-500/20 flex items-center justify-between">
                  <span>3. Verdict Payload</span>
                  <Lock className="h-3.5 w-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-4 font-mono text-sm leading-relaxed">
                  <span className="text-slate-400">{'{'}</span><br/>
                  <span className="text-rose-400 ml-4">&quot;recommendation&quot;</span><span className="text-slate-400">: </span><span className="text-rose-400">&quot;ABORT&quot;</span><span className="text-slate-400">,</span><br/>
                  <span className="text-cyan-400 ml-4">&quot;score&quot;</span><span className="text-slate-400">: </span><span className="text-purple-400">92</span><span className="text-slate-400">,</span><br/>
                  <span className="text-cyan-400 ml-4">&quot;reason&quot;</span><span className="text-slate-400">: </span><span className="text-emerald-400">&quot;Hidden Mint&quot;</span><br/>
                  <span className="text-slate-400">{'}'}</span>
                </div>
              </div>
              
            </div>
          </div>
        </section>

        {/* 4. Threat Modules Grid */}
        <section className="max-w-7xl mx-auto px-4 py-24 border-t border-slate-800 bg-slate-900/20 backdrop-blur-sm animate-fade-in-up delay-400">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Multi-Layered Threat Detection</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Our engine runs four parallel analysis modules to build a comprehensive risk profile of any ERC-20 token in under a second.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-cyan-500/50 hover:-translate-y-1 hover:bg-slate-900/80 hover:shadow-[0_4px_25px_rgba(6,182,212,0.15)] transition-all group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
                <Activity className="h-6 w-6 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Liquidity Intelligence</h3>
              <div className="space-y-2 font-mono text-sm text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-800/80">
                <div><span className="text-cyan-400">liquidity_usd:</span> <span className="text-rose-400">&quot;low&quot;</span></div>
                <div><span className="text-cyan-400">volume_24h:</span> <span className="text-amber-400">&quot;thin&quot;</span></div>
                <div><span className="text-cyan-400">pair_age:</span> <span className="text-rose-400">&quot;new&quot;</span></div>
              </div>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-purple-500/50 hover:-translate-y-1 hover:bg-slate-900/80 hover:shadow-[0_4px_25px_rgba(168,85,247,0.15)] transition-all group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Fingerprint className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Contract DNA Scanner</h3>
              <div className="space-y-2 font-mono text-sm text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-800/80">
                <div><span className="text-purple-400">is_honeypot:</span> <span className="text-emerald-400">false</span></div>
                <div><span className="text-purple-400">has_hidden_mint:</span> <span className="text-rose-400">true</span></div>
                <div><span className="text-purple-400">can_take_back_ownership:</span> <span className="text-rose-400">true</span></div>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-amber-500/50 hover:-translate-y-1 hover:bg-slate-900/80 hover:shadow-[0_4px_25px_rgba(245,158,11,0.15)] transition-all group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Whale & Holder Analysis</h3>
              <div className="space-y-2 font-mono text-sm text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-800/80">
                <div><span className="text-amber-400">top_10_holder_concentration:</span> <span className="text-rose-400">&quot;85.4%&quot;</span></div>
                <div><span className="text-amber-400">creator_wallet_balance:</span> <span className="text-emerald-400">&quot;0.00&quot;</span></div>
                <div><span className="text-amber-400">is_supply_centralized:</span> <span className="text-rose-400">true</span></div>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-emerald-500/50 hover:-translate-y-1 hover:bg-slate-900/80 hover:shadow-[0_4px_25px_rgba(16,185,129,0.15)] transition-all group relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <MessageCircle className="h-6 w-6 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Social Threat Radar</h3>
              <div className="space-y-2 font-mono text-sm text-slate-400 bg-slate-900 p-4 rounded-xl border border-slate-800/80">
                <div><span className="text-emerald-400">social_links:</span> <span className="text-amber-400">&quot;missing&quot;</span></div>
                <div><span className="text-emerald-400">buy_sell_ratio:</span> <span className="text-rose-400">&quot;skewed&quot;</span></div>
                <div><span className="text-emerald-400">price_change_24h:</span> <span className="text-amber-400">&quot;volatile&quot;</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Transparency & Receipts */}
        <section className="border-t border-slate-800/50 bg-slate-950/40 backdrop-blur-sm py-24 animate-fade-in-up delay-500">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Cryptographic Proof for Every Decision.</h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-10">
              When your agent blocks a trade or executes a risky swap, your users will ask why. WatchTower&apos;s Deep Scans automatically generate an immutable <code className="text-cyan-400 font-mono bg-cyan-400/10 px-1.5 py-0.5 rounded">scanHash</code> on X Layer. Serve these cryptographic receipts to your users to prove your agent acted on verifiable threat intelligence.
            </p>
            
            <div className="inline-flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/verify" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/50 transition-all text-sm font-bold text-white group shadow-sm">
                <Database className="h-4 w-4 text-cyan-400" />
                Verify an On-Chain Attestation
              </Link>
              <Link href="/network" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-emerald-500/50 transition-all text-sm font-bold text-white group shadow-sm">
                <Activity className="h-4 w-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                View Scan History
              </Link>
            </div>
          </div>
        </section>

        {/* 6. Pricing */}
        <section id="pricing" className="max-w-5xl mx-auto px-4 pb-24 animate-fade-in-up delay-600">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">API Pricing for Autonomous Scale</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto mb-4">
              WatchTower uses self-hosted x402-style machine-to-machine payments. Pay purely for what your agents consume. No subscriptions.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold rounded-lg shadow-sm">
              <Zap className="h-3.5 w-3.5" /> X Layer Mainnet-ready: payment policy, settlement verification, and attestation are network-configured.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-700/50 flex flex-col h-full hover:border-slate-500/50 transition-colors shadow-lg">
              <h3 className="text-lg font-bold text-slate-300 mb-1">Tier 2: Firewall</h3>
              <div className="text-3xl font-black text-white mb-6">0.5 USDT <span className="text-sm font-normal text-slate-500 font-mono">/ scan</span></div>
              <ul className="space-y-3 mb-8 text-sm text-slate-400 flex-grow">
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-500 shrink-0" /> Instant cache-based threat score (0-100)</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-500 shrink-0" /> Recommendation (TRADE/CAUTION/ABORT)</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-500 shrink-0" /> Perfect for high-frequency trading bots</li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-md border border-cyan-500/40 relative overflow-hidden flex flex-col h-full shadow-[0_0_50px_rgba(6,182,212,0.2)] hover:shadow-[0_0_60px_rgba(6,182,212,0.3)] hover:-translate-y-1 transition-all">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
              <div className="absolute top-6 right-6 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border border-cyan-500/20">
                Popular
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Tier 1: Deep Scan</h3>
              <div className="text-3xl font-black text-white mb-6">1.0 USDT <span className="text-sm font-normal text-slate-500 font-mono">/ scan</span></div>
              <ul className="space-y-3 mb-8 text-sm text-slate-300 flex-grow">
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-400 shrink-0" /> Includes everything in Firewall</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-400 shrink-0" /> Full pre-execution threat report</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-400 shrink-0" /> Generates a verifiable <code className="text-xs bg-slate-950 px-1 border border-slate-800 rounded font-mono text-cyan-400">scanHash</code></li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-400 shrink-0" /> Full detailed 4-module JSON payload</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-400 shrink-0" /> On-chain Smart Contract Attestation</li>
              </ul>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Hexagon className="h-5 w-5 text-slate-500" />
            <span className="text-slate-500 font-medium">WatchTower Protocol</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link href="/docs" className="hover:text-cyan-400 transition-colors">Docs</Link>
            <Link href="/network" className="hover:text-cyan-400 transition-colors">Network Explorer</Link>
            <Link href="#integrate" className="hover:text-cyan-400 transition-colors">SDK</Link>
            <Link href="#pricing" className="hover:text-cyan-400 transition-colors">Pricing</Link>
            <Link href="/verify" className="hover:text-cyan-400 transition-colors">Verify Attestation</Link>
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
