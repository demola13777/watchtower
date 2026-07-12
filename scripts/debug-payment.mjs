import nextEnv from '@next/env';
import { createClient } from '@libsql/client';

nextEnv.loadEnvConfig(process.cwd());

const dbClient = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const result = await dbClient.execute(`
    SELECT payment_id, status, created_at, settlement_tx_hash
    FROM payments 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.log(result.rows);
}

main().catch(console.error);
