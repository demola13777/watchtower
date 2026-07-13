import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { runDeepScan, runFirewallScan, resolveScanChain, ChainResolutionError } from '@/lib/scan-service';
import { mcpScanInputSchema, scanRequestSchema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// WatchTower MCP Server — "The Wow Factor"
//
// Exposes WatchTower threat intelligence as MCP tools that any AI agent
// (Claude, Cursor, OpenClaw, etc.) can discover and invoke.
//
// Architecture: This server calls analyzeToken() directly — the same shared
// engine function used by /api/scan and /api/scan/deep. This ensures:
//   1. Zero internal HTTP overhead
//   2. Shared DexScreener/Ethplorer promise memoization
//   3. Shared in-memory cache
//   4. Single source of truth for scoring logic
// ---------------------------------------------------------------------------

export function createWatchTowerMcpServer(verifiedAgentWallet?: string): McpServer {
  const server = new McpServer(
    {
      name: 'watchtower',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: [
        'WatchTower is a pre-execution threat intelligence agent for blockchain tokens.',
        'Use scan_token before any token swap to check for rug pulls, honeypots, and whale dumps.',
        'Use deep_scan_token for comprehensive reports with on-chain attestation.',
        'Both tools accept an EVM token contract address and optional chainId override. If chainId is omitted, WatchTower auto-detects the EVM chain.',
      ].join(' '),
    },
  );

  // -------------------------------------------------------------------------
  // Tool 1: scan_token — Quick threat scan (Tier 2: API Firewall)
  // -------------------------------------------------------------------------
  server.tool(
    'scan_token',
    'Scan a token contract for threats (rug pulls, honeypots, whale concentration, liquidity issues). Returns a 0-100 threat score with TRADE/CAUTION/ABORT recommendation. Use this before executing any swap.',
    mcpScanInputSchema,
    async (args) => {
      const parsed = scanRequestSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Invalid MCP tool input',
                details: parsed.error.flatten(),
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const chainResolution = await resolveScanChain(parsed.data);
        const report = await runFirewallScan({
          ...parsed.data,
          agentWallet: verifiedAgentWallet ?? parsed.data.agentWallet ?? 'mcp_agent',
          chainResolution,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(report, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        console.error('[WatchTower MCP] scan_token error:', error);
        
        const errorMessage = error instanceof ChainResolutionError 
          ? error.message 
          : error instanceof Error ? error.message : 'Internal scan error';

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Tool 2: deep_scan_token — Comprehensive report (Tier 1: Deep Scan)
  // -------------------------------------------------------------------------
  server.tool(
    'deep_scan_token',
    `Run a comprehensive deep security analysis on a token. Returns a detailed threat report with on-chain attestation, module-by-module breakdown, and actionable recommendations. Costs ${SCAN_PRICING_USDT.deep} USDT via x402.`,
    mcpScanInputSchema,
    async (args) => {
      const parsed = scanRequestSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Invalid MCP tool input',
                details: parsed.error.flatten(),
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const chainResolution = await resolveScanChain(parsed.data);
        const deepReport = await runDeepScan({
          ...parsed.data,
          agentWallet: verifiedAgentWallet ?? parsed.data.agentWallet ?? 'mcp_agent',
          chainResolution,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(deepReport, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        console.error('[WatchTower MCP] deep_scan_token error:', error);

        const errorMessage = error instanceof ChainResolutionError 
          ? error.message 
          : error instanceof Error ? error.message : 'Internal deep scan error';

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
