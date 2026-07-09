// ---------------------------------------------------------------------------
// Shared API utilities — extracted from route handlers (F8)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rate Limiter (In-Memory)
// NOTE: Resets on serverless cold starts. For production, use Redis or SQLite.
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
}

// ---------------------------------------------------------------------------
// F2: Rate limit key extraction — prefer IP, fallback to agentWallet
// ---------------------------------------------------------------------------
export function getRateLimitKey(request: Request, agentWallet?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim();
  return ip || agentWallet || 'anonymous';
}

// ---------------------------------------------------------------------------
// Agent Metrics Tracking (F6/H6)
// ---------------------------------------------------------------------------
import { db } from '@/lib/db';
import { scans, agents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function trackAgentMetrics(agentWallet: string, tokenAddress: string, chainId: string) {
  const existingAgent = await db.select().from(agents).where(eq(agents.wallet, agentWallet)).limit(1);

  if (existingAgent.length > 0) {
    const previousWarnings = await db.select().from(scans).where(
      and(
        eq(scans.agentWallet, agentWallet),
        eq(scans.chainId, chainId),
        eq(scans.tokenAddress, tokenAddress),
        eq(scans.recommendation, 'ABORT')
      )
    ).limit(1);

    if (previousWarnings.length > 0) {
      await db.update(agents)
        .set({
          totalScans: sql`total_scans + 1`,
          recklessTrades: sql`reckless_trades + 1`,
        })
        .where(eq(agents.wallet, agentWallet));
    } else {
      await db.update(agents)
        .set({ totalScans: sql`total_scans + 1` })
        .where(eq(agents.wallet, agentWallet));
    }
  } else {
    await db.insert(agents).values({ wallet: agentWallet, totalScans: 1, recklessTrades: 0 });
  }
}
