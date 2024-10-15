// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Store {
    IERC20 public token;
    mapping(uint256 => uint256) public itemPrices;
    mapping(uint256 => uint256) public itemStock;
    mapping(address => uint256) public ticketsPurchased;

    event ItemPurchased(address buyer, uint256 itemId, uint256 price);
    event PurchaseAttempted(address buyer, uint256 itemId, uint256 price, uint256 buyerBalance);
    event TransferResult(bool success);
    event TicketPurchased(address buyer, uint256 newTotalTickets);

    constructor(address _tokenAddress) {
        token = IERC20(_tokenAddress);
        itemPrices[1] = 10 * 10**18;
        itemStock[1] = 1000;
    }

    function completePurchase(address buyer, uint256 itemId) external {
        uint256 price = itemPrices[itemId];
        uint256 buyerBalance = token.balanceOf(buyer);
        
        emit PurchaseAttempted(buyer, itemId, price, buyerBalance);
        require(itemStock[itemId] > 0, "Item out of stock");
        require(buyerBalance >= price, "Insufficient balance");
        
        uint256 allowance = token.allowance(buyer, address(this));
        require(allowance >= price, "Insufficient allowance");

        bool success = token.transferFrom(buyer, address(this), price);
        emit TransferResult(success);
        require(success, "Token transfer failed");

        itemStock[itemId]--;
        ticketsPurchased[buyer]++;

        emit ItemPurchased(buyer, itemId, price);
        emit TicketPurchased(buyer, ticketsPurchased[buyer]);
    }

    function getItemPrice(uint256 itemId) external view returns (uint256) {
        return itemPrices[itemId];
    }

    function getItemStock(uint256 itemId) external view returns (uint256) {
        return itemStock[itemId];
    }

    function getTicketCount(address user) external view returns (uint256) {
        return ticketsPurchased[user];
    }
}
