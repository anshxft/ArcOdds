async function main() {
  const marketId = Number(process.argv[2]);
  const outcomeArg = String(process.argv[3] || "").toLowerCase();
  if (!Number.isInteger(marketId) || marketId < 1 || !["yes", "no"].includes(outcomeArg)) {
    throw new Error("Usage: npm run resolve:arc -- <marketId> <yes|no>");
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
