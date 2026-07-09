import { db } from '@/lib/db';
import { scans } from '@/lib/db/schema';
import { resolveTokenChain, type ChainResolution } from '@/lib/chain-resolver';
import { analyzeToken, submitScanProof, type ThreatReport } from '@/lib/engine';
import { REGISTRY_ADDRESS, REGISTRY_CHAIN_ID, SCAN_PRICING_USDT } from '@/lib/config';
import { trackAgentMetrics } from '@/lib/api-utils';

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

export async function runFirewallScan(input: {
  tokenAddress: string;
  chainId?: string;
  agentWallet?: string;
}) {
  const chainResolution = await resolveTokenChain(input.tokenAddress, input.chainId);
  const chainId = chainResolution.chainId;
  const report = await analyzeToken(input.tokenAddress, chainId);

  let txHash: string | null = null;
  const recordFirewall = process.env.RECORD_FIREWALL_SCANS !== 'false';
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
}): Promise<DeepScanReport> {
  const chainResolution = await resolveTokenChain(input.tokenAddress, input.chainId);
  const chainId = chainResolution.chainId;
  const report = await analyzeToken(input.tokenAddress, chainId);
  const txHash = await submitScanProof(input.tokenAddress, chainId, report.scanHash, report.threatScore);

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
      txHash: txHash || null,
      registryContract: REGISTRY_ADDRESS,
      chain: `Registry chain ${REGISTRY_CHAIN_ID}; scan chain ${chainId}`,
      status: txHash
        ? 'On-chain attestation recorded successfully'
        : 'Off-chain hash generated (blockchain submission pending)',
    },
    recommendations: generateRecommendations(report.recommendation, report.modules),
  };

  await db.insert(scans).values({
    chainId,
    tokenAddress: input.tokenAddress,
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    scanHash: report.scanHash,
    txHash: txHash || null,
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
