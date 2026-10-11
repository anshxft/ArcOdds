// Resolve or cancel a market as the owner.
//   MARKET=3 OUTCOME=yes npm run resolve:arc              (v1, ArcOdds, testnet only)
//   VERSION=2 MARKET=3 OUTCOME=no npm run resolve:arc     (v2, PredictArcV2)
//   VERSION=2 MARKET=3 CANCEL="reason" npm run resolve:arc (v2 only: void + refunds)
//   Mainnet: CONFIRM_MAINNET=yes VERSION=2 MARKET=3 OUTCOME=no npm run resolve:mainnet
// `hardhat run` does not forward CLI arguments, so everything comes from env vars.
const { v2Address, mainnetGuard, NETWORKS_FILE } = require("./network");

async function main() {
  const v2 = process.env.VERSION === "2";
  const marketId = Number(process.env.MARKET);
  const outcomeArg = String(process.env.OUTCOME || "").toLowerCase();
  const cancelReason = process.env.CANCEL;
  if (!Number.isInteger(marketId) || marketId < 1 || (!cancelReason && !["yes", "no"].includes(outcomeArg))) {
    throw new Error("Usage: [VERSION=2] MARKET=<id> OUTCOME=<yes|no> npm run resolve:arc   or   VERSION=2 MARKET=<id> CANCEL=<reason>");
  }
  if (cancelReason && !v2) throw new Error("Cancelling needs the v2 contract (VERSION=2)");

  const name = hre.network.name;
  mainnetGuard(name);
  const address = v2 ? v2Address(name) : require(NETWORKS_FILE)[name]?.v1;
  if (!address) throw new Error(`No ${v2 ? "v2" : "v1"} contract on ${name}`);
  const contract = await ethers.getContractAt(v2 ? "PredictArcV2" : "ArcOdds", address);
  const tx = cancelReason ? await contract.cancelMarket(marketId, cancelReason) : await contract.resolveMarket(marketId, outcomeArg === "yes");
  await tx.wait();
  console.log(`${v2 ? "v2" : "v1"} market ${marketId} ${cancelReason ? `cancelled (${cancelReason})` : `resolved as ${outcomeArg.toUpperCase()}`}: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
