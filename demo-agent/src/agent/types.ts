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
  /** Watch Tower authorization report URL */
  reportUrl?: string;
  /** Threat-analysis content hash */
  scanHash?: string;
  /** Public report lookup hash */
  reportHash?: string;
  /** Execution Permit id, when one was issued */
  executionPermitId?: string;
  /** Execution Permit hash, when one was issued */
  permitHash?: string | null;
  /** X Layer transaction hash, when available */
  txHash?: string | null;
  /** Audit-plane attestation lifecycle, when an Execution Permit was issued */
  attestationStatus?: 'pending' | 'confirmed' | 'failed' | null;
  /** Which scan tier was used */
  scanMode?: 'firewall' | 'deep' | 'authorize';
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

// ---------------------------------------------------------------------------
// Execution Authorization Types
// ---------------------------------------------------------------------------

/** Authorization decision from WatchTower */
export type AuthorizationDecision = 'AUTHORIZED' | 'REVIEW_REQUIRED' | 'DENIED';

/** The Execution Authorization credential */
export interface ExecutionAuthorization {
  id: string;
  action: string;
  tokenAddress: string;
  chainId: string;
  agentWallet: string;
  executionHash: `0x${string}`;
  amountUsd?: string;
  recipient?: string;
  spender?: string;
  calldataHash?: `0x${string}`;
  riskScore: number;
  issuedAt: string;
  expiresAt: string;
  signerAddress: string;
  domain: {
    name: 'WatchTower';
    version: '1';
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  signature: `0x${string}`;
}

/** Signature verification result */
export interface AuthorizationVerification {
  signatureValid: boolean;
  expired: boolean;
  authorized: boolean;
  signerAddress: string | null;
}

/** Full authorization response from WatchTower */
export interface AuthorizationResult {
  decision: AuthorizationDecision;
  verdict: 'EXECUTE' | 'REVIEW' | 'ABORT';
  riskScore: number;
  confidence: number;
  reasoning: string[];
  authorization: ExecutionAuthorization | null;
  verification?: AuthorizationVerification | null;
  executable?: boolean;
  scan?: {
    analysisHash?: string;
    scanHash: string;
    reportHash?: string;
    permitHash?: string | null;
    reportUrl: string;
  };
  attestation: {
    status?: 'pending' | 'confirmed' | 'failed';
    permitHash: string;
    txHash?: string | null;
    chain?: string;
    reason?: string;
  } | null;
}
