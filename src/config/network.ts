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

function envAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid EVM address in payment network config: ${value}`);
  }
  return value as Address;
}

function envNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric payment network config value: ${value}`);
  }
  return parsed;
}

export const NETWORK_ENV = (process.env.NEXT_PUBLIC_NETWORK_ENV || 'testnet') as NetworkEnvironment;

export const PAYMENT_NETWORKS: Record<NetworkEnvironment, PaymentNetworkConfig> = {
  development: {
    environment: 'development',
    name: process.env.DEV_NETWORK_NAME || 'X Layer Testnet',
    chainId: envNumber(process.env.DEV_CHAIN_ID, 1952),
    rpcUrl: process.env.DEV_RPC_URL || process.env.XLAYER_TESTNET_RPC_URL || process.env.XLAYER_RPC_URL,
    treasuryAddress: envAddress(process.env.DEV_TREASURY_ADDRESS || process.env.X402_PAY_TO),
    token: {
      symbol: process.env.DEV_PAYMENT_TOKEN_SYMBOL || 'USDT',
      address: envAddress(process.env.DEV_USDT_ADDRESS || process.env.X402_TOKEN_ADDRESS),
      decimals: envNumber(process.env.DEV_PAYMENT_TOKEN_DECIMALS, 6),
    },
  },
  testnet: {
    environment: 'testnet',
    name: process.env.TESTNET_NETWORK_NAME || 'X Layer Testnet',
    chainId: envNumber(process.env.TESTNET_CHAIN_ID, 1952),
    rpcUrl: process.env.TESTNET_RPC_URL || process.env.XLAYER_TESTNET_RPC_URL || process.env.XLAYER_RPC_URL,
    treasuryAddress: envAddress(process.env.TESTNET_TREASURY_ADDRESS || process.env.X402_PAY_TO),
    token: {
      symbol: process.env.TESTNET_PAYMENT_TOKEN_SYMBOL || 'USDT',
      address: envAddress(process.env.TESTNET_USDT_ADDRESS || process.env.X402_TOKEN_ADDRESS),
      decimals: envNumber(process.env.TESTNET_PAYMENT_TOKEN_DECIMALS, 6),
    },
  },
  mainnet: {
    environment: 'mainnet',
    name: process.env.MAINNET_NETWORK_NAME || 'X Layer Mainnet',
    chainId: envNumber(process.env.MAINNET_CHAIN_ID, 196),
    rpcUrl: process.env.MAINNET_RPC_URL || process.env.XLAYER_RPC_URL,
    treasuryAddress: envAddress(process.env.MAINNET_TREASURY_ADDRESS || process.env.X402_PAY_TO),
    token: {
      symbol: process.env.MAINNET_PAYMENT_TOKEN_SYMBOL || 'USDT',
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
