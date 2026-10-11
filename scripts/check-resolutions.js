// Lists markets the owner must act on: closed-but-unresolved (with their v2 resolve-by date)
// and markets closing within the next 14 days, on every network in networks.json. Read-only.
// Usage: node scripts/check-resolutions.js
const { ethers } = require("ethers");
const NETWORKS = require("../networks.json");

const ABI = {
  2: ["function marketCount() view returns (uint256)", "function getMarket(uint256) view returns (tuple(string question, string category, string rules, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator))"],
  1: ["function marketCount() view returns (uint256)", "function getMarket(uint256) view returns (string question, string category, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator)"],
};
// One provider per network; batching off because the testnet RPC mishandles batches.
const CONTRACTS = Object.entries(NETWORKS).flatMap(([network, n]) => {
  const provider = new ethers.JsonRpcProvider(n.rpc, n.chainId, { staticNetwork: true, batchMaxCount: 1 });
  return [[3, n.v3], [2, n.v2], [1, n.v1]].filter(([, address]) => address).map(([version, address]) => ({ network, version, address, abi: ABI[Math.min(version, 2)], provider }));
});
const WINDOW = 30 * 86400; // PredictArcV2.RESOLUTION_WINDOW
const day = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const due = [];
  const soon = [];
  for (const { network, version, address, abi, provider } of CONTRACTS) {
    const contract = new ethers.Contract(address, abi, provider);
    const count = Number(await contract.marketCount());
    for (let id = 1; id <= count; id += 1) {
      const raw = await contract.getMarket(id);
      const m = version >= 2 ? raw : { question: raw[0], deadline: raw[2], yesPool: raw[3], noPool: raw[4], status: raw[6] };
      if (Number(m.status) !== 0) continue;
      const deadline = Number(m.deadline);
      const pool = `${ethers.formatEther(m.yesPool)} YES / ${ethers.formatEther(m.noPool)} NO`;
      const row = { key: `${network === "arcMainnet" ? "MAINNET " : ""}v${version}-${id}`, question: m.question, rules: version >= 2 ? m.rules : "(legacy: question wording)", deadline: day(deadline), pool };
      if (deadline <= now) due.push({ ...row, resolveBy: version >= 2 ? day(deadline + WINDOW) : "no limit (v1)" });
      else if (deadline - now <= 14 * 86400) soon.push(row);
    }
  }
  console.log(`NEEDS RESOLUTION NOW (${due.length})`);
  due.forEach((m) => console.log(`- ${m.key} | ${m.question} | closed ${m.deadline} | resolve by ${m.resolveBy} | pool ${m.pool}\n  rules: ${m.rules}`));
  console.log(`\nCLOSING IN THE NEXT 14 DAYS (${soon.length})`);
  soon.forEach((m) => console.log(`- ${m.key} | ${m.question} | closes ${m.deadline} | pool ${m.pool}`));
}

main().catch((error) => {
  console.error("Check failed:", error.message);
  process.exitCode = 1;
});
