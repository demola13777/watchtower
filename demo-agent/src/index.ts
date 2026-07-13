// ───────────────────────────────────────────────────────────────
// Watch Tower Autonomous Trading Agent — Entry Point
//
// Event-driven CLI that simulates an autonomous trading agent
// discovering market opportunities and consulting Watch Tower
// before every trade.
//
// Usage:
//   npm start                          # Firewall scan (default)
//   npm start -- <token_address>       # Firewall scan a specific token
//   npm start -- --deep                # Deep scan with default demo token
//   npm start -- --deep <token_address> # Deep scan a specific token
// ───────────────────────────────────────────────────────────────

import 'dotenv/config';
import { AgentWorkflow } from './agent/workflow.js';
import { createProvider } from './providers/index.js';
import type { MarketOpportunity } from './agent/types.js';
import type { ScanMode } from './mcp/client.js';
import * as log from './utils/logger.js';

// ── CLI Argument Parsing ─────────────────────────────────────
// Parses --deep flag and token address from process.argv.
// Order doesn't matter: `--deep 0xABC` and `0xABC --deep` both work.

function parseArgs(): { scanMode: ScanMode; tokenAddress?: string } {
  const args = process.argv.slice(2);
  let scanMode: ScanMode = 'firewall';
  let tokenAddress: string | undefined;

  for (const arg of args) {
    if (arg === '--deep') {
      scanMode = 'deep';
    } else if (arg.startsWith('0x') || arg.startsWith('0X')) {
      tokenAddress = arg;
    }
  }

  return { scanMode, tokenAddress };
}

// ── Demo Scenarios ────────────────────────────────────────────
// Predefined market opportunities for the hackathon demo.
// The first token is a known threat; the second re-scan
// demonstrates agent memory (session watchlist).

const DEMO_OPPORTUNITIES: MarketOpportunity[] = [
  {
    tokenAddress: '0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D',
    chainId: '1952',
    label: 'Newly launched token — high activity detected',
  },
  {
    // Re-scan the same token to demonstrate memory
    tokenAddress: '0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D',
    chainId: '1952',
    label: 'Same token detected again — testing agent memory',
  },
];

async function main(): Promise<void> {
  try {
    const { scanMode, tokenAddress } = parseArgs();

    // Resolve the MCP endpoint
    const mcpUrl = process.env.WATCHTOWER_MCP_URL || 'http://localhost:3000/api/mcp';

    // Create the LLM provider
    const provider = createProvider();

    // Initialize the workflow with scan mode
    const workflow = new AgentWorkflow(mcpUrl, provider, scanMode);
    await workflow.boot();

    // Determine which tokens to scan
    const opportunities: MarketOpportunity[] = tokenAddress
      ? [{ tokenAddress, label: 'CLI-provided token' }]
      : DEMO_OPPORTUNITIES;

    // Execute the workflow for each opportunity
    for (const opportunity of opportunities) {
      await workflow.evaluate(opportunity);

      // Brief pause between opportunities (simulates market monitoring)
      if (opportunities.indexOf(opportunity) < opportunities.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  } catch (error) {
    log.printError('Agent Initialization', error);
    process.exit(1);
  }
}

main();
