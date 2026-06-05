const fs = require("fs");
const path = require("path");
const { SEED_MARKETS } = require("./seed-markets");

async function main() {
  const ArcOdds = await ethers.getContractFactory("ArcOdds");
  const arcOdds = await ArcOdds.deploy();

  await arcOdds.waitForDeployment();
  const address = await arcOdds.getAddress();

  for (const [question, category, deadlineIso] of SEED_MARKETS) {
    const deadline = Math.floor(new Date(deadlineIso).getTime() / 1000);
    const tx = await arcOdds.createMarket(question, category, deadline);
    await tx.wait();
    console.log(`Created market: ${question}`);
  }

  const output = {
    contract: "ArcOdds",
    address,
    network: "arcTestnet",
    chainId: 5042002,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const contractPath = path.join(__dirname, "..", "contract.js");
  const contractSource = fs.readFileSync(contractPath, "utf8");
  fs.writeFileSync(
    contractPath,
    contractSource.replace(/const CONTRACT_ADDRESS = ".*?";/, `const CONTRACT_ADDRESS = "${address}";`)
  );

  console.log(`ArcOdds deployed to ${address}`);
  console.log(`Created ${SEED_MARKETS.length} markets and updated contract.js`);
  console.log(`Saved deployment details to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
