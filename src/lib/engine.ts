import crypto from 'crypto';
import {
  DEFAULT_CHAIN_ID,
  DEXSCREENER_CHAIN_BY_EVM_CHAIN_ID,
  REGISTRY_ADDRESS,
  REGISTRY_CHAIN_ID,
} from '@/lib/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ModuleResult {
  name: string;
  score: number;       // 0-100 contribution from this module
  maxScore: number;    // maximum possible from this module
  signals: string[];
  status: 'active' | 'unavailable' | 'coming_soon';
}

export interface ThreatReport {
  threatScore: number;
  confidence: number;  // 0-1, based on how many modules contributed
  recommendation: 'TRADE' | 'CAUTION' | 'ABORT';
  modules: ModuleResult[];
  scanHash: string;     // SHA-256 content hash (always present)
  scanTimestamp: number;
  txHash?: string;      // On-chain transaction hash (only if blockchain submission succeeded)
  reasoning: string[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface DexPair {
  chainId?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  pairCreatedAt?: number;
  info?: {
    socials?: unknown[];
    websites?: unknown[];
  };
  txns?: {
    h24?: {
      buys?: number;
      sells?: number;
    };
  };
  priceChange?: { h24?: number };
}

interface DexScreenerResponse {
  pairs?: DexPair[];
}

interface GoPlusTokenSecurity {
  is_honeypot?: string;
  cannot_sell_all?: string;
  is_mintable?: string;
  owner_change_balance?: string;
  buy_tax?: string;
  sell_tax?: string;
}

interface GoPlusResponse {
  result?: Record<string, GoPlusTokenSecurity | undefined>;
}

interface EthplorerHolder {
  address?: string;
  share?: number;
}

interface EthplorerResponse {
  holders?: EthplorerHolder[];
  error?: string | { message?: string };
}

interface WhaleCache {
  topHoldersPercent: number;
  largestSingleHolder: number;
}

interface SocialCache {
  hasSocials: boolean;
  buySellRatio: number;
  priceChange24h: number;
  totalTxns24h: number;
  pairAgeHours: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 8000;
const ATTESTATION_RECEIPT_TIMEOUT_MS = Number(process.env.ATTESTATION_RECEIPT_TIMEOUT_MS ?? 45_000);

// ---------------------------------------------------------------------------
// In-Memory Cache with Eviction + Size Limit (F14)
// ---------------------------------------------------------------------------
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_MAX_SIZE = 500;

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() >= item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCache<T>(key: string, data: T, ttlSeconds: number) {
  // Evict oldest entries if cache is full
  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ---------------------------------------------------------------------------
// C7: Fetch with Timeout
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// H3: Input Validation
// ---------------------------------------------------------------------------
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

// ---------------------------------------------------------------------------
// Shared DexScreener Data Fetcher
// Both Liquidity and Social modules consume this single cached response.
// Uses promise memoization to deduplicate concurrent in-flight requests.
// ---------------------------------------------------------------------------
const dexScreenerInflight = new Map<string, Promise<DexScreenerResponse | null>>();

async function fetchDexScreenerData(address: string): Promise<DexScreenerResponse | null> {
  const cacheKey = `dexscreener_${address}`;
  const cached = getCached<DexScreenerResponse>(cacheKey);
  if (cached) return cached;

  // Deduplicate concurrent requests for the same address
  const existing = dexScreenerInflight.get(address) as Promise<DexScreenerResponse | null> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const data = (await res.json()) as DexScreenerResponse;
      setCache(cacheKey, data, 30); // 30s cache
      return data;
    } catch (err) {
      console.error('[WatchTower] DexScreener API error:', err);
      return null;
    } finally {
      dexScreenerInflight.delete(address);
    }
  })();

  dexScreenerInflight.set(address, promise);
  return promise;
}

function getDexPairsForChain(data: DexScreenerResponse, chainId: string): DexPair[] {
  const pairs = data.pairs ?? [];
  const dexChainId = DEXSCREENER_CHAIN_BY_EVM_CHAIN_ID[chainId];
  if (!dexChainId) return [];
  return pairs.filter((pair) => pair.chainId === dexChainId);
}

function summarizeOtherDexChains(data: DexScreenerResponse, chainId: string): string | null {
  const dexChainId = DEXSCREENER_CHAIN_BY_EVM_CHAIN_ID[chainId];
  const otherChains = Array.from(
    new Set((data.pairs ?? []).map((pair) => pair.chainId).filter(Boolean)),
  ).filter((chain) => chain !== dexChainId);
  return otherChains.length > 0 ? otherChains.slice(0, 4).join(', ') : null;
}

// ---------------------------------------------------------------------------
// Module 1: Liquidity Intelligence (DexScreener)
// ---------------------------------------------------------------------------
async function liquidityModule(address: string, chainId: string): Promise<ModuleResult> {
  const mod: ModuleResult = { name: 'Liquidity Intelligence', score: 0, maxScore: 35, signals: [], status: 'active' };

  const cacheKey = `liquidity_${chainId}_${address}`;
  const cached = getCached<ModuleResult>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchDexScreenerData(address);

    if (!data || !data.pairs || data.pairs.length === 0) {
      mod.score = 35;
      mod.signals.push('No trading pairs found on any major DEX');
      setCache(cacheKey, mod, 30);
      return mod;
    }

    const chainPairs = getDexPairsForChain(data, chainId);
    if (chainPairs.length === 0) {
      mod.score = 35;
      const otherChains = summarizeOtherDexChains(data, chainId);
      mod.signals.push(
        otherChains
          ? `No trading pairs found on requested chain ${chainId}; same address has pairs on ${otherChains}`
          : `No trading pairs found on requested chain ${chainId}`,
      );
      setCache(cacheKey, mod, 30);
      return mod;
    }

    // Sort by highest liquidity
    const mainPair = chainPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const liquidityUsd = mainPair.liquidity?.usd || 0;
    const volume24h = mainPair.volume?.h24 || 0;
    const pairCreatedAt = mainPair.pairCreatedAt; // Unix ms timestamp

    // Liquidity depth scoring
    if (liquidityUsd > 500000) {
      mod.signals.push(`Strong liquidity: $${Math.round(liquidityUsd).toLocaleString()}`);
    } else if (liquidityUsd > 50000) {
      mod.score = Math.min(mod.score + 10, mod.maxScore);
      mod.signals.push(`Moderate liquidity: $${Math.round(liquidityUsd).toLocaleString()}`);
    } else if (liquidityUsd > 10000) {
      mod.score = Math.min(mod.score + 20, mod.maxScore);
      mod.signals.push(`Low liquidity: $${Math.round(liquidityUsd).toLocaleString()}`);
    } else {
      mod.score = Math.min(mod.score + 30, mod.maxScore);
      mod.signals.push(`Critically low liquidity: $${Math.round(liquidityUsd).toLocaleString()}`);
    }

    // Volume analysis
    if (volume24h < 100) {
      mod.score = Math.min(mod.score + 5, mod.maxScore);
      mod.signals.push(`Dead volume: $${Math.round(volume24h)} (24h)`);
    } else {
      mod.signals.push(`24h volume: $${Math.round(volume24h).toLocaleString()}`);
    }

    // Pair age (proxy for deployer reputation)
    if (pairCreatedAt) {
      const ageHours = (Date.now() - pairCreatedAt) / (1000 * 60 * 60);
      if (ageHours < 1) {
        mod.signals.push(`⚠ Pair created ${Math.round(ageHours * 60)} minutes ago`);
      } else if (ageHours < 24) {
        mod.signals.push(`Pair age: ${Math.round(ageHours)} hours`);
      } else {
        mod.signals.push(`Pair age: ${Math.round(ageHours / 24)} days`);
      }
    }

    setCache(cacheKey, mod, 30);
  } catch (err) {
    console.error('DexScreener API error:', err);
    mod.status = 'unavailable';
    mod.score = 0;
    mod.signals.push('Liquidity data unavailable from DexScreener; module excluded from threat score');
  }

