// ───────────────────────────────────────────────────────────────
// LLM Provider Interface
//
// Any LLM provider must implement this single method.
// The provider receives the Watch Tower report and returns
// a natural language analysis. It must NEVER fabricate
// security findings — all security data comes from Watch Tower.
// ───────────────────────────────────────────────────────────────

export interface LLMProvider {
  /** Provider display name (for logging) */
  readonly name: string;

  /** Model identifier being used */
  readonly model: string;

  /**
   * Analyze a Watch Tower security report and produce a
   * natural language explanation.
   *
   * @param systemPrompt - The immutable system instructions
   * @param userPrompt - The analysis request containing Watch Tower data
   * @returns The LLM's natural language analysis
   */
  analyze(systemPrompt: string, userPrompt: string): Promise<string>;
}
