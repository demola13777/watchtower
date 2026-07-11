import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scans, agents, payments } from '@/lib/db/schema';
import { desc, eq, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const requestedLimit = parseInt(searchParams.get('limit') || '10', 10);
    const limitValue = Math.min(Math.max(requestedLimit, 1), 100);
    const offsetValue = (page - 1) * limitValue;

    const latestScansPromise = db.select({
      id: scans.id,
      chainId: scans.chainId,
      tokenAddress: scans.tokenAddress,
      threatScore: scans.threatScore,
      recommendation: scans.recommendation,
      scanHash: scans.scanHash,
      agentWallet: scans.agentWallet,
      tier: scans.tier,
      timestamp: scans.timestamp,
    }).from(scans).orderBy(desc(scans.timestamp)).limit(limitValue).offset(offsetValue);
    
    const totalScansPromise = db.select({ value: count() }).from(scans);
    const threatsBlockedPromise = db.select({ value: count() }).from(scans).where(eq(scans.recommendation, 'ABORT'));
    const activeAgentsPromise = db.select({ value: count() }).from(agents);
    const settledRevenuePromise = db.select({
      value: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('settled', 'processing', 'completed') THEN CAST(${payments.amount} AS REAL) ELSE 0 END), 0)`,
    }).from(payments);
    const leaderboardPromise = db.select({
      agentWallet: scans.agentWallet,
      totalScans: count().as('total_scans'),
      threatsDetected: sql<number>`SUM(CASE WHEN ${scans.recommendation} = 'ABORT' THEN 1 ELSE 0 END)`.as('threats_detected'),
      cautionsRaised: sql<number>`SUM(CASE WHEN ${scans.recommendation} = 'CAUTION' THEN 1 ELSE 0 END)`.as('cautions_raised'),
      lastActive: sql<number>`MAX(${scans.timestamp})`.as('last_active'),
    })
      .from(scans)
      .groupBy(scans.agentWallet)
      .orderBy(sql`total_scans DESC`, sql`last_active DESC`)
      .limit(3);

    const [
      latestScans,
      [{ value: totalScans }],
      [{ value: threatsBlocked }],
      [{ value: activeAgents }],
      [{ value: settledRevenue }],
      leaderboardRows,
    ] = await Promise.all([
      latestScansPromise,
      totalScansPromise,
      threatsBlockedPromise,
      activeAgentsPromise,
      settledRevenuePromise,
      leaderboardPromise,
    ]);

    const revenue = Number(settledRevenue ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        totalScans,
        threatsBlocked,
        revenue,
        activeAgents,
        latestScans, // H5: No longer includes reportData or txHash
        leaderboard: leaderboardRows,
      }
    });
  } catch (error: unknown) {
    console.error("Telemetry error:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
