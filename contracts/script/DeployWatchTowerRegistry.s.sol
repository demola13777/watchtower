// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/WatchTowerRegistry.sol";

contract DeployWatchTowerRegistry is Script {
    function run() external returns (WatchTowerRegistry registry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        registry = new WatchTowerRegistry();
        vm.stopBroadcast();
    }
}
