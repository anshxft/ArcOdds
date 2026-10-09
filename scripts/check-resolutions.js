// Lists markets the owner must act on: closed-but-unresolved (with their v2 resolve-by date)
// and markets closing within the next 14 days. Read-only.  Usage: node scripts/check-resolutions.js
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true, batchMaxCount: 1 });
const CONTRACTS = [
  {
    version: 2,
    address: "0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796",
    abi: ["function marketCount() view returns (uint256)", "function getMarket(uint256) view returns (tuple(string question, string category, string rules, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator))"],
  },
  {
    version: 1,
    address: "0x19D638Af6b2De9718Eff496fc27a304155D6Af44",
    abi: ["function marketCount() view returns (uint256)", "function getMarket(uint256) view returns (string question, string category, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator)"],
  },
];
const WINDOW = 30 * 86400; // PredictArcV2.RESOLUTION_WINDOW
const day = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const due = [];
  const soon = [];
  for (const { version, address, abi } of CONTRACTS) {
    const contract = new ethers.Contract(address, abi, provider);
    const count = Number(await contract.marketCount());
    for (let id = 1; id <= count; id += 1) {
      const raw = await contract.getMarket(id);
      const m = version === 2 ? raw : { question: raw[0], deadline: raw[2], yesPool: raw[3], noPool: raw[4], status: raw[6] };
      if (Number(m.status) !== 0) continue;
      const deadline = Number(m.deadline);
      const pool = `${ethers.formatEther(m.yesPool)} YES / ${ethers.formatEther(m.noPool)} NO`;
      const row = { key: `v${version}-${id}`, question: m.question, rules: version === 2 ? m.rules : "(legacy: question wording)", deadline: day(deadline), pool };
      if (deadline <= now) due.push({ ...row, resolveBy: version === 2 ? day(deadline + WINDOW) : "no limit (v1)" });
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
