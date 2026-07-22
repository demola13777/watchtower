import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { runFirewallScan, resolveScanChain, ChainResolutionError } from '@/lib/scan-service';
import { runAuthorization } from '@/lib/authorize-service';
import { mcpScanInputSchema, mcpAuthorizeInputSchema, scanRequestSchema, authorizeRequestSchema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// WatchTower MCP Server — Execution Authorization
//
// Exposes WatchTower threat intelligence and execution authorization as MCP
// tools that any AI agent (Claude, Cursor, OpenClaw, etc.) can discover and
// invoke.
//
// Every autonomous action now carries a cryptographically verifiable
// execution authorization.
//
// Architecture: This server calls analyzeToken() and runAuthorization()
// directly — the same shared engine functions used by /api/scan, /api/scan/deep,
// and /api/authorize. This ensures:
//   1. Zero internal HTTP overhead
//   2. Shared DexScreener/Ethplorer promise memoization
//   3. Shared in-memory cache
//   4. Single source of truth for scoring logic
// ---------------------------------------------------------------------------

export function createWatchTowerMcpServer(verifiedAgentWallet?: string): McpServer {
  const server = new McpServer(
    {
      name: 'watchtower',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: [
        'WatchTower is a pre-execution security and authorization agent for autonomous blockchain transactions.',
        'Use authorize_transaction before any token swap to request an Execution Authorization — a cryptographically signed permit that proves what the agent is allowed to execute.',
        'Use scan_token for quick threat checks without authorization.',
        'The legacy deep_scan_token tool id is kept as a compatibility alias for Execution Authorization.',
        'All tools accept an EVM token contract address and optional chainId override. If chainId is omitted, WatchTower auto-detects the EVM chain.',
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
  // Tool 2: deep_scan_token — compatibility alias for Execution Authorization
  // -------------------------------------------------------------------------
  server.tool(
    'deep_scan_token',
    `Compatibility alias for Execution Authorization. Runs the complete WatchTower threat analysis, evaluates execution policy, and returns a Permission to Execute report. Use authorize_transaction when an agent needs the full signed Execution Permit. Costs ${SCAN_PRICING_USDT.deep} USDT via x402.`,
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
        const authorization = await runAuthorization({
          ...parsed.data,
          agentWallet: verifiedAgentWallet ?? parsed.data.agentWallet ?? '0x0000000000000000000000000000000000000000',
          chainResolution,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(authorization.report, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        console.error('[WatchTower MCP] deep_scan_token compatibility alias error:', error);

        const errorMessage = error instanceof ChainResolutionError 
          ? error.message 
          : error instanceof Error ? error.message : 'Internal Execution Authorization error';

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
  // Tool 3: authorize_transaction — Execution Authorization
  //
  // The new "wow factor." Evaluates a proposed transaction and returns a
  // cryptographically signed Execution Authorization when the action is
  // deemed safe. Agents MUST request authorization before executing.
  // -------------------------------------------------------------------------
  server.tool(
    'authorize_transaction',
    `Request Execution Authorization for a proposed transaction. WatchTower evaluates the token through its full threat analysis pipeline and returns AUTHORIZED with a signed Execution Authorization, REVIEW_REQUIRED, or DENIED. Agents must verify the authorization signature before executing. Costs ${SCAN_PRICING_USDT.deep} USDT via x402.`,
    mcpAuthorizeInputSchema,
    async (args) => {
      const parsed = authorizeRequestSchema.safeParse(args);
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
        const result = await runAuthorization({
          ...parsed.data,
          agentWallet: verifiedAgentWallet ?? parsed.data.agentWallet ?? '0x0000000000000000000000000000000000000000',
          chainResolution,
        });

        const responseText = JSON.stringify(result, null, 2);
        return {
          content: [
            {
              type: 'text' as const,
              text: responseText,
            },
          ],
        };
      } catch (error: unknown) {
        console.error('[WatchTower MCP] authorize_transaction error:', error);

        const errorMessage = error instanceof ChainResolutionError 
          ? error.message 
          : error instanceof Error ? error.message : 'Internal authorization error';

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
