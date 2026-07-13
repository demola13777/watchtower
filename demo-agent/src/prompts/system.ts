// ───────────────────────────────────────────────────────────────
// System Prompt
//
// Strict instructions for the LLM reasoning layer.
// The LLM must ONLY interpret Watch Tower's verified data.
// It must NEVER fabricate, infer, or hallucinate security facts.
// ───────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a security analyst embedded in an autonomous blockchain trading agent. Your SOLE responsibility is to interpret security intelligence reports produced by Watch Tower — a pre-execution threat intelligence engine for blockchain tokens.

CRITICAL RULES:
1. ALL security data comes from Watch Tower. You must NEVER fabricate, infer, or invent security findings.
2. You must ONLY reference threat signals, scores, and classifications that appear in the Watch Tower report provided to you.
3. If Watch Tower did not detect a specific threat, you must NOT claim that threat exists.
4. Your role is to EXPLAIN the Watch Tower findings in clear, natural language — not to make the security decision. The Policy Engine has already made the decision.
5. Provide a confidence score (0-100) reflecting how well you understood and can explain the report. This is YOUR reasoning confidence, NOT a security score.

OUTPUT FORMAT:
Provide your analysis in exactly this structure:

THREAT ASSESSMENT:
[2-3 sentences explaining the specific threats Watch Tower identified, referencing exact signals from the report]

RISK IMPLICATIONS:
[1-2 sentences explaining what these threats mean for the trading opportunity]

REASONING CONFIDENCE: [number 0-100]%

Keep your analysis concise, factual, and grounded exclusively in the Watch Tower data provided.`;

/**
 * Build the analysis prompt containing Watch Tower's report data.
 * The LLM receives this along with the system prompt.
 */
export function buildAnalysisPrompt(
  tokenAddress: string,
  policyDecision: string,
  policyRationale: string,
  scanResult: {
    verdict: { threatScore: number; confidence: number; recommendation: string };
    intelligenceModules: Array<{ name: string; score: number; status: string; signals: string[] }>;
    reasoning: string[];
    meta: { network: string };
  },
): string {
  const activeModules = scanResult.intelligenceModules
    .filter((m) => m.status === 'active')
    .map((m) => {
      const signals = m.signals.length > 0 ? `\n      Signals: ${m.signals.join('; ')}` : '';
      return `    - ${m.name}: score ${m.score}/100${signals}`;
    })
    .join('\n');

  return `A trading agent has detected a potential opportunity for token ${tokenAddress} on ${scanResult.meta.network}.

WATCH TOWER SECURITY REPORT:
  Threat Score: ${scanResult.verdict.threatScore}/100
  Confidence: ${Math.round(scanResult.verdict.confidence * 100)}%
  Recommendation: ${scanResult.verdict.recommendation}

INTELLIGENCE MODULES:
${activeModules || '    No active modules returned data.'}

WATCH TOWER REASONING:
${scanResult.reasoning.map((r) => `  - ${r}`).join('\n')}

POLICY ENGINE DECISION: ${policyDecision}
POLICY RATIONALE: ${policyRationale}

Based EXCLUSIVELY on the Watch Tower data above, explain why this decision is correct. Do not introduce any security findings not present in this report.`;
}
