(function () {
// PredictArc Contract Config
const CONTRACT_ADDRESS = "0x19D638Af6b2De9718Eff496fc27a304155D6Af44"; // Arc testnet deployment ke baad yahan contract address paste karein.

const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "_question", "type": "string"},
      {"internalType": "string", "name": "_category", "type": "string"},
      {"internalType": "uint256", "name": "_deadline", "type": "uint256"}
    ],
    "name": "createMarket",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_marketId", "type": "uint256"},
      {"internalType": "bool", "name": "_side", "type": "bool"}
    ],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_marketId", "type": "uint256"},
      {"internalType": "bool", "name": "_outcome", "type": "bool"}
    ],
    "name": "resolveMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_marketId", "type": "uint256"}
    ],
    "name": "claimWinnings",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_marketId", "type": "uint256"}
    ],
    "name": "getOdds",
    "outputs": [
      {"internalType": "uint256", "name": "yesOdds", "type": "uint256"},
      {"internalType": "uint256", "name": "noOdds", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_marketId", "type": "uint256"}
    ],
    "name": "getMarket",
    "outputs": [
      {"internalType": "string", "name": "question", "type": "string"},
      {"internalType": "string", "name": "category", "type": "string"},
      {"internalType": "uint256", "name": "deadline", "type": "uint256"},
      {"internalType": "uint256", "name": "yesPool", "type": "uint256"},
      {"internalType": "uint256", "name": "noPool", "type": "uint256"},
      {"internalType": "bool", "name": "outcome", "type": "bool"},
      {"internalType": "uint8", "name": "status", "type": "uint8"},
      {"internalType": "address", "name": "creator", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "marketCount",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_marketId", "type": "uint256"},
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getPosition",
    "outputs": [
      {"internalType": "uint256", "name": "yesAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "noAmount", "type": "uint256"},
      {"internalType": "bool", "name": "hasClaimed", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;
const ARC_EXPLORER = "https://explorer.testnet.arc.io";
const BET_PLACED_TOPIC = "0x4af71b021e799c62c158bd54636ca8da2fa26115a21a2dc6efe486ec104fd15f";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = ["function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)"];
let readProvider = null;
let betsCache = null;

function hasContractAddress() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);
}

function getInjectedProvider() {
  const app = window.PredictArcApp;
  return app && app.getSelectedWalletProvider ? app.getSelectedWalletProvider() : window.ethereum;
}

async function ensureArcChain(injectedProvider) {
  const chainId = await injectedProvider.request({ method: "eth_chainId" });
  if (Number(chainId) === ARC_CHAIN_ID) return;
  const arc = window.PredictArcApp && window.PredictArcApp.ARC_TESTNET;
  try {
    await injectedProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + ARC_CHAIN_ID.toString(16) }] });
  } catch (error) {
    if (error.code !== 4902 || !arc) throw new Error("Please switch your wallet to Arc Testnet.");
    await injectedProvider.request({ method: "wallet_addEthereumChain", params: [arc] });
  }
}

async function getProviderAndSigner() {
  const injectedProvider = getInjectedProvider();
  if (!injectedProvider) {
    throw new Error("No browser wallet found. Please install MetaMask, OKX Wallet, Rabby, Trust Wallet, or open this in a wallet browser.");
  }
  const accounts = await injectedProvider.request({ method: "eth_requestAccounts" });
  await ensureArcChain(injectedProvider);
  const provider = new ethers.BrowserProvider(injectedProvider);
  const signer = await provider.getSigner();
  return { provider, signer, account: accounts[0] };
}

