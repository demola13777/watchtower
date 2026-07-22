import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createWatchTowerMcpServer } from './mcp-server';
import { SCAN_PRICING_USDT } from '@/lib/config';
import { claimPaymentProcessing, completePayment, createPaymentRequestHash, isDemoReceipt, paymentRequiredResponse, releasePaymentProcessing, requirePayment, setPaymentResponseHeader, type PaymentReceipt } from '@/lib/payment';
import { scanRequestSchema, authorizeRequestSchema } from '@/lib/validation';
import { ChainResolutionError, resolveScanChain } from '@/lib/scan-service';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';

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
// Authorization returns after permit verification; non-blocking audit work can
// continue through the route duration when scheduled by Next.js after().
export const maxDuration = 60;

type JsonRpcToolCall = {
  id?: unknown;
  method?: string;
  params?: {
    name?: string;
    arguments?: unknown;
  };
};

function getMcpToolFailureReason(responsePayload: string): string | null {
  try {
    const parsed = JSON.parse(responsePayload) as {
      error?: { message?: string };
      result?: {
        isError?: boolean;
        content?: Array<{ type?: string; text?: string }>;
      };
    };

    if (parsed.error?.message) return parsed.error.message;
    if (!parsed.result?.isError) return null;

    const text = parsed.result.content?.find((item) => item.type === 'text')?.text;
    if (!text) return 'MCP tool returned an error result.';

    try {
      const parsedText = JSON.parse(text) as { error?: string };
      return parsedText.error || text;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

function paymentHashArguments(argumentsValue: unknown): unknown {
  if (!argumentsValue || typeof argumentsValue !== 'object' || Array.isArray(argumentsValue)) {
    return argumentsValue;
  }
  const { agentWallet: _agentWallet, ...paymentIdentityArguments } = argumentsValue as Record<string, unknown>;
  void _agentWallet;
  return paymentIdentityArguments;
}

async function requireMcpToolPayment(req: Request): Promise<{ response?: Response; receipt?: PaymentReceipt }> {
  const payload = (await req.clone().json().catch(() => null)) as JsonRpcToolCall | JsonRpcToolCall[] | null;
  const calls = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const paidToolCalls = calls.filter((call) => call.method === 'tools/call');
  const toolNames = paidToolCalls.map((call) => call.params?.name);

  if (toolNames.length === 0) {
    return {};
  }
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
    if (call.params?.name !== 'scan_token' && call.params?.name !== 'deep_scan_token' && call.params?.name !== 'authorize_transaction') continue;
    const schema = call.params?.name === 'authorize_transaction' ? authorizeRequestSchema : scanRequestSchema;
    const parsed = schema.safeParse(call.params.arguments ?? {});
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

    try {
      await resolveScanChain(parsed.data);
    } catch (error) {
      const message = error instanceof ChainResolutionError
        ? error.message
        : 'Unable to resolve the requested token chain.';
      return {
        response: new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32602, message },
            id: call.id ?? null,
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }
  }

  const requiresAuthorization = toolNames.includes('deep_scan_token') || toolNames.includes('authorize_transaction');
  const requestHash = createPaymentRequestHash({
    endpoint: '/api/mcp',
    tools: paidToolCalls
      .map((call) => ({
        name: call.params?.name,
        arguments: paymentHashArguments(call.params?.arguments),
      })),
  });
  const payment = await requirePayment(
    req,
    requiresAuthorization ? SCAN_PRICING_USDT.deep : SCAN_PRICING_USDT.firewall,
    requiresAuthorization ? 'Execution Authorization' : 'Firewall Scan',
    requestHash,
    { allowDemoBypass: true },
  );

  if (payment.ok) {
    return { receipt: payment.receipt };
  }

  return { response: paymentRequiredResponse(payment.failure) };
}

// Instantiate a new MCP server for each request.
export async function POST(req: Request): Promise<Response> {
  let claimedPaymentId: string | null = null;
  try {
    if (await isRateLimited(getRateLimitKey(req))) {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32029, message: 'Rate limit exceeded. Retry shortly.' }, id: null }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      );
    }

    const paymentResult = await requireMcpToolPayment(req);
    if (paymentResult.response) {
      return paymentResult.response;
    }

    // Create a new server instance per request.
    // In stateless HTTP, the transport is unique to the request,
    // and an MCP server can only connect to one transport at a time.
    // Claim payment processing — skip DB operations for demo receipts
    const receipt = paymentResult.receipt;
    if (receipt && !isDemoReceipt(receipt)) {
      const claim = await claimPaymentProcessing(receipt.paymentId);
      if (claim.state === 'completed') {
        return setPaymentResponseHeader(
          new Response(claim.responsePayload, { headers: { 'Content-Type': 'application/json' } }),
          receipt,
        );
      }
      if (claim.state === 'processing') {
        return setPaymentResponseHeader(new Response(
          JSON.stringify({ jsonrpc: '2.0', error: { code: -32009, message: 'Your paid tool call is already processing. Retry shortly.' }, id: null }),
          { status: 409, headers: { 'Content-Type': 'application/json', 'Retry-After': '2' } },
        ), receipt);
      }
      claimedPaymentId = receipt.paymentId;
    }

    const server = createWatchTowerMcpServer(receipt?.payer);

    // Create a stateless transport for this request
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true,
    });

    await server.connect(transport);

    const response = await transport.handleRequest(req);
    
    // Clean up
    await server.close();

    if (!receipt) {
      return response;
    }

    // Complete payment — skip DB write for demo receipts
    if (!isDemoReceipt(receipt)) {
      const responsePayload = await response.clone().text();
      if (!response.ok) {
        await releasePaymentProcessing(receipt.paymentId, `MCP tool returned HTTP ${response.status}.`);
        return setPaymentResponseHeader(response, receipt);
      }
      const toolFailureReason = getMcpToolFailureReason(responsePayload);
      if (toolFailureReason) {
        await releasePaymentProcessing(receipt.paymentId, toolFailureReason);
        return setPaymentResponseHeader(response, receipt);
      }
      await completePayment(receipt.paymentId, responsePayload);
    }
    return setPaymentResponseHeader(response, receipt);
  } catch (error: unknown) {
    if (claimedPaymentId) {
      await releasePaymentProcessing(claimedPaymentId, error instanceof Error ? error.message : 'MCP tool processing failed.').catch(() => undefined);
    }
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
