# WatchTower Database Operations

This document covers backup, restore, reconciliation, and maintenance procedures for the WatchTower production database (Turso/libSQL).

## Architecture

- **Production**: Turso (libSQL-over-HTTP), configured via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- **Development**: Local SQLite file (`watchtower.db`), no configuration needed
- **Schema management**: Drizzle ORM (`npx drizzle-kit push`)

## Turso CLI Setup

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Authenticate
turso auth login

# List databases
turso db list

# Show database info
turso db show watchtower
turso db show watchtower --url     # Connection URL
```

## Backup

### Automated Turso Backups

Turso maintains automatic backups with point-in-time recovery. To create a manual snapshot:

```bash
# Create a database dump
turso db shell watchtower .dump > watchtower-backup-$(date +%Y%m%d-%H%M%S).sql

# Export to a local SQLite file
turso db shell watchtower ".backup watchtower-export.db"
```

### Scheduled Backups

For automated daily backups, set up a cron job or CI/CD step:

```bash
# Daily backup to a timestamped file
0 3 * * * turso db shell watchtower .dump > /backups/watchtower-$(date +\%Y\%m\%d).sql
```

## Restore

### From SQL Dump

```bash
# Create a new database from dump
turso db create watchtower-restored
turso db shell watchtower-restored < watchtower-backup.sql

# Update TURSO_DATABASE_URL in Vercel to point to the restored DB
turso db show watchtower-restored --url
```

### From Turso Point-in-Time Recovery

Contact Turso support for PITR if needed. Turso Pro plans include automated PITR.

## Schema Migration

```bash
# Push schema changes to production
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx drizzle-kit push

# Push schema to local dev
npx drizzle-kit push

# Generate migration files (for review before pushing)
npx drizzle-kit generate
```

## Reconciliation

### Payment Reconciliation

Verifies all completed payments against on-chain transaction receipts:

```bash
npm run reconcile:payments
```

This script:
1. Queries all `completed` payments on `X Layer Mainnet`
2. Fetches each settlement transaction receipt from the RPC
3. Verifies the ERC-20 Transfer event matches the expected amount and treasury
4. Reports any mismatches

### Expected output

```
payment-id-1: reconciled 0.5 USDT0 via 0x...
payment-id-2: reconciled 1 USDT0 via 0x...
Payment reconciliation passed for 2 completed Mainnet payment(s).
```

## Maintenance

### Cleanup Expired Payment Intents

Pending payment intents that were never settled accumulate over time. Run periodically:

```bash
# Preview what would be deleted
node scripts/cleanup-expired-payments.mjs --dry-run

# Delete expired intents
node scripts/cleanup-expired-payments.mjs
```

### Database Size Check

```bash
# Check table sizes
turso db shell watchtower "SELECT name, COUNT(*) as rows FROM (SELECT 'scans' as name FROM scans UNION ALL SELECT 'payments' FROM payments UNION ALL SELECT 'agents' FROM agents UNION ALL SELECT 'used_payment_transactions' FROM used_payment_transactions UNION ALL SELECT 'rate_limits' FROM rate_limits) GROUP BY name ORDER BY rows DESC;"
```

## Tables

| Table | Purpose | Primary Key | Growth Rate |
|-------|---------|-------------|-------------|
| `scans` | Scan results and reports | `id` (auto-increment) | ~per scan |
| `payments` | Payment intent lifecycle | `payment_id` (UUID) | ~per API request |
| `used_payment_transactions` | Replay protection | `tx_hash` | ~per settled payment |
| `agents` | Agent reputation tracking | `wallet` (address) | ~per unique agent |
| `rate_limits` | Rate limit buckets | `id` (hash) | High, auto-pruned |

## Monitoring Queries

```sql
-- Active payments in the last hour
SELECT COUNT(*), status FROM payments
WHERE created_at > (strftime('%s', 'now') - 3600) * 1000
GROUP BY status;

-- Revenue (settled + completed payments)
SELECT SUM(CAST(amount AS REAL)) as total_revenue
FROM payments
WHERE status IN ('settled', 'processing', 'completed')
  AND network = 'X Layer Mainnet';

-- Top agents by scan count
SELECT wallet, total_scans, reckless_trades
FROM agents ORDER BY total_scans DESC LIMIT 10;

-- Expired pending intents (candidates for cleanup)
SELECT COUNT(*) FROM payments
WHERE status = 'pending' AND expires_at < (strftime('%s', 'now') * 1000);
```
