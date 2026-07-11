export const DEFAULT_CHAIN_ID = '196';
export const XLAYER_TESTNET_CHAIN_ID = '1952';
const IS_MAINNET_ENV = process.env.NEXT_PUBLIC_NETWORK_ENV === 'mainnet';

export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  process.env.WATCHTOWER_REGISTRY_ADDRESS ||
  // Preserve the local legacy registry for non-production development only.
  // A mainnet deployment must explicitly declare its own registry address.
  (IS_MAINNET_ENV ? '' : '0x82a131047e92b0A785971AA78634495222b9dED5');

export const REGISTRY_CHAIN_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CHAIN_ID || (IS_MAINNET_ENV ? DEFAULT_CHAIN_ID : XLAYER_TESTNET_CHAIN_ID);

export const SCAN_PRICING_USDT = {
  deep: 1,
  firewall: 0.5,
} as const;

export type ScanTier = keyof typeof SCAN_PRICING_USDT;

export interface SupportedEvmChain {
  chainId: string;
  name: string;
  dexScreenerChainId?: string;
  rpcUrl?: string;
  supportsGoPlus?: boolean;
}

const ALL_SUPPORTED_EVM_CHAINS: SupportedEvmChain[] = [
  {
    chainId: '1',
    name: 'Ethereum',
    dexScreenerChainId: 'ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
    supportsGoPlus: true,
  },
  {
    chainId: '10',
    name: 'Optimism',
    dexScreenerChainId: 'optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism-rpc.publicnode.com',
    supportsGoPlus: true,
  },
  {
    chainId: '56',
    name: 'BNB Chain',
    dexScreenerChainId: 'bsc',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com',
    supportsGoPlus: true,
  },
  {
    chainId: '137',
    name: 'Polygon',
    dexScreenerChainId: 'polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    supportsGoPlus: true,
  },
  {
    chainId: '196',
    name: 'X Layer Mainnet',
    dexScreenerChainId: 'xlayer',
    rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    supportsGoPlus: true,
  },
  {
    chainId: '1952',
    name: 'X Layer Testnet',
    rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
    supportsGoPlus: false,
  },
  {
    chainId: '42161',
    name: 'Arbitrum',
    dexScreenerChainId: 'arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one-rpc.publicnode.com',
    supportsGoPlus: true,
  },
  {
    chainId: '43114',
    name: 'Avalanche',
    dexScreenerChainId: 'avalanche',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://avalanche-c-chain-rpc.publicnode.com',
    supportsGoPlus: true,
  },
  {
    chainId: '8453',
    name: 'Base',
    dexScreenerChainId: 'base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
    supportsGoPlus: true,
  },
];

// In mainnet production, exclude testnet chains from auto-detection to avoid
// unnecessary RPC calls and prevent testnet tokens from appearing as candidates.
export const SUPPORTED_EVM_CHAINS: SupportedEvmChain[] = IS_MAINNET_ENV
  ? ALL_SUPPORTED_EVM_CHAINS.filter((chain) => chain.chainId !== XLAYER_TESTNET_CHAIN_ID)
  : ALL_SUPPORTED_EVM_CHAINS;

export const DEXSCREENER_CHAIN_BY_EVM_CHAIN_ID = Object.fromEntries(
  SUPPORTED_EVM_CHAINS
    .filter((chain) => chain.dexScreenerChainId)
    .map((chain) => [chain.chainId, chain.dexScreenerChainId as string]),
) as Record<string, string>;
