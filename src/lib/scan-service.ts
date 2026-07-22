import { db } from '@/lib/db';
import { scans } from '@/lib/db/schema';
import { resolveTokenChain, type ChainResolution } from '@/lib/chain-resolver';
import { analyzeToken, submitScanProof, type ThreatReport } from '@/lib/engine';
import { REGISTRY_ADDRESS, REGISTRY_CHAIN_ID, SCAN_PRICING_USDT } from '@/lib/config';
import { trackAgentMetrics } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://watchtowr.xyz').replace(/\/$/, '');

export interface ExecutionAuthorizationCompatibilityReport {
  reportType: 'EXECUTION_AUTHORIZATION_COMPATIBILITY' | 'DEEP_SCAN';
  tier: string;
  price: string;
  generatedAt: string;
  target: {
    tokenAddress: string;
    chainId: string;
    chainResolution: ChainResolution;
  };
  verdict: {
    threatScore: number;
    confidence: number;
    recommendation: ThreatReport['recommendation'];
    summary: string;
  };
  intelligenceModules: ThreatReport['modules'];
  reasoning: string[];
  verification: {
    scanHash: string;
    txHash: string | null;
    registryContract: string;
    chain: string;
    status: string;
  };
  recommendations: string[];
  meta: {
    engine: string;
    network: string;
    reportUrl: string;
  };
}
export class ChainResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainResolutionError';
  }
}

export async function resolveScanChain(input: {
  tokenAddress: string;
  chainId?: string;
}): Promise<ChainResolution> {
  const chainResolution = await resolveTokenChain(input.tokenAddress, input.chainId);
  if (chainResolution.source !== 'explicit' && (chainResolution.confidence === 'ambiguous' || chainResolution.confidence === 'fallback')) {
    throw new ChainResolutionError(
      'WatchTower could not confidently identify this token\'s chain. Retry with an explicit chainId to avoid scanning the wrong deployment.',
    );
  }
  return chainResolution;
}

export async function runFirewallScan(input: {
  tokenAddress: string;
  chainId?: string;
  agentWallet?: string;
  chainResolution?: ChainResolution;
}) {
  const chainResolution = input.chainResolution ?? await resolveScanChain(input);
  const chainId = chainResolution.chainId;
  const agentWallet = input.agentWallet?.toLowerCase() ?? null;
  const report = await analyzeToken(input.tokenAddress, chainId);

  const activeModules = report.modules.filter((m) => m.status === 'active').length;
  const unavailableModules = report.modules.filter((m) => m.status === 'unavailable').length;
  logger.scan('firewall_complete', {
    tokenAddress: input.tokenAddress,
    chainId,
    tier: 'firewall',
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    activeModules,
    unavailableModules,
  });

  let txHash: string | null = null;
  // Mainnet defaults to premium authorization attestations only. Firewall attestations can
  // be explicitly enabled once the registry signer and gas budget are operated.
  const recordFirewall = process.env.RECORD_FIREWALL_SCANS === 'true'
    || (process.env.NEXT_PUBLIC_NETWORK_ENV !== 'mainnet' && process.env.RECORD_FIREWALL_SCANS !== 'false');
  if (recordFirewall) {
    txHash = await submitScanProof(input.tokenAddress, chainId, report.scanHash, report.threatScore);
  }

  await db.insert(scans).values({
    chainId,
    tokenAddress: input.tokenAddress,
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    scanHash: report.scanHash,
    txHash,
    agentWallet,
    tier: 'firewall',
    timestamp: report.scanTimestamp,
  });

  if (agentWallet) {
    await trackAgentMetrics(agentWallet, input.tokenAddress, chainId);
  }

  return {
    reportType: 'FIREWALL_SCAN' as const,
    tier: 'Tier 2 — API Firewall',
    generatedAt: new Date().toISOString(),
    target: {
      tokenAddress: input.tokenAddress,
      chainId,
      chainResolution,
    },
    verdict: {
      threatScore: report.threatScore,
      confidence: report.confidence,
      recommendation: report.recommendation,
    },
    intelligenceModules: report.modules,
    reasoning: report.reasoning,
    verification: {
      scanHash: report.scanHash,
      ...(txHash ? { txHash } : {}),
    },
    meta: {
      engine: 'WatchTower v1',
      network: chainResolution.chainName,
    },
  };
}

