// ───────────────────────────────────────────────────────────────
// Agent Workflow
//
// The core event-driven pipeline. Orchestrates the full
// security decision flow:
//
//   Market Alert → Watch Tower Scan → Policy Engine →
//   LLM Reasoning → Final Decision → Audit Trail
//
// Watch Tower is the authoritative security middleware.
// The Policy Engine makes the deterministic decision.
// The LLM only explains WHY the decision is correct.
// ───────────────────────────────────────────────────────────────

import type { LLMProvider } from '../providers/types.js';
import type { AgentDecision, MarketOpportunity } from './types.js';
import { WatchTowerMCPClient, type ScanMode } from '../mcp/client.js';
import { evaluatePolicy, getPolicyRationale } from './policy.js';
import { AgentMemory } from './memory.js';
import { SYSTEM_PROMPT, buildAnalysisPrompt } from '../prompts/system.js';
import * as log from '../utils/logger.js';

export class AgentWorkflow {
  private mcp: WatchTowerMCPClient;
  private llm: LLMProvider;
  private memory: AgentMemory;
  private scanMode: ScanMode;

  constructor(mcpEndpoint: string, llmProvider: LLMProvider, scanMode: ScanMode = 'firewall') {
    this.mcp = new WatchTowerMCPClient(mcpEndpoint);
    this.llm = llmProvider;
    this.memory = new AgentMemory();
    this.scanMode = scanMode;
  }

  /**
   * Boot sequence — verify Watch Tower connectivity and display agent info.
   */
  async boot(): Promise<void> {
    const mcpUrl = process.env.WATCHTOWER_MCP_URL || 'http://localhost:3000/api/mcp';
    await log.printBoot(mcpUrl);

    // Verify Watch Tower MCP connection
    const tools = await this.mcp.verifyConnection();
    log.printMcpConnected(tools);

    // Display LLM provider info and scan mode
    log.printProviderInfo(this.llm.name, this.llm.model);
    log.printScanMode(this.scanMode);
  }

  /**
   * Execute the full security decision workflow for a market opportunity.
   * This is the core demo flow.
   */
  async evaluate(opportunity: MarketOpportunity): Promise<AgentDecision> {
    const { tokenAddress, chainId, label } = opportunity;

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
    await log.printSecurityCheckStart(this.scanMode);

    let scanResult;
    try {
      scanResult = await this.mcp.scan(this.scanMode, tokenAddress, chainId);
    } catch (error) {
      log.printError('Watch Tower Security Check', error);
      // If Watch Tower is unavailable, the agent CANNOT proceed.
      // This reinforces Watch Tower as mandatory middleware.
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

      // Extract confidence from the LLM's response
      const confidenceMatch = response.match(/REASONING CONFIDENCE:\s*(\d+)/i);
      reasoningConfidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 85;
    } catch (error) {
      // LLM failure does NOT block the decision — the Policy Engine already decided.
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
      reportUrl: scanResult.meta?.reportUrl,
      scanHash: scanResult.verification?.scanHash,
    };

    await log.printFinalDecision(decision);

    // ── Stage 7: Audit Trail ──────────────────────────────────
    await log.printAuditTrail(decision);

    // ── Stage 8: Closing Sequence ─────────────────────────────
    // Record in memory
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
