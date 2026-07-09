// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title WatchTowerRegistry
/// @notice On-chain attestation registry for WatchTower threat scan results.
/// @dev C1: Only the deployer (owner) can record scans, preventing spoofed attestations.
contract WatchTowerRegistry {
    struct ScanRecord {
        uint256 chainId;
        string scanHash;
        uint256 threatScore;
        uint256 timestamp;
    }

    address public owner;

    // Mapping from keccak256(chainId, tokenAddress) -> most recent ScanRecord
    mapping(bytes32 => ScanRecord) public latestScans;
    
    // Event emitted when a scan is recorded
    event ScanRecorded(uint256 indexed chainId, address indexed tokenAddress, string scanHash, uint256 threatScore, uint256 timestamp);
    
    // Event emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "WatchTowerRegistry: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordScan(uint256 _chainId, address _tokenAddress, string calldata _scanHash, uint256 _threatScore) external onlyOwner {
        bytes32 scanKey = keccak256(abi.encodePacked(_chainId, _tokenAddress));
        latestScans[scanKey] = ScanRecord({
            chainId: _chainId,
            scanHash: _scanHash,
            threatScore: _threatScore,
            timestamp: block.timestamp
        });

        emit ScanRecorded(_chainId, _tokenAddress, _scanHash, _threatScore, block.timestamp);
    }

    /// @notice Transfer ownership to a new address (e.g., multisig for production)
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "WatchTowerRegistry: new owner is the zero address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
