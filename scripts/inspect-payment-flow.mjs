import nextEnv from '@next/env';
import { createClient } from '@libsql/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function argValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function toIso(value) {
  return value ? new Date(Number(value)).toISOString() : null;
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? null]));
}

const database = createClient({
  url: requiredEnv('TURSO_DATABASE_URL'),
  authToken: requiredEnv('TURSO_AUTH_TOKEN'),
});

const filters = [];
const args = [];

const paymentId = argValue('--payment-id');
const requestHash = argValue('--request-hash');
const txHash = argValue('--tx');
const payer = argValue('--payer');
const limit = Math.min(Math.max(Number(argValue('--limit') ?? 20), 1), 100);

if (paymentId) {
  filters.push('payment_id = ?');
  args.push(paymentId);
}
if (requestHash) {
  filters.push('request_hash = ?');
  args.push(requestHash);
}
if (txHash) {
  filters.push('LOWER(settlement_tx_hash) = LOWER(?)');
  args.push(txHash);
}
if (payer) {
  filters.push('LOWER(payer) = LOWER(?)');
  args.push(payer);
}

const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

const payments = await database.execute({
  sql: `SELECT payment_id, status, tier, amount, currency, network, payer,
               settlement_tx_hash, request_hash, resource, method,
               created_at, settled_at, completed_at, failure_reason
        FROM payments
        ${whereSql}
        ORDER BY COALESCE(completed_at, settled_at, created_at) DESC
        LIMIT ?`,
  args: [...args, limit],
});

const requestHashes = [...new Set(payments.rows.map((row) => row.request_hash).filter(Boolean))];
const scanWallets = [...new Set(payments.rows.map((row) => row.payer).filter(Boolean))];

let scans = { rows: [] };
if (scanWallets.length > 0) {
  scans = await database.execute({
    sql: `SELECT id, chain_id, token_address, threat_score, recommendation,
                 scan_hash, agent_wallet, tier, timestamp
          FROM scans
          WHERE LOWER(agent_wallet) IN (${scanWallets.map(() => 'LOWER(?)').join(', ')})
          ORDER BY timestamp DESC
          LIMIT ?`,
    args: [...scanWallets, limit],
  });
}

const output = {
  filters: { paymentId, requestHash, txHash, payer, limit },
  summary: {
    payments: payments.rows.length,
    settledOrCompleted: payments.rows.filter((row) => ['settled', 'processing', 'completed'].includes(String(row.status))).length,
    pendingChallenges: payments.rows.filter((row) => row.status === 'pending').length,
    uniqueRequestHashes: requestHashes.length,
    matchingScanRows: scans.rows.length,
  },
  payments: payments.rows.map((row) => ({
    ...normalizeRow(row),
    created_at_iso: toIso(row.created_at),
    settled_at_iso: toIso(row.settled_at),
    completed_at_iso: toIso(row.completed_at),
  })),
  scans: scans.rows.map((row) => ({
    ...normalizeRow(row),
    timestamp_iso: toIso(row.timestamp),
  })),
};

console.log(JSON.stringify(output, null, 2));
