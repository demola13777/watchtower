import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createWatchTowerMcpServer } from './mcp-server';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { createPaymentRequestHash, paymentRequiredResponse, requirePayment, setPaymentResponseHeader, type PaymentReceipt } from '@/lib/payment';
import { scanRequestSchema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// MCP Route Handler — Streamable HTTP Transport
//
// Exposes the WatchTower MCP server at POST /api/mcp
// Uses stateless mode (no session management) — each request is independent.
// Uses enableJsonResponse to return simple JSON instead of SSE for tool calls,
// which is the cleanest integration for AI agent clients.
//
// Flow: Agent → POST /api/mcp (JSON-RPC) → McpServer → analyzeToken() → Response
// ---------------------------------------------------------------------------

// Force Node.js runtime (not Edge) for SQLite/viem compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonRpcToolCall = {
  id?: unknown;
  method?: string;
  params?: {
    name?: string;
    arguments?: unknown;
  };
};

async function requireMcpToolPayment(req: Request): Promise<{ response?: Response; receipt?: PaymentReceipt }> {
  const payload = (await req.clone().json().catch(() => null)) as JsonRpcToolCall | JsonRpcToolCall[] | null;
  const calls = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const paidToolCalls = calls.filter((call) => call.method === 'tools/call');
  const toolNames = paidToolCalls.map((call) => call.params?.name);

  if (toolNames.length === 0) return {};
  if (paidToolCalls.length > 1) {
    return {
      response: new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Batching paid WatchTower tool calls is not supported. Send one paid tool call per request.',
          },
          id: null,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    };
  }

  for (const call of paidToolCalls) {
    if (call.params?.name !== 'scan_token' && call.params?.name !== 'deep_scan_token') continue;
    const parsed = scanRequestSchema.safeParse(call.params.arguments ?? {});
    if (!parsed.success) {
      return {
        response: new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid MCP tool input',
              data: parsed.error.flatten(),
            },
            id: call.id ?? null,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }
  }

  const requiresDeepScan = toolNames.includes('deep_scan_token');
  const requestHash = createPaymentRequestHash({
    endpoint: '/api/mcp',
    tools: paidToolCalls
      .map((call) => ({
        name: call.params?.name,
        arguments: call.params?.arguments,
      })),
  });
  const payment = await requirePayment(
    req,
    requiresDeepScan ? SCAN_PRICING_USDT.deep : SCAN_PRICING_USDT.firewall,
    requiresDeepScan ? 'Tier 1 - Deep Scan' : 'Tier 2 - API Firewall',
    requestHash,
  );

  return payment.ok
    ? { receipt: payment.receipt }
    : { response: paymentRequiredResponse(payment.failure) };
}

// Instantiate a new MCP server for each request.
export async function POST(req: Request): Promise<Response> {
  try {
    const paymentResult = await requireMcpToolPayment(req);
    if (paymentResult.response) return paymentResult.response;

    // Create a new server instance per request.
    // In stateless HTTP, the transport is unique to the request,
    // and an MCP server can only connect to one transport at a time.
    const server = createWatchTowerMcpServer();

    // Create a stateless transport for this request
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true,
    });

    await server.connect(transport);

    const response = await transport.handleRequest(req);
    
    // Clean up
    await server.close();

    return paymentResult.receipt
      ? setPaymentResponseHeader(response, paymentResult.receipt)
      : response;
  } catch (error: unknown) {
    console.error('[WatchTower MCP] Route error:', error);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Handle GET requests for SSE stream (optional, for streaming clients)
export async function GET(req: Request): Promise<Response> {
  try {
    const server = createWatchTowerMcpServer();

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(req);
    await server.close();
    return response;
  } catch (error: unknown) {
    console.error('[WatchTower MCP] GET error:', error);
    return new Response('MCP server error', { status: 500 });
  }
}

// Handle DELETE requests for session cleanup
export async function DELETE(): Promise<Response> {
  // Stateless mode — no sessions to clean up
  return new Response(null, { status: 405 });
}
