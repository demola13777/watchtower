import { DEFAULT_CHAIN_ID, SUPPORTED_EVM_CHAINS, type SupportedEvmChain } from '@/lib/config';

type Confidence = 'high' | 'medium' | 'low' | 'ambiguous' | 'fallback' | 'explicit';

interface DexPair {
  chainId?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
}

interface DexScreenerResponse {
  pairs?: DexPair[];
}

interface GoPlusResponse {
  result?: Record<string, unknown>;
}

export interface ChainCandidate {
  chainId: string;
  name: string;
  confidenceScore: number;
  signals: string[];
}

export interface ChainResolution {
  chainId: string;
  chainName: string;
  confidence: Confidence;
  source: 'explicit' | 'auto' | 'fallback';
  candidates: ChainCandidate[];
  reason: string;
}

const RESOLUTION_TTL_MS = 5 * 60 * 1000;
const DEXSCREENER_TIMEOUT_MS = 5000;
const AUXILIARY_TIMEOUT_MS = 2500;

const cache = new Map<string, { resolution: ChainResolution; expiresAt: number }>();

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function getChain(chainId: string): SupportedEvmChain | undefined {
  return SUPPORTED_EVM_CHAINS.find((chain) => chain.chainId === chainId);
}

function blankCandidate(chain: SupportedEvmChain): ChainCandidate {
  return {
    chainId: chain.chainId,
    name: chain.name,
    confidenceScore: 0,
    signals: [],
  };
}

function confidenceFor(top: ChainCandidate, second?: ChainCandidate): Confidence {
  if (second && top.confidenceScore >= 35 && top.confidenceScore - second.confidenceScore <= 15) {
    return 'ambiguous';
  }
  if (top.confidenceScore >= 80) return 'high';
  if (top.confidenceScore >= 50) return 'medium';
  return 'low';
}

async function fetchDexScreener(address: string): Promise<DexScreenerResponse | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      signal: timeoutSignal(DEXSCREENER_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as DexScreenerResponse;
  } catch {
    return null;
  }
}

async function hasContractCode(chain: SupportedEvmChain, address: string): Promise<boolean> {
  if (!chain.rpcUrl) return false;

  try {
    const res = await fetch(chain.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: timeoutSignal(AUXILIARY_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { result?: string };
    return Boolean(data.result && data.result !== '0x');
  } catch {
    return false;
  }
}

async function hasGoPlusSecurity(chain: SupportedEvmChain, address: string): Promise<boolean> {
  if (!chain.supportsGoPlus) return false;

  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chain.chainId}?contract_addresses=${address}`,
      { signal: timeoutSignal(AUXILIARY_TIMEOUT_MS) },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as GoPlusResponse;
    return Boolean(data.result?.[address.toLowerCase()] ?? data.result?.[address]);
  } catch {
    return false;
  }
}

export async function resolveTokenChain(tokenAddress: string, explicitChainId?: string): Promise<ChainResolution> {
  const normalizedAddress = tokenAddress.toLowerCase();

  if (explicitChainId) {
    const chain = getChain(explicitChainId);
    return {
      chainId: explicitChainId,
      chainName: chain?.name ?? `Chain ${explicitChainId}`,
      confidence: 'explicit',
      source: 'explicit',
      candidates: chain ? [blankCandidate(chain)] : [],
      reason: 'Caller supplied chainId; auto-detection skipped.',
    };
  }

  const cached = cache.get(normalizedAddress);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.resolution;
  }

  const candidates = new Map<string, ChainCandidate>();
  for (const chain of SUPPORTED_EVM_CHAINS) {
    candidates.set(chain.chainId, blankCandidate(chain));
  }

  const dexData = await fetchDexScreener(normalizedAddress);
  for (const pair of dexData?.pairs ?? []) {
    const chain = SUPPORTED_EVM_CHAINS.find((item) => item.dexScreenerChainId === pair.chainId);
    if (!chain) continue;

    const candidate = candidates.get(chain.chainId);
    if (!candidate) continue;

    const liquidityUsd = pair.liquidity?.usd ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    candidate.confidenceScore += 45;
    candidate.confidenceScore += Math.min(Math.floor(liquidityUsd / 100_000) * 5, 25);
    candidate.confidenceScore += Math.min(Math.floor(volume24h / 100_000) * 3, 15);
    candidate.signals.push(
      liquidityUsd > 0
        ? `DexScreener liquidity on ${chain.name}: $${Math.round(liquidityUsd).toLocaleString()}`
        : `DexScreener pair found on ${chain.name}`,
    );
  }

  const [codeChecks, goPlusChecks] = await Promise.all([
    Promise.all(
      SUPPORTED_EVM_CHAINS.map(async (chain) => ({
        chain,
        hasCode: await hasContractCode(chain, normalizedAddress),
      })),
    ),
    Promise.all(
      SUPPORTED_EVM_CHAINS.map(async (chain) => ({
        chain,
        hasSecurityData: await hasGoPlusSecurity(chain, normalizedAddress),
      })),
    ),
  ]);

  for (const { chain, hasCode } of codeChecks) {
    if (!hasCode) continue;
    const candidate = candidates.get(chain.chainId);
    if (!candidate) continue;
    candidate.confidenceScore += 30;
    candidate.signals.push(`Contract bytecode exists on ${chain.name}`);
  }

  for (const { chain, hasSecurityData } of goPlusChecks) {
    if (!hasSecurityData) continue;
    const candidate = candidates.get(chain.chainId);
    if (!candidate) continue;
    candidate.confidenceScore += 15;
    candidate.signals.push(`GoPlus security profile found on ${chain.name}`);
  }

  const ranked = Array.from(candidates.values())
    .filter((candidate) => candidate.confidenceScore > 0)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  if (ranked.length === 0) {
    const fallbackChain = getChain(DEFAULT_CHAIN_ID);
    return {
      chainId: DEFAULT_CHAIN_ID,
      chainName: fallbackChain?.name ?? `Chain ${DEFAULT_CHAIN_ID}`,
      confidence: 'fallback',
      source: 'fallback',
      candidates: [],
      reason: 'No chain-specific liquidity, bytecode, or security data was detected; using the configured fallback chain.',
    };
  }

  const [top, second] = ranked;
  const resolution: ChainResolution = {
    chainId: top.chainId,
    chainName: top.name,
    confidence: confidenceFor(top, second),
    source: 'auto',
    candidates: ranked.slice(0, 4),
    reason: top.signals[0] ?? `Highest confidence match was ${top.name}.`,
  };
  cache.set(normalizedAddress, { resolution, expiresAt: Date.now() + RESOLUTION_TTL_MS });
  return resolution;
}
