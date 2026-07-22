// ───────────────────────────────────────────────────────────────
// Thinking Timeline Logger
//
// Creates the visual "thinking timeline" UX for the hackathon
// demo. Each stage is color-coded and timed to create a
// compelling narrative that judges can follow at a glance.
// ───────────────────────────────────────────────────────────────

import chalk from 'chalk';
import type { PolicyDecision, AgentDecision } from '../agent/types.js';
import type { WatchTowerScanResult, ScanMode } from '../mcp/client.js';

const DIVIDER = chalk.dim('━'.repeat(64));
const THIN_DIVIDER = chalk.dim('─'.repeat(64));

/**
 * Pause for dramatic effect during the demo.
 */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatConfidence(confidence: number): string {
  const percent = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(percent)}%`;
}

function gateValue(status: 'pass' | 'warn' | 'fail' | 'none', label: string): string {
  if (status === 'pass') return chalk.green(label);
  if (status === 'warn') return chalk.yellow(label);
  if (status === 'fail') return chalk.red(label);
  return chalk.dim(label);
}

/**
 * Print the agent boot sequence.
 */
export async function printBoot(mcpUrl: string): Promise<void> {
  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║     Watch Tower — Autonomous Trading Agent Demo         ║'));
  console.log(chalk.bold.cyan('  ║                  X Layer Hackathon 2026                  ║'));
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
}

/**
 * Print the active scan mode.
 */
export function printScanMode(mode: ScanMode): void {
  const label = mode === 'deep' ? 'Execution Authorization (Permission to Execute)' : 'Firewall Scan (Quick Threat Check)';
  console.log(chalk.dim(`  Scan Mode:    ${label}`));
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

export async function printPreviouslyAnalyzedToken(tokenAddress: string): Promise<void> {
  console.log(DIVIDER);
  console.log('');
  console.log(chalk.yellow.bold('  🟡  Market Alert'));
  console.log(chalk.white('     Previously analyzed token detected.'));
  console.log(chalk.dim(`     Token: ${tokenAddress}`));
  console.log(chalk.dim('     Checking Watch Tower session memory...'));
  console.log('');
  await pause(600);
}

export async function printCachedPolicyDecision(decision: PolicyDecision): Promise<void> {
  const status = decision === 'EXECUTE' ? 'Execution may proceed if a fresh permit verifies.'
    : decision === 'REVIEW' ? 'Execution still requires manual review.'
      : 'Execution remains blocked.';
  console.log(chalk.green('     ✓ Cached Threat Report'));
  console.log(chalk.green('     ✓ Cached Policy Decision'));
  console.log(chalk.green('     ✓ No material session changes detected.'));
  console.log(chalk.dim(`     ${status}`));
  console.log('');
  await pause(500);
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

export async function printSecurityCheckStart(mode: ScanMode = 'firewall'): Promise<void> {
  const scanLabel = mode === 'deep' ? 'Execution Authorization' : 'Firewall Scan';
  console.log(chalk.blue.bold('  🔵  Security Verification'));
  console.log(chalk.white(`     Initiating mandatory Watch Tower ${scanLabel}...`));
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
  const confidence = formatConfidence(scan.verdict.confidence);

  console.log(chalk.white('     ┌─────────────────────────────────────────────────┐'));
  console.log(chalk.white(`     │  Threat Score:    ${scoreColor(`${score}/100`)}${' '.repeat(Math.max(0, 30 - `${score}/100`.length))}│`));
  console.log(chalk.white(`     │  Confidence:      ${chalk.dim(confidence)}${' '.repeat(Math.max(0, 30 - confidence.length))}│`));
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

export function printAuthorizationReasonSummary(reasoning: string[], decision: 'AUTHORIZED' | 'REVIEW_REQUIRED' | 'DENIED'): void {
  if (reasoning.length === 0) return;

  const bullets = new Set<string>();
  const joined = reasoning.join(' ').toLowerCase();

  if (joined.includes('liquidity') || joined.includes('trading pair')) {
    bullets.add('Liquidity could not be verified');
  }
  if (joined.includes('goplus') || joined.includes('contract') || joined.includes('security')) {
    bullets.add('Contract security data incomplete');
  }
  if (joined.includes('holder') || joined.includes('whale')) {
    bullets.add('Holder distribution unavailable');
  }
  if (joined.includes('social') || joined.includes('dexscreener')) {
    bullets.add('Market and social context incomplete');
  }
  if (joined.includes('low module coverage') || joined.includes('unavailable')) {
    bullets.add('Threat engine confidence is below autonomous-execution threshold');
  }

  if (bullets.size === 0) {
    for (const reason of reasoning.slice(0, 3)) {
      bullets.add(reason.length > 72 ? `${reason.slice(0, 69)}...` : reason);
    }
  }

  const title = decision === 'REVIEW_REQUIRED' ? 'Reason for Review'
    : decision === 'DENIED' ? 'Reason for Denial'
      : 'Authorization Basis';

  console.log(chalk.white(`  ${title}`));
  for (const bullet of bullets) {
    console.log(chalk.dim(`     • ${bullet}`));
  }
  if (decision === 'REVIEW_REQUIRED') {
    console.log(chalk.dim('     Autonomous execution paused until sufficient confidence is established.'));
  }
  console.log('');
}

export function printAuthorizationStatus(status: 'review' | 'denied' | 'missing-permit', reason: string): void {
  console.log(`\n  ${'🔐'.padStart(4)} ─── Authorization Status ───────────────────────────────\n`);
  console.log(chalk.green('  ✔ Watch Tower Analysis Complete'));

  if (status === 'review') {
    console.log(chalk.yellow('  ⚠ Manual Review Required'));
    console.log('');
    console.log(chalk.yellow('  Execution paused.'));
    console.log(`  Reason: ${reason}`);
    console.log(chalk.dim('  No Execution Permit issued.'));
  } else if (status === 'denied') {
    console.log(chalk.red('  ✖ Authorization Denied'));
    console.log('');
    console.log(chalk.red('  Execution blocked.'));
    console.log(`  Reason: ${reason}`);
    console.log(chalk.dim('  No Execution Permit issued.'));
  } else {
    console.log(chalk.red('  ✖ Execution Permit Missing'));
    console.log('');
    console.log(chalk.red('  Execution blocked.'));
    console.log(`  Reason: ${reason}`);
  }
  console.log('');
}

export function printPermitVerificationGate(input: {
  permitFound: boolean;
  signatureParsed: boolean;
  signatureVerified?: boolean;
  expired?: boolean;
  policySatisfied?: boolean;
  failureReason?: string;
  showHeader?: boolean;
}): void {
  if (input.showHeader !== false) {
    console.log(`\n  ${'🔐'.padStart(4)} ─── Verifying Execution Permit ─────────────────────────\n`);
  }
  console.log(input.permitFound ? chalk.green('  ✔ Permit Found') : chalk.red('  ✖ Permit Missing'));
  if (!input.permitFound) return;

  console.log(input.signatureParsed ? chalk.green('  ✔ Signature Parsed') : chalk.red('  ✖ Signature Missing'));
  if (input.signatureVerified === true) {
    console.log(chalk.green('  ✔ Signature Verified'));
  } else if (input.signatureVerified === false) {
    console.log(chalk.red('  ✖ Signature Invalid'));
  }

  if (input.expired) {
    console.log(chalk.red('  ✖ Permit Expired'));
  }
  if (input.policySatisfied === true) {
    console.log(chalk.green('  ✔ Policy Satisfied'));
    console.log(chalk.green('  ✔ Execution Authorized'));
  } else if (input.policySatisfied === false) {
    console.log(chalk.red('  ✖ Policy Not Satisfied'));
  }
  if (input.failureReason) {
    console.log('');
    console.log(chalk.red('  Execution blocked.'));
    console.log(`  Reason: ${input.failureReason}`);
    console.log(chalk.red('  Trade aborted.'));
  }
  console.log('');
}

export function printExecutionGate(decision: PolicyDecision): void {
  const policyStatus = decision === 'EXECUTE' ? 'pass' : decision === 'REVIEW' ? 'warn' : 'fail';
  const permitStatus = decision === 'EXECUTE' ? 'pass' : 'none';
  const tradeLabel = decision === 'EXECUTE' ? 'EXECUTING' : decision === 'REVIEW' ? 'PAUSED' : 'BLOCKED';
  const tradeStatus = decision === 'EXECUTE' ? 'pass' : decision === 'REVIEW' ? 'warn' : 'fail';

  console.log(DIVIDER);
  console.log('');
  console.log(chalk.bold.white('  Execution Gate'));
  console.log('');
  console.log(`  Threat Intelligence      ${gateValue('pass', '✔')}`);
  console.log(`  Policy Evaluation        ${gateValue(policyStatus, decision === 'EXECUTE' ? '✔' : decision === 'REVIEW' ? '⚠' : '✖')}`);
  console.log(`  Execution Permit         ${gateValue(permitStatus, decision === 'EXECUTE' ? '✔' : '—')}`);
  console.log(`  Trade                    ${gateValue(tradeStatus, tradeLabel)}`);
  console.log('');
  console.log(DIVIDER);
  console.log('');
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
  console.log(chalk.dim(`     Watch Tower Confidence: ${formatConfidence(decision.watchTowerConfidence)}`));
  console.log(chalk.dim(`     Watch Tower Verdict: ${decision.watchTowerVerdict}`));
  console.log(chalk.dim(`     Policy Decision:     ${decision.decision}`));
  if (decision.reasoningConfidence > 0) {
    console.log(chalk.dim(`     Explanation Confidence: ${formatConfidence(decision.reasoningConfidence)}`));
  }
  if (decision.executionPermitId) {
    console.log(chalk.dim(`     Execution Permit:    ${decision.executionPermitId}`));
  } else {
    console.log(chalk.dim(`     Execution Permit:    Not issued`));
  }
  console.log(chalk.dim(`     Timestamp:           ${decision.timestamp}`));
  if (decision.scanHash) {
    console.log(chalk.dim(`     Analysis Hash:       ${decision.scanHash}`));
  }
  if (decision.reportHash) {
    console.log(chalk.dim(`     Report Hash:         ${decision.reportHash}`));
  }
  if (decision.reportUrl) {
    console.log(chalk.dim(`     Report URL:          ${decision.reportUrl}`));
  }
  if (decision.permitHash) {
    console.log(chalk.dim(`     Permit Hash:         ${decision.permitHash}`));
  }
  if (decision.txHash) {
    console.log(chalk.dim(`     X Layer Tx Hash:     ${decision.txHash}`));
  } else if (decision.attestationStatus === 'pending') {
    console.log(chalk.dim('     X Layer Attestation: Pending confirmation'));
  } else if (decision.attestationStatus === 'failed') {
    console.log(chalk.dim('     X Layer Attestation: Failed'));
  }
  console.log('');
  await pause(400);
}

// ─── Stage 8: Closing Sequence ────────────────────────────────

export async function printClosingSequence(decision: AgentDecision): Promise<void> {
  const isBlocked = decision.decision === 'ABORT';

  if (isBlocked) {
    console.log(chalk.red('  ✖  Execution blocked.'));
    await pause(200);
    console.log(chalk.red('  ✖  Policy requirements were not satisfied.'));
    await pause(200);
    console.log(chalk.green('  ✓  Execution remained blocked by policy.'));
    await pause(200);
    console.log(chalk.green('  ✓  Token added to session watchlist.'));
    await pause(200);
  } else if (decision.decision === 'EXECUTE') {
    console.log(chalk.green('  ✓  Permission to Execute granted.'));
    await pause(200);
    if (decision.txHash) {
      console.log(chalk.green('  ✓  Execution Permit attested on-chain.'));
      await pause(200);
    } else if (decision.attestationStatus === 'pending') {
      console.log(chalk.yellow('  ⚠  Attestation pending; execution already authorized by verified permit.'));
      await pause(200);
    } else {
      console.log(chalk.yellow('  ⚠  On-chain attestation unavailable; execution remains authorized by verified permit.'));
      await pause(200);
    }
    console.log(chalk.green('  ✓  Trade execution authorized.'));
    await pause(200);
  } else {
    console.log(chalk.yellow('  ⚠  Execution paused.'));
    await pause(200);
    console.log(chalk.yellow('  ⚠  Autonomous trade prevented until policy requirements are satisfied.'));
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
