import type { Address } from 'viem';

export type NetworkEnvironment = 'development' | 'testnet' | 'mainnet';

export interface PaymentTokenConfig {
  symbol: string;
  address?: Address;
  decimals: number;
}

export interface PaymentNetworkConfig {
  environment: NetworkEnvironment;
  name: string;
  chainId: number;
  rpcUrl?: string;
  treasuryAddress?: Address;
  token: PaymentTokenConfig;
}

export interface ResolvedPaymentNetworkConfig extends Omit<PaymentNetworkConfig, 'rpcUrl' | 'treasuryAddress' | 'token'> {
  rpcUrl: string;
  treasuryAddress: Address;
  token: PaymentTokenConfig & { address: Address };
}

function envString(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, '');
  return normalized || undefined;
}

function envAddress(value: string | undefined): Address | undefined {
  const normalized = envString(value);
  if (!normalized) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw new Error(`Invalid EVM address in payment network config: ${value}`);
  }
  return normalized as Address;
}

function envNumber(value: string | undefined, fallback: number): number {
  const normalized = envString(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric payment network config value: ${value}`);
  }
  return parsed;
}

export const NETWORK_ENV = (envString(process.env.NEXT_PUBLIC_NETWORK_ENV) || 'testnet') as NetworkEnvironment;

export const PAYMENT_NETWORKS: Record<NetworkEnvironment, PaymentNetworkConfig> = {
  development: {
    environment: 'development',
    name: envString(process.env.DEV_NETWORK_NAME) || 'X Layer Testnet',
    chainId: envNumber(process.env.DEV_CHAIN_ID, 1952),
    rpcUrl: envString(process.env.DEV_RPC_URL) || envString(process.env.XLAYER_TESTNET_RPC_URL) || envString(process.env.XLAYER_RPC_URL) || 'https://testrpc.xlayer.tech',
    treasuryAddress: envAddress(process.env.DEV_TREASURY_ADDRESS || process.env.X402_PAY_TO),
    token: {
      symbol: envString(process.env.DEV_PAYMENT_TOKEN_SYMBOL) || 'USDT',
      address: envAddress(process.env.DEV_USDT_ADDRESS || process.env.X402_TOKEN_ADDRESS),
      decimals: envNumber(process.env.DEV_PAYMENT_TOKEN_DECIMALS, 6),
    },
  },
  testnet: {
    environment: 'testnet',
    name: envString(process.env.TESTNET_NETWORK_NAME) || 'X Layer Testnet',
    chainId: envNumber(process.env.TESTNET_CHAIN_ID, 1952),
    rpcUrl: envString(process.env.TESTNET_RPC_URL) || envString(process.env.XLAYER_TESTNET_RPC_URL) || envString(process.env.XLAYER_RPC_URL) || 'https://testrpc.xlayer.tech',
    treasuryAddress: envAddress(process.env.TESTNET_TREASURY_ADDRESS || process.env.X402_PAY_TO),
    token: {
      symbol: envString(process.env.TESTNET_PAYMENT_TOKEN_SYMBOL) || 'USDT',
      address: envAddress(process.env.TESTNET_USDT_ADDRESS || process.env.X402_TOKEN_ADDRESS),
      decimals: envNumber(process.env.TESTNET_PAYMENT_TOKEN_DECIMALS, 6),
    },
  },
  mainnet: {
    environment: 'mainnet',
    name: envString(process.env.MAINNET_NETWORK_NAME) || 'X Layer Mainnet',
    chainId: envNumber(process.env.MAINNET_CHAIN_ID, 196),
    rpcUrl: envString(process.env.MAINNET_RPC_URL) || envString(process.env.XLAYER_RPC_URL) || 'https://rpc.xlayer.tech',
    treasuryAddress: envAddress(process.env.MAINNET_TREASURY_ADDRESS || process.env.X402_PAY_TO),
    token: {
      symbol: envString(process.env.MAINNET_PAYMENT_TOKEN_SYMBOL) || 'USDT',
      address: envAddress(process.env.MAINNET_USDT_ADDRESS || process.env.X402_TOKEN_ADDRESS),
      decimals: envNumber(process.env.MAINNET_PAYMENT_TOKEN_DECIMALS, 6),
    },
  },
};

export function getActivePaymentNetwork(): PaymentNetworkConfig {
  const config = PAYMENT_NETWORKS[NETWORK_ENV] ?? PAYMENT_NETWORKS.testnet;
  return config;
}

export function getRequiredPaymentNetwork(): ResolvedPaymentNetworkConfig {
  const config = getActivePaymentNetwork();
  const missing: string[] = [];
  if (!config.rpcUrl) missing.push(`${config.environment.toUpperCase()}_RPC_URL`);
  if (!config.treasuryAddress) missing.push(`${config.environment.toUpperCase()}_TREASURY_ADDRESS or X402_PAY_TO`);
  if (!config.token.address) missing.push(`${config.environment.toUpperCase()}_USDT_ADDRESS or X402_TOKEN_ADDRESS`);

  if (missing.length > 0) {
    throw new Error(`Missing payment network configuration: ${missing.join(', ')}`);
  }

  return {
    ...config,
    rpcUrl: config.rpcUrl,
    treasuryAddress: config.treasuryAddress,
    token: {
      ...config.token,
      address: config.token.address,
    },
  } as ResolvedPaymentNetworkConfig;
}
