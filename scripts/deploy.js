// Deploys the current PredictArc contract (PredictArcV3, or CONTRACT_NAME=PredictArcV2) and records
// its address in networks.json (read by the site, share cards and scripts). Markets are added
// separately with add-markets.js.
//   npx hardhat run scripts/deploy.js --network arcTestnet
//   CONFIRM_MAINNET=yes npx hardhat run scripts/deploy.js --network arcMainnet
const fs = require("fs");
const { CONTRACT_NAMES, NETWORKS_FILE, mainnetGuard } = require("./network");

async function main() {
  const name = hre.network.name;
  const contractName = process.env.CONTRACT_NAME || "PredictArcV3";
  const version = Number(Object.keys(CONTRACT_NAMES).find((v) => CONTRACT_NAMES[v] === contractName));
  if (!version) throw new Error(`Unknown contract ${contractName}`);
  const field = `v${version}`;

  const networks = JSON.parse(fs.readFileSync(NETWORKS_FILE, "utf8"));
  if (!networks[name]) throw new Error(`Unknown network ${name}; add it to networks.json`);
  if (networks[name][field] && process.env.FORCE !== "yes") {
    throw new Error(`networks.json already has a ${field} contract on ${name} (${networks[name][field]}). Set FORCE=yes to deploy a new one.`);
  }
  mainnetGuard(name);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error(`No deployer key for ${name}: set ${name === "arcMainnet" ? "MAINNET_PRIVATE_KEY" : "PRIVATE_KEY"} in .env`);
  console.log(`Network ${name}, deployer ${deployer.address}, balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} USDC`);

  const contract = await (await ethers.getContractFactory(contractName)).deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = await ethers.provider.getTransactionReceipt(contract.deploymentTransaction().hash);
  console.log(`${contractName} deployed to ${address} (block ${receipt.blockNumber})`);

  networks[name][field] = address;
  networks[name][`${field}DeployBlock`] = receipt.blockNumber;
  fs.writeFileSync(NETWORKS_FILE, JSON.stringify(networks, null, 2) + "\n");
  console.log(`Saved to networks.json as ${field}. Balance left ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} USDC`);
  console.log(`Next: add markets with  ${name === "arcMainnet" ? "CONFIRM_MAINNET=yes " : ""}npx hardhat run scripts/add-markets.js --network ${name}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
