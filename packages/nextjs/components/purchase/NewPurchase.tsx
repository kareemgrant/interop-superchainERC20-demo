/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useEffect, useState } from "react";
import { Menu } from "@headlessui/react";
import { ethers } from "ethers";
import { BrowserProvider, formatEther, parseEther } from "ethers";
import ReactConfetti from "react-confetti";
import { MoonLoader } from "react-spinners";
import { useAccount, useNetwork } from "wagmi";
import { InformationCircleIcon, LinkIcon, TicketIcon } from "@heroicons/react/24/outline"

// Define the local chain configuration for ChainID 901
const localChain901 = {
  id: 901,
  name: "OPChainA",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:9545"] } },
  blockExplorers: { default: { name: "Local Explorer A", url: "http://127.0.0.1:9545" } },
  testnet: true,
};

// Define the local chain configuration for ChainID 902
const localChain902 = {
  id: 902,
  name: "OPChainB",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:9546"] } },
  blockExplorers: { default: { name: "Local Explorer B", url: "http://127.0.0.1:9546" } },
  testnet: true,
};

const L2NativeSuperchainERC20Address = "0x420beeF000000000000000000000000000000001";
const StoreContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const SuperchainERC20BridgeAddress = "0x4200000000000000000000000000000000000028";
const ITEM_PRICE = parseEther("10");

const erc20ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function sendERC20(address _to, uint256 _amount, uint256 _chainId) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const superchainBridgeABI = ["function sendERC20(address _token, address _to, uint256 _amount, uint256 _chainId)"];

const storeABI = [
  "function completePurchase(address buyer, uint256 itemId) external",
  "function getItemPrice(uint256 itemId) external view returns (uint256)",
  "function getItemStock(uint256 itemId) external view returns (uint256)",
  "function getTicketCount(address user) external view returns (uint256)",
  "event ItemPurchased(address buyer, uint256 itemId, uint256 price)",
  "event PurchaseAttempted(address buyer, uint256 itemId, uint256 price, uint256 buyerBalance)",
  "event TransferResult(bool success)",
  "event TicketPurchased(address buyer, uint256 newTotalTickets)",
];

