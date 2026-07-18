# WatchTower Mainnet Readiness Checklist

**Status:** X Layer Mainnet deployment is in progress. The first registry deployment and local end-to-end canaries were verified on 2026-07-11, but that registry is now retired because the original owner/treasury key was rotated after exposure. A replacement registry must be deployed and re-canary-tested with the rotated addresses before WatchTower can claim a live production launch.

WatchTower's application architecture is mainnet-capable: payment-network values, registry values, SDK payment policy, wallet switching, and explorer links are configuration-driven. This checklist records the remaining release work required before accepting real funds or presenting the product as live on X Layer Mainnet.

## Mainnet Evidence

- Retired registry: `WatchTowerRegistry` was deployed on **X Layer Mainnet, chain ID 196** at `0x2498a8fDa4F689c2A4a86767468Ff24dEab24e3D`.
- Deployment transaction: `0x092fa744f302952ff59f50602ca86f3c131fbf9e36ea49eee87ce71216911547`.
- The deployed runtime bytecode matches the reviewed build; `owner()` is `0x9cfd99ae73da2402f70c4198a3b3448a19bba68f`.
- A `0.5 USD0` Firewall SDK canary completed, including payment verification and a confirmed `ScanRecorded` attestation: `0xc0d3748d09322bd46977d0d9789ccfebe50e678e9883a53e7cd3efdde150f371`.
- A `1 USD0` Deep Scan SDK canary completed for Ethereum WETH, including report persistence and a confirmed `ScanRecorded` attestation: `0x377a16231420c6c8aa77c46b824025cbe8a193b99e391d3b2d8b7866eb75058a`.
- Both canaries used replay-protected payment records, settled ERC-20 transfers to the configured treasury, and the expected agent-wallet balance changes.
- Rotated treasury / current registry owner target: `0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1`.
- Rotated agent-payment wallet: `0x1bF9f3D8643Ca416878837DF610c9FC8561067b7`.
- Replacement registry deployed from the rotated owner key at `0x8B9d300f133E3bC754A88D00c1c46f8114019a2A`.
- Replacement deployment transaction: `0x1fdc08c86a08e67934a1e903f0d2dd8c267c0ce816c47a39b031a652facbfa15`.
- Replacement runtime hash: `0x84ed08ec9dde3cdc708ee3b6e27fcf19d1293be13d77e0e0e49ed8f7325e0e65`.
- Replacement `owner()` is the rotated owner address: `0xE4A3089Fc40C534DC4c628B7551e6f711fcCe1A1`.
- Replacement Firewall canary completed through the SDK with replay-protected settlement `0xbb88bc5c7a5614c422242c0dad241a45b768cb666ae209e39f30896d0652d25d`.
- Replacement Deep Scan canary completed through the SDK with replay-protected settlement `0xd1f7f81893320db4363a8dfa72f96a445b9eb446902701211bc84487953e090c`.
- Replacement Deep Scan registry attestation: `0x3f4220c0cc9e65b8765c2703366bebae4ad284d47f9799f04ae30a79f0182239`.
- Replacement Deep Scan report hash: `5ce37c50d706691135c5851e3a5038399f5635f8628ab583ad08f49bffc40ae6`.
- Replacement contract source verification completed through Sourcify with `exact_match`. Verification job: `809a97a8-2156-400b-ad48-2796d99c71f6`.
- The service currently uses an owner-operated registry signer and OKX x402 facilitator settlement. It does not yet provide decentralized attestation generation.

## Release Gate

Do not describe WatchTower as **live on X Layer Mainnet**, turn on public paid traffic, or direct users to send real USDT until every required item below is complete and a named release owner has signed off.

## 1. Smart Contract and Attestation

- [x] Deploy the first `WatchTowerRegistry` to X Layer Mainnet (chain ID `196`) from the reviewed contract source. This registry is now retired because its owner key was rotated after exposure.
- [x] Save the first deployment transaction, contract address, bytecode hash, deployer, and deployment date in the release record.
- [x] Dry-run a replacement `WatchTowerRegistry` deployment from the rotated owner key. Predicted address: `0x8B9d300f133E3bC754A88D00c1c46f8114019a2A`.
- [x] Broadcast the replacement `WatchTowerRegistry` deployment after explicit approval for the signing transaction.
- [x] Save the replacement deployment transaction, contract address, bytecode hash, deployer, and deployment date in the release record.
- [x] Verify the replacement contract source and constructor output. Sourcify returned `exact_match` for verification job `809a97a8-2156-400b-ad48-2796d99c71f6`.
- [x] Set `NEXT_PUBLIC_REGISTRY_ADDRESS` to the replacement Mainnet registry address locally.
- [x] Set `NEXT_PUBLIC_REGISTRY_CHAIN_ID=196`.
- [x] Set `NEXT_PUBLIC_REGISTRY_RPC_URL` for the browser verifier and use the server-only `MAINNET_RPC_URL` for registry writes.
- [x] Confirm the retired deployed bytecode matches the reviewed build artifact.
- [x] Confirm replacement deployed code exists and record the runtime hash.
- [x] Confirm the replacement deployed bytecode matches the reviewed build artifact exactly.
- [ ] Transfer `owner` from the deployment wallet to a production-controlled signer or multisig after deployment verification. Current owner `0xE4A...e1A1` is an EOA in the latest read-only check, not an on-chain multisig contract.
- [x] Verify that the original intended signer could call `recordScan` through confirmed Firewall and Deep Scan attestations.
- [x] Verify that the rotated signer can call `recordScan` through a confirmed Deep Scan attestation after replacement deployment.
- [x] Submit and independently verify a real deep-scan registry transaction from the first deployed application.
- [x] Submit and independently verify a real deep-scan registry transaction from the replacement deployed application.

