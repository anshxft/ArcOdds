// Resolve or cancel a market as the owner.
//   MARKET=3 OUTCOME=yes npm run resolve:arc              (v1, ArcOdds)
//   VERSION=2 MARKET=3 OUTCOME=no npm run resolve:arc     (v2, PredictArcV2)
//   VERSION=2 MARKET=3 CANCEL="reason" npm run resolve:arc (v2 only: void + refunds)
// `hardhat run` does not forward CLI arguments, so everything comes from env vars.
async function main() {
  const v2 = process.env.VERSION === "2";
  const marketId = Number(process.env.MARKET);
  const outcomeArg = String(process.env.OUTCOME || "").toLowerCase();
  const cancelReason = process.env.CANCEL;
  if (!Number.isInteger(marketId) || marketId < 1 || (!cancelReason && !["yes", "no"].includes(outcomeArg))) {
    throw new Error("Usage: [VERSION=2] MARKET=<id> OUTCOME=<yes|no> npm run resolve:arc   or   VERSION=2 MARKET=<id> CANCEL=<reason>");
  }
  if (cancelReason && !v2) throw new Error("Cancelling needs the v2 contract (VERSION=2)");

  const deployment = require(v2 ? "../deployment-v2.json" : "../deployment.json");
  const contract = await ethers.getContractAt(v2 ? "PredictArcV2" : "ArcOdds", deployment.address);
  const tx = cancelReason ? await contract.cancelMarket(marketId, cancelReason) : await contract.resolveMarket(marketId, outcomeArg === "yes");
  await tx.wait();
  console.log(`${v2 ? "v2" : "v1"} market ${marketId} ${cancelReason ? `cancelled (${cancelReason})` : `resolved as ${outcomeArg.toUpperCase()}`}: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
