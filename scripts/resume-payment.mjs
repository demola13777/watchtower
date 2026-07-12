import nextEnv from '@next/env';
import { createRequire } from 'module';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const require = createRequire(import.meta.url);
const { WatchTowerClient } = require('../packages/watchtower-sdk/src/index.js');

const API_URL = 'http://localhost:3000'; // Run against local to avoid Vercel 500 error
const AGENT_WALLET = process.env.AGENT_PAYMENT_ADDRESS;
const TARGET_ADDRESS = process.env.MAINNET_USDT_ADDRESS;

async function main() {
  const client = new WatchTowerClient({
    apiUrl: API_URL,
    agentWallet: AGENT_WALLET,
    chainId: 196,
  });

  // We need the txHash of the 1 USDT transfer that just happened.
  // The user can provide it, or we can fetch the latest from the DB.
}
