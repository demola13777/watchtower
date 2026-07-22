# Mainnet Payment Operations

## Production Model

WatchTower uses standard x402 challenges with the OKX facilitator as the V1 production model. The API creates a request-bound challenge, accepts a signed `PAYMENT-SIGNATURE`, asks the facilitator to verify and settle on-chain, and records the settled payment before Firewall or Authorization work proceeds.

`PaymentService` remains the replacement boundary if WatchTower changes facilitator providers or adds another x402 scheme later. REST routes, MCP tools, telemetry, and report generation should continue to consume receipts from that boundary rather than implementing payment logic directly.

## Daily Reconciliation

Run the following against the production environment at least once each business day and after any payment-related incident:

```bash
npm run validate:mainnet
npm run reconcile:payments
```

`reconcile:payments` reads settled, processing, and completed Mainnet payments from Turso and independently checks the facilitator transaction recorded for each settlement. It is read-only and exits non-zero on any discrepancy.

## Flow Inspection

Use the read-only inspector when a treasury transfer, dashboard scan, or agent response looks inconsistent:

```bash
npm run inspect:payments -- --limit 20
npm run inspect:payments -- --tx 0x...
npm run inspect:payments -- --request-hash ...
npm run inspect:payments -- --payer 0x...
```

Interpretation:

- `pending` with no `payer` and no `settlement_tx_hash` is only a 402 challenge. It is not a treasury payment.
- `settled` means the facilitator accepted and settled payment, but scan work has not completed yet.
- `processing` means a worker/request is currently trying to produce the paid result.
- `completed` means the paid response payload was persisted and safe retries can return it.
- Matching `scans` rows confirm that the threat engine persisted the Firewall result, Authorization report, or compatibility report.

If a paid service fails after settlement, the payment should move back from `processing` to `settled` with a failure reason. It should not be marked `completed` until the service response has been delivered and persisted.

## Customer Payment Handling

1. Do not manually credit a payment from a transaction hash alone. A paid request must have a settled or completed row in `payments`.
2. A transfer that reaches the treasury but cannot be associated with a valid x402 payment record is not automatically credited.
3. Support must first reconcile the transaction with `npm run reconcile:payments`, then confirm payer, token, amount, destination, request hash, and response status.
4. Approved refunds are sent manually from the treasury or multisig after a second operator verifies the recipient and amount. Record the original payment ID, refund transaction hash, approvers, and reason.
5. Never request a private key, seed phrase, or wallet-connect signature from a customer as part of payment support.

## Attestations

`RECORD_FIREWALL_SCANS=false` is the Mainnet-safe default. Authorization returns after the Execution Permit verifies locally; X Layer attestation runs as non-blocking audit work when a permit is issued. Enable Firewall attestations only after the registry signer, gas budget, and throughput limits have been explicitly approved:

```bash
RECORD_FIREWALL_SCANS=true
```

## Escalation

Immediately pause paid routes if reconciliation detects a mismatch, facilitator verification starts failing unexpectedly, the configured treasury changes unexpectedly, or one settlement transaction appears associated with more than one request.