  return mod;
}

// ---------------------------------------------------------------------------
// Module 2: Contract DNA Scanner (GoPlus Security API)
// ---------------------------------------------------------------------------
async function contractDnaModule(address: string, chainId: string): Promise<ModuleResult> {
  const mod: ModuleResult = { name: 'Contract DNA Scanner', score: 0, maxScore: 40, signals: [], status: 'active' };

  // Demo honeypot fixture — only active outside mainnet production.
  if (
    process.env.NEXT_PUBLIC_NETWORK_ENV !== 'mainnet' &&
    chainId === '1952' &&
    address.toLowerCase() === '0x2498a8fda4f689c2a4a86767468ff24deab24e3d'
  ) {
    mod.score = 40;
    mod.signals.push('CRITICAL: Demo honeypot contract blocks non-owner sells on X Layer Testnet');
    mod.signals.push('CRITICAL: Sell path is owner-gated, creating a token trap for buyers');
    mod.signals.push('Verified demo fixture: MaliciousRugPull.sol deployed for WatchTower protected-agent flow');
    setCache(`contractdna_${chainId}_${address}`, mod, 60);
    return mod;
  }

  const cacheKey = `contractdna_${chainId}_${address}`; // M2: Add caching
  const cached = getCached<ModuleResult>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithTimeout(`https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`);
    const data = (await res.json()) as GoPlusResponse;
    const tokenSecurity = data.result?.[address.toLowerCase()] ?? data.result?.[address];

    if (!tokenSecurity) {
      mod.status = 'unavailable';
      mod.score = 0;
      mod.signals.push(`GoPlus has no verifiable security profile for this contract on chain ${chainId}; module excluded from threat score`);
      setCache(cacheKey, mod, 30);
      return mod;
    }

    // Honeypot detection — L2: use Math.min consistently
    if (tokenSecurity.is_honeypot === '1') {
      mod.score = Math.min(mod.score + 40, mod.maxScore);
      mod.signals.push('CRITICAL: Honeypot code detected — cannot sell');
    } else {
      mod.signals.push('No honeypot code detected');
    }

    // Sell restriction
    if (tokenSecurity.cannot_sell_all === '1') {
      mod.score = Math.min(mod.score + 15, mod.maxScore);
      mod.signals.push('Cannot sell all tokens (hidden tax trap)');
    }

    // Mintable
    if (tokenSecurity.is_mintable === '1') {
      mod.score = Math.min(mod.score + 10, mod.maxScore);
      mod.signals.push('Mint function active (inflation risk)');
    } else {
      mod.signals.push('No mint function');
    }

    // Owner can change balances
    if (tokenSecurity.owner_change_balance === '1') {
      mod.score = Math.min(mod.score + 15, mod.maxScore);
      mod.signals.push('CRITICAL: Owner can alter user balances');
    }

    // Buy/sell tax
    const buyTax = parseFloat(tokenSecurity.buy_tax || '0');
    const sellTax = parseFloat(tokenSecurity.sell_tax || '0');
    if (sellTax > 0.1) {
      mod.score = Math.min(mod.score + 10, mod.maxScore);
      mod.signals.push(`High sell tax: ${(sellTax * 100).toFixed(1)}%`);
    }
    if (buyTax > 0.05 || sellTax > 0.05) {
      mod.signals.push(`Taxes: Buy ${(buyTax * 100).toFixed(1)}% / Sell ${(sellTax * 100).toFixed(1)}%`);
    }

    setCache(cacheKey, mod, 60); // M2: Cache for 60s
  } catch (err) {
    console.error('GoPlus API error:', err);
    mod.status = 'unavailable';
    mod.score = 0;
    mod.signals.push('Contract DNA scan unavailable from GoPlus; module excluded from threat score');
  }

  return mod;
}

