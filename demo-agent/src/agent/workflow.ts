// ───────────────────────────────────────────────────────────────
// Agent Workflow
//
// The core event-driven pipeline. Orchestrates the full
// security decision flow:
//
//   Scan Mode:
//     Market Alert → Watch Tower Scan → Policy Engine →
//     LLM Reasoning → Final Decision → Audit Trail
//
//   Authorization Mode (the evolution):
//     Token Detected → Watch Tower Analysis →
//     Execution Authorization → Signature Verification →
//     Execute / Cancel → Audit Trail
//
// Every autonomous action now carries a cryptographically
// verifiable execution authorization.
// ───────────────────────────────────────────────────────────────

import type { LLMProvider } from '../providers/types.js';
import type { AgentDecision, MarketOpportunity } from './types.js';
import { WatchTowerMCPClient, type AgentMode } from '../mcp/client.js';
import { evaluatePolicy, getPolicyRationale } from './policy.js';
import { AgentMemory } from './memory.js';
import { SYSTEM_PROMPT, buildAnalysisPrompt } from '../prompts/system.js';
import * as log from '../utils/logger.js';
import {
  createPermitDomain,
  verificationOptionsFromPolicy,
  verifyExecutionAuthorization,
  WatchTowerPolicy,
  type WatchTowerAuthorizationPolicy,
} from '../../../packages/watchtower-sdk/src/permit.js';

export class AgentWorkflow {
  private mcp: WatchTowerMCPClient;
  private llm: LLMProvider;
  private memory: AgentMemory;
  private agentMode: AgentMode;

  constructor(mcpEndpoint: string, llmProvider: LLMProvider, agentMode: AgentMode = 'authorize') {
    this.mcp = new WatchTowerMCPClient(mcpEndpoint);
    this.llm = llmProvider;
    this.memory = new AgentMemory();
    this.agentMode = agentMode;
  }

  /**
   * Boot sequence — verify Watch Tower connectivity and display agent info.
   */
  async boot(): Promise<void> {
    const mcpUrl = process.env.WATCHTOWER_MCP_URL || 'https://watchtowr.xyz/api/mcp';
    await log.printBoot(mcpUrl);

    // Verify Watch Tower MCP connection
    const tools = await this.mcp.verifyConnection();
    log.printMcpConnected(tools);

    // Display LLM provider info and agent mode
    log.printProviderInfo(this.llm.name, this.llm.model);
    log.printScanMode(this.agentMode === 'authorize' ? 'deep' : this.agentMode);

    if (this.agentMode === 'authorize') {
      console.log(`  ${'⚡'.padStart(4)} Agent Mode   │ ${'Execution Authorization'.padEnd(40)} │`);
      console.log(`  ${''.padStart(4)}              │ ${'Every action requires a signed permit'.padEnd(40)} │`);
    }
  }

  /**
   * Execute the appropriate workflow for a market opportunity.
   */
  async evaluate(opportunity: MarketOpportunity): Promise<AgentDecision> {
    if (this.agentMode === 'authorize') {
      return this.evaluateWithAuthorization(opportunity);
    }
    return this.evaluateWithScan(opportunity);
  }