function getContract(signer) {
  if (!hasContractAddress()) throw new Error("Contract address not configured yet");
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

function getReadContract() {
  if (!hasContractAddress()) throw new Error("Contract address not configured yet");
  // Arc RPC mishandles JSON-RPC batches (random CALL_EXCEPTIONs), so send calls one by one.
  readProvider = readProvider || new ethers.JsonRpcProvider(ARC_RPC_URL, ARC_CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
}

function toNumber(value) {
  return Number(ethers.formatEther(value));
}

function txUrl(hash) {
  return `${ARC_EXPLORER}/tx/${hash}`;
}

// Contract wallet connection. Keep this name distinct from page-level connectWallet handlers.
async function connectContractWallet() {
  const { provider, signer, account } = await getProviderAndSigner();
  const contract = hasContractAddress() ? getContract(signer) : null;
  return { provider, signer, contract, account };
}

async function placeBet(marketId, side, usdcAmount) {
  const { contract } = await connectContractWallet();
  if (!contract) throw new Error("Contract address not configured yet");
  const tx = await contract.placeBet(marketId, side, { value: ethers.parseEther(String(usdcAmount)) });
  await tx.wait();
  betsCache = null;
  return tx;
}

async function getOdds(marketId) {
  const [yesOdds, noOdds] = await getReadContract().getOdds(marketId);
  return { yes: yesOdds.toString(), no: noOdds.toString() };
}

async function claimWinnings(marketId) {
  const { contract } = await connectContractWallet();
  if (!contract) throw new Error("Contract address not configured yet");
  const tx = await contract.claimWinnings(marketId);
  await tx.wait();
  return tx;
}

// Reads every call in one eth_call through Multicall3 (deployed on Arc Testnet),
// so a page load costs 2 RPC requests instead of 25+ (the public RPC rate-limits).
async function readMany(calls) {
  const contract = getReadContract();
  const multicall = new ethers.Contract(MULTICALL3, MULTICALL3_ABI, readProvider);
  const results = await multicall.aggregate3(calls.map(([fn, args]) => ({
    target: CONTRACT_ADDRESS,
    allowFailure: false,
    callData: contract.interface.encodeFunctionData(fn, args),
  })));
  return results.map((result, index) => contract.interface.decodeFunctionResult(calls[index][0], result.returnData));
}

async function getMarketIds() {
  const count = Number(await getReadContract().marketCount());
  return Array.from({ length: count }, (_, index) => index + 1);
}

function parseMarket(id, market) {
  const total = market.yesPool + market.noPool;
  const yesOdds = total === 0n ? 50 : Number((market.yesPool * 100n) / total); // same math as ArcOdds.getOdds
  return {
    id,
    question: market.question,
    category: market.category,
    deadline: Number(market.deadline),
    yesPool: toNumber(market.yesPool),
    noPool: toNumber(market.noPool),
    outcome: market.outcome ? "YES" : "NO",
    status: Number(market.status),
    creator: market.creator,
    yesOdds,
    noOdds: 100 - yesOdds,
  };
}

async function getOnchainMarkets() {
  const ids = await getMarketIds();
  const markets = await readMany(ids.map((id) => ["getMarket", [id]]));
  return markets.map((market, index) => parseMarket(ids[index], market));
}

// One entry per side: a wallet can hold both YES and NO in the same market.
async function getWalletPositions(account) {
  const ids = await getMarketIds();
  const results = await readMany(ids.flatMap((id) => [["getPosition", [id, account]], ["getMarket", [id]]]));
  return ids.flatMap((id, index) => {
    const position = results[index * 2];
    const market = parseMarket(id, results[index * 2 + 1]);
    return [["YES", toNumber(position.yesAmount)], ["NO", toNumber(position.noAmount)]]
      .filter(([, amount]) => amount > 0)
      .map(([side, amount]) => ({
        marketId: id,
        question: market.question,
        side,
        amount,
        claimed: position.hasClaimed,
        status: market.status,
        outcome: market.outcome,
        deadline: market.deadline,
        yesPool: market.yesPool,
        noPool: market.noPool,
      }));
  });
}

// Bet history comes from the Arc explorer (the public RPC prunes old logs).
async function fetchAllBets() {
  const bets = [];
  let params = "";
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(`${ARC_EXPLORER}/api/v2/addresses/${CONTRACT_ADDRESS}/logs${params}`);
    if (!response.ok) throw new Error(`Explorer request failed: ${response.status}`);
    const data = await response.json();
    (data.items || []).forEach((log) => {
      if (log.topics?.[0] !== BET_PLACED_TOPIC) return;
      const [side, amount] = ethers.AbiCoder.defaultAbiCoder().decode(["bool", "uint256"], log.data);
      bets.push({
        marketId: Number(BigInt(log.topics[1])),
        user: ethers.getAddress("0x" + log.topics[2].slice(26)),
        side: side ? "YES" : "NO",
        amount: toNumber(amount),
        time: Date.parse(log.block_timestamp),
        txHash: log.transaction_hash || null,
      });
    });
    if (!data.next_page_params) break;
    params = "?" + new URLSearchParams(data.next_page_params);
  }
  return bets.sort((a, b) => a.time - b.time);
}

function getAllBets() {
  if (!hasContractAddress()) return Promise.resolve([]);
  if (!betsCache || Date.now() - betsCache.at > 60000) {
    betsCache = { at: Date.now(), promise: fetchAllBets().catch((error) => { betsCache = null; throw error; }) };
  }
  return betsCache.promise;
}

window.ArcOddsContracts = {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  connectWallet: connectContractWallet,
  placeBet,
  claimWinnings,
  getOdds,
  getOnchainMarkets,
  getWalletPositions,
  getAllBets,
  hasContractAddress,
  txUrl,
  ARC_EXPLORER,
};
window.PredictArcContracts = window.ArcOddsContracts;
})();
