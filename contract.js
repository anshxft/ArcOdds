// ArcOdds Contract Config
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

function hasContractAddress() {
  return /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);
}

async function getProviderAndSigner() {
  if (typeof window.ethereum === "undefined") {
    throw new Error("MetaMask not found. Please install MetaMask or open this in a wallet browser.");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = ethers.providers
    ? new ethers.providers.Web3Provider(window.ethereum)
    : new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return { provider, signer, account: accounts[0] };
}

function getContract(signer) {
  if (!hasContractAddress()) {
    throw new Error("Contract address not configured yet");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

function getReadContract() {
  if (!hasContractAddress()) throw new Error("Contract address not configured yet");
  const provider = ethers.providers
    ? new ethers.providers.JsonRpcProvider("https://rpc.testnet.arc.network")
    : new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

function formatNative(value) {
  return ethers.utils ? ethers.utils.formatEther(value) : ethers.formatEther(value);
}

// Contract wallet connection. Keep this name distinct from page-level connectWallet handlers.
async function connectContractWallet() {
  if (typeof window.ethereum !== 'undefined') {
    try {
      const { provider, signer, account } = await getProviderAndSigner();
      const contract = hasContractAddress() ? getContract(signer) : null;
      
      console.log("Wallet connected:", account);
      if (contract) console.log("Contract ready!");
      else console.warn("Contract address not configured yet.");
      
      return { provider, signer, contract, account };
    } catch (err) {
      console.error("Connection failed:", err);
      throw err;
    }
  } else {
    alert('MetaMask not found! Please install MetaMask or open this in a wallet browser.');
    throw new Error("MetaMask not found");
  }
}

// Place bet
async function placeBet(marketId, side, usdcAmount) {
  const { contract } = await connectContractWallet();
  if (!contract) throw new Error("Contract address not configured yet");
  const value = ethers.utils
    ? ethers.utils.parseEther(usdcAmount.toString())
    : ethers.parseEther(usdcAmount.toString());
  const tx = await contract.placeBet(marketId, side, {
    value
  });
  await tx.wait();
  console.log("Bet placed!", tx.hash);
  return tx;
}

// Get odds
async function getOdds(marketId) {
  const { contract } = await connectContractWallet();
  if (!contract) throw new Error("Contract address not configured yet");
  const [yesOdds, noOdds] = await contract.getOdds(marketId);
  return { yes: yesOdds.toString(), no: noOdds.toString() };
}

async function claimWinnings(marketId) {
  const { contract } = await connectContractWallet();
  if (!contract) throw new Error("Contract address not configured yet");
  const tx = await contract.claimWinnings(marketId);
  await tx.wait();
  return tx;
}

async function getOnchainMarkets() {
  const contract = getReadContract();
  const count = Number((await contract.marketCount()).toString());
  const markets = [];
  for (let id = 1; id <= count; id += 1) {
    const [market, odds] = await Promise.all([contract.getMarket(id), contract.getOdds(id)]);
    markets.push({
      id,
      question: market.question,
      category: market.category,
      deadline: Number(market.deadline.toString()),
      yesPool: formatNative(market.yesPool),
      noPool: formatNative(market.noPool),
      status: Number(market.status),
      creator: market.creator,
      yesOdds: Number(odds.yesOdds.toString()),
      noOdds: Number(odds.noOdds.toString()),
    });
  }
  return markets;
}

async function getWalletPositions(account) {
  const contract = getReadContract();
  const count = Number((await contract.marketCount()).toString());
  const positions = [];
  for (let id = 1; id <= count; id += 1) {
    const [market, position] = await Promise.all([contract.getMarket(id), contract.getPosition(id, account)]);
    const yesAmount = Number(formatNative(position.yesAmount));
    const noAmount = Number(formatNative(position.noAmount));
    if (yesAmount > 0 || noAmount > 0) {
      positions.push({
        marketId: id,
        question: market.question,
        side: yesAmount > 0 ? "YES" : "NO",
        amount: yesAmount > 0 ? yesAmount : noAmount,
        claimed: position.hasClaimed,
        status: Number(market.status),
        outcome: market.outcome ? "YES" : "NO",
      });
    }
  }
  return positions;
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
  hasContractAddress,
};
