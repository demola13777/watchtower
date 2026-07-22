import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Code2,
  ExternalLink,
  GitBranch,
  Network,
  Shield,
  Terminal,
  Wallet,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";

const GITHUB_URL = "https://github.com/demola13777/watchtower";

export const metadata: Metadata = {
  title: "Developer Docs",
  description: "Integrate WatchTower pre-execution security through the SDK, REST API, MCP tools, and x402 payment flow.",
};

const sections = [
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk", label: "SDK" },
  { id: "mcp", label: "MCP" },
  { id: "api", label: "REST API" },
  { id: "payments", label: "Payments" },
  { id: "attestations", label: "Reports" },
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
              WatchTower gives agents a simple execution gate: run the threat engine, evaluate policy, verify the signed permit, then execute only when Authorization passes.
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
              Use the SDK when WatchTower sits inside your agent runtime. The default client already knows the trusted WatchTower signer and permit domain, so normal integrations do not need custom trust configuration.
            </p>
            <CodeBlock language="bash">{`npm install okx-watchtower-middleware`}</CodeBlock>
            <CodeBlock language="ts">{`import { WatchTowerClient, WatchTowerPaymentRequiredError } from "okx-watchtower-middleware";

const wt = new WatchTowerClient({
  apiUrl: "https://watchtowr.xyz",
  agentWallet: "0xYourAgentWallet",
  chainId: 196,
});

try {
  const authorization = await wt.authorize({
    action: "swap",
    token: "0xTokenAddress",
  });

  if (!authorization.executable) {
    throw new Error(\`Execution blocked: \${authorization.decision}\`);
  }

  await executeTrade();
} catch (error) {
  if (error instanceof WatchTowerPaymentRequiredError) {
    console.log(error.paymentRequired);
  }
}`}</CodeBlock>
            <p>
              For production agents, add the payment configuration below or retry with a wallet-provided payment signature. For a local demo, run the app, use <InlineCode>/network</InlineCode> to generate a free token report, or open <InlineCode>/verify</InlineCode> to inspect a confirmed registry transaction.
            </p>
          </Section>

          <Section id="sdk" icon={<Code2 className="h-4 w-4" />} title="SDK Integration">
            <p>
              <InlineCode>authorize()</InlineCode> is the premium Permission to Execute flow. It runs full threat intelligence, evaluates policy, and only returns <InlineCode>executable: true</InlineCode> after the signed permit verifies locally.
            </p>
            <CodeBlock language="ts">{`import { WatchTowerClient, WatchTowerAuthorizationError } from "okx-watchtower-middleware";

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
    tokenDecimals: 6,
    treasuryAddress: process.env.MAINNET_TREASURY_ADDRESS!,
    maxAmount: "1",
  },
});

try {
  const authorization = await wt.authorize({
    action: "swap",
    token: "0xTokenAddress",
    amountUsd: 250,
  });

  if (!authorization.executable) {
    console.log("Trade blocked", authorization.decision);
    return;
  }

  await executeTrade();
} catch (error) {
  if (error instanceof WatchTowerAuthorizationError) {
    console.log("Permit verification failed", error.message);
  }
}`}</CodeBlock>
            <p>
              Configure <InlineCode>paymentPrivateKey</InlineCode> only inside a secure agent runtime. Automatic x402 signing also requires a <InlineCode>paymentPolicy</InlineCode> that pins the API origin, chain, token, treasury, and maximum amount. Without a key, the SDK returns the payment challenge so your wallet flow can sign it.
            </p>
          </Section>

          <Section id="mcp" icon={<Network className="h-4 w-4" />} title="MCP Tools">
            <p>
              MCP lets local AI agents discover WatchTower as a protected tool provider. The endpoint is Streamable HTTP and uses the same payment, validation, chain-resolution, and Authorization logic as REST.
            </p>
            <CodeBlock language="json">{`{
  "mcpServers": {
    "watchtower": {
      "url": "https://watchtowr.xyz/api/mcp"
    }
  }
}`}</CodeBlock>
            <p>
              Tools: <InlineCode>scan_token</InlineCode> for Firewall, <InlineCode>authorize_transaction</InlineCode> for Authorization, and <InlineCode>deep_scan_token</InlineCode> as a compatibility alias for existing Marketplace integrations.
            </p>
          </Section>

          <Section id="api" icon={<Activity className="h-4 w-4" />} title="REST API">
            <p>
              REST is useful when you do not want the SDK package. Inputs are validated before payment, so malformed requests do not consume a valid settlement.
            </p>
            <CodeBlock language="ts">{`POST /api/scan       // Firewall, 0.5 USDT
POST /api/authorize   // Authorization, 1 USDT
POST /api/scan/deep   // compatibility alias

{
  "tokenAddress": "0x...",
  "chainId": "196",
  "agentWallet": "0x...",
  "action": "swap"
}`}</CodeBlock>
            <p>
              <InlineCode>chainId</InlineCode> is strongly recommended. If omitted, WatchTower attempts chain resolution and rejects ambiguous results before payment.
            </p>
          </Section>

          <Section id="payments" icon={<Wallet className="h-4 w-4" />} title="Payments">
            <p>
              WatchTower uses x402 with the OKX facilitator for machine payments. Protected endpoints return <InlineCode>402 Payment Required</InlineCode> with a <InlineCode>PAYMENT-REQUIRED</InlineCode> challenge.
            </p>
            <CodeBlock language="bash">{`PAYMENT-SIGNATURE: <base64-encoded PaymentPayload>`}</CodeBlock>
            <p>
              The SDK can reuse the signed payment payload during retries. WatchTower records confirmed facilitator settlements before service delivery, and failed service delivery releases the payment back into a recoverable state.
            </p>
          </Section>

          <Section id="attestations" icon={<Shield className="h-4 w-4" />} title="Reports and Attestations">
            <p>
              Execution Authorization generates public reports at <InlineCode>/report/[reportHash]</InlineCode>. The response also exposes the threat-analysis hash, the permit hash when a permit is issued, and an attestation status so developers can tell each artifact apart.
            </p>
            <CodeBlock language="ts">{`analysisHash // threat-analysis content hash, legacy scanHash alias
permitHash   // signed Execution Permit hash, only when a permit is issued
reportHash   // public /report/[reportHash] lookup key
attestation.status // pending | confirmed | failed`}</CodeBlock>
            <p>
              Authorization is returned as soon as the Execution Permit verifies locally. X Layer anchoring runs as audit work, and <Link href="/verify" className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-500/30 underline-offset-4">/verify</Link> can decode a confirmed registry transaction when one is available.
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
