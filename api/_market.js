// Shared by the OG image and the crawler page: reads one market from PredictArc on Arc mainnet or
// testnet. Addresses come from the repo-root networks.json (written by the deploy script).
import { createRequire } from "node:module";
import { Contract, JsonRpcProvider, formatEther } from "ethers";

const NETWORKS = createRequire(import.meta.url)("../networks.json");
const ABI = {
  2: ["function getMarket(uint256) view returns (tuple(string question, string category, string rules, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator))"],
  1: ["function getMarket(uint256) view returns (string question, string category, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator)"],
};
export const MAINNET_LIVE = Boolean(NETWORKS.arcMainnet.v2);

/** Same rule as the site: mainnet once it has a contract, unless ?net=testnet. */
export const pickNet = (net) => (net === "testnet" || !MAINNET_LIVE ? "testnet" : "mainnet");

const contracts = {};
function contractFor(net, version) {
  const config = net === "mainnet" ? NETWORKS.arcMainnet : NETWORKS.arcTestnet;
  const address = version === 2 ? config.v2 : config.v1;
  if (!address) return null;
  const id = `${net}:${version}`;
  // Batching off: the testnet RPC mishandles JSON-RPC batches.
  contracts[id] ??= new Contract(address, ABI[version], new JsonRpcProvider(config.rpc, config.chainId, { staticNetwork: true, batchMaxCount: 1 }));
  return contracts[id];
}

/** "v2-3" -> v2 market 3; a bare "3" is an old v1 link. Returns null for anything else. */
export function parseKey(key) {
  const match = /^(?:v([12])-)?(\d{1,6})$/.exec(String(key || ""));
  return match ? { version: Number(match[1] || 1), id: Number(match[2]) } : null;
}

export async function readMarket(key, net = pickNet()) {
  const parsed = parseKey(key);
  const contract = parsed && contractFor(net, parsed.version);
  if (!contract) return null;
  try {
    const raw = await contract.getMarket(parsed.id);
    const m = parsed.version === 2 ? raw : { question: raw[0], category: raw[1], deadline: raw[2], yesPool: raw[3], noPool: raw[4], outcome: raw[5], status: raw[6] };
    const total = m.yesPool + m.noPool;
    const yes = total === 0n ? 50 : Number((m.yesPool * 100n) / total);
    return {
      key: `v${parsed.version}-${parsed.id}`,
      question: m.question,
      category: m.category,
      deadline: Number(m.deadline),
      yes,
      volume: Number(formatEther(total)),
      status: Number(m.status),
      outcome: m.outcome ? "YES" : "NO",
      testnet: net === "testnet",
    };
  } catch {
    return null; // unknown id or RPC hiccup: callers fall back to the generic card
  }
}

export const formatDate = (seconds) =>
  new Date(seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function statusLabel(market) {
  if (market.status === 1) return `Resolved ${market.outcome}`;
  if (market.status === 2) return "Cancelled";
  return Date.now() / 1000 >= market.deadline ? "Awaiting resolution" : "Open";
}
