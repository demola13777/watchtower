/**
 * Execution Authorization Service
 *
 * Orchestrates the authorization flow by composing existing WatchTower
 * infrastructure with the new Execution Authorization layer.
 *
 * Flow:
 *   resolveScanChain()              [existing]
 *   → analyzeToken()               [existing]
 *   → evaluatePolicy()             [new — from permit.ts]
 *   → generateExecutionAuthorization() [new — from permit.ts, only if AUTHORIZED]
 *   → verifyExecutionAuthorization()
 *   → Return AuthorizationResult
 *   → schedule submitScanProof() as non-blocking audit work
 */

import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { analyzeToken, submitScanProof } from '@/lib/engine';
import { resolveScanChain } from '@/lib/scan-service';
import { type ChainResolution } from '@/lib/chain-resolver';
import { REGISTRY_ADDRESS, REGISTRY_CHAIN_ID, SCAN_PRICING_USDT } from '@/lib/config';
import { db } from '@/lib/db';
import { scans } from '@/lib/db/schema';
import { trackAgentMetrics } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import {
  evaluatePolicy,
  generateExecutionAuthorization,
  createPermitHash,
  verifyExecutionAuthorization,
  type AuthorizationResult,
} from '@/lib/permit';

export { ChainResolutionError } from '@/lib/scan-service';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://watchtowr.xyz').replace(/\/$/, '');

function registryChainLabel(): string {
  return `X Layer ${REGISTRY_CHAIN_ID === '196' ? 'Mainnet' : 'Testnet'}`;
}

