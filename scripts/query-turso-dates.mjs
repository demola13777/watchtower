import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const rs = await client.execute("SELECT created_at FROM used_payment_transactions ORDER BY created_at DESC LIMIT 1");
  console.log("Last used_payment_transaction:", new Date(Number(rs.rows[0].created_at)).toISOString());
  
  const rs2 = await client.execute("SELECT created_at FROM payments ORDER BY created_at DESC LIMIT 1");
  console.log("Last payment:", new Date(Number(rs2.rows[0].created_at)).toISOString());
}
run().catch(console.error);