## 2. Network and Environment Configuration

- [x] Set `NEXT_PUBLIC_NETWORK_ENV=mainnet` in the local mainnet environment.
- [ ] Set `NEXT_PUBLIC_NETWORK_ENV=mainnet` in the production deployment environment.
- [x] Set `MAINNET_NETWORK_NAME=X Layer Mainnet` in the local mainnet environment.
- [x] Set `MAINNET_CHAIN_ID=196` locally.
- [ ] Set `MAINNET_CHAIN_ID=196` in the production deployment environment.
- [x] Set `MAINNET_RPC_URL` locally to a dedicated X Layer Mainnet RPC endpoint accepted by `npm run validate:mainnet`.
- [x] Set `MAINNET_TREASURY_ADDRESS` locally to the rotated treasury address and verify its checksum format out of band.
- [x] Set `MAINNET_PAYMENT_TOKEN_SYMBOL=USDT0` locally.
- [x] Set `MAINNET_USDT_ADDRESS` locally to the canonical X Layer Mainnet USD0 contract address.
- [x] Set `MAINNET_PAYMENT_TOKEN_DECIMALS=6` locally and verify the value from the deployed ERC-20 contract.
- [x] Set `PAYMENT_MIN_CONFIRMATIONS=2` locally.
- [x] Test that facilitator settlement failures are rejected before scan processing.
- [x] Remove stale testnet/Vercel override values from the active local `.env.local` block.
- [ ] Keep testnet and development values in separate Vercel environments or secret stores. Do not share a treasury, signer, or payment token between environments.
- [x] Confirm that the active local mainnet variables do not point to `testrpc.xlayer.tech`, a testnet explorer, chain `1952`, or a test token.

**Implemented safeguard:** when `NEXT_PUBLIC_NETWORK_ENV=mainnet`, the registry address no longer falls back to the legacy testnet address. An explicit valid mainnet registry address is required before an attestation can be submitted.

## 3. Payments and x402-Style Settlement

- [x] Fund the rotated production agent payment wallet with an approved operating balance and native OKB for gas.
- [x] Confirm a real `0.5 USD0` firewall settlement was accepted exactly once, produced a scan, and could not be replayed against the first registry/treasury configuration.
- [x] Repeat the real `0.5 USD0` firewall settlement canary with the rotated treasury, rotated agent wallet, and replacement registry.
- [x] Confirm a real `1 USD0` deep-scan settlement completed only after the registry transaction was mined successfully against the first registry/treasury configuration.
- [x] Repeat the real `1 USD0` deep-scan settlement canary with the rotated treasury, rotated agent wallet, and replacement registry.
- [x] Confirm an incorrect token, wrong chain, failed settlement, wrong treasury, insufficient amount, malformed payment signature, and concurrent retry are all rejected or serialized correctly.
- [x] Confirm concurrent retries of the same `paymentId` yield one completed result rather than duplicate scans or duplicate charge acceptance in local web tests.
- [x] Confirm the payment record, compatibility settlement ledger, and revenue telemetry use the production Turso database.
- [x] Reconcile accepted treasury transfers against database payment records and define an operational reconciliation cadence.
- [x] Decide that OKX x402 facilitator settlement is the V1 production model and document the protocol envelope and interoperability expectations.
- [x] Define support and refund handling for transfers that reached the treasury but could not be associated with a valid payment intent.

## 4. Treasury and Key Management

- [x] Decide to keep the current EOA treasury/registry-owner model for this phase. Latest read-only chain check shows the rotated treasury address is an EOA, not a deployed smart-contract multisig.
- [ ] Move the registry writer away from a raw `PRIVATE_KEY` stored in the application environment to KMS-backed signing, managed custody, or a constrained relayer.
- [x] Rotate the locally configured treasury/deployer and agent-payment keys after exposure, and confirm the configured keys derive to the new public addresses without printing secrets.
- [ ] Complete a historical secret audit across Git history, shared logs, screenshots, deployment artifacts, and hosted environments before public launch.
- [ ] Store all deployment secrets in Vercel or an approved secret manager; never place them in `.env.example`, source code, client-side `NEXT_PUBLIC_*` variables, or Git history.
- [x] Separate the agent-payment wallet from the current treasury/deployer address.
- [ ] Separate deployer, registry-writer, and treasury roles. The rotated treasury and replacement registry deployer currently resolve to the same EOA.
- [x] Create an incident runbook for signer loss, suspected key exposure, erroneous registry writes, and treasury compromise.

