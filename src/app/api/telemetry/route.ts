import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scans, payments, usedPaymentTransactions } from '@/lib/db/schema';
import { desc, eq, count, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10);
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '10', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const requestedLimit = Number.isFinite(parsedLimit) ? parsedLimit : 10;
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
    const activeAgentsPromise = db.select({
      value: sql<number>`COUNT(DISTINCT LOWER(${scans.agentWallet}))`,
    }).from(scans).where(sql`${scans.agentWallet} IS NOT NULL`);
    const settledRevenuePromise = db.select({
      value: sql<number>`COALESCE(SUM(
        CASE 
          WHEN ${usedPaymentTransactions.network} = 'X Layer Mainnet' THEN CAST(${usedPaymentTransactions.amount} AS REAL) / 1000000.0
          ELSE CAST(${usedPaymentTransactions.amount} AS REAL) / 1000000000000000000.0
        END
      ), 0)`,
    }).from(usedPaymentTransactions);
    const leaderboardPromise = db.select({
      agentWallet: sql<string>`LOWER(${scans.agentWallet})`.as('agent_wallet'),
      totalScans: count().as('total_scans'),
      threatsDetected: sql<number>`SUM(CASE WHEN ${scans.recommendation} = 'ABORT' THEN 1 ELSE 0 END)`.as('threats_detected'),
      cautionsRaised: sql<number>`SUM(CASE WHEN ${scans.recommendation} = 'CAUTION' THEN 1 ELSE 0 END)`.as('cautions_raised'),
      lastActive: sql<number>`MAX(${scans.timestamp})`.as('last_active'),
    })
      .from(scans)
      .where(sql`${scans.agentWallet} IS NOT NULL`)
      .groupBy(sql`LOWER(${scans.agentWallet})`)
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