export const NewPurchase = () => {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const [balanceChain901, setBalanceChain901] = useState<string>("Loading...");
  const [balanceChain902, setBalanceChain902] = useState<string>("Loading...");
  const [tokenSymbol, setTokenSymbol] = useState<string>("Loading...");
  const [showBalanceSelector, setShowBalanceSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showInsufficientFundsWarning, setShowInsufficientFundsWarning] = useState(false);
  const [purchasedTickets, setPurchasedTickets] = useState(0);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [transactionHash, setTransactionHash] = useState("");

  useEffect(() => {
    fetchBalances();
    if (address) {
      fetchTicketCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const fetchBalances = async () => {
    if (address) {
      try {
        const tokenContract901 = new ethers.Contract(
          L2NativeSuperchainERC20Address,
          erc20ABI,
          new ethers.JsonRpcProvider(localChain901.rpcUrls.default.http[0]),
        );
        const tokenContract902 = new ethers.Contract(
          L2NativeSuperchainERC20Address,
          erc20ABI,
          new ethers.JsonRpcProvider(localChain902.rpcUrls.default.http[0]),
        );

        const [balance901, balance902, symbol] = await Promise.all([
          tokenContract901.balanceOf(address),
          tokenContract902.balanceOf(address),
          tokenContract901.symbol(),
        ]);

        setBalanceChain901(formatEther(balance901));
        setBalanceChain902(formatEther(balance902));
        setTokenSymbol(symbol);
      } catch (error) {
        console.error("Error fetching balances: ", error);
        setBalanceChain901("Error");
        setBalanceChain902("Error");
      }
    }
  };

  const fetchTicketCount = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(localChain902.rpcUrls.default.http[0]);
      console.log(provider);

      const storeContract = new ethers.Contract(StoreContractAddress, storeABI, provider);
      console.log(storeContract)

      const count = await storeContract.getTicketCount(address);
      console.log(address)

      console.log("ticket count");
      console.log(count);
      setPurchasedTickets(Number(count));
    } catch (error) {
      console.error("Error fetching ticket count:", error);
    }
  };

  const handlePurchase = async (sourceChain: number) => {
    setIsLoading(true);
    setTransactionStatus("Processing purchase...");
    try {
      if (sourceChain === 901) {
        await handleCrossChainPurchase();
      } else {
        await handleSameChainPurchase();
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 7000);
      await fetchTicketCount();
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSameChainPurchase = async () => {
    try {
      const provider902 = new BrowserProvider(window.ethereum);
      const signer902 = await provider902.getSigner();

      // Create a token contract instance for chain 902 with the signer
      const tokenContract902 = new ethers.Contract(L2NativeSuperchainERC20Address, erc20ABI, signer902);
      console.log("Token contract address on Chain 902:", L2NativeSuperchainERC20Address);

      setTransactionStatus("Requesting approval");
      // Step 2: Approve the store contract to transfer tokens on Chain 902
      const approveTx = await tokenContract902.approve(StoreContractAddress, ITEM_PRICE);
      await approveTx.wait();
      console.log("Approval successful");

      // Step 3: Complete the purchase on Chain 902
      console.log("Completing purchase on Chain 902...");
      setTransactionStatus("Completing purchase");
      const storeContract = new ethers.Contract(StoreContractAddress, storeABI, signer902);
      console.log("Store contract address:", StoreContractAddress);

      // Attempt to complete purchase
      const purchaseTx = await storeContract.completePurchase(address, 1, {
        gasLimit: 500000,
      });
      console.log("Purchase transaction sent", purchaseTx.hash);

      // Wait for the transaction and get the receipt
      const receipt = await purchaseTx.wait();

      setTransactionHash(purchaseTx.hash);
      console.log("Purchase transaction receipt", receipt);
      console.log(receipt.logs);

      // Check if the transaction was successful
      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      console.log("Purchase completed successfully");
      await fetchBalances();
      setShowBalanceSelector(false);
    } catch (error) {
      console.error("Same-chain purchase failed:", error);
    }
  };

  const handleCrossChainPurchase = async () => {
    try {
      // Step 1: User on Chain 902 requests tokens from Chain 901 by calling sendERC20 on L2NativeSuperchain token
      const provider901 = new ethers.JsonRpcProvider(localChain901.rpcUrls.default.http[0]);
      const signer901 = await provider901.getSigner(address);

      const superchainBridgeContract901 = new ethers.Contract(
        SuperchainERC20BridgeAddress,
        superchainBridgeABI,
        signer901,
      );

      console.log("Initiating cross-chain sendERC20 on Chain 901...");
      setTransactionStatus(
        `Initiating cross-chain transaction to transfer ${ethers.formatEther(ITEM_PRICE)} Mock from OPChainA`,
      );
      const tx = await superchainBridgeContract901.sendERC20(
        L2NativeSuperchainERC20Address,
        address,
        ITEM_PRICE,
        localChain902.id,
      );

      console.log("Transaction sent, waiting for confirmation...");
      const txReceipt = await tx.wait();

      console.log("sendERC20 transaction confirmed: ", txReceipt.transactionHash);
      console.log("Tokens received on Chain 902. Proceeding with purchase...");
      setTransactionStatus("Tokens received on OPChainB. Proceeding with purchase..");

      // Step 2: Approve the store contract to transfer tokens on Chain 902
      console.log("Approving Store contract to transfer tokens on Chain 902...");
      const provider902 = new BrowserProvider(window.ethereum);
      const signer902 = await provider902.getSigner();

      // Create a token contract instance for chain 902 with the signer
      const tokenContract902 = new ethers.Contract(L2NativeSuperchainERC20Address, erc20ABI, signer902);
      console.log("Token contract address on Chain 902:", L2NativeSuperchainERC20Address);

      // Request approval
      setTransactionStatus("Requesting approval");
      const approveTx = await tokenContract902.approve(StoreContractAddress, ITEM_PRICE);
      await approveTx.wait();
      console.log("Approval successful");

      // Step 3: Complete the purchase on Chain 902
      console.log("Completing purchase on Chain 902...");
      setTransactionStatus("Completing purchase");
      const storeContract = new ethers.Contract(StoreContractAddress, storeABI, signer902);
      console.log("Store contract address:", StoreContractAddress);

      // Attempt to complete purchase
      const purchaseTx = await storeContract.completePurchase(address, 1, {
        gasLimit: 500000,
      });
      console.log("Purchase transaction sent", purchaseTx.hash);

      // Wait for the transaction and get the receipt
      const receipt = await purchaseTx.wait();

      setTransactionHash(purchaseTx.hash);
      console.log("Purchase transaction receipt", receipt);
      console.log(receipt.logs);

      // Check if the transaction was successful
      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      await fetchBalances();
      setShowBalanceSelector(false);
    } catch (error) {
      console.error("Purchase failed:", error);

      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      if (error.transaction) {
        console.error("Transaction hash:", error.transaction.hash);
        try {
          const receipt = await provider902.getTransactionReceipt(error.transaction.hash);
          console.error("Transaction receipt:", receipt);
        } catch (e) {
          console.error("Failed to fetch transaction receipt:", e);
        }
      }

      if (error.error && error.error.data) {
        const errorData = error.error.data;
        const decodedError = ethers.toUtf8String(errorData);
        console.error("Decoded error:", decodedError);
      }
    }
  };

  const handleBuyTicketClick = () => {
    setShowBalanceSelector(true);
    setShowInsufficientFundsWarning(parseFloat(balanceChain901) < 10 && parseFloat(balanceChain902) < 10);
  };

  if (!address || !chain) {
    return <div>Loading...</div>;
  }

  const totalBalance = parseFloat(balanceChain901) + parseFloat(balanceChain902);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 py-12 p-4">
      {showConfetti && <ReactConfetti />}
      <h1 className="text-4xl font-bold text-center mb-8">Interop Demo - Cross Chain Purchase Example</h1>
      <div className="flex justify-center w-full max-w-6xl mx-auto space-x-6">
        {/* Left card for user information */}
        <div className="w-1/3 bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">User Information</h2>
          <dl className="space-y-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">Connected Address</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900 break-all">{address}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Current Chain</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900">{chain?.name}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Unified {tokenSymbol} Balance</dt>
              <dd className="mt-1 text-base font-semibold text-gray-900 flex items-center">
                {totalBalance.toFixed(2)} {tokenSymbol}
                <Menu as="div" className="relative inline-block text-left ml-2">
                  <div>
                    <Menu.Button className="flex items-center rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100">
                      <span className="sr-only">View balance breakdown</span>
                      <InformationCircleIcon className="h-5 w-5" aria-hidden="true" />
                    </Menu.Button>
                  </div>
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                      <Menu.Item>
                        <div className="px-4 py-2 text-sm text-gray-700">
                          <p>
                            OPChainA:{" "}
                            <span className="font-medium">
                              {balanceChain901} {tokenSymbol}
                            </span>
                          </p>
                          <p className="mt-1">
                            OPChainB:{" "}
                            <span className="font-medium">
                              {balanceChain902} {tokenSymbol}
                            </span>
                          </p>
                        </div>
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Menu>
              </dd>
            </div>
          </dl>
        </div>

        {/* Main card for purchase functionality */}
        <div className="w-2/3 bg-white shadow-lg rounded-lg p-6">

          <div className="mb-6 bg-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">OPalooza</h3>
            <p className="text-sm text-gray-600 mb-2">
              OPalooza is the ultimate celebration of the OP Collective, the most vibrant and collaborative community in
              Web3. This electrifying event combines cutting-edge tech talks with an unforgettable party atmosphere.
              Join fellow optimists for a night of networking, music, and optimistic vibes that only the OP Collective
              can deliver. Don't miss this chance to connect, collaborate, and celebrate the future of Web3 in true
              Optimism style!
            </p>
            <p className="text-lg font-bold">Cost: 10 MOCK</p>
          </div>

          {showInsufficientFundsWarning && (
            <div className="mb-6 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
              <p className="font-bold">Insufficient funds</p>
              <p>You don't have enough MOCK tokens on either chain to purchase the ticket.</p>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Purchase Ticket</h3>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center mb-4">
                  <div className="w-12 mr-4">
                    <MoonLoader color="#3B82F6" size={40} />
                  </div>
                  <div className="w-64">
                    <p className="text-sm font-medium text-gray-700">{transactionStatus}</p>
                  </div>
                </div>
              </div>
            ) : !showBalanceSelector ? (
              <button
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-150 ease-in-out"
                onClick={handleBuyTicketClick}
              >
                Buy Ticket
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  className={`w-full py-2 px-4 rounded-lg transition duration-150 ease-in-out flex justify-between items-center
                    ${
                      parseFloat(balanceChain901) >= 10
                        ? "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  onClick={() => parseFloat(balanceChain901) >= 10 && handlePurchase(901)}
                  disabled={parseFloat(balanceChain901) < 10}
                >
                  <span>Pay with balance on OPChainA</span>
                  <span>
                    {balanceChain901} {tokenSymbol}
                  </span>
                </button>
                <button
                  className={`w-full py-2 px-4 rounded-lg transition duration-150 ease-in-out flex justify-between items-center
                    ${
                      parseFloat(balanceChain902) >= 10
                        ? "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  onClick={() => parseFloat(balanceChain902) >= 10 && handlePurchase(902)}
                  disabled={parseFloat(balanceChain902) < 10}
                >
                  <span>Pay with balance on OPChainB</span>
                  <span>
                    {balanceChain902} {tokenSymbol}
                  </span>
                </button>
                <button
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition duration-150 ease-in-out"
                  onClick={() => {
                    setShowBalanceSelector(false);
                    setShowInsufficientFundsWarning(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {showConfetti && (
            <div className="mt-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
              <p className="font-bold">Purchase Successful!</p>
              <p>Congratulations! You've successfully purchased a ticket to OPalooza.</p>
              {transactionHash && (
                <p className="mt-2">
                  Transaction Hash:{" "}
                  <a
                    href={`https://etherscan.io/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 underline inline-flex items-center"
                  >
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    <LinkIcon className="h-4 w-4 ml-1" />
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {/* New right card for purchased tickets */}
        <div className="w-1/4 bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">Your Tickets</h2>
          <div className="flex flex-col items-center">
            <p className="text-lg font-medium text-gray-900 mb-2">OPalooza</p>
            <div className="flex items-center">
              <TicketIcon className="h-8 w-8 text-indigo-500 mr-3" />
              <p className="text-2xl font-bold text-gray-900">{purchasedTickets}</p>
            </div>
          </div>
          {purchasedTickets > 0 && (
            <p className="mt-4 text-sm text-gray-600">You're all set for OPalooza! We can't wait to see you there.</p>
          )}
          {purchasedTickets === 0 && (
            <p className="mt-4 text-sm text-gray-600">No tickets yet. Purchase now to join the excitement!</p>
          )}
        </div>
      </div>
    </div>
  );
};