  /**
   * Execution Authorization Workflow — the evolution.
   *
   * Token Detected → Watch Tower Analysis → Execution Authorization →
   * Signature Verification → Execute / Cancel → Audit Trail
   */
  private async evaluateWithAuthorization(opportunity: MarketOpportunity): Promise<AgentDecision> {
    const { tokenAddress, chainId, label } = opportunity;

    // ── Check Memory ──────────────────────────────────────────
    const previousDecision = this.memory.get(tokenAddress);
    const previousRejection = this.memory.wasRejected(tokenAddress);
    if (previousRejection) {
      log.printPreviouslyRejected(tokenAddress, previousRejection.reason);
      return {
        decision: 'ABORT',
        watchTowerScore: previousRejection.watchTowerScore,
        watchTowerConfidence: 0,
        watchTowerVerdict: 'ABORT',
        reasoning: `Previously rejected: ${previousRejection.reason}`,
        reasoningConfidence: 100,
        tokenAddress,
        timestamp: new Date().toISOString(),
      };
    }

    // ── Stage 1: Token Detected ──────────────────────────────
    if (previousDecision) {
      await log.printPreviouslyAnalyzedToken(tokenAddress);
    } else {
      await log.printMarketAlert(tokenAddress, label);
    }

    // ── Stage 2: Watch Tower Analysis ────────────────────────
    console.log(`\n  ${'🔐'.padStart(4)} ─── Requesting Execution Authorization ───────────────────\n`);

    let authResult;
    try {
      authResult = await this.mcp.authorizeTransaction(tokenAddress, chainId, 'swap');
    } catch (error) {
      log.printError('Execution Authorization', error);
      return {
        decision: 'ABORT',
        watchTowerScore: 100,
        watchTowerConfidence: 0,
        watchTowerVerdict: 'ABORT',
        reasoning: 'Watch Tower Execution Authorization is unavailable. All trading is blocked until the authorization middleware is operational.',
        reasoningConfidence: 100,
        tokenAddress,
        timestamp: new Date().toISOString(),
      };
    }

    // ── Stage 3: Authorization Decision ──────────────────────
    const decisionIcon = authResult.decision === 'AUTHORIZED' ? '✅' : authResult.decision === 'DENIED' ? '🚫' : '⚠️';
    const decisionColor = authResult.decision === 'AUTHORIZED' ? '\x1b[32m' : authResult.decision === 'DENIED' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`  ${decisionIcon.padStart(4)} Authorization │ ${decisionColor}${authResult.decision.padEnd(40)}${reset} │`);
    console.log(`  ${'📊'.padStart(4)} Risk Score   │ ${String(authResult.riskScore).padEnd(40)} │`);
    console.log(`  ${'🎯'.padStart(4)} Confidence   │ ${log.formatConfidence(authResult.confidence).padEnd(40)} │`);

    log.printAuthorizationReasonSummary(authResult.reasoning, authResult.decision);

    if (previousDecision) {
      await log.printCachedPolicyDecision(previousDecision.decision);
    }

    const nonExecutableDecision = async (
      decision: 'ABORT' | 'REVIEW',
      rationale: string,
    ): Promise<AgentDecision> => {
      await log.printPolicyVerification(decision, rationale);
      const finalDecision: AgentDecision = {
        decision,
        watchTowerScore: authResult.riskScore,
        watchTowerConfidence: authResult.confidence,
        watchTowerVerdict: authResult.verdict === 'ABORT' ? 'ABORT' : 'CAUTION',
        reasoning: authResult.reasoning.join(' ') || rationale,
        reasoningConfidence: 100,
        tokenAddress,
        chainName: chainId,
        timestamp: new Date().toISOString(),
        reportUrl: authResult.scan?.reportUrl,
        scanHash: authResult.scan?.analysisHash ?? authResult.scan?.scanHash,
        reportHash: authResult.scan?.reportHash,
        executionPermitId: authResult.authorization?.id,
        permitHash: authResult.attestation?.permitHash ?? authResult.scan?.permitHash ?? null,
        txHash: authResult.attestation?.txHash ?? null,
        scanMode: 'authorize',
      };
      log.printExecutionGate(decision);
      await log.printFinalDecision(finalDecision);
      await log.printAuditTrail(finalDecision);
      this.memory.record(tokenAddress, decision, authResult.riskScore, rationale);
      await log.printClosingSequence(finalDecision);
      return finalDecision;
    };

    const resolveTrustPolicy = (): WatchTowerAuthorizationPolicy => {
      const signerAddress = process.env.WATCHTOWER_AUTH_SIGNER_ADDRESS ?? WatchTowerPolicy.Mainnet.signerAddress;
      const domain = process.env.WATCHTOWER_AUTH_DOMAIN_CHAIN_ID && process.env.WATCHTOWER_AUTH_VERIFYING_CONTRACT
        ? createPermitDomain({
          chainId: process.env.WATCHTOWER_AUTH_DOMAIN_CHAIN_ID,
          verifyingContract: process.env.WATCHTOWER_AUTH_VERIFYING_CONTRACT,
        })
        : WatchTowerPolicy.Mainnet.domain;

      return { signerAddress, domain };
    };

