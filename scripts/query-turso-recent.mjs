import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const rs = await client.execute("SELECT payment_id, amount, status, tier, created_at, settlement_tx_hash FROM payments ORDER BY created_at DESC LIMIT 5");
  rs.rows.forEach(r => console.log(`${r.payment_id} | ${r.amount} | ${r.status} | ${r.tier} | ${new Date(Number(r.created_at)).toISOString()} | ${r.settlement_tx_hash}`));
}
run().catch(console.error);
