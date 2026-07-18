import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const scans = sqliteTable('scans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chainId: text('chain_id').notNull().default('196'),
  tokenAddress: text('token_address').notNull(),
  threatScore: integer('threat_score').notNull(),
  recommendation: text('recommendation').notNull(),
  scanHash: text('scan_hash').notNull().unique(), // H8: Unique constraint
  txHash: text('tx_hash'),                        // C6: Separate on-chain tx hash
  agentWallet: text('agent_wallet'),               // Optional, who requested the scan
  tier: text('tier').default('firewall'),           // 'firewall' (0.5 USDT) or 'deep' (1 USDT)
  reportData: text('report_data'),                 // Stores full stringified deep scan JSON
  timestamp: integer('timestamp').notNull(),
});

export const agents = sqliteTable('agents', {
  wallet: text('wallet').primaryKey(),
  totalScans: integer('total_scans').default(0),
  recklessTrades: integer('reckless_trades').default(0), // Tracks agents that ignore ABORT warnings
});

export const payments = sqliteTable('payments', {
  paymentId: text('payment_id').primaryKey(),
  status: text('status').notNull().default('pending'), // pending | settling | settled | processing | completed | rejected | expired
  tier: text('tier').notNull(),
  amount: text('amount').notNull(),
  currency: text('currency').notNull(),
  network: text('network').notNull(),
  scheme: text('scheme').notNull(),
  payer: text('payer'),
  payTo: text('pay_to').notNull(),
  resource: text('resource').notNull(),
  method: text('method').notNull(),
  requestHash: text('request_hash').notNull(),
  requirement: text('requirement').notNull(),
  paymentPayload: text('payment_payload'),
  settlementTxHash: text('settlement_tx_hash'),
  failureReason: text('failure_reason'),
  responsePayload: text('response_payload'),
  completedAt: integer('completed_at'),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  settledAt: integer('settled_at'),
}, (table) => [
  uniqueIndex('payments_settlement_tx_hash_unique').on(table.settlementTxHash),
  index('payments_request_payer_status_idx').on(table.requestHash, table.payer, table.status),
  index('payments_status_expires_idx').on(table.status, table.expiresAt),
]);

export const usedPaymentTransactions = sqliteTable('used_payment_transactions', {
  txHash: text('tx_hash').primaryKey(),
  network: text('network').notNull(),
  chainId: integer('chain_id').notNull(),
  tokenAddress: text('token_address').notNull(),
  treasuryAddress: text('treasury_address').notNull(),
  payer: text('payer').notNull(),
  amount: text('amount').notNull(),
  tier: text('tier').notNull(),
  paymentId: text('payment_id'),
  requestHash: text('request_hash'),
  createdAt: integer('created_at').notNull(),
});

export const rateLimits = sqliteTable('rate_limits', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