    if (authResult.decision === 'DENIED') {
      log.printAuthorizationStatus(
        'denied',
        'Policy requirements were not satisfied.',
      );
      return nonExecutableDecision(
        'ABORT',
        `Execution Authorization denied. Watch Tower blocked this token (risk: ${authResult.riskScore}/100).`,
      );
    }

    if (authResult.decision === 'REVIEW_REQUIRED') {
      log.printAuthorizationStatus(
        'review',
        'Watch Tower requires manual review before autonomous execution.',
      );
      return nonExecutableDecision(
        'REVIEW',
        `Execution Authorization requires review. Elevated risk detected (risk: ${authResult.riskScore}/100).`,
      );
    }

    if (!authResult.authorization) {
      log.printAuthorizationStatus(
        'missing-permit',
        'Watch Tower returned AUTHORIZED without a verifiable Execution Permit.',
      );
      return nonExecutableDecision(
        'ABORT',
        'Watch Tower returned AUTHORIZED without a verifiable Execution Permit. Execution is blocked.',
      );
    }

    // ── Stage 4: Signature Verification (the wow moment) ─────
    console.log(`\n  ${'🔐'.padStart(4)} ─── Verifying Execution Permit ─────────────────────────\n`);
    console.log(`  ${'📋'.padStart(4)} Permit ID    │ ${authResult.authorization.id.padEnd(40)} │`);
    console.log(`  ${'🎯'.padStart(4)} Intent Hash  │ ${(authResult.authorization.executionHash.slice(0, 20) + '...').padEnd(40)} │`);
    console.log(`  ${'⏱️'.padStart(4)} Issued       │ ${authResult.authorization.issuedAt.padEnd(40)} │`);
    console.log(`  ${'⏳'.padStart(4)} Expires      │ ${authResult.authorization.expiresAt.padEnd(40)} │`);
    console.log(`  ${'🔑'.padStart(4)} Signer       │ ${authResult.authorization.signerAddress.padEnd(40)} │`);
    console.log(`  ${'✍️'.padStart(4)} Signature    │ ${(authResult.authorization.signature.slice(0, 20) + '...').padEnd(40)} │`);

    const trustPolicy = resolveTrustPolicy();
    const verification = await verifyExecutionAuthorization(
      authResult.authorization,
      verificationOptionsFromPolicy(trustPolicy),
    );
    if (!verification.authorized) {
      const message = verification.expired
        ? 'Permit expired.'
        : `Permit verification failed (${verification.reason ?? 'invalid permit'}).`;
      log.printPermitVerificationGate({
        permitFound: true,
        signatureParsed: Boolean(authResult.authorization.signature),
        signatureVerified: verification.signatureValid,
        expired: verification.expired,
        policySatisfied: false,
        failureReason: message,
        showHeader: false,
      });
      return nonExecutableDecision('ABORT', message);
    }

    log.printPermitVerificationGate({
      permitFound: true,
      signatureParsed: true,
      signatureVerified: true,
      policySatisfied: true,
      showHeader: false,
    });

    if (authResult.attestation) {
      console.log(`\n  ${'⛓️'.padStart(4)} ─── On-Chain Attestation ─────────────────────────────────\n`);
      if (authResult.attestation.chain) {
        console.log(`  ${'🔗'.padStart(4)} Chain        │ ${authResult.attestation.chain.padEnd(40)} │`);
      }
      console.log(`  ${'#️⃣'.padStart(4)} Permit Hash  │ ${(authResult.attestation.permitHash.slice(0, 20) + '...').padEnd(40)} │`);
      if (authResult.attestation.status === 'confirmed' && authResult.attestation.txHash) {
        console.log(`  ${'✅'.padStart(4)} Status       │ ${'Confirmed'.padEnd(40)} │`);
        console.log(`  ${'📜'.padStart(4)} Tx Hash      │ ${(authResult.attestation.txHash.slice(0, 20) + '...').padEnd(40)} │`);
      } else if (authResult.attestation.status === 'failed') {
        console.log(`  ${'⚠️'.padStart(4)} Status       │ ${'Failed'.padEnd(40)} │`);
        console.log(`  Attestation failed: ${authResult.attestation.reason ?? 'X Layer confirmation unavailable.'}`);
        console.log('  Execution already authorized by verified permit.');
      } else {
        console.log(`  ${'⏳'.padStart(4)} Status       │ ${'Pending X Layer confirmation'.padEnd(40)} │`);
        console.log('  Attestation still pending.');
        console.log('  Execution already authorized by verified permit.');
        console.log('  Audit record will be anchored when confirmation is received.');
      }
    }

