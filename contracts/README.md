# WatchTower Contracts

Foundry workspace for the WatchTower on-chain attestation registry.

## Contract

`src/WatchTowerRegistry.sol` records chain-aware scan attestations emitted by the WatchTower engine.

Current event:

```solidity
event ScanRecorded(
    uint256 indexed chainId,
    address indexed tokenAddress,
    string scanHash,
    uint256 threatScore,
    uint256 timestamp
);
```

The registry stores the latest scan for `(chainId, tokenAddress)` under:

```solidity
keccak256(abi.encodePacked(chainId, tokenAddress))
```

Only the owner can record scans.

## Test

```bash
forge test
```

## Deploy

```bash
forge script script/DeployWatchTowerRegistry.s.sol:DeployWatchTowerRegistry \
  --rpc-url $TESTNET_RPC_URL \
  --broadcast \
  --slow
```

The deploy script reads `PRIVATE_KEY` from the environment.
