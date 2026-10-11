// Creates every market in markets-v2.js that is not on the network's current PredictArc contract yet (matched by
// question), skipping any that close within the hour. Safe to re-run.
//   npx hardhat run scripts/add-markets.js --network arcTestnet
//   CONFIRM_MAINNET=yes npx hardhat run scripts/add-markets.js --network arcMainnet
const { MARKETS_V2 } = require("./markets-v2");
const { contractFor, mainnetGuard } = require("./network");

async function main() {
  const name = hre.network.name;
  mainnetGuard(name);
  const { contractName, address } = contractFor(name);
  const contract = await ethers.getContractAt(contractName, address);
  const count = Number(await contract.marketCount());
  const existing = new Set();
  for (let id = 1; id <= count; id += 1) existing.add((await contract.getMarket(id)).question);

  const soonest = Date.now() / 1000 + 3600;
  const todo = MARKETS_V2.filter((market) => !existing.has(market.question));
  const live = todo.filter((market) => Date.parse(market.deadline) / 1000 > soonest);
  console.log(`${name} ${contractName} ${address}: ${count} on-chain, ${live.length} to create, ${todo.length - live.length} skipped (closed or closing within the hour)`);
  for (const market of live) {
    const deadline = Math.floor(Date.parse(market.deadline) / 1000);
    await (await contract.createMarket(market.question, market.category, market.rules, deadline)).wait();
    console.log(`Created: ${market.question}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
