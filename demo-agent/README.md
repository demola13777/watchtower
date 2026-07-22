# WatchTower Demo Agent

Provider-agnostic autonomous trading agent demo for the X Layer Hackathon.

The demo shows WatchTower as an execution gate:

```text
Market Opportunity
→ Request Execution Authorization
→ WatchTower Analysis
→ Policy Decision
→ Execution Permit Issued
→ Permit Verification
→ Execution Gate
→ Execute / Block / Review
→ Audit Trail
```

The default mode is **Authorization**. The agent cannot execute unless WatchTower returns `AUTHORIZED`, provides a signed Execution Permit, and the permit verifies locally.

---

## What The Demo Proves

- WatchTower is the authoritative security layer.
- The policy engine maps WatchTower output to `EXECUTE`, `REVIEW`, or `ABORT`.
- The LLM explains the decision but never overrides it.
- `DENIED`, `REVIEW_REQUIRED`, missing permits, invalid signatures, expired permits, and verification errors all stop execution.
- On-chain attestation is only displayed when a real transaction hash is available.

---

## Quick Start

Prerequisites:

- A deployed WatchTower MCP endpoint, or WatchTower running locally from the project root with `npm run dev`.
- An OpenRouter API key for the default LLM provider.

```bash
cd demo-agent
npm install
cp .env.example .env
```

Set:

```bash
WATCHTOWER_MCP_URL=http://localhost:3000/api/mcp
OPENROUTER_API_KEY=...
```

For the live deployment, use:

```bash
WATCHTOWER_MCP_URL=https://watchtowr.xyz/api/mcp
```

Run:

```bash
npm start
```

Run against a specific token:

```bash
npm start -- 0xTokenAddress
```

---

## Modes

```bash
npm start -- --authorize  # default Permission to Execute flow
npm start -- --firewall   # fast Firewall scan path
npm start -- --deep       # legacy compatibility alias
```

Use `--authorize` for the hackathon demo. `--deep` exists only to exercise the legacy compatibility tool.

---

## MCP Tools Used

| Mode | MCP tool |
| --- | --- |
| Authorization | `authorize_transaction` |
| Firewall | `scan_token` |
| Legacy compatibility | `deep_scan_token` |

The MCP endpoint shares the same payment, validation, chain-resolution, service recovery, and replay-protection behavior as the REST API.

---

## Provider Agnosticism

The LLM provider can be swapped by changing `LLM_PROVIDER`.

| Provider | Config |
| --- | --- |
| OpenRouter | `LLM_PROVIDER=openrouter` |
| Groq | `LLM_PROVIDER=groq` |

Adding another provider requires implementing:

```ts
interface LLMProvider {
  readonly name: string;
  readonly model: string;
  analyze(systemPrompt: string, userPrompt: string): Promise<string>;
}
```

---

## Project Structure

```text
src/
  index.ts              CLI entry point and mode parsing
  agent/
    workflow.ts         Authorization and legacy scan workflows
    policy.ts           deterministic policy gate
    memory.ts           session watchlist
    types.ts            decision and authorization types
  mcp/
    client.ts           WatchTower MCP JSON-RPC client
  providers/
    index.ts            provider factory
    openrouter.ts       OpenRouter implementation
    groq.ts             Groq implementation
    types.ts            provider interface
  prompts/
    system.ts           strict prompt and explanation template
  utils/
    logger.ts           terminal timeline output
```

---

## Design Rules

1. WatchTower decides authorization.
2. The policy engine is deterministic.
3. The LLM only explains the result.
4. If WatchTower is unavailable, execution is blocked.
5. If permit verification fails, execution is blocked.
6. The demo never claims a permit or on-chain attestation exists unless one was actually returned.