export async function runDeepScan(input: {
  tokenAddress: string;
  chainId?: string;
  agentWallet?: string;
  chainResolution?: ChainResolution;
  skipAttestation?: boolean;
}): Promise<ExecutionAuthorizationCompatibilityReport> {
  const chainResolution = input.chainResolution ?? await resolveScanChain(input);
  const chainId = chainResolution.chainId;
  const agentWallet = input.agentWallet?.toLowerCase() ?? null;
  const report = await analyzeToken(input.tokenAddress, chainId);

  let txHash: string | null = null;
  if (input.skipAttestation) {
    logger.scan('authorization_attestation_skipped', { tokenAddress: input.tokenAddress, chainId, scanHash: report.scanHash });
  } else {
    txHash = await submitScanProof(input.tokenAddress, chainId, report.scanHash, report.threatScore);
    if (!txHash) {
      logger.error('Authorization attestation failed — returning report without attestation', { tokenAddress: input.tokenAddress, chainId, scanHash: report.scanHash });
    } else {
      logger.registry('authorization_attested', { tokenAddress: input.tokenAddress, chainId, txHash, scanHash: report.scanHash });
    }
  }

  const authorizationReport: ExecutionAuthorizationCompatibilityReport = {
    reportType: 'EXECUTION_AUTHORIZATION_COMPATIBILITY',
    tier: 'Execution Authorization Compatibility Report',
    price: `${SCAN_PRICING_USDT.deep} USDT`,
    generatedAt: new Date().toISOString(),
    target: {
      tokenAddress: input.tokenAddress,
      chainId,
      chainResolution,
    },
    verdict: {
      threatScore: report.threatScore,
      confidence: report.confidence,
      recommendation: report.recommendation,
      summary: generateSummary(report.recommendation, report.threatScore, report.confidence),
    },
    intelligenceModules: report.modules,
    reasoning: report.reasoning,
    verification: {
      scanHash: report.scanHash,
      txHash: txHash ?? null,
      registryContract: REGISTRY_ADDRESS,
      chain: `Registry chain ${REGISTRY_CHAIN_ID}; scan chain ${chainId}`,
      status: txHash ? 'On-chain attestation confirmed' : 'Attestation pending — scan results verified off-chain',
    },
    recommendations: generateRecommendations(report.recommendation, report.modules),
    meta: {
      engine: 'WatchTower v1',
      network: chainResolution.chainName,
      reportUrl: `${SITE_URL}/report/${report.scanHash}`,
    },
  };

  await db.insert(scans).values({
    chainId,
    tokenAddress: input.tokenAddress,
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    scanHash: report.scanHash,
    txHash,
    agentWallet,
    tier: 'deep',
    reportData: JSON.stringify(authorizationReport),
    timestamp: report.scanTimestamp,
  });

  if (agentWallet) {
    await trackAgentMetrics(agentWallet, input.tokenAddress, chainId);
  }

  return authorizationReport;
}

function generateSummary(
  recommendation: ThreatReport['recommendation'],
  score: number,
  confidence: number,
): string {
  const confText = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'moderate' : 'limited';
  if (recommendation === 'ABORT') {
    return `Critical threat detected — threat score ${score}/100 at ${confText} confidence. WatchTower strongly advises against any interaction with this contract.`;
  }
  if (recommendation === 'CAUTION') {
    return `Elevated risk indicators identified — threat score ${score}/100 at ${confText} confidence. Proceed only with reduced exposure and active monitoring.`;
  }
  return `Security checks passed — threat score ${score}/100 at ${confText} confidence. No critical risks detected. Standard risk management applies.`;
}

function generateRecommendations(
  recommendation: ThreatReport['recommendation'],
  modules: ThreatReport['modules'],
): string[] {
  const recs: string[] = [];
  if (recommendation === 'ABORT') {
    recs.push('Immediately cease all interaction with this contract.');
    recs.push('If holding tokens, attempt to exit positions without delay.');
    recs.push('Flag this contract address in your agent\'s blocklist.');
  } else if (recommendation === 'CAUTION') {
    recs.push('Restrict position size to < 1% of total portfolio value.');
    recs.push('Deploy strict stop-loss parameters before entry.');
    recs.push('Monitor on-chain liquidity movements for sudden changes.');
  } else {
    recs.push('Standard position sizing and risk parameters apply.');
    recs.push('Schedule periodic re-scans as market conditions evolve.');
  }

  const unavailable = modules.filter((module) => module.status === 'unavailable');
  if (unavailable.length > 0) {
    recs.push(`${unavailable.length} intelligence module(s) returned degraded data — confidence may improve once all data sources are fully available.`);
  }
  return recs;
}
