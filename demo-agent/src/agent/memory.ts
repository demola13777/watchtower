// ───────────────────────────────────────────────────────────────
// Agent Session Memory
//
// Lightweight in-memory store for tracking security decisions
// within a single session. Makes the agent feel autonomous
// by remembering previously rejected and approved tokens.
// ───────────────────────────────────────────────────────────────

import type { MemoryEntry, PolicyDecision } from './types.js';

export class AgentMemory {
  private entries: Map<string, MemoryEntry> = new Map();

  /**
   * Record a security decision for a token.
   */
  record(tokenAddress: string, decision: PolicyDecision, watchTowerScore: number, reason: string): void {
    const key = tokenAddress.toLowerCase();
    this.entries.set(key, {
      tokenAddress: key,
      decision,
      watchTowerScore,
      timestamp: new Date().toISOString(),
      reason,
    });
  }

  /**
   * Check if a token was previously rejected.
   */
  wasRejected(tokenAddress: string): MemoryEntry | null {
    const entry = this.entries.get(tokenAddress.toLowerCase());
    if (entry && entry.decision === 'ABORT') {
      return entry;
    }
    return null;
  }

  /**
   * Get the previous session decision for a token.
   */
  get(tokenAddress: string): MemoryEntry | null {
    return this.entries.get(tokenAddress.toLowerCase()) ?? null;
  }

  /**
   * Get all recorded decisions.
   */
  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get count of decisions by type.
   */
  getStats(): { executed: number; aborted: number; reviewed: number } {
    let executed = 0, aborted = 0, reviewed = 0;
    for (const entry of this.entries.values()) {
      if (entry.decision === 'EXECUTE') executed++;
      else if (entry.decision === 'ABORT') aborted++;
      else reviewed++;
    }
    return { executed, aborted, reviewed };
  }
}
