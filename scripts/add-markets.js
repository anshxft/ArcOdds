// Creates every market in markets-v2.js that is not on the deployed PredictArcV2 yet (matched by question).
// Safe to re-run.  Usage: npx hardhat run scripts/add-markets.js --network arcTestnet
const { MARKETS_V2 } = require("./markets-v2");
const ADDRESS = "0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796";

async function main() {
  const contract = await ethers.getContractAt("PredictArcV2", ADDRESS);
  const count = Number(await contract.marketCount());
  const existing = new Set();
  for (let id = 1; id <= count; id += 1) existing.add((await contract.getMarket(id)).question);

  const todo = MARKETS_V2.filter((market) => !existing.has(market.question));
  console.log(`${count} on-chain, ${todo.length} to create`);
  for (const market of todo) {
    const deadline = Math.floor(Date.parse(market.deadline) / 1000);
    if (deadline <= Date.now() / 1000) throw new Error(`Deadline already passed: ${market.question}`);
    await (await contract.createMarket(market.question, market.category, market.rules, deadline)).wait();
    console.log(`Created: ${market.question}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
