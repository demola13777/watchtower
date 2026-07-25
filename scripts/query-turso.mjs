import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  console.log("=== used_payment_transactions ===");
  const rs = await client.execute("SELECT tx_hash, amount, tier, treasury_address FROM used_payment_transactions WHERE chain_id=196");
  rs.rows.forEach(r => console.log(`${r.tx_hash} | ${r.amount} | ${r.tier} | ${r.treasury_address}`));
  
  console.log("\n=== scans ===");
  const scansRs = await client.execute("SELECT id, tier, threat_score FROM scans");
  scansRs.rows.forEach(r => console.log(`${r.id} | ${r.tier} | ${r.threat_score}`));
}
run().catch(console.error);
