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

function getNetworkPrefix() {
  const networkEnv = process.env.NEXT_PUBLIC_NETWORK_ENV || 'testnet';
  return networkEnv === 'mainnet' ? 'MAINNET' : networkEnv === 'development' ? 'DEV' : 'TESTNET';
}

function getDemoChainId() {
  const prefix = getNetworkPrefix();
  const fallbackChainId = prefix === 'MAINNET' ? '196' : '1952';
  return process.env.WATCHTOWER_DEMO_CHAIN_ID || process.env[`${prefix}_CHAIN_ID`] || fallbackChainId;
}

function getPaymentRpcUrl() {
  const prefix = getNetworkPrefix();
  return process.env.AGENT_PAYMENT_RPC_URL
    || process.env[`${prefix}_RPC_URL`]
    || (prefix === 'MAINNET' ? process.env.XLAYER_RPC_URL : process.env.XLAYER_TESTNET_RPC_URL)
    || process.env.XLAYER_RPC_URL;
}

function getPaymentPolicy() {
  const prefix = getNetworkPrefix();
  const treasuryAddress = getRequiredEnv(
    `${prefix}_TREASURY_ADDRESS`,
    `Missing ${prefix}_TREASURY_ADDRESS for the automatic payment policy.`,
  );
  const tokenAddress = getRequiredEnv(
    `${prefix}_USDT_ADDRESS`,
    `Missing ${prefix}_USDT_ADDRESS for the automatic payment policy.`,
  );
  const chainId = Number(process.env[`${prefix}_CHAIN_ID`] || getDemoChainId());

  return {
    apiOrigin: new URL(getApiUrl()).origin,
    chainId,
    tokenAddress,
    treasuryAddress,
    maxAmount: process.env.AGENT_PAYMENT_MAX_AMOUNT || '1',
  };
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
    paymentPolicy: getPaymentPolicy(),
  };
}

module.exports = {
  createAgentConfig,
};