// ---------------------------------------------------------------------------
// Module 3: Whale Intelligence (Top Holders)
// Uses Ethplorer Free API for holder concentration analysis.
// Filters burn/dead addresses and detects individual whale dominance.
// ---------------------------------------------------------------------------

// Well-known non-whale addresses to exclude from concentration calculations.
// These hold tokens but will never dump them.
const EXCLUDED_HOLDER_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000', // Null address
  '0x000000000000000000000000000000000000dead', // Common burn address
  '0xdead000000000000000000000000000000000000', // Alternate burn
]);

function isExcludedHolder(addr: string): boolean {
  return EXCLUDED_HOLDER_ADDRESSES.has(addr.toLowerCase());
}

async function whaleModule(address: string, chainId: string): Promise<ModuleResult> {
  const mod: ModuleResult = { name: 'Whale Intelligence', score: 0, maxScore: 25, signals: [], status: 'active' };

  const cacheKey = `whale_${chainId}_${address}`;
  const cached = getCached<WhaleCache>(cacheKey);

  try {
    let topHoldersPercent = 0;
    let largestSingleHolder = 0;

    if (cached) {
      topHoldersPercent = cached.topHoldersPercent;
      largestSingleHolder = cached.largestSingleHolder ?? 0;
    } else {
      let apiSuccess = false;

      if (chainId === '1') {
        try {
          const apiKey = process.env.ETHPLORER_API_KEY || 'freekey';
          const url = `https://api.ethplorer.io/getTopTokenHolders/${address}?apiKey=${apiKey}&limit=10`;
          const res = await fetchWithTimeout(url);
          const data = (await res.json()) as EthplorerResponse;

          if (data && data.holders && Array.isArray(data.holders)) {
            // Filter out burn addresses and null address — they inflate concentration
            const realHolders = data.holders.filter(
              (h) => h.address && !isExcludedHolder(h.address),
            );

            topHoldersPercent = realHolders.reduce(
              (sum, holder) => sum + (holder.share || 0),
              0,
            );

            // Track the single largest holder for dominance detection
            largestSingleHolder = realHolders.reduce(
              (max, holder) => Math.max(max, holder.share || 0),
              0,
            );

            apiSuccess = true;
          } else if (data && data.error) {
            // Distinguish between "not found" and "rate limited"
            const errMsg = typeof data.error === 'string' ? data.error : data.error.message || '';
            if (errMsg.includes('Not found') || errMsg.includes('Invalid')) {
              mod.status = 'unavailable';
              mod.score = 0;
              mod.signals.push('Ethplorer has no verifiable holder data for this token on Ethereum; module excluded from threat score');
              return mod;
            } else {
              console.warn(`[WatchTower] Ethplorer API error:`, data.error);
            }
          }
        } catch (err) {
          console.error(`[WatchTower] Ethplorer API fetch failed:`, err);
        }
      } else {
        mod.status = 'unavailable';
        mod.score = 0;
        mod.signals.push(`Holder data unavailable for chain ${chainId} via Ethplorer free tier; module excluded from threat score`);
        return mod;
      }

      if (!apiSuccess) {
        mod.status = 'unavailable';
        mod.score = 0;
        mod.signals.push('Holder data unavailable from Ethplorer; module excluded from threat score');
        return mod;
      }

      setCache(cacheKey, { topHoldersPercent, largestSingleHolder }, 60);
    }

    // Score based on overall concentration
    if (topHoldersPercent > 80) {
      mod.score = Math.min(mod.score + 25, mod.maxScore);
      mod.signals.push(`CRITICAL: Top holders control ${topHoldersPercent.toFixed(1)}% of supply (burn addresses excluded)`);
    } else if (topHoldersPercent > 50) {
      mod.score = Math.min(mod.score + 15, mod.maxScore);
      mod.signals.push(`WARNING: Top holders control ${topHoldersPercent.toFixed(1)}% of supply`);
    } else if (topHoldersPercent > 0) {
      mod.signals.push(`Healthy distribution: Top holders control ${topHoldersPercent.toFixed(1)}%`);
    }

    // Individual whale dominance: any single holder > 15% is a red flag
    if (largestSingleHolder > 15) {
      mod.score = Math.min(mod.score + 5, mod.maxScore);
      mod.signals.push(`⚠ Single wallet holds ${largestSingleHolder.toFixed(1)}% of supply`);
    }

  } catch {
    mod.status = 'unavailable';
    mod.score = 0;
    mod.signals.push('Whale data unavailable; module excluded from threat score');
  }

  return mod;
}

