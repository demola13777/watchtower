# Mainnet Payment Operations

## Production Model

WatchTower uses the self-hosted `evm-erc20-transfer` payment verifier as the V1 production model. The API creates a request-bound payment intent, verifies the mined ERC-20 transfer against the configured X Layer Mainnet RPC, and records the transaction hash as one-time-use before the scan proceeds.

This is intentionally not a hosted facilitator dependency. `PaymentService` remains the replacement boundary if WatchTower adopts a standards-compatible facilitator or signed payment envelope later.

## Daily Reconciliation

Run the following against the production environment at least once each business day and after any payment-related incident:

```bash
npm run validate:mainnet
npm run reconcile:payments
```

`reconcile:payments` reads completed Mainnet payments from Turso and independently confirms a successful configured-token transfer to the configured treasury. It is read-only and exits non-zero on any discrepancy.

## Customer Payment Handling

1. Do not accept a transaction hash as payment unless it is paired with the original payment intent ID and request body.
2. A transfer that reaches the treasury but cannot be associated with a valid, unexpired intent is not automatically credited.
3. Support must first reconcile the transaction with `npm run reconcile:payments`, then confirm payer, token, amount, destination, and request metadata.
4. Approved refunds are sent manually from the treasury or multisig after a second operator verifies the recipient and amount. Record the original payment ID, refund transaction hash, approvers, and reason.
5. Never request a private key, seed phrase, or wallet-connect signature from a customer as part of payment support.

## Firewall Attestations

`RECORD_FIREWALL_SCANS=false` is the Mainnet-safe default. Deep Scans remain attested. Enable Firewall attestations only after the registry signer, gas budget, and throughput limits have been explicitly approved:

```bash
RECORD_FIREWALL_SCANS=true
```

## Escalation

Immediately pause paid routes if reconciliation detects a mismatch, the configured treasury changes unexpectedly, confirmation checks fail, or a used transaction hash appears associated with more than one request.
