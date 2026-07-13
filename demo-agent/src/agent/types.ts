// ───────────────────────────────────────────────────────────────
// Agent Decision Types
//
// Separates Watch Tower's authoritative security verdict from
// the Policy Engine's deterministic decision and the LLM's
// explanatory reasoning.
// ───────────────────────────────────────────────────────────────

/** Watch Tower's verdict — the authoritative security decision */
export type WatchTowerVerdict = 'TRADE' | 'CAUTION' | 'ABORT';

/** The Policy Engine's final decision — derived from Watch Tower, never the LLM */
export type PolicyDecision = 'EXECUTE' | 'ABORT' | 'REVIEW';

/** Structured decision output from the agent workflow */
export interface AgentDecision {
  /** The Policy Engine's deterministic decision */
  decision: PolicyDecision;
  /** Watch Tower's raw threat score (0-100) */
  watchTowerScore: number;
  /** Watch Tower's confidence level (0-1) */
  watchTowerConfidence: number;
  /** Watch Tower's recommendation */
  watchTowerVerdict: WatchTowerVerdict;
  /** LLM's natural language explanation of WHY the decision was made */
  reasoning: string;
  /** LLM's confidence in its own explanation (0-100), separate from Watch Tower's score */
  reasoningConfidence: number;
  /** Token address that was evaluated */
  tokenAddress: string;
  /** Chain name */
  chainName?: string;
  /** Timestamp of the decision */
  timestamp: string;
  /** Watch Tower report URL (deep scan only) */
  reportUrl?: string;
  /** On-chain scan hash */
  scanHash?: string;
  /** Which scan tier was used */
  scanMode?: 'firewall' | 'deep';
}

/** A market opportunity that triggers the agent workflow */
export interface MarketOpportunity {
  tokenAddress: string;
  chainId?: string;
  label?: string;
}

/** Memory entry for previously evaluated tokens */
export interface MemoryEntry {
  tokenAddress: string;
  decision: PolicyDecision;
  watchTowerScore: number;
  timestamp: string;
  reason: string;
}
