import nextEnv from '@next/env';
import { createRequire } from 'module';
import { createClient } from '@libsql/client';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const require = createRequire(import.meta.url);
const { WatchTowerClient } = require('../packages/watchtower-sdk/src/index.js');

const dbClient = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const result = await dbClient.execute(`
    SELECT payment_id, settlement_tx_hash 
    FROM payments 
    WHERE status = 'settled' AND tier = 'Tier 1 - Deep Scan'
    ORDER BY created_at DESC 
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log("No settled payments found.");
    return;
  }

  const paymentId = result.rows[0].payment_id;
  const txHash = result.rows[0].settlement_tx_hash;

  console.log(`Found settled payment: ${paymentId}`);
  console.log(`TxHash: ${txHash}`);
  
  const client = new WatchTowerClient({
    apiUrl: 'http://localhost:3000',
    agentWallet: process.env.AGENT_PAYMENT_ADDRESS,
    chainId: 196,
  });

  console.log("Resuming scan against local server...");
  try {
    const report = await client.deepScan(process.env.MAINNET_USDT_ADDRESS, {
      chainId: 196,
      paymentId: paymentId,
      paymentTxHash: txHash,
    });
    console.log('\n✅ Deep Scan Completed Successfully!');
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

main().catch(console.error);
