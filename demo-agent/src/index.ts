// ───────────────────────────────────────────────────────────────
// Watch Tower Autonomous Trading Agent — Entry Point
//
// Event-driven CLI that simulates an autonomous trading agent
// discovering market opportunities and consulting Watch Tower
// before every trade.
//
// Every autonomous action now carries a cryptographically
// verifiable execution authorization.
//
// Usage:
//   npm start                              # Authorize mode (default)
//   npm start -- <token_address>           # Authorize a specific token
//   npm start -- --firewall                # Legacy firewall scan
//   npm start -- --deep                    # Legacy alias for Execution Authorization
//   npm start -- --deep <token_address>    # Legacy alias for a specific token
// ───────────────────────────────────────────────────────────────

import 'dotenv/config';
import { AgentWorkflow } from './agent/workflow.js';
import { createProvider } from './providers/index.js';
import type { MarketOpportunity } from './agent/types.js';
import type { AgentMode } from './mcp/client.js';
import * as log from './utils/logger.js';

// ── CLI Argument Parsing ─────────────────────────────────────
// Parses --authorize, --deep, --firewall flags and token address.
// Defaults to authorize mode — the evolution.

function parseArgs(): { agentMode: AgentMode; tokenAddress?: string } {
  const args = process.argv.slice(2);
  let agentMode: AgentMode = 'authorize'; // Default to the new mode
  let tokenAddress: string | undefined;

  for (const arg of args) {
    if (arg === '--authorize') {
      agentMode = 'authorize';
    } else if (arg === '--deep') {
      agentMode = 'deep';
    } else if (arg === '--firewall') {
      agentMode = 'firewall';
    } else if (arg.startsWith('0x') || arg.startsWith('0X')) {
      tokenAddress = arg;
    }
  }

  return { agentMode, tokenAddress };
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
    const { agentMode, tokenAddress } = parseArgs();

    // Resolve the MCP endpoint
    const mcpUrl = process.env.WATCHTOWER_MCP_URL || 'https://watchtowr.xyz/api/mcp';

    // Create the LLM provider
    const provider = createProvider();

    // Initialize the workflow with agent mode
    const workflow = new AgentWorkflow(mcpUrl, provider, agentMode);
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
