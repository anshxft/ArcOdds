// Shared by the Hardhat scripts: contract addresses per network, and a guard for real-money networks.
// networks.json keeps one field per contract version (v1 ArcOdds, v2 PredictArcV2, v3 PredictArcV3);
// the newest one present is "current" (new markets, owner actions), older ones are legacy.
const path = require("path");

const NETWORKS_FILE = path.join(__dirname, "..", "networks.json");
const CONTRACT_NAMES = { 1: "ArcOdds", 2: "PredictArcV2", 3: "PredictArcV3" };

const config = (name) => require(NETWORKS_FILE)[name] || {};

function currentVersion(name) {
  const c = config(name);
  return c.v3 ? 3 : c.v2 ? 2 : c.v1 ? 1 : null;
}

/** Address of `version` (default: current) on `name`; CONTRACT=0x... overrides. */
function contractFor(name, version = currentVersion(name)) {
  const address = process.env.CONTRACT || config(name)[`v${version}`];
  if (!version || !address) throw new Error(`No v${version ?? "?"} contract on ${name} yet: deploy it first (scripts/deploy.js) or set CONTRACT=0x...`);
  return { version, address, contractName: CONTRACT_NAMES[version] };
}

/** Mainnet moves real USDC: every write there needs CONFIRM_MAINNET=yes. */
function mainnetGuard(name) {
  if (name === "arcMainnet" && process.env.CONFIRM_MAINNET !== "yes") {
    throw new Error("This sends real-USDC transactions on Arc mainnet. Re-run with CONFIRM_MAINNET=yes if you mean it.");
  }
}

module.exports = { NETWORKS_FILE, CONTRACT_NAMES, currentVersion, contractFor, mainnetGuard };
