import { db } from '@/lib/db';
import { scans } from '@/lib/db/schema';
import { resolveTokenChain, type ChainResolution } from '@/lib/chain-resolver';
import { analyzeToken, submitScanProof, type ThreatReport } from '@/lib/engine';
import { REGISTRY_ADDRESS, REGISTRY_CHAIN_ID, SCAN_PRICING_USDT } from '@/lib/config';
import { trackAgentMetrics } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export interface DeepScanReport {
  reportType: 'DEEP_SCAN';
  tier: string;
  price: string;
  generatedAt: string;
  chainId: string;
  chainResolution: ChainResolution;
  tokenAddress: string;
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
  // Mainnet defaults to Deep Scan attestations only. Firewall attestations can
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
    agentWallet: input.agentWallet ?? null,
    tier: 'firewall',
    timestamp: report.scanTimestamp,
  });

  if (input.agentWallet) {
    await trackAgentMetrics(input.agentWallet, input.tokenAddress, chainId);
  }

  return {
    tokenAddress: input.tokenAddress,
    chainId,
    chainResolution,
    threatScore: report.threatScore,
    confidence: report.confidence,
    recommendation: report.recommendation,
    reasoning: report.reasoning,
    modules: report.modules,
    scanHash: report.scanHash,
    txHash: txHash || undefined,
  };
}

export async function runDeepScan(input: {
  tokenAddress: string;
  chainId?: string;
  agentWallet?: string;
  chainResolution?: ChainResolution;
}): Promise<DeepScanReport> {
  const chainResolution = input.chainResolution ?? await resolveScanChain(input);
  const chainId = chainResolution.chainId;
  const report = await analyzeToken(input.tokenAddress, chainId);
  const txHash = await submitScanProof(input.tokenAddress, chainId, report.scanHash, report.threatScore);
  if (!txHash) {
    logger.error('Deep scan on-chain attestation failed', { tokenAddress: input.tokenAddress, chainId, scanHash: report.scanHash });
    throw new Error('On-chain attestation could not be confirmed. Retry this paid request with the same payment receipt.');
  }
  logger.registry('deep_scan_attested', { tokenAddress: input.tokenAddress, chainId, txHash, scanHash: report.scanHash });

  const deepReport: DeepScanReport = {
    reportType: 'DEEP_SCAN',
    tier: 'Tier 1 - Comprehensive Report',
    price: `${SCAN_PRICING_USDT.deep} USDT`,
    generatedAt: new Date().toISOString(),
    chainId,
    chainResolution,
    tokenAddress: input.tokenAddress,
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
      txHash,
      registryContract: REGISTRY_ADDRESS,
      chain: `Registry chain ${REGISTRY_CHAIN_ID}; scan chain ${chainId}`,
      status: 'On-chain attestation recorded successfully',
    },
    recommendations: generateRecommendations(report.recommendation, report.modules),
  };

  await db.insert(scans).values({
    chainId,
    tokenAddress: input.tokenAddress,
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    scanHash: report.scanHash,
    txHash,
    agentWallet: input.agentWallet ?? null,
    tier: 'deep',
    reportData: JSON.stringify(deepReport),
    timestamp: report.scanTimestamp,
  });

  if (input.agentWallet) {
    await trackAgentMetrics(input.agentWallet, input.tokenAddress, chainId);
  }

  return deepReport;
}

function generateSummary(
  recommendation: ThreatReport['recommendation'],
  score: number,
  confidence: number,
): string {
  const confText = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'moderate' : 'limited';
  if (recommendation === 'ABORT') {
    return `This token presents critical security risks (score: ${score}/100) with ${confText} confidence. Interaction is strongly discouraged.`;
  }
  if (recommendation === 'CAUTION') {
    return `This token has elevated risk indicators (score: ${score}/100) with ${confText} confidence. Proceed with reduced position sizing and active monitoring.`;
  }
  return `This token passed security checks with a low threat score (${score}/100) at ${confText} confidence. Standard risk management practices still apply.`;
}

function generateRecommendations(
  recommendation: ThreatReport['recommendation'],
  modules: ThreatReport['modules'],
): string[] {
  const recs: string[] = [];
  if (recommendation === 'ABORT') {
    recs.push('Do not interact with this contract');
    recs.push('If you hold tokens, attempt to sell immediately');
    recs.push('Report this contract to the community');
  } else if (recommendation === 'CAUTION') {
    recs.push('Limit position size to < 1% of portfolio');
    recs.push('Set strict stop-losses');
    recs.push('Monitor for liquidity changes');
  } else {
    recs.push('Standard position sizing applies');
    recs.push('Re-scan periodically as conditions change');
  }

  const unavailable = modules.filter((module) => module.status === 'unavailable');
  if (unavailable.length > 0) {
    recs.push(`Note: ${unavailable.length} intelligence module(s) returned degraded data. Confidence will improve when live data sources are available.`);
  }
  return recs;
}
