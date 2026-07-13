// ───────────────────────────────────────────────────────────────
// Thinking Timeline Logger
//
// Creates the visual "thinking timeline" UX for the hackathon
// demo. Each stage is color-coded and timed to create a
// compelling narrative that judges can follow at a glance.
// ───────────────────────────────────────────────────────────────

import chalk from 'chalk';
import type { PolicyDecision, AgentDecision } from '../agent/types.js';
import type { WatchTowerScanResult } from '../mcp/client.js';

const DIVIDER = chalk.dim('━'.repeat(64));
const THIN_DIVIDER = chalk.dim('─'.repeat(64));

/**
 * Pause for dramatic effect during the demo.
 */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print the agent boot sequence.
 */
export async function printBoot(mcpUrl: string): Promise<void> {
  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║     Watch Tower — Autonomous Trading Agent Demo         ║'));
  console.log(chalk.bold.cyan('  ║                  X Layer Hackathon 2025                  ║'));
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.dim(`  MCP Endpoint: ${mcpUrl}`));
}

/**
 * Print MCP connection verification.
 */
export function printMcpConnected(tools: string[]): void {
  console.log(chalk.green(`  ✓ Watch Tower connected. Tools: ${tools.join(', ')}`));
  console.log('');
}

/**
 * Print LLM provider info.
 */
export function printProviderInfo(name: string, model: string): void {
  console.log(chalk.dim(`  LLM Provider: ${name} (${model})`));
  console.log('');
}

/**
 * Print when a token was previously rejected from memory.
 */
export function printPreviouslyRejected(tokenAddress: string, reason: string): void {
  console.log(DIVIDER);
  console.log('');
  console.log(chalk.yellow('  ⚠  Previously Rejected Token'));
  console.log(chalk.dim(`     ${tokenAddress}`));
  console.log(chalk.dim(`     Reason: ${reason}`));
  console.log(chalk.dim('     Skipping — contract is on temporary watchlist.'));
  console.log('');
}

// ─── Stage 1: Market Alert ────────────────────────────────────

export async function printMarketAlert(tokenAddress: string, label?: string): Promise<void> {
  console.log(DIVIDER);
  console.log('');
  console.log(chalk.green.bold('  🟢  Market Alert'));
  console.log(chalk.white(`     Potential trading opportunity detected.`));
  console.log(chalk.dim(`     Token: ${tokenAddress}`));
  if (label) console.log(chalk.dim(`     Label: ${label}`));
  console.log('');
  await pause(800);
}

// ─── Stage 2: Security Check ──────────────────────────────────

export async function printSecurityCheckStart(): Promise<void> {
  console.log(chalk.blue.bold('  🔵  Security Verification'));
  console.log(chalk.white('     Initiating mandatory Watch Tower security verification...'));
  await pause(600);
}

export async function printSecurityCheckComplete(): Promise<void> {
  console.log(chalk.green('     ✓ Security report received.'));
  console.log('');
  await pause(400);
}

// ─── Stage 3: Threat Analysis ─────────────────────────────────

export async function printThreatAnalysis(scan: WatchTowerScanResult): Promise<void> {
  console.log(chalk.yellow.bold('  🟡  Threat Analysis'));
  console.log('');

  // Threat score with color coding
  const score = scan.verdict.threatScore;
  const scoreColor = score >= 70 ? chalk.red.bold : score >= 40 ? chalk.yellow.bold : chalk.green.bold;
  const confidence = Math.round(scan.verdict.confidence * 100);

  console.log(chalk.white('     ┌─────────────────────────────────────────────────┐'));
  console.log(chalk.white(`     │  Threat Score:    ${scoreColor(`${score}/100`)}${' '.repeat(Math.max(0, 30 - `${score}/100`.length))}│`));
  console.log(chalk.white(`     │  Confidence:      ${chalk.dim(`${confidence}%`)}${' '.repeat(Math.max(0, 30 - `${confidence}%`.length))}│`));
  console.log(chalk.white(`     │  Verdict:         ${scoreColor(scan.verdict.recommendation)}${' '.repeat(Math.max(0, 30 - scan.verdict.recommendation.length))}│`));
  console.log(chalk.white(`     │  Network:         ${chalk.dim(scan.meta.network)}${' '.repeat(Math.max(0, 30 - scan.meta.network.length))}│`));
  console.log(chalk.white('     │                                                 │'));

  // Show key signals from active modules
  const activeModules = scan.intelligenceModules.filter((m) => m.status === 'active');
  for (const mod of activeModules) {
    if (mod.signals.length > 0) {
      for (const signal of mod.signals) {
        const icon = mod.score >= 70 ? '⚠' : mod.score >= 40 ? '◆' : '✓';
        const color = mod.score >= 70 ? chalk.red : mod.score >= 40 ? chalk.yellow : chalk.green;
        const truncated = signal.length > 45 ? signal.slice(0, 42) + '...' : signal;
        console.log(chalk.white(`     │  ${color(`${icon} ${truncated}`)}${' '.repeat(Math.max(0, 47 - truncated.length - 2))}│`));
      }
    }
  }

  console.log(chalk.white('     └─────────────────────────────────────────────────┘'));
  console.log('');
  await pause(1000);
}

