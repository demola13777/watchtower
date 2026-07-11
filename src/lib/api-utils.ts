// ---------------------------------------------------------------------------
// Shared API utilities — extracted from route handlers (F8)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Durable fixed-window rate limiter. Keys are hashed before storage so the
// database does not retain raw IP addresses or wallet identifiers.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { db } from '@/lib/db';
import { rateLimits, scans, agents } from '@/lib/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

export async function isRateLimited(key: string): Promise<boolean> {
  const now = Date.now();
  const bucketStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const bucketId = crypto
    .createHash('sha256')
    .update(`${bucketStart}:${key}`)
    .digest('hex');

  await db.insert(rateLimits)
    .values({ id: bucketId, count: 1, expiresAt: bucketStart + RATE_LIMIT_WINDOW_MS })
    .onConflictDoUpdate({
      target: rateLimits.id,
      set: { count: sql`${rateLimits.count} + 1` },
    });

  const [record] = await db.select({ count: rateLimits.count })
    .from(rateLimits)
    .where(eq(rateLimits.id, bucketId))
    .limit(1);

  if (bucketStart % (RATE_LIMIT_WINDOW_MS * 15) === 0) {
    await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now)).catch(() => undefined);
  }

  return (record?.count ?? RATE_LIMIT_MAX + 1) > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// F2: Rate limit key extraction — prefer IP, fallback to agentWallet
// ---------------------------------------------------------------------------
export function getRateLimitKey(request: Request, agentWallet?: string): string {
  const ip = request.headers.get('x-vercel-forwarded-for')?.trim()
    || request.headers.get('x-real-ip')?.trim();
  return ip || agentWallet || 'anonymous';
}

// ---------------------------------------------------------------------------
// Agent Metrics Tracking (F6/H6)
// ---------------------------------------------------------------------------
export async function trackAgentMetrics(agentWallet: string, tokenAddress: string, chainId: string) {
  // Check if the agent previously ignored an ABORT recommendation for this token.
  const previousWarnings = await db.select().from(scans).where(
    and(
      eq(scans.agentWallet, agentWallet),
      eq(scans.chainId, chainId),
      eq(scans.tokenAddress, tokenAddress),
      eq(scans.recommendation, 'ABORT')
    )
  ).limit(1);

  const isReckless = previousWarnings.length > 0;

  // Atomic upsert — avoids the TOCTOU race where two concurrent requests for
  // the same new wallet both see "not found" and both try to INSERT.
  await db.insert(agents)
    .values({ wallet: agentWallet, totalScans: 1, recklessTrades: isReckless ? 1 : 0 })
    .onConflictDoUpdate({
      target: agents.wallet,
      set: {
        totalScans: sql`total_scans + 1`,
        ...(isReckless ? { recklessTrades: sql`reckless_trades + 1` } : {}),
      },
    });
}
