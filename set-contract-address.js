const fs = require("fs");
const path = require("path");

const address = process.argv[2];

if (!/^0x[a-fA-F0-9]{40}$/.test(address || "")) {
  console.error("Usage: node scripts/set-contract-address.js 0xYourContractAddress");
  process.exit(1);
}

const contractPath = path.join(__dirname, "..", "contract.js");
const source = fs.readFileSync(contractPath, "utf8");
const updated = source.replace(
  /const CONTRACT_ADDRESS = ".*?";/,
  `const CONTRACT_ADDRESS = "${address}";`
);

fs.writeFileSync(contractPath, updated);
console.log(`Updated contract.js with ${address}`);
