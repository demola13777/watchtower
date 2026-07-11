/**
 * Cleanup Expired Payment Intents
 *
 * Purges pending payment intents that have passed their expires_at timestamp.
 * Run periodically (e.g. daily via cron) to prevent unbounded table growth.
 *
 * Usage:
 *   node scripts/cleanup-expired-payments.mjs [--dry-run]
 */

import nextEnv from '@next/env';
import { createClient as createLibsqlClient } from '@libsql/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const dryRun = process.argv.includes('--dry-run');
const databaseUrl = process.env.TURSO_DATABASE_URL;
const databaseToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl || !databaseToken) {
  console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
  process.exit(1);
}

const database = createLibsqlClient({ url: databaseUrl, authToken: databaseToken });
const now = Date.now();

// Count expired pending intents.
const { rows: countRows } = await database.execute({
  sql: `SELECT COUNT(*) AS count FROM payments WHERE status = 'pending' AND expires_at < ?`,
  args: [now],
});
const expiredCount = Number(countRows[0]?.count ?? 0);

if (expiredCount === 0) {
  console.log('No expired pending payment intents found.');
  process.exit(0);
}

console.log(`Found ${expiredCount} expired pending payment intent(s).`);

if (dryRun) {
  console.log('Dry run — no rows deleted.');

  const { rows: sample } = await database.execute({
    sql: `SELECT payment_id, tier, amount, currency, created_at, expires_at
          FROM payments WHERE status = 'pending' AND expires_at < ?
          ORDER BY expires_at ASC LIMIT 10`,
    args: [now],
  });
  for (const row of sample) {
    const age = Math.round((now - Number(row.expires_at)) / 60_000);
    console.log(`  ${row.payment_id}: ${row.amount} ${row.currency} (${row.tier}), expired ${age}m ago`);
  }

  process.exit(0);
}

// Also purge corresponding expired rate limit rows.
const { rowsAffected: rateLimitsPurged } = await database.execute({
  sql: `DELETE FROM rate_limits WHERE expires_at < ?`,
  args: [now],
});

const { rowsAffected } = await database.execute({
  sql: `DELETE FROM payments WHERE status = 'pending' AND expires_at < ?`,
  args: [now],
});

console.log(`Deleted ${rowsAffected} expired pending payment intent(s).`);
console.log(`Deleted ${rateLimitsPurged} expired rate limit row(s).`);
