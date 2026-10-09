// Deploys PredictArcV2, seeds MARKETS_V2, and writes deployment-v2.json.
const fs = require("fs");
const path = require("path");
const { MARKETS_V2 } = require("./markets-v2");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer ${deployer.address}, balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} USDC`);

  const contract = await (await ethers.getContractFactory("PredictArcV2")).deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`PredictArcV2 deployed to ${address}`);

  for (const market of MARKETS_V2) {
    const deadline = Math.floor(Date.parse(market.deadline) / 1000);
    const tx = await contract.createMarket(market.question, market.category, market.rules, deadline);
    await tx.wait();
    console.log(`Created: ${market.question}`);
  }

  const output = {
    contract: "PredictArcV2",
    address,
    network: "arcTestnet",
    chainId: 5042002,
    deployBlock: (await ethers.provider.getTransactionReceipt(contract.deploymentTransaction().hash)).blockNumber,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployment-v2.json"), JSON.stringify(output, null, 2));
  console.log(`Saved deployment-v2.json. Balance left ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} USDC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