    // ── Stage 5: Policy Decision ─────────────────────────────
    const policyDecision = authResult.decision === 'AUTHORIZED' ? 'EXECUTE' as const
      : authResult.decision === 'DENIED' ? 'ABORT' as const
      : 'REVIEW' as const;

    const policyRationale = authResult.decision === 'AUTHORIZED'
      ? `Execution Authorization granted. Watch Tower verified this token (risk: ${authResult.riskScore}/100).`
      : authResult.decision === 'DENIED'
        ? `Execution Authorization denied. Watch Tower blocked this token (risk: ${authResult.riskScore}/100).`
        : `Execution Authorization requires review. Elevated risk detected (risk: ${authResult.riskScore}/100).`;

    await log.printPolicyVerification(policyDecision, policyRationale);

    // ── Stage 6: AI Evaluation ───────────────────────────────
    await log.printAiEvaluationStart();

    let reasoning = '';
    let reasoningConfidence = 0;

    try {
      const analysisPrompt = `WatchTower Execution Authorization Result:
Decision: ${authResult.decision}
Risk Score: ${authResult.riskScore}/100
Confidence: ${authResult.confidence}
Reasoning: ${authResult.reasoning.join('; ')}
${authResult.authorization ? `Authorization ID: ${authResult.authorization.id}` : 'No authorization issued.'}

Explain WHY this authorization decision is correct. The decision has already been made — your role is to provide a clear explanation.`;

      const response = await this.llm.analyze(SYSTEM_PROMPT, analysisPrompt);
      reasoning = response;

      const confidenceMatch = response.match(/REASONING CONFIDENCE:\s*(\d+)/i);
      reasoningConfidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 85;
    } catch (error) {
      reasoning = 'AI reasoning unavailable. The Execution Authorization decision stands based on Watch Tower data.';
      reasoningConfidence = 0;
      log.printError('AI Evaluation', error);
    }

    await log.printAiEvaluation(reasoning, reasoningConfidence);

    // ── Stage 7: Final Decision ──────────────────────────────
    const decision: AgentDecision = {
      decision: policyDecision,
      watchTowerScore: authResult.riskScore,
      watchTowerConfidence: authResult.confidence,
      watchTowerVerdict: authResult.verdict === 'EXECUTE' ? 'TRADE' : authResult.verdict === 'ABORT' ? 'ABORT' : 'CAUTION',
      reasoning,
      reasoningConfidence,
      tokenAddress,
      chainName: authResult.authorization?.chainId,
      timestamp: new Date().toISOString(),
      reportUrl: authResult.scan?.reportUrl,
      scanHash: authResult.scan?.analysisHash ?? authResult.scan?.scanHash,
      reportHash: authResult.scan?.reportHash,
      executionPermitId: authResult.authorization.id,
      permitHash: authResult.attestation?.permitHash ?? authResult.scan?.permitHash ?? null,
      txHash: authResult.attestation?.txHash ?? null,
      attestationStatus: authResult.attestation?.status ?? null,
      scanMode: 'authorize',
    };

    log.printExecutionGate(policyDecision);
    await log.printFinalDecision(decision);

    // ── Stage 8: Audit Trail ─────────────────────────────────
    await log.printAuditTrail(decision);

    this.memory.record(
      tokenAddress,
      policyDecision,
      authResult.riskScore,
      policyRationale,
    );

    await log.printClosingSequence(decision);

