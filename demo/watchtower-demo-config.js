/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { loadEnvConfig } = require('@next/env');

const projectDir = path.resolve(__dirname, '..');
loadEnvConfig(projectDir);

function getRequiredEnv(name, message) {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  throw new Error(message || `Missing required environment variable: ${name}`);
}

function getAgentPaymentKey() {
  return getRequiredEnv(
    'AGENT_PAYMENT_KEY',
    'Missing AGENT_PAYMENT_KEY. Configure the autonomous agent payment wallet private key in .env.local before running this demo.',
  );
}

function getApiUrl() {
  return process.env.WATCHTOWER_API_URL || 'http://localhost:3000';
}

function getDemoChainId() {
  return process.env.WATCHTOWER_DEMO_CHAIN_ID || process.env.TESTNET_CHAIN_ID || '1952';
}

function getPaymentRpcUrl() {
  return process.env.AGENT_PAYMENT_RPC_URL
    || process.env.TESTNET_RPC_URL
    || process.env.XLAYER_TESTNET_RPC_URL
    || process.env.XLAYER_RPC_URL;
}

function normalizePrivateKey(privateKey) {
  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}

async function createAgentConfig() {
  const paymentPrivateKey = normalizePrivateKey(getAgentPaymentKey());
  const { privateKeyToAccount } = await import('viem/accounts');
  const account = privateKeyToAccount(paymentPrivateKey);

  return {
    apiUrl: getApiUrl(),
    agentWallet: account.address,
    chainId: getDemoChainId(),
    paymentPrivateKey,
    paymentRpcUrl: getPaymentRpcUrl(),
  };
}

module.exports = {
  createAgentConfig,
};
