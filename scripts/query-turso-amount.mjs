import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const rs = await client.execute("SELECT amount FROM payments WHERE payment_id='0b5cf512-6b5d-4c14-89a8-22b11cc9ef93'");
  console.log(rs.rows[0]);
}
run().catch(console.error);
