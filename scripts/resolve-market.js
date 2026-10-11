// Resolve or cancel a market as the owner, on the current contract unless VERSION says otherwise.
//   MARKET=3 OUTCOME=yes npm run resolve:arc               (testnet, current contract)
//   VERSION=1 MARKET=3 OUTCOME=no npm run resolve:arc      (legacy ArcOdds on testnet)
//   MARKET=3 CANCEL="reason" npm run resolve:arc           (void + refunds; v2 and later)
//   Mainnet: CONFIRM_MAINNET=yes MARKET=3 OUTCOME=no npm run resolve:mainnet
// `hardhat run` does not forward CLI arguments, so everything comes from env vars.
const { contractFor, currentVersion, mainnetGuard } = require("./network");

async function main() {
  const name = hre.network.name;
  const version = process.env.VERSION ? Number(process.env.VERSION) : currentVersion(name);
  const marketId = Number(process.env.MARKET);
  const outcomeArg = String(process.env.OUTCOME || "").toLowerCase();
  const cancelReason = process.env.CANCEL;
  if (!Number.isInteger(marketId) || marketId < 1 || (!cancelReason && !["yes", "no"].includes(outcomeArg))) {
    throw new Error("Usage: [VERSION=1|2|3] MARKET=<id> OUTCOME=<yes|no>   or   MARKET=<id> CANCEL=<reason>");
  }
  if (cancelReason && version < 2) throw new Error("Cancelling needs v2 or later");

  mainnetGuard(name);
  const { contractName, address } = contractFor(name, version);
  const contract = await ethers.getContractAt(contractName, address);
  const tx = cancelReason ? await contract.cancelMarket(marketId, cancelReason) : await contract.resolveMarket(marketId, outcomeArg === "yes");
  await tx.wait();
  console.log(`${name} v${version} market ${marketId} ${cancelReason ? `cancelled (${cancelReason})` : `resolved as ${outcomeArg.toUpperCase()}`}: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