    return decision;
  }

  /**
   * Legacy scan workflow (firewall / legacy authorization-alias modes).
   */
  private async evaluateWithScan(opportunity: MarketOpportunity): Promise<AgentDecision> {
    const { tokenAddress, chainId, label } = opportunity;
    const scanMode = this.agentMode === 'authorize' ? 'deep' as const : this.agentMode;

    // ── Check Memory ──────────────────────────────────────────
    const previousRejection = this.memory.wasRejected(tokenAddress);
    if (previousRejection) {
      log.printPreviouslyRejected(tokenAddress, previousRejection.reason);
      return {
        decision: 'ABORT',
        watchTowerScore: previousRejection.watchTowerScore,
        watchTowerConfidence: 0,
        watchTowerVerdict: 'ABORT',
        reasoning: `Previously rejected: ${previousRejection.reason}`,
        reasoningConfidence: 100,
        tokenAddress,
        timestamp: new Date().toISOString(),
      };
    }

    // ── Stage 1: Market Alert ─────────────────────────────────
    await log.printMarketAlert(tokenAddress, label);

    // ── Stage 2: Security Check (Watch Tower MCP) ─────────────
    await log.printSecurityCheckStart(scanMode);

    let scanResult;
    try {
      scanResult = await this.mcp.scan(scanMode, tokenAddress, chainId);
    } catch (error) {
      log.printError('Watch Tower Security Check', error);
      return {
        decision: 'ABORT',
        watchTowerScore: 100,
        watchTowerConfidence: 0,
        watchTowerVerdict: 'ABORT',
        reasoning: 'Watch Tower security verification is unavailable. Trading is blocked until the security middleware is operational.',
        reasoningConfidence: 100,
        tokenAddress,
        timestamp: new Date().toISOString(),
      };
    }

    await log.printSecurityCheckComplete();

    // ── Stage 3: Threat Analysis ──────────────────────────────
    await log.printThreatAnalysis(scanResult);

    // ── Stage 4: Policy Verification ──────────────────────────
    const policyInput = {
      recommendation: scanResult.verdict.recommendation,
      threatScore: scanResult.verdict.threatScore,
      confidence: scanResult.verdict.confidence,
    };
    const policyDecision = evaluatePolicy(policyInput);
    const policyRationale = getPolicyRationale(policyDecision, policyInput);

    await log.printPolicyVerification(policyDecision, policyRationale);

    // ── Stage 5: AI Evaluation ────────────────────────────────
    await log.printAiEvaluationStart();

    let reasoning = '';
    let reasoningConfidence = 0;

    try {
      const analysisPrompt = buildAnalysisPrompt(
        tokenAddress,
        policyDecision,
        policyRationale,
        scanResult,
      );

      const response = await this.llm.analyze(SYSTEM_PROMPT, analysisPrompt);
      reasoning = response;

      const confidenceMatch = response.match(/REASONING CONFIDENCE:\s*(\d+)/i);
      reasoningConfidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 85;
    } catch (error) {
      reasoning = 'AI reasoning unavailable. The Policy Engine decision stands based on Watch Tower data.';
      reasoningConfidence = 0;
      log.printError('AI Evaluation', error);
    }

    await log.printAiEvaluation(reasoning, reasoningConfidence);

    // ── Stage 6: Final Decision ───────────────────────────────
    const decision: AgentDecision = {
      decision: policyDecision,
      watchTowerScore: scanResult.verdict.threatScore,
      watchTowerConfidence: scanResult.verdict.confidence,
      watchTowerVerdict: scanResult.verdict.recommendation,
      reasoning,
      reasoningConfidence,
      tokenAddress,
      chainName: scanResult.meta?.network,
      timestamp: new Date().toISOString(),
      reportUrl: scanMode === 'deep' ? scanResult.meta?.reportUrl : undefined,
      scanHash: scanResult.verification?.scanHash,
      scanMode,
    };

    await log.printFinalDecision(decision);

    // ── Stage 7: Audit Trail ──────────────────────────────────
    await log.printAuditTrail(decision);

    this.memory.record(
      tokenAddress,
      policyDecision,
      scanResult.verdict.threatScore,
      policyRationale,
    );

    await log.printClosingSequence(decision);

    return decision;
  }
}
