// Shared by the OG image and the crawler page: reads one market from either PredictArc contract.
import { Contract, JsonRpcProvider, formatEther } from "ethers";

const provider = new JsonRpcProvider("https://rpc.testnet.arc.network", 5042002, { staticNetwork: true, batchMaxCount: 1 });
const CONTRACTS = {
  2: new Contract(
    "0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796",
    ["function getMarket(uint256) view returns (tuple(string question, string category, string rules, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator))"],
    provider,
  ),
  1: new Contract(
    "0x19D638Af6b2De9718Eff496fc27a304155D6Af44",
    ["function getMarket(uint256) view returns (string question, string category, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator)"],
    provider,
  ),
};

/** "v2-3" -> v2 market 3; a bare "3" is an old v1 link. Returns null for anything else. */
export function parseKey(key) {
  const match = /^(?:v([12])-)?(\d{1,6})$/.exec(String(key || ""));
  return match ? { version: Number(match[1] || 1), id: Number(match[2]) } : null;
}

export async function readMarket(key) {
  const parsed = parseKey(key);
  if (!parsed) return null;
  try {
    const raw = await CONTRACTS[parsed.version].getMarket(parsed.id);
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
