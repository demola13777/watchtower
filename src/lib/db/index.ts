import * as schema from './schema';

export type DatabaseBackend = 'sqlite' | 'turso';

type LocalSqliteDatabase = {
  prepare: (sql: string) => {
    all: () => Array<{ name: string }>;
    run: () => unknown;
  };
};

// ---------------------------------------------------------------------------
// Database Connection — Environment-Aware
//
// Local development: Uses better-sqlite3 (zero latency, works offline)
// Production/Staging: Uses Turso via @libsql/client (serverless-compatible)
//
// The switch is controlled by the TURSO_DATABASE_URL env var:
//   - If set → connect to Turso (production)
//   - If not set → use local watchtower.db file (development)
//
// Both drivers expose the identical Drizzle query API, so every file that
// imports `db` works unchanged regardless of which driver is active.
// ---------------------------------------------------------------------------

function requiresRemoteDatabase() {
  return process.env.WATCHTOWER_REQUIRE_TURSO === 'true'
    || (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production');
}

export const databaseBackend: DatabaseBackend = process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite';

function createDb() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    if (!tursoToken) {
      throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is configured.');
    }
    // Production: Turso/LibSQL over HTTP
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/libsql');

    const client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });

    console.log('[WatchTower DB] Connected to Turso (production)');
    return drizzle(client, { schema });
  } else {
    if (requiresRemoteDatabase()) {
      throw new Error('A production WatchTower deployment requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
    }
    // Development: Local SQLite file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/better-sqlite3');

    const sqlite = new Database('watchtower.db');
    ensureLocalSchema(sqlite);
    console.log('[WatchTower DB] Connected to local SQLite (development)');
    return drizzle(sqlite, { schema });
  }
}

function ensureLocalSchema(sqlite: LocalSqliteDatabase) {
  const columns = new Set(sqlite.prepare('PRAGMA table_info(scans)').all().map((column) => column.name));

  if (columns.size > 0) {
    if (!columns.has('chain_id')) {
      sqlite.prepare("ALTER TABLE scans ADD COLUMN chain_id text DEFAULT '196' NOT NULL").run();
    }
    if (!columns.has('tx_hash')) {
      sqlite.prepare('ALTER TABLE scans ADD COLUMN tx_hash text').run();
    }
  }

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS payments (
      payment_id text PRIMARY KEY,
      status text NOT NULL DEFAULT 'pending',
      tier text NOT NULL,
      amount text NOT NULL,
      currency text NOT NULL,
      network text NOT NULL,
      scheme text NOT NULL,
      payer text,
      pay_to text NOT NULL,
      resource text NOT NULL,
      method text NOT NULL,
      request_hash text NOT NULL,
      requirement text NOT NULL,
      payment_payload text,
      settlement_tx_hash text,
      failure_reason text,
      created_at integer NOT NULL,
      expires_at integer NOT NULL,
      settled_at integer
    )
  `).run();

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS used_payment_transactions (
      tx_hash text PRIMARY KEY,
      network text NOT NULL,
      chain_id integer NOT NULL,
      token_address text NOT NULL,
      treasury_address text NOT NULL,
      payer text NOT NULL,
      amount text NOT NULL,
      tier text NOT NULL,
      request_hash text,
      created_at integer NOT NULL
    )
  `).run();

  const usedPaymentColumns = new Set(
    sqlite.prepare('PRAGMA table_info(used_payment_transactions)').all().map((column) => column.name),
  );
  if (!usedPaymentColumns.has('request_hash')) {
    sqlite.prepare('ALTER TABLE used_payment_transactions ADD COLUMN request_hash text').run();
  }
  if (!usedPaymentColumns.has('payment_id')) {
    sqlite.prepare('ALTER TABLE used_payment_transactions ADD COLUMN payment_id text').run();
  }

  const paymentColumns = new Set(sqlite.prepare('PRAGMA table_info(payments)').all().map((column) => column.name));
  if (!paymentColumns.has('response_payload')) {
    sqlite.prepare('ALTER TABLE payments ADD COLUMN response_payload text').run();
  }
  if (!paymentColumns.has('completed_at')) {
    sqlite.prepare('ALTER TABLE payments ADD COLUMN completed_at integer').run();
  }
  sqlite.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS payments_settlement_tx_hash_unique
    ON payments (settlement_tx_hash)
  `).run();
  sqlite.prepare(`
    CREATE INDEX IF NOT EXISTS payments_request_payer_status_idx
    ON payments (request_hash, payer, status)
  `).run();
  sqlite.prepare(`
    CREATE INDEX IF NOT EXISTS payments_status_expires_idx
    ON payments (status, expires_at)
  `).run();

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id text PRIMARY KEY,
      count integer NOT NULL,
      expires_at integer NOT NULL
    )
  `).run();
}

export const db = createDb();
