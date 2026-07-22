import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getRateLimitKey, isRateLimited } from '@/lib/api-utils';
import { ChainResolutionError, resolveScanChain, runDeepScan } from '@/lib/scan-service';
import { scanRequestSchema } from '@/lib/validation';

/**
 * POST /api/scan/dashboard
 * 
 * Free Web Dashboard Scan
 * Runs the full threat analysis engine without payment or on-chain attestation.
 * Designed for human users exploring WatchTower through the web interface.
 * 
 * Agent-to-agent interactions should continue using:
 *   - POST /api/authorize   (x402-gated Execution Authorization)
 *   - POST /api/mcp         (MCP tool surface with x402 payment)
 */
export async function POST(req: Request) {
  try {
    const input = scanRequestSchema.parse(await req.json());
    const chainResolution = await resolveScanChain(input);

    const rateLimitKey = getRateLimitKey(req);
    if (await isRateLimited(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 scans per minute.' },
        { status: 429 },
      );
    }

    const authorizationReport = await runDeepScan({
      ...input,
      agentWallet: 'web_dashboard',
      chainResolution,
      skipAttestation: true,
    });

    // Override tier and price to reflect the free web scan context
    authorizationReport.tier = 'Free Web Scan';
    authorizationReport.price = 'Free';
    authorizationReport.verification.status = 'Free scan — Permission to Execute available via paid API';

    return NextResponse.json({ success: true, data: authorizationReport });
  } catch (error: unknown) {
    console.error('Dashboard scan error:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 });
    }
    if (error instanceof ChainResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
