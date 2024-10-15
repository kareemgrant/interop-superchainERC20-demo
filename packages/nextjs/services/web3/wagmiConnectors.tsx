import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { Chain, configureChains } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import scaffoldConfig from "~~/scaffold.config";
import { burnerWalletConfig } from "~~/services/web3/wagmi-burner/burnerWalletConfig";
import { getTargetNetworks } from "~~/utils/scaffold-eth";

// Define the local chain configuration for ChainID 901
export const localChain901: Chain = {
  id: 901,
  name: "OPChainA",
  network: "opchainA",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:9545"],
    },
    public: {
      http: ["http://127.0.0.1:9545"],
    },
  },
  blockExplorers: {
    default: { name: "Local Explorer A", url: "http://127.0.0.1:9545" },
  },
  testnet: true,
};

// Update localChain902 to align properly for use in your testnet
export const localChain902: Chain = {
  id: 902,
  name: "OPChainB",
  network: "opchainB",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:9546"],
    },
    public: {
      http: ["http://127.0.0.1:9546"],
    },
  },
  blockExplorers: {
    default: { name: "Local Explorer B", url: "http://127.0.0.1:9546" },
  },
  testnet: true,
};

// Make sure we only have relevant target networks
const targetNetworks = [...getTargetNetworks(), localChain901, localChain902];
const { onlyLocalBurnerWallet } = scaffoldConfig;

// Updated chains for the app focusing on only testnets and local environments
export const appChains = configureChains(
  targetNetworks,
  [
    publicProvider(),
  ],
  {
    stallTimeout: 3_000,
    ...(targetNetworks.find(network => network.id !== 31337)
      ? {
          pollingInterval: scaffoldConfig.pollingInterval,
        }
      : {}),
  },
);

const walletsOptions = { chains: appChains.chains, projectId: scaffoldConfig.walletConnectProjectId };
const wallets = [
  metaMaskWallet({ ...walletsOptions, shimDisconnect: true }),
  walletConnectWallet(walletsOptions),
  ledgerWallet(walletsOptions),
  braveWallet(walletsOptions),
  coinbaseWallet({ ...walletsOptions, appName: "scaffold-eth-2" }),
  rainbowWallet(walletsOptions),
  ...(!targetNetworks.some(network => network.id !== 31337) || !onlyLocalBurnerWallet
    ? [
        burnerWalletConfig({
          chains: appChains.chains.filter(chain => targetNetworks.map(({ id }) => id).includes(chain.id)),
        }),
      ]
    : []),
  safeWallet({ ...walletsOptions }),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = connectorsForWallets([
  {
    groupName: "Supported Wallets",
    wallets,
  },
]);
