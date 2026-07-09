// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/WatchTowerRegistry.sol";

contract WatchTowerRegistryTest is Test {
    WatchTowerRegistry registry;
    address token = address(0x1111111111111111111111111111111111111111);

    event ScanRecorded(uint256 indexed chainId, address indexed tokenAddress, string scanHash, uint256 threatScore, uint256 timestamp);

    function setUp() public {
        registry = new WatchTowerRegistry();
    }

    function testRecordScanEmitsEventAndStoresLatestScan() public {
        string memory scanHash = "scan-hash";

        vm.expectEmit(true, false, false, true);
        emit ScanRecorded(196, token, scanHash, 87, block.timestamp);
        registry.recordScan(196, token, scanHash, 87);

        bytes32 scanKey = keccak256(abi.encodePacked(uint256(196), token));
        (uint256 chainId, string memory storedHash, uint256 threatScore, uint256 timestamp) = registry.latestScans(scanKey);
        assertEq(chainId, 196);
        assertEq(storedHash, scanHash);
        assertEq(threatScore, 87);
        assertEq(timestamp, block.timestamp);
    }

    function testOnlyOwnerCanRecordScan() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("WatchTowerRegistry: caller is not the owner");
        registry.recordScan(196, token, "scan-hash", 1);
    }
}
