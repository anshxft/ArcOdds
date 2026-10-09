async function main() {
  // `hardhat run` does not forward CLI arguments, so the market and outcome come from env vars.
  const marketId = Number(process.env.MARKET);
  const outcomeArg = String(process.env.OUTCOME || "").toLowerCase();
  if (!Number.isInteger(marketId) || marketId < 1 || !["yes", "no"].includes(outcomeArg)) {
    throw new Error("Usage: MARKET=<id> OUTCOME=<yes|no> npm run resolve:arc");
  }

  const deployment = require("../deployment.json");
  const arcOdds = await ethers.getContractAt("ArcOdds", deployment.address);
  const tx = await arcOdds.resolveMarket(marketId, outcomeArg === "yes");
  await tx.wait();
  console.log(`Resolved market ${marketId} as ${outcomeArg.toUpperCase()}: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
