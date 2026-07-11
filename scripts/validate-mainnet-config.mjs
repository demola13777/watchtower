import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const CANONICAL_XLAYER_USDT0 = '0x779ded0c9e1022225f8e0630b35a9b54be713736';
const PUBLIC_RPC_HOSTS = new Set(['rpc.xlayer.tech', 'xlayerrpc.okx.com']);
const errors = [];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} must be configured.`);
  return value;
}

function requireAddress(name) {
  const value = required(name);
  if (value && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    errors.push(`${name} must be a valid EVM address.`);
  }
  return value;
}

function requireExact(name, expected) {
  const value = required(name);
  if (value && value !== expected) errors.push(`${name} must be ${expected}.`);
  return value;
}

requireExact('NEXT_PUBLIC_NETWORK_ENV', 'mainnet');
requireExact('MAINNET_NETWORK_NAME', 'X Layer Mainnet');
requireExact('MAINNET_CHAIN_ID', '196');
const rpcUrl = required('MAINNET_RPC_URL');
if (rpcUrl) {
  try {
    const host = new URL(rpcUrl).hostname.toLowerCase();
    if (PUBLIC_RPC_HOSTS.has(host)) {
      errors.push('MAINNET_RPC_URL must use a dedicated provider endpoint, not a shared public RPC.');
    }
  } catch {
    errors.push('MAINNET_RPC_URL must be a valid URL.');
  }
}

requireAddress('MAINNET_TREASURY_ADDRESS');
const tokenAddress = requireAddress('MAINNET_USDT_ADDRESS');
if (tokenAddress && tokenAddress.toLowerCase() !== CANONICAL_XLAYER_USDT0) {
  errors.push('MAINNET_USDT_ADDRESS must match the approved X Layer USD0 contract.');
}
requireExact('MAINNET_PAYMENT_TOKEN_SYMBOL', 'USDT0');
requireExact('MAINNET_PAYMENT_TOKEN_DECIMALS', '6');
requireExact('NEXT_PUBLIC_REGISTRY_CHAIN_ID', '196');
requireAddress('NEXT_PUBLIC_REGISTRY_ADDRESS');
required('NEXT_PUBLIC_REGISTRY_RPC_URL');

const confirmations = Number(required('PAYMENT_MIN_CONFIRMATIONS'));
if (!Number.isInteger(confirmations) || confirmations < 2) {
  errors.push('PAYMENT_MIN_CONFIRMATIONS must be an integer of at least 2 for mainnet.');
}

if (!['true', 'false'].includes(required('RECORD_FIREWALL_SCANS'))) {
  errors.push('RECORD_FIREWALL_SCANS must be explicitly true or false.');
}

required('TURSO_DATABASE_URL');
required('TURSO_AUTH_TOKEN');

// ---------------------------------------------------------------------------
// Advisory warnings (non-blocking) — surface production readiness gaps.
// ---------------------------------------------------------------------------
const warnings = [];

// Chain-detection RPCs: the chain resolver fires eth_getCode against all
// supported chains for every uncached token.  Public RPC fallbacks will
// get rate-limited under production load.
const CHAIN_RPC_VARS = [
  { env: 'ETHEREUM_RPC_URL', chain: 'Ethereum', fallback: 'ethereum-rpc.publicnode.com' },
  { env: 'BSC_RPC_URL', chain: 'BNB Chain', fallback: 'bsc-rpc.publicnode.com' },
  { env: 'POLYGON_RPC_URL', chain: 'Polygon', fallback: 'polygon-bor-rpc.publicnode.com' },
  { env: 'OPTIMISM_RPC_URL', chain: 'Optimism', fallback: 'optimism-rpc.publicnode.com' },
  { env: 'ARBITRUM_RPC_URL', chain: 'Arbitrum', fallback: 'arbitrum-one-rpc.publicnode.com' },
  { env: 'AVALANCHE_RPC_URL', chain: 'Avalanche', fallback: 'avalanche-c-chain-rpc.publicnode.com' },
  { env: 'BASE_RPC_URL', chain: 'Base', fallback: 'base-rpc.publicnode.com' },
];

for (const { env, chain, fallback } of CHAIN_RPC_VARS) {
  const value = process.env[env]?.trim();
  if (!value) {
    warnings.push(`${env} is not set — chain detection for ${chain} will use ${fallback} (public, rate-limited).`);
  } else {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host.includes('publicnode.com')) {
        warnings.push(`${env} uses publicnode.com — consider a dedicated provider for ${chain}.`);
      }
    } catch {
      // URL parsing failed — already validated elsewhere or irrelevant.
    }
  }
}

// Ethplorer: the Whale Intelligence module falls back to 'freekey' (2 req/sec)
// if ETHPLORER_API_KEY is not set.
if (!process.env.ETHPLORER_API_KEY?.trim()) {
  warnings.push('ETHPLORER_API_KEY is not set — Whale Intelligence module will use the free tier (2 req/sec).');
}

if (errors.length > 0) {
  console.error('Mainnet configuration validation failed:');
  for (const error of errors) console.error(`  ✗ ${error}`);
  if (warnings.length > 0) {
    console.warn('\nAdvisory warnings:');
    for (const warning of warnings) console.warn(`  ⚠ ${warning}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('Advisory warnings:');
  for (const warning of warnings) console.warn(`  ⚠ ${warning}`);
  console.log('');
}

console.log('Mainnet configuration validation passed.');