// ─── Stage 4: Policy Verification ─────────────────────────────

export async function printPolicyVerification(decision: PolicyDecision, rationale: string): Promise<void> {
  const icon = decision === 'ABORT' ? '🔴' : decision === 'REVIEW' ? '🟠' : '🟢';
  const color = decision === 'ABORT' ? chalk.red.bold : decision === 'REVIEW' ? chalk.yellow.bold : chalk.green.bold;

  console.log(color(`  ${icon}  Policy Verification`));
  console.log(chalk.white(`     Verifying execution policy...`));
  await pause(500);
  console.log(chalk.white(`     ${rationale}`));
  console.log('');
  await pause(600);
}

// ─── Stage 5: AI Evaluation ───────────────────────────────────

export async function printAiEvaluationStart(): Promise<void> {
  console.log(chalk.hex('#FF8C00').bold('  🟠  AI Evaluation'));
  console.log(chalk.white('     Generating natural language explanation...'));
  await pause(400);
}

export async function printAiEvaluation(reasoning: string, confidence: number): Promise<void> {
  console.log('');
  // Parse the reasoning into sections
  const lines = reasoning.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    console.log(chalk.dim(`     ${line.trim()}`));
  }
  console.log('');
  console.log(chalk.dim(`     Reasoning Confidence: ${confidence}%`));
  console.log('');
  await pause(600);
}

// ─── Stage 6: Final Decision ──────────────────────────────────

export async function printFinalDecision(decision: AgentDecision): Promise<void> {
  const color = decision.decision === 'ABORT' ? chalk.red : decision.decision === 'REVIEW' ? chalk.yellow : chalk.green;
  const icon = decision.decision === 'ABORT' ? '🔴' : decision.decision === 'REVIEW' ? '🟡' : '🟢';

  console.log(THIN_DIVIDER);
  console.log('');
  console.log(color.bold(`  ${icon}  Decision: ${decision.decision}`));
  console.log('');
  await pause(300);
}

// ─── Stage 7: Audit Trail ─────────────────────────────────────

export async function printAuditTrail(decision: AgentDecision): Promise<void> {
  console.log(chalk.bold.white('  📋  Security Audit Trail'));
  console.log('');
  console.log(chalk.dim(`     Token:              ${decision.tokenAddress}`));
  if (decision.chainName) {
    console.log(chalk.dim(`     Network:            ${decision.chainName}`));
  }
  console.log(chalk.dim(`     Watch Tower Score:   ${decision.watchTowerScore}/100`));
  console.log(chalk.dim(`     Watch Tower Verdict: ${decision.watchTowerVerdict}`));
  console.log(chalk.dim(`     Policy Decision:     ${decision.decision}`));
  console.log(chalk.dim(`     AI Confidence:       ${decision.reasoningConfidence}%`));
  console.log(chalk.dim(`     Timestamp:           ${decision.timestamp}`));
  if (decision.scanHash) {
    console.log(chalk.dim(`     Scan Hash:           ${decision.scanHash}`));
  }
  if (decision.reportUrl) {
    console.log(chalk.dim(`     Report:              ${decision.reportUrl}`));
  }
  console.log('');
  await pause(400);
}

// ─── Stage 8: Closing Sequence ────────────────────────────────

export async function printClosingSequence(decision: AgentDecision): Promise<void> {
  const isBlocked = decision.decision === 'ABORT';

  if (isBlocked) {
    console.log(chalk.green('  ✓  Threat prevented.'));
    await pause(200);
    console.log(chalk.green('  ✓  User funds protected.'));
    await pause(200);
    if (decision.scanHash) {
      console.log(chalk.green('  ✓  Security attestation recorded on-chain.'));
      await pause(200);
    }
    console.log(chalk.green('  ✓  Token added to session watchlist.'));
    await pause(200);
  } else if (decision.decision === 'EXECUTE') {
    console.log(chalk.green('  ✓  Security clearance granted.'));
    await pause(200);
    console.log(chalk.green('  ✓  Trade execution authorized.'));
    await pause(200);
  } else {
    console.log(chalk.yellow('  ◆  Additional verification recommended before proceeding.'));
    await pause(200);
  }

  console.log(chalk.green('  ✓  Resuming market surveillance...'));
  console.log('');
  console.log(DIVIDER);
  console.log('');
}

/**
 * Print an error state.
 */
export function printError(stage: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.log('');
  console.log(chalk.red.bold(`  ✗  ${stage} failed`));
  console.log(chalk.red(`     ${message}`));
  console.log('');
}
