require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const NETWORKS = require("./networks.json");

const withPrefix = (key) => (key && !key.startsWith("0x") ? `0x${key}` : key);
// Separate keys on purpose: the testnet key must never sign on mainnet by accident.
const TESTNET_KEY = withPrefix(process.env.PRIVATE_KEY || "");
const MAINNET_KEY = withPrefix(process.env.MAINNET_PRIVATE_KEY || "");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL || NETWORKS.arcTestnet.rpc,
      chainId: NETWORKS.arcTestnet.chainId,
      accounts: TESTNET_KEY ? [TESTNET_KEY] : [],
    },
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || NETWORKS.arcMainnet.rpc,
      chainId: NETWORKS.arcMainnet.chainId,
      accounts: MAINNET_KEY ? [MAINNET_KEY] : [],
    },
  },
  // Arc's explorers are Blockscout: `npx hardhat verify --network <arcTestnet|arcMainnet> <address>`
  etherscan: {
    apiKey: { arcTestnet: "blockscout", arcMainnet: "blockscout" },
    customChains: ["arcTestnet", "arcMainnet"].map((network) => ({
      network,
      chainId: NETWORKS[network].chainId,
      urls: { apiURL: `${NETWORKS[network].explorer}/api`, browserURL: NETWORKS[network].explorer },
    })),
  },
  sourcify: { enabled: false },
};
