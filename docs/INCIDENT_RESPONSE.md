# WatchTower Mainnet Incident Response

## Severity One: Suspected Key Exposure

1. Disable paid Firewall and Authorization routes at the deployment layer.
2. Remove the affected signing secret from the deployment environment.
3. Revoke or rotate the affected API, RPC, database, and wallet credentials.
4. If the registry owner or treasury is affected, move authority and funds using the approved multisig recovery process.
5. Reconcile all payments and registry writes from the suspected exposure window.
6. Preserve transaction hashes, deployment logs, and timestamps for the incident record.
7. Resume traffic only after two operators review the replacement configuration.

## Incorrect Registry Write

1. Pause the registry signer; do not attempt to overwrite evidence silently.
2. Record the erroneous transaction hash, report hash or permit hash, chain ID, token, and cause.
3. Issue a corrected Authorization report and attestation when appropriate, retaining the original record as an immutable audit artifact.
4. Notify affected integrators if an incorrect verdict was returned.

## Payment Discrepancy

1. Pause the affected payment route if replay, treasury, or token verification is suspect.
2. Run `npm run reconcile:payments`.
3. Compare database payment record, facilitator settlement transaction, compatibility settlement ledger, and treasury balance.
4. Use the refund process in `PAYMENT_OPERATIONS.md` only after two-person review.

## Availability Failure

1. Check the health route, Turso status, configured RPC health, and upstream provider status.
2. Keep the API fail-closed: unavailable payment or attestation infrastructure must not return a paid success.
3. Communicate a clear degraded status to integrators and resume only after post-recovery reconciliation.
