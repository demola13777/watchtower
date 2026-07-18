import nextEnv from '@next/env';
import { createClient as createLibsqlClient } from '@libsql/client';
import {
  createPublicClient,
  decodeEventLog,
  formatUnits,
  http,
  parseAbiItem,
  parseUnits,
} from 'viem';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for payment reconciliation.`);
  return value;
};

const rpcUrl = required('MAINNET_RPC_URL');
const databaseUrl = required('TURSO_DATABASE_URL');
const databaseToken = required('TURSO_AUTH_TOKEN');
const tokenAddress = required('MAINNET_USDT_ADDRESS').toLowerCase();
const treasuryAddress = required('MAINNET_TREASURY_ADDRESS').toLowerCase();
const decimals = Number(required('MAINNET_PAYMENT_TOKEN_DECIMALS'));
const mainnetNetwork = `eip155:${process.env.MAINNET_CHAIN_ID?.trim() || '196'}`;

if (!Number.isInteger(decimals) || decimals < 0) {
  throw new Error('MAINNET_PAYMENT_TOKEN_DECIMALS must be a non-negative integer.');
}

const database = createLibsqlClient({ url: databaseUrl, authToken: databaseToken });
const chain = createPublicClient({ transport: http(rpcUrl) });
const { rows } = await database.execute({
  sql: `SELECT payment_id, amount, currency, settlement_tx_hash
        FROM payments
        WHERE status IN ('settled', 'processing', 'completed')
          AND network IN (?, 'X Layer Mainnet')
        ORDER BY COALESCE(completed_at, settled_at, created_at) ASC`,
  args: [mainnetNetwork],
});

const failures = [];
for (const row of rows) {
  const paymentId = String(row.payment_id);
  const txHash = String(row.settlement_tx_hash || '');
  const amount = String(row.amount);
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    failures.push(`${paymentId}: missing or malformed settlement transaction hash`);
    continue;
  }

  const receipt = await chain.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt || receipt.status !== 'success') {
    failures.push(`${paymentId}: settlement transaction is missing or unsuccessful`);
    continue;
  }

  const requiredAmount = amount.includes('.')
    ? parseUnits(amount, decimals)
    : BigInt(amount);
  const transfer = receipt.logs.find((log) => {
    if (log.address.toLowerCase() !== tokenAddress) return false;
    try {
      const decoded = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
      const args = decoded.args;
      return args.to?.toLowerCase() === treasuryAddress && (args.value ?? 0n) >= requiredAmount;
    } catch {
      return false;
    }
  });

  if (!transfer) {
    failures.push(`${paymentId}: no qualifying token transfer to the configured treasury`);
    continue;
  }

  console.log(`${paymentId}: reconciled ${formatUnits(requiredAmount, decimals)} ${row.currency} via ${txHash}`);
}

if (failures.length > 0) {
  console.error('Payment reconciliation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Payment reconciliation passed for ${rows.length} completed Mainnet payment(s).`);