// ---------------------------------------------------------------------------
// Module 4: Social Threat Radar (Sentiment, Price Action & Bot Activity)
// Consumes shared DexScreener data for social links, buy/sell sentiment,
// price dump/pump detection, and transaction count anomaly analysis.
// ---------------------------------------------------------------------------
async function socialModule(address: string, chainId: string): Promise<ModuleResult> {
  const mod: ModuleResult = { name: 'Social Threat Radar', score: 0, maxScore: 15, signals: [], status: 'active' };

  const cacheKey = `social_${chainId}_${address}`;
  const cached = getCached<SocialCache>(cacheKey);

  try {
    let hasSocials = false;
    let buySellRatio = 1.0;
    let priceChange24h = 0;
    let totalTxns24h = 0;
    let pairAgeHours = Infinity; // default to old (safe)

    if (cached) {
      hasSocials = cached.hasSocials;
      buySellRatio = cached.buySellRatio;
      priceChange24h = cached.priceChange24h ?? 0;
      totalTxns24h = cached.totalTxns24h ?? 0;
      pairAgeHours = cached.pairAgeHours ?? Infinity;
    } else {
      let apiSuccess = false;

      try {
        // Reuse the shared DexScreener response (no duplicate API call)
        const data = await fetchDexScreenerData(address);

        if (data && data.pairs && data.pairs.length > 0) {
          const chainPairs = getDexPairsForChain(data, chainId);
          if (chainPairs.length === 0) {
            const otherChains = summarizeOtherDexChains(data, chainId);
            mod.status = 'unavailable';
            mod.score = 0;
            mod.signals.push(
              otherChains
                ? `No DexScreener social/trading data on requested chain ${chainId}; same address has pairs on ${otherChains}. Module excluded from threat score`
                : `No DexScreener social/trading data on requested chain ${chainId}; module excluded from threat score`,
            );
            return mod;
          } else {
            const mainPair = chainPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

            // Social links (Twitter, Telegram, Website)
            const socialsCount = (mainPair.info?.socials?.length || 0) + (mainPair.info?.websites?.length || 0);
            hasSocials = socialsCount > 0;

            // Trading sentiment (Buys vs Sells in 24h)
            const buys = mainPair.txns?.h24?.buys || 0;
            const sells = mainPair.txns?.h24?.sells || 0;
            totalTxns24h = buys + sells;
            if (sells > 0) {
              buySellRatio = buys / sells;
            } else if (buys > 0) {
              buySellRatio = 2.0;
            }

            // Price action (24h change)
            priceChange24h = mainPair.priceChange?.h24 ?? 0;

            // Pair age
            if (mainPair.pairCreatedAt) {
              pairAgeHours = (Date.now() - mainPair.pairCreatedAt) / (1000 * 60 * 60);
            }

            apiSuccess = true;
          }
        }
      } catch (err) {
        console.error(`[WatchTower] DexScreener Social data extraction failed:`, err);
      }

      if (!apiSuccess) {
        mod.status = 'unavailable';
        mod.score = 0;
        mod.signals.push('Social/trading data unavailable from DexScreener; module excluded from threat score');
        return mod;
      }

      setCache(cacheKey, { hasSocials, buySellRatio, priceChange24h, totalTxns24h, pairAgeHours }, 60);
    }

    // --- Signal 1: Social presence ---
    if (!hasSocials) {
      mod.score = Math.min(mod.score + 10, mod.maxScore);
      mod.signals.push('No social links or website detected (High rug-pull risk)');
    } else {
      mod.signals.push('Verified social links present');
    }

    // --- Signal 2: Buy/sell sentiment ---
    if (buySellRatio < 0.5) {
      mod.score = Math.min(mod.score + 5, mod.maxScore);
      mod.signals.push('Poor community sentiment (Heavy sell pressure)');
    } else if (buySellRatio > 1.5) {
      mod.signals.push('Strong community sentiment (Buy-dominated volume)');
    }

    // --- Signal 3: Price dump/pump detection ---
    if (priceChange24h < -50) {
      mod.score = Math.min(mod.score + 5, mod.maxScore);
      mod.signals.push(`⚠ Price crashed ${priceChange24h.toFixed(0)}% in 24h (Potential dump)`);
    } else if (priceChange24h > 500 && pairAgeHours < 48) {
      mod.score = Math.min(mod.score + 3, mod.maxScore);
      mod.signals.push(`⚠ Price surged +${priceChange24h.toFixed(0)}% on a new token (Pump-and-dump risk)`);
    } else if (priceChange24h !== 0) {
      mod.signals.push(`24h price change: ${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(1)}%`);
    }

    // --- Signal 4: Transaction count anomaly ---
    if (totalTxns24h > 0 && totalTxns24h < 10) {
      mod.signals.push(`Very low activity: only ${totalTxns24h} transactions in 24h`);
    } else if (totalTxns24h > 10000 && pairAgeHours < 24) {
      mod.score = Math.min(mod.score + 2, mod.maxScore);
      mod.signals.push(`⚠ ${totalTxns24h.toLocaleString()} txns in 24h on a brand-new token (Possible bot activity)`);
    } else if (totalTxns24h > 0) {
      mod.signals.push(`24h transactions: ${totalTxns24h.toLocaleString()}`);
    }

  } catch {
    mod.status = 'unavailable';
    mod.score = 0;
    mod.signals.push('Social data unavailable; module excluded from threat score');
  }

  return mod;
}

