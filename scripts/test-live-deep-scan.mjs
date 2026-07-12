import nextEnv from '@next/env';
import { createRequire } from 'module';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const require = createRequire(import.meta.url);
const { WatchTowerClient } = require('../packages/watchtower-sdk/src/index.js');

const API_URL = process.env.WATCHTOWER_API_URL || 'https://watchtowr.xyz';
const AGENT_WALLET = process.env.AGENT_PAYMENT_ADDRESS;
const PAYMENT_KEY = process.env.AGENT_PAYMENT_KEY;

// Using USDT contract as a sample target
const TARGET_ADDRESS = process.env.MAINNET_USDT_ADDRESS;

async function main() {
  if (!PAYMENT_KEY) {
    throw new Error('AGENT_PAYMENT_KEY is missing in .env.local');
  }

  console.log(`Executing real paid Deep Scan against ${API_URL}`);
  console.log(`Target: ${TARGET_ADDRESS} on X Layer Mainnet (196)`);
  
  const client = new WatchTowerClient({
    apiUrl: API_URL,
    agentWallet: AGENT_WALLET,
    paymentPrivateKey: PAYMENT_KEY,
    chainId: 196,
    paymentPolicy: {
      apiOrigin: API_URL,
      chainId: 196,
      tokenAddress: TARGET_ADDRESS,
      treasuryAddress: process.env.MAINNET_TREASURY_ADDRESS,
      maxAmount: '10', // Allow up to 10 USDT per request
    },
  });

  try {
    const report = await client.deepScan(TARGET_ADDRESS, '196');
    console.log('\n✅ Deep Scan Completed Successfully!');
    console.log(JSON.stringify(report, null, 2));
    
    console.log(`\nView attestation at: https://watchtowr.xyz/verify`);
  } catch (err) {
    console.error('\n❌ Deep Scan Failed:', err.message);
  }
}

main().catch(console.error);
