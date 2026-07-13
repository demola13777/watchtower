// ───────────────────────────────────────────────────────────────
// Policy Engine (Decision Guard)
//
// Deterministic security gate between Watch Tower and the LLM.
// The Policy Engine translates Watch Tower's authoritative
// verdict into a PolicyDecision. The LLM NEVER overrides this.
//
// Flow: Watch Tower → Policy Engine → LLM (explanation only)
// ───────────────────────────────────────────────────────────────

import type { PolicyDecision, WatchTowerVerdict } from './types.js';

interface PolicyInput {
  recommendation: WatchTowerVerdict;
  threatScore: number;
  confidence: number;
}

/**
 * Evaluate Watch Tower's verdict and produce a deterministic policy decision.
 *
 * Rules:
 * - ABORT: Watch Tower says ABORT, or threat score ≥ 70
 * - REVIEW: Watch Tower says CAUTION, or score between 40-69
 * - EXECUTE: Watch Tower says TRADE, and score < 40
 */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  // Hard block — Watch Tower says ABORT
  if (input.recommendation === 'ABORT') {
    return 'ABORT';
  }

  // High threat score override (even if Watch Tower says CAUTION)
  if (input.threatScore >= 70) {
    return 'ABORT';
  }

  // Elevated risk — requires manual review
  if (input.recommendation === 'CAUTION' || input.threatScore >= 40) {
    return 'REVIEW';
  }

  // Low risk — clear to execute
  return 'EXECUTE';
}

/**
 * Returns a human-readable policy justification.
 */
export function getPolicyRationale(decision: PolicyDecision, input: PolicyInput): string {
  switch (decision) {
    case 'ABORT':
      return `Policy requires transaction rejection. Watch Tower threat score: ${input.threatScore}/100 (verdict: ${input.recommendation}).`;
    case 'REVIEW':
      return `Policy requires additional verification. Elevated risk indicators detected (score: ${input.threatScore}/100).`;
    case 'EXECUTE':
      return `Policy permits execution. Watch Tower cleared this token (score: ${input.threatScore}/100).`;
  }
}