## 5. Database, Vercel, and Operations

- [ ] Provision production Turso/libSQL and set both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the production environment.
- [ ] Apply all Drizzle migrations to the production database before deployment, including payment-intent completion and durable rate-limit tables.
- [ ] Run the application health endpoint against the production deployment and confirm payment-network and database readiness.
- [ ] Confirm Vercel uses Node.js-compatible route execution for `better-sqlite3`/libSQL dependencies and that the production deployment is using Turso rather than local SQLite.
- [ ] Add structured logs, error tracking, uptime checks, RPC availability monitoring, payment-verification failure alerts, and registry-write alerts. The code currently logs failures but does not provide a full production observability stack.
- [ ] Define database backup, retention, restore, and payment-reconciliation procedures.
- [ ] Load-test the scan, payment-intent, MCP, telemetry, and rate-limit paths against realistic concurrency before public launch.
- [ ] Confirm the fixed-window rate limit and upstream-provider quotas are appropriate for the expected traffic profile. Add a dedicated distributed rate-limit layer if database-backed limits become a bottleneck.

## 6. Data Providers and Threat Intelligence

- [ ] Replace public/default RPC endpoints used for supported-chain resolution with providers that have production SLAs, quotas, and monitoring.
- [ ] Provision and monitor production API access for DexScreener, GoPlus, and Ethplorer; document provider limits and failure behavior.
- [ ] Confirm each module's response is genuine on mainnet tokens and that unavailable modules remain excluded from the score while confidence is reduced.
- [ ] Do not describe LunarCrush as live until its provider integration and production credentials are active; the current social module is DexScreener-backed.
- [ ] Define cache duration, invalidation, provider-timeout, and degraded-mode policy for high-frequency agent traffic.
- [ ] Maintain a corpus of known honeypots, clean tokens, illiquid tokens, and ambiguous cross-chain addresses for regression testing.

## 7. SDK, MCP, and Frontend

- [ ] Publish the SDK under its intended package identity or keep the documented package name aligned with the registry name. The current workspace package is `okx-watchtower-middleware`; it is not yet published as `@okx-watchtower-middleware`.
- [ ] Run an installed-package integration test against the production API, not only a workspace build.
- [ ] Require agent SDK callers that enable automatic settlement to provide a production payment policy pinning API origin, chain `196`, token, treasury, and maximum amount.
- [ ] Confirm MCP and REST issue identical mainnet payment challenges and cannot bypass payment, validation, or replay protection.
- [ ] Test the browser Command Center free-scan and telemetry flow with the production X Layer Mainnet configuration.
- [ ] Confirm wallet network-add/switch metadata, explorer links, balance preflight, token decimals, and error states use the configured mainnet values.
- [ ] Confirm `/report/[scanHash]` and `/verify` show the mainnet explorer transaction and a real registry event after deployment.
- [ ] Replace any remaining release-facing references to testnet addresses, chain IDs, explorer URLs, or faucet instructions after the mainnet deployment has been verified.

## 8. Security Review and Release Validation

- [ ] Complete an independent smart-contract review focused on ownership transfer, registry event integrity, replay assumptions, and upgrade/operational controls.
- [ ] Complete an application security review for authorization, input validation, SSRF/provider request handling, rate limiting, secret handling, error disclosure, and dependency vulnerabilities.
- [ ] Run `npm run lint`, `npm run build`, `npm --prefix packages/watchtower-sdk run build`, `forge test -vv`, and `npm run test:payments` using production-like configuration.
- [ ] Run a complete mainnet canary: payment challenge, wallet/agent settlement, receipt verification, scan persistence, report creation, registry write, verifier page, and telemetry reconciliation.
- [ ] Test failure paths: RPC outage, provider timeout, database failure, registry revert, signer failure, payment confirmation timeout, malformed headers, and duplicate requests.
- [ ] Freeze reviewed contract and configuration versions, tag the release, and retain the deployment evidence.
- [ ] Obtain an explicit go/no-go sign-off from the product owner and security owner.

## Claiming Mainnet Status

After the required checks are complete, the product can accurately say:

> WatchTower is deployed on X Layer Mainnet. Agents can pay the configured ERC-20 token for threat intelligence, receive replay-protected scan results, and verify confirmed deep-scan attestations through the WatchTower registry.

Until then, use **mainnet-ready**, **mainnet-targeted**, or **configured for X Layer Mainnet**. These accurately describe the architecture without implying that a real-funds deployment has already been completed.
