# Watch Tower — Autonomous Trading Agent Demo

> Provider-agnostic autonomous trading agent powered by Watch Tower security middleware.  
> Built for the **X Layer Hackathon 2026**.

## Architecture

```
Market Opportunity Detected
  → Watch Tower Scan (MCP)        ← Security Middleware
  → Policy Engine                  ← Deterministic Decision Gate
  → LLM Reasoning                 ← Natural Language Explanation
  → Final Decision (EXECUTE/ABORT/REVIEW)
  → Audit Trail
```

**Watch Tower** is the authoritative security layer. The **Policy Engine** makes deterministic decisions based on Watch Tower's verdict. The **LLM** only explains *why* the decision was made — it never fabricates security findings or overrides the Policy Engine.

## Quick Start

### Prerequisites
- Watch Tower running locally (`npm run dev` from the project root)
- An [OpenRouter API key](https://openrouter.ai/keys) (free tier available)

### Setup

```bash
cd demo-agent
npm install
cp .env.example .env
# Add your OpenRouter API key to .env
```

### Run

```bash
# Default demo (scans a known threat token)
npm start

# Scan a specific token
npm start -- 0xYourTokenAddress
```

## Provider Agnosticism

The LLM provider can be swapped by changing a single environment variable. The architecture ensures **Watch Tower works with any LLM**.

| Provider | Config | Free Tier |
|----------|--------|-----------|
| OpenRouter (default) | `LLM_PROVIDER=openrouter` | ✅ Yes |
| OpenAI | `LLM_PROVIDER=openai` | ❌ No |
| Anthropic | `LLM_PROVIDER=anthropic` | ❌ No |

Adding a new provider requires implementing a single `analyze()` method:

```typescript
interface LLMProvider {
  readonly name: string;
  readonly model: string;
  analyze(systemPrompt: string, userPrompt: string): Promise<string>;
}
```

## Demo Flow (Thinking Timeline)

```
🟢 Market Alert          — Potential trading opportunity detected
🔵 Security Verification — Watch Tower MCP scan executing
🟡 Threat Analysis        — Watch Tower report displayed
🔴 Policy Verification   — Deterministic decision gate
🟠 AI Evaluation          — LLM explains the decision
🔴 Final Decision         — EXECUTE / ABORT / REVIEW
📋 Audit Trail            — Full security summary
✓  Closing Sequence       — Threat prevented / funds protected
```

## Project Structure

```
src/
├── index.ts              # Entry point (event-driven CLI)
├── agent/
│   ├── workflow.ts       # Core 8-stage decision pipeline
│   ├── policy.ts         # Policy Engine (Decision Guard)
│   ├── memory.ts         # In-memory session watchlist
│   └── types.ts          # Decision, Verdict, Memory types
├── providers/
│   ├── types.ts          # LLM Provider interface
│   ├── openrouter.ts     # OpenRouter implementation
│   └── index.ts          # Provider factory
├── mcp/
│   └── client.ts         # Watch Tower MCP JSON-RPC client
├── prompts/
│   └── system.ts         # Strict system prompt + analysis template
└── utils/
    └── logger.ts         # Thinking Timeline terminal UX
```

## Key Design Decisions

1. **Policy Engine over LLM**: The LLM never decides whether to trade. Watch Tower's verdict flows through a deterministic Policy Engine first.
2. **No hallucinated security data**: The system prompt explicitly prohibits the LLM from inventing security findings.
3. **Agent Memory**: Previously rejected tokens are remembered within the session, demonstrating autonomous behavior.
4. **Watch Tower as mandatory middleware**: If Watch Tower is unreachable, all trading is blocked — not degraded.