function scheduleAuthorizationAttestation(input: {
  tokenAddress: string;
  chainId: string;
  permitHash: string;
  threatScore: number;
  reportHash: string;
  authorizationReport: Record<string, unknown>;
}) {
  after(async () => {
    try {
      const txHash = await submitScanProof(
        input.tokenAddress,
        input.chainId,
        input.permitHash,
        input.threatScore,
      );

      if (!txHash) {
        const failedReport = {
          ...input.authorizationReport,
          verification: {
            ...(input.authorizationReport.verification as Record<string, unknown>),
            txHash: null,
            status: 'Execution authorization issued; X Layer attestation failed or is unavailable',
            attestationStatus: 'failed',
          },
          attestation: {
            status: 'failed',
            permitHash: input.permitHash,
            chain: registryChainLabel(),
            reason: 'X Layer attestation did not return a confirmed transaction hash.',
          },
        };
        await db.update(scans)
          .set({ reportData: JSON.stringify(failedReport) })
          .where(eq(scans.scanHash, input.reportHash));
        logger.error('Authorization attestation failed after response', {
          tokenAddress: input.tokenAddress,
          chainId: input.chainId,
          permitHash: input.permitHash,
        });
        return;
      }

      const confirmedReport = {
        ...input.authorizationReport,
        verification: {
          ...(input.authorizationReport.verification as Record<string, unknown>),
          txHash,
          status: 'Execution authorization attestation confirmed on-chain',
          attestationStatus: 'confirmed',
        },
        attestation: {
          status: 'confirmed',
          permitHash: input.permitHash,
          txHash,
          chain: registryChainLabel(),
        },
      };
      await db.update(scans)
        .set({ txHash, reportData: JSON.stringify(confirmedReport) })
        .where(eq(scans.scanHash, input.reportHash));
      logger.registry('authorization_attested', {
        tokenAddress: input.tokenAddress,
        chainId: input.chainId,
        permitHash: input.permitHash,
        txHash,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown attestation error';
      const failedReport = {
        ...input.authorizationReport,
        verification: {
          ...(input.authorizationReport.verification as Record<string, unknown>),
          txHash: null,
          status: 'Execution authorization issued; X Layer attestation failed',
          attestationStatus: 'failed',
        },
        attestation: {
          status: 'failed',
          permitHash: input.permitHash,
          chain: registryChainLabel(),
          reason,
        },
      };
      await db.update(scans)
        .set({ reportData: JSON.stringify(failedReport) })
        .where(eq(scans.scanHash, input.reportHash))
        .catch(() => undefined);
      logger.error('Authorization attestation background task failed', {
        tokenAddress: input.tokenAddress,
        chainId: input.chainId,
        permitHash: input.permitHash,
        reason,
      });
    }
  });
}

export interface AuthorizeInput {
  tokenAddress: string;
  chainId?: string;
  action?: string;
  amountUsd?: number;
  recipient?: string;
  spender?: string;
  calldata?: string;
  executionHash?: string;
  agentWallet?: string;
  chainResolution?: ChainResolution;
}

export async function runAuthorization(input: AuthorizeInput): Promise<AuthorizationResult> {
  const chainResolution = input.chainResolution ?? await resolveScanChain(input);
  const chainId = chainResolution.chainId;
  const agentWallet = input.agentWallet?.toLowerCase() ?? null;
  const action = input.action || 'transaction';

  // ── Stage 1: Run the existing threat analysis engine ──────────────
  const report = await analyzeToken(input.tokenAddress, chainId);

  const activeModules = report.modules.filter((m) => m.status === 'active').length;
  const unavailableModules = report.modules.filter((m) => m.status === 'unavailable').length;
  logger.scan('authorization_analysis_complete', {
    tokenAddress: input.tokenAddress,
    chainId,
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    activeModules,
    unavailableModules,
  });

  // ── Stage 2: Evaluate execution policy ────────────────────────────
  const { decision, verdict } = evaluatePolicy(report);

  // ── Stage 3: Generate Execution Authorization (only if AUTHORIZED) ─
  let authorization: AuthorizationResult['authorization'] = null;
  let verification: AuthorizationResult['verification'] = null;
  let attestation: AuthorizationResult['attestation'] = null;

  if (decision === 'AUTHORIZED') {
    authorization = await generateExecutionAuthorization({
      action,
      tokenAddress: input.tokenAddress,
      chainId,
      agentWallet: agentWallet ?? '0x0000000000000000000000000000000000000000',
      amountUsd: input.amountUsd,
      recipient: input.recipient,
      spender: input.spender,
      calldata: input.calldata,
      executionHash: input.executionHash,
      riskScore: report.threatScore,
    });

    const issuedAuthorization = authorization;
    verification = await verifyExecutionAuthorization(issuedAuthorization);
    if (!verification.authorized) {
      throw new Error(`Execution permit verification failed: ${verification.reason ?? 'invalid permit'}`);
    }

    // ── Stage 4: Prepare audit-plane attestation without blocking authorization ─
    const permitHash = await createPermitHash(issuedAuthorization);

    attestation = {
      status: 'pending',
      permitHash,
      txHash: null,
      chain: registryChainLabel(),
    };

    logger.scan('execution_authorization_issued', {
      permitId: authorization.id,
      tokenAddress: input.tokenAddress,
      chainId,
      agentWallet,
      executionHash: authorization.executionHash,
      riskScore: report.threatScore,
      permitHash,
      attestationStatus: 'pending',
    });
  } else {
    logger.scan('execution_authorization_denied', {
      decision,
      tokenAddress: input.tokenAddress,
      chainId,
      riskScore: report.threatScore,
      recommendation: report.recommendation,
    });
  }

  const analysisHash = report.scanHash;
  const permitHash = attestation?.permitHash ?? null;
  const reportHash = permitHash ?? analysisHash;
  const authorizationReport = {
    reportType: 'EXECUTION_AUTHORIZATION',
    tier: 'Execution Authorization — Permission to Execute',
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
      summary: decision === 'AUTHORIZED'
        ? `Permission to Execute granted — threat score ${report.threatScore}/100.`
        : decision === 'REVIEW_REQUIRED'
          ? `Manual review required — threat score ${report.threatScore}/100 with insufficient confidence for autonomous execution.`
          : `Execution denied — threat score ${report.threatScore}/100 did not satisfy policy requirements.`,
    },
    intelligenceModules: report.modules,
    reasoning: report.reasoning,
    verification: {
      analysisHash,
      scanHash: analysisHash,
      reportHash,
      permitHash,
      txHash: attestation?.txHash ?? null,
      registryContract: REGISTRY_ADDRESS,
      chain: `Registry chain ${REGISTRY_CHAIN_ID}; scan chain ${chainId}`,
      status: attestation
        ? 'Execution authorization issued; X Layer attestation pending'
        : 'Authorization evaluated off-chain; no Execution Permit attestation issued',
      attestationStatus: attestation?.status ?? 'not_applicable',
    },
    authorization: authorization
      ? { id: authorization.id, action: authorization.action, executionHash: authorization.executionHash, expiresAt: authorization.expiresAt }
      : null,
    executionPermit: authorization,
    permitVerification: verification,
    policy: {
      decision,
      verdict,
      permitIssued: Boolean(authorization),
    },
    recommendations: decision === 'AUTHORIZED'
      ? ['Verify the Execution Permit before submitting the transaction.', 'Execute only the intent bound to the permit hash.']
      : decision === 'REVIEW_REQUIRED'
        ? ['Pause autonomous execution.', 'Require manual review before continuing.', 'Retry authorization only if new evidence improves confidence.']
        : ['Block autonomous execution.', 'Do not submit this transaction intent.', 'Keep the token under surveillance.'],
    meta: {
      engine: 'WatchTower v1',
      network: chainResolution.chainName,
      reportUrl: `${SITE_URL}/report/${reportHash}`,
    },
    attestation,
  };

  // ── Persist scan record ───────────────────────────────────────────
  await db.insert(scans).values({
    chainId,
    tokenAddress: input.tokenAddress,
    threatScore: report.threatScore,
    recommendation: report.recommendation,
    scanHash: reportHash,
    txHash: attestation?.txHash ?? null,
    agentWallet,
    tier: 'authorize',
    reportData: JSON.stringify(authorizationReport),
    timestamp: report.scanTimestamp,
  });

  if (attestation?.status === 'pending' && permitHash) {
    scheduleAuthorizationAttestation({
      tokenAddress: input.tokenAddress,
      chainId,
      permitHash,
      threatScore: report.threatScore,
      reportHash,
      authorizationReport,
    });
  }

  if (agentWallet) {
    await trackAgentMetrics(agentWallet, input.tokenAddress, chainId);
  }

  const result = {
    decision,
    verdict,
    riskScore: report.threatScore,
    confidence: report.confidence,
    reasoning: report.reasoning,
    authorization,
    verification,
    attestation,
    scan: {
      analysisHash,
      scanHash: analysisHash,
      reportHash,
      permitHash,
      reportUrl: `${SITE_URL}/report/${reportHash}`,
    },
    report: authorizationReport,
  };
  return result;
}
