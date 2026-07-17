import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Code2,
  Database,
  ExternalLink,
  GitBranch,
  Hexagon,
  Network,
  Shield,
  Terminal,
  Wallet,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";

const GITHUB_URL = "https://github.com/demola13777/watchtower";

export const metadata: Metadata = {
  title: "Developer Docs",
  description: "Integrate WatchTower threat intelligence through the SDK, REST API, MCP tools, and x402-style payment flow.",
};

const sections = [
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk", label: "SDK" },
  { id: "mcp", label: "MCP" },
  { id: "api", label: "REST API" },
  { id: "payments", label: "Payments" },
  { id: "attestations", label: "Attestations" },
  { id: "deploy", label: "Deploy" },
];

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-800/60 py-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="space-y-5 text-[15px] leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[13px] text-cyan-300 border border-slate-800 break-all">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 relative selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Ambient Background Glows */}
      <div className="absolute top-0 right-0 -z-10 h-[800px] w-[800px] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-slate-950 to-slate-950 opacity-60"></div>
      <div className="absolute top-[40%] left-0 -z-10 h-[600px] w-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950 opacity-40"></div>

      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <Image src="/watchtower_logo.png" alt="WatchTower Logo" width={32} height={32} className="rounded-lg transition-all" />
            <span className="text-xl font-bold text-white">WatchTower</span>
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium">
            <Link href="/#integrate" className="text-slate-400 transition-colors hover:text-white">SDK</Link>
            <Link href="/network" className="text-slate-400 transition-colors hover:text-white">Network</Link>
            <Link href="/verify" className="text-slate-400 transition-colors hover:text-white">Verify</Link>
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-white sm:flex">
              GitHub <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-[90rem] gap-10 px-4 sm:px-6 py-12 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr_200px]">
        
        {/* Left Sidebar */}
        <aside className="hidden lg:block relative">
          <div className="sticky top-28 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-4 shadow-xl">
            <div className="mb-4 px-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Documentation</div>
            <div className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-all hover:bg-cyan-500/10 hover:text-cyan-400 hover:translate-x-1"
                >
                  {section.label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="max-w-4xl min-w-0 w-full">
          <header className="pb-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-500">
              <BookOpen className="h-3.5 w-3.5" />
              X Layer Mainnet Developer Documentation
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-3 duration-700">
              Put production-grade security in front of every autonomous trade.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-400 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              WatchTower is an agent-native threat-intelligence layer for X Layer Mainnet: integrate it through the SDK, MCP, or REST, then expose verified receipts when operators need an audit trail.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row animate-in fade-in slide-in-from-bottom-5 duration-1000">
              <Link href="/#integrate" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:-translate-y-0.5">
                SDK quickstart <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:bg-slate-800">
                View source <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </header>

          <Section id="quickstart" icon={<Terminal className="h-4 w-4" />} title="Quickstart">
            <p>
              Install the app dependencies, configure the environment, and start the local server. The public dashboard is useful for demos, but agent integrations should call the SDK, MCP tools, or REST API directly.
            </p>
            <CodeBlock language="bash">{`npm install
cd packages/watchtower-sdk && npm install && npm run build
cd ../..
cp .env.example .env.local
npm run dev`}</CodeBlock>
            <p>
              Open <InlineCode>http://localhost:3000</InlineCode> for the homepage, <InlineCode>/network</InlineCode> for the public scan feed, and <InlineCode>/verify</InlineCode> for attestation checks.
            </p>
          </Section>

          <Section id="sdk" icon={<Code2 className="h-4 w-4" />} title="SDK Integration">
            <p>
              Use the SDK when WatchTower is embedded inside a trading bot or autonomous agent runtime. The homepage SDK panel is the fast path; this docs page explains what happens around it.
            </p>
            <CodeBlock language="ts">{`import { WatchTowerClient, WatchTowerAbortError } from "okx-watchtower-middleware";

const wt = new WatchTowerClient({
  apiUrl: "https://watchtowr.xyz",
  agentWallet: "0xYourAgentWallet",
  chainId: 196,
  threshold: 70,
  paymentPrivateKey: process.env.AGENT_PAYMENT_KEY,
  paymentPolicy: {
    apiOrigin: "https://watchtowr.xyz",
    chainId: 196,
    tokenAddress: process.env.MAINNET_USDT_ADDRESS!,
    treasuryAddress: process.env.MAINNET_TREASURY_ADDRESS!,
    maxAmount: "1",
  },
});

try {
  const intel = await wt.guardTransaction("0xTokenAddress");
  console.log(intel.recommendation, intel.threatScore);
} catch (error) {
  if (error instanceof WatchTowerAbortError) {
    console.log("Trade blocked", error.reasoning);
  }
}`}</CodeBlock>
            <p>
              Configure <InlineCode>paymentPrivateKey</InlineCode> only in a secure agent runtime. Automatic settlement also requires a <InlineCode>paymentPolicy</InlineCode> that pins the API origin, chain, token, treasury, and maximum amount. Without a key, the SDK raises a payment-required error with the challenge details.
            </p>
          </Section>

          <Section id="mcp" icon={<Network className="h-4 w-4" />} title="MCP Tools">
            <p>
              MCP lets local AI agents discover WatchTower as a tool provider. The endpoint is Streamable HTTP and exposes the same scan engine as REST.
            </p>
            <CodeBlock language="json">{`{
  "mcpServers": {
    "watchtower": {
      "url": "https://watchtowr.xyz/api/mcp"
    }
  }
}`}</CodeBlock>
            <p>
              Tools: <InlineCode>scan_token</InlineCode> for Tier 2 firewall scans and <InlineCode>deep_scan_token</InlineCode> for detailed reports. Paid tool calls use the same payment boundary as REST.
            </p>
          </Section>

          <Section id="api" icon={<Activity className="h-4 w-4" />} title="REST API">
            <p>
              REST integrations are useful for services that do not need the SDK package. Both scan routes validate the request body before payment validation, so bad inputs do not consume a valid settlement transaction.
            </p>
            <CodeBlock language="ts">{`POST /api/scan       // Tier 2, 0.5 USDT
POST /api/scan/deep  // Tier 1, 1 USDT

{
  "tokenAddress": "0x...",
  "chainId": "196",
  "agentWallet": "0x..."
}`}</CodeBlock>
            <p>
              <InlineCode>chainId</InlineCode> is strongly recommended. If omitted, WatchTower attempts chain resolution and falls back to the configured X Layer default.
            </p>
          </Section>

          <Section id="payments" icon={<Wallet className="h-4 w-4" />} title="Payments">
            <p>
              WatchTower uses the standard x402 payment protocol with the OKX facilitator for machine payments. Protected endpoints return <InlineCode>402 Payment Required</InlineCode> with a <InlineCode>PAYMENT-REQUIRED</InlineCode> challenge.
            </p>
            <CodeBlock language="bash">{`PAYMENT-SIGNATURE: <base64-encoded PaymentPayload>`}</CodeBlock>
            <p>
              The OKX facilitator verifies the payment signature and settles the transfer on-chain. The <InlineCode>PaymentService</InlineCode> boundary keeps the facilitator integration replaceable without changing scan routes or agent integrations.
            </p>
          </Section>

          <Section id="attestations" icon={<Shield className="h-4 w-4" />} title="Reports and Attestations">
            <p>
              Deep scans generate public reports at <InlineCode>/report/[scanHash]</InlineCode>. The scan hash is deterministic over core inputs, not raw JSON serialization.
            </p>
            <CodeBlock language="ts">{`sha256(chainId:tokenAddress:threatScore:confidence:timestamp)`}</CodeBlock>
            <p>
              The deployed registry is selected entirely through environment configuration. Use <Link href="/verify" className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-500/30 underline-offset-4">/verify</Link> to decode a configured X Layer registry transaction and confirm the emitted scan event.
            </p>
          </Section>

          <Section id="deploy" icon={<Database className="h-4 w-4" />} title="Deployment">
            <p>
              Local development may use SQLite. A mainnet deployment uses Turso/libSQL, a dedicated X Layer RPC, an explicit registry address, and production secret management.
            </p>
            <CodeBlock language="bash">{`NEXT_PUBLIC_SITE_URL=https://watchtowr.xyz
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_REGISTRY_CHAIN_ID=196
NEXT_PUBLIC_REGISTRY_RPC_URL=https://rpc.xlayer.tech
NEXT_PUBLIC_NETWORK_ENV=mainnet
MAINNET_RPC_URL=https://your-dedicated-x-layer-rpc
MAINNET_TREASURY_ADDRESS=0x...
MAINNET_USDT_ADDRESS=0x...
MAINNET_PAYMENT_TOKEN_DECIMALS=6
PAYMENT_MIN_CONFIRMATIONS=<your-confirmation-policy>`}</CodeBlock>
            <p>
              Keep <InlineCode>PRIVATE_KEY</InlineCode> out of public repos. Before public mainnet traffic, use managed custody, a relayer, or KMS-backed signing for the registry writer and complete the mainnet readiness checklist in this repository.
            </p>
          </Section>



          <div className="flex flex-col gap-4 border-t border-slate-800/60 py-12 sm:flex-row">
            <Link href="/#integrate" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 border border-slate-800">
              Back to SDK section <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:border-cyan-500/50 hover:bg-slate-900/50">
              Open GitHub <GitBranch className="h-4 w-4" />
            </Link>
          </div>
        </div>
        
        {/* Right spacing filler for XL screens */}
        <div className="hidden xl:block"></div>
      </main>
    </div>
  );
}