// ---------------------------------------------------------------------------
// Composite Engine — shared by firewall and authorization routes
// C4: Pure analysis function — no blockchain side effects
// ---------------------------------------------------------------------------
export function createScanHash(input: {
  chainId: string;
  tokenAddress: string;
  threatScore: number;
  confidence: number;
  timestamp: number;
}): string {
  const canonical = `${input.chainId}:${input.tokenAddress.toLowerCase()}:${input.threatScore}:${input.confidence}:${input.timestamp}`;
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function analyzeToken(address: string, chainId = DEFAULT_CHAIN_ID): Promise<ThreatReport> {
  const modules = await Promise.all([
    liquidityModule(address, chainId),
    contractDnaModule(address, chainId),
    whaleModule(address, chainId),
    socialModule(address, chainId),
  ]);

  // Calculate composite score from active modules only. Module scores are already
  // expressed as weighted risk points, so the final score should reconcile with
  // the per-module values displayed in reports.
  const activeModules = modules.filter(m => m.status === 'active');
  const totalActiveMaxScore = activeModules.reduce((sum, m) => sum + m.maxScore, 0);
  const totalActiveScore = activeModules.reduce((sum, m) => sum + m.score, 0);

  // Cap at 100 while excluding unavailable modules from both score and confidence.
  const threatScore = totalActiveMaxScore > 0
    ? Math.min(Math.round(totalActiveScore), 100)
    : 0;

  // Confidence: what % of total intelligence modules were active
  const totalMaxScore = modules.reduce((sum, m) => sum + m.maxScore, 0);
  const confidence = totalMaxScore > 0
    ? Math.round((totalActiveMaxScore / totalMaxScore) * 100) / 100
    : 0;

  // Recommendation
  let recommendation: 'TRADE' | 'CAUTION' | 'ABORT' = totalActiveMaxScore > 0 ? 'TRADE' : 'CAUTION';
  if (totalActiveMaxScore === 0) {
    recommendation = 'CAUTION';
  } else if (threatScore > 70) {
    recommendation = 'ABORT';
  } else if (threatScore >= 35 || confidence < 0.5) {
    recommendation = 'CAUTION';
  }

  const scanTimestamp = Date.now();
  const scanHash = createScanHash({
    chainId,
    tokenAddress: address,
    threatScore,
    confidence,
    timestamp: scanTimestamp,
  });

  // Flatten reasoning for backward compat (SDK and DB)
  const reasoning = modules.flatMap(m =>
    m.signals.map(s => `[${m.name}] ${s}`)
  );
  if (totalActiveMaxScore === 0) {
    reasoning.unshift('No threat score was computed because no module returned verifiable data.');
  } else if (confidence < 0.5) {
    reasoning.unshift('Low module coverage: recommendation raised to CAUTION until more intelligence sources are available.');
  }

  return { threatScore, confidence, recommendation, modules, scanHash, scanTimestamp, reasoning };
}

// ---------------------------------------------------------------------------
// C4: Dedicated blockchain submission function
// Called by route handlers, NOT by analyzeToken()
// ---------------------------------------------------------------------------
export async function submitScanProof(
  tokenAddress: string, 
  chainId: string,
  scanHash: string, 
  threatScore: number
): Promise<string | null> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.warn('[WatchTower] No PRIVATE_KEY configured — skipping on-chain submission');
    return null;
  }

  if (!isValidEthAddress(REGISTRY_ADDRESS)) {
    console.error('[WatchTower] No valid registry address configured for on-chain submission');
    return null;
  }

  try {
    const { createPublicClient, createWalletClient, decodeEventLog, encodePacked, http, keccak256, parseAbiItem } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { defineChain } = await import('viem');
    
    const registryChain = defineChain({
      id: Number(REGISTRY_CHAIN_ID),
      name: REGISTRY_CHAIN_ID === '196' ? 'X Layer Mainnet' : 'X Layer Testnet',
      network: REGISTRY_CHAIN_ID === '196' ? 'xlayer-mainnet' : 'xlayer-testnet',
      nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
      rpcUrls: {
        default: {
          http: [
            (REGISTRY_CHAIN_ID === '196' ? process.env.MAINNET_RPC_URL : process.env.TESTNET_RPC_URL) ||
            process.env.XLAYER_RPC_URL ||
            process.env.NEXT_PUBLIC_REGISTRY_RPC_URL ||
            (REGISTRY_CHAIN_ID === '196' ? 'https://rpc.xlayer.tech' : 'https://testrpc.xlayer.tech'),
          ],
        },
      },
    });

    const account = privateKeyToAccount(
      privateKey.startsWith('0x') ? (privateKey as `0x${string}`) : `0x${privateKey}`
    );
    const client = createWalletClient({
      account,
      chain: registryChain,
      transport: http()
    });
    const publicClient = createPublicClient({
      chain: registryChain,
      transport: http(),
    });

    const abi = [
      {
        "type": "function",
        "name": "recordScan",
        "inputs": [
          { "name": "_chainId", "type": "uint256" },
          { "name": "_tokenAddress", "type": "address" },
          { "name": "_scanHash", "type": "string" },
          { "name": "_threatScore", "type": "uint256" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      }
    ] as const;
    const scanRecordedEvent = parseAbiItem(
      'event ScanRecorded(uint256 indexed chainId, address indexed tokenAddress, string scanHash, uint256 threatScore, uint256 timestamp)',
    );
    const readAbi = [
      {
        type: 'function',
        name: 'latestScans',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [
          { name: 'chainId', type: 'uint256' },
          { name: 'scanHash', type: 'string' },
          { name: 'threatScore', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
        ],
        stateMutability: 'view',
      },
    ] as const;

    // F3: Abort if address is invalid instead of sending zero-address
    if (!isValidEthAddress(tokenAddress)) {
      console.warn(`[WatchTower] Invalid token address for on-chain submission: ${tokenAddress}`);
      return null;
    }

    if (chainId !== REGISTRY_CHAIN_ID) {
      console.warn(`[WatchTower] Scan chain ${chainId} differs from registry chain ${REGISTRY_CHAIN_ID}; recording attestation on configured registry chain`);
    }

    const args = [BigInt(chainId), tokenAddress as `0x${string}`, scanHash, BigInt(threatScore)] as const;
    const estimatedGas = await publicClient.estimateContractGas({
      account,
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi,
      functionName: 'recordScan',
      args,
    });
    const gas = (estimatedGas * BigInt(130)) / BigInt(100);

    const txHash = await client.writeContract({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi,
      functionName: 'recordScan',
      args,
      gas,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: ATTESTATION_RECEIPT_TIMEOUT_MS,
    });
    if (receipt.status !== 'success') {
      throw new Error(`Registry transaction ${txHash} reverted.`);
    }

    const emittedExpectedEvent = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== REGISTRY_ADDRESS.toLowerCase()) return false;
      try {
        const decoded = decodeEventLog({
          abi: [scanRecordedEvent],
          data: log.data,
          topics: log.topics,
        });
        const eventArgs = decoded.args as {
          chainId?: bigint;
          tokenAddress?: `0x${string}`;
          scanHash?: string;
          threatScore?: bigint;
        };
        return eventArgs.chainId === BigInt(chainId)
          && eventArgs.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase()
          && eventArgs.scanHash === scanHash
          && eventArgs.threatScore === BigInt(threatScore);
      } catch {
        return false;
      }
    });

    const scanKey = keccak256(encodePacked(['uint256', 'address'], [BigInt(chainId), tokenAddress as `0x${string}`]));
    const latest = await publicClient.readContract({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: readAbi,
      functionName: 'latestScans',
      args: [scanKey],
    }).catch(() => null);
    const storedExpectedScan = Boolean(
      latest
      && latest[0] === BigInt(chainId)
      && latest[1] === scanHash
      && latest[2] === BigInt(threatScore),
    );

    if (!emittedExpectedEvent || !storedExpectedScan) {
      throw new Error(`Registry transaction ${txHash} did not produce a verifiable WatchTower attestation.`);
    }

    console.log(`[WatchTower] On-chain proof confirmed. TxHash: ${txHash}`);
    return txHash;
  } catch (err) {
    console.error(`[WatchTower] Failed to submit to blockchain:`, err);
    return null;
  }
}
