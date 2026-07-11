import { NextResponse } from 'next/server';
import { getRequiredPaymentNetwork } from '@/config/network';
import { databaseBackend, db } from '@/lib/db';
import { payments, rateLimits } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const network = getRequiredPaymentNetwork();
    await Promise.all([
      db.select({ paymentId: payments.paymentId }).from(payments).limit(1),
      db.select({ id: rateLimits.id }).from(rateLimits).limit(1),
    ]);

    return NextResponse.json({
      ok: true,
      paymentNetwork: network.name,
      chainId: network.chainId,
      database: databaseBackend,
    });
  } catch (error) {
    console.error('[WatchTower Health] Service configuration check failed:', error);
    return NextResponse.json({ ok: false, error: 'Service configuration is unavailable.' }, { status: 503 });
  }
}
