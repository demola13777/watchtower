/**
 * x402 HTTP Resource Server — Next.js Adapter
 *
 * Provides a framework adapter so the official OKX SDK's x402HTTPResourceServer
 * can process requests from Next.js App Router handlers.
 *
 * The SDK's HTTP server handles content negotiation automatically:
 *   - Browser clients (Accept: text/html) → HTML paywall page
 *   - API clients (Accept: application/json) → JSON {} with PAYMENT-REQUIRED header
 *
 * This is required for OKX marketplace listing verification.
 */

import { x402HTTPResourceServer } from '@okxweb3/x402-core/server';
import { NextResponse } from 'next/server';
import { getResourceServer, getX402Network } from './x402';
import { getRequiredPaymentNetwork } from '@/config/network';
import { SCAN_PRICING_USDT } from './config';
import { logger } from './logger';

// ─── Next.js HTTP Adapter ────────────────────────────────────────────────────

/**
 * Adapts a Next.js/Web API Request to the SDK's HTTPAdapter interface.
 * This is the Next.js equivalent of the SDK's ExpressAdapter.
 */
class NextJsAdapter {
  private url: URL;

  constructor(private req: Request) {
    this.url = new URL(req.url);
  }

  getHeader(name: string): string | undefined {
    return this.req.headers.get(name) ?? undefined;
  }

  getMethod(): string {
    return this.req.method;
  }

  getPath(): string {
    return this.url.pathname;
  }

  getUrl(): string {
    return this.req.url;
  }

  getAcceptHeader(): string {
    return this.req.headers.get('accept') ?? '';
  }

  getUserAgent(): string {
    return this.req.headers.get('user-agent') ?? '';
  }

  getQueryParams(): Record<string, string | string[]> {
    const params: Record<string, string | string[]> = {};
    this.url.searchParams.forEach((value, key) => {
      const existing = params[key];
      if (existing) {
        params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        params[key] = value;
      }
    });
    return params;
  }

  getQueryParam(name: string): string | string[] | undefined {
    const values = this.url.searchParams.getAll(name);
    if (values.length === 0) return undefined;
    return values.length === 1 ? values[0] : values;
  }
}

// ─── Singleton HTTP Resource Server ──────────────────────────────────────────

let _httpServer: x402HTTPResourceServer | null = null;
let _httpInitPromise: Promise<void> | null = null;

function buildRouteAccepts(price: number) {
  const network = getRequiredPaymentNetwork();
  return {
    scheme: 'exact' as const,
    payTo: network.treasuryAddress,
    price,
    network: getX402Network(),
    maxTimeoutSeconds: 600,
    extra: { decimals: network.token.decimals },
  };
}

/**
 * Get or create the singleton x402HTTPResourceServer.
 *
 * This wraps the existing x402ResourceServer from x402.ts and adds route
 * configurations so the SDK can match incoming requests to payment configs.
 */
async function getHTTPResourceServer(): Promise<x402HTTPResourceServer> {
  if (!_httpServer) {
    const server = await getResourceServer();

    const scanAccepts = buildRouteAccepts(SCAN_PRICING_USDT.firewall);
    const deepAccepts = buildRouteAccepts(SCAN_PRICING_USDT.deep);
    const mcpAccepts = buildRouteAccepts(SCAN_PRICING_USDT.firewall);

    _httpServer = new x402HTTPResourceServer(server, {
      'GET /api/scan': {
        accepts: scanAccepts,
        description: 'WatchTower Tier 2 - API Firewall scan',
      },
      'POST /api/scan': {
        accepts: scanAccepts,
        description: 'WatchTower Tier 2 - API Firewall scan',
      },
      'GET /api/scan/deep': {
        accepts: deepAccepts,
        description: 'WatchTower Execution Authorization',
      },
      'POST /api/scan/deep': {
        accepts: deepAccepts,
        description: 'WatchTower Execution Authorization',
      },
      'GET /api/authorize': {
        accepts: deepAccepts,
        description: 'WatchTower Execution Authorization',
      },
      'POST /api/authorize': {
        accepts: deepAccepts,
        description: 'WatchTower Execution Authorization',
      },
      'POST /api/mcp': {
        accepts: mcpAccepts,
        description: 'WatchTower MCP Protocol',
      },
    });

    _httpInitPromise = _httpServer.initialize().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.payment('x402_http_init_failed', { error: msg });
      _httpServer = null;
      _httpInitPromise = null;
      throw new Error(`x402 HTTP server init failed: ${msg}`);
    });
  }

  await _httpInitPromise;
  return _httpServer!;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a 402 response using the official OKX SDK's x402HTTPResourceServer.
 *
 * This produces responses identical to what the x402-express paymentMiddleware
 * generates, including:
 *   - HTML paywall for browser clients (Accept: text/html)
 *   - JSON {} with PAYMENT-REQUIRED header for API clients
 *
 * @param request - The incoming Next.js Request
 * @returns A NextResponse with the SDK-generated 402 response
 */
export async function sdkPaymentResponse(request: Request): Promise<NextResponse> {
  const httpServer = await getHTTPResourceServer();
  const adapter = new NextJsAdapter(request);
  const url = new URL(request.url);

  const result = await httpServer.processHTTPRequest({
    adapter,
    path: url.pathname,
    method: request.method,
  });

  if (result.type === 'payment-error') {
    const { response } = result;

    if (response.isHtml) {
      return new NextResponse(response.body as string, {
        status: response.status,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
        },
      });
    }

    return NextResponse.json(response.body ?? {}, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE',
      },
    });
  }

  // payment-verified or no-payment-required — shouldn't happen for unpaid requests
  // but return a sensible fallback
  return NextResponse.json({}, { status: 402 });
}

/**
 * Check if the incoming request is from a browser (Accept: text/html).
 */
export function isBrowserRequest(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  return accept.includes('text/html');
}
