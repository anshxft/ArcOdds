// Shared by the Hardhat scripts: contract addresses per network, and a guard for real-money networks.
const path = require("path");

const NETWORKS_FILE = path.join(__dirname, "..", "networks.json");

function v2Address(name) {
  const address = process.env.CONTRACT || require(NETWORKS_FILE)[name]?.v2;
  if (!address) throw new Error(`No PredictArcV2 on ${name} yet: deploy it first (scripts/deploy-v2.js) or set CONTRACT=0x...`);
  return address;
}

/** Mainnet moves real USDC: every write there needs CONFIRM_MAINNET=yes. */
function mainnetGuard(name) {
  if (name === "arcMainnet" && process.env.CONFIRM_MAINNET !== "yes") {
    throw new Error("This sends real-USDC transactions on Arc mainnet. Re-run with CONFIRM_MAINNET=yes if you mean it.");
  }
}

module.exports = { NETWORKS_FILE, v2Address, mainnetGuard };
