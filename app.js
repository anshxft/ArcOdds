const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: [],
};

const ARC_FAUCET_URL = "https://faucet.circle.com";
const POLYMARKET_API = "https://gamma-api.polymarket.com";
const CATEGORY_IMAGES = {
  crypto: "assets/markets/classic-btc.jpg",
  politics: "assets/markets/classic-us-politics.jpg",
  sports: "assets/markets/classic-football-field.jpg",
  tech: "assets/markets/classic-apple.jpg",
  entertainment: "assets/markets/classic-cinema.jpg",
  finance: "assets/markets/classic-finance.jpg",
};

const MARKET_IMAGES = [
  "assets/markets/classic-btc.jpg",
  "assets/markets/market-eth-v3.jpg",
  "assets/markets/classic-finance.jpg",
  "assets/markets/classic-gold-fixed.jpg",
  "assets/markets/classic-ai-fixed.jpg",
  "assets/markets/market-apple-v3.jpg",
  "assets/markets/classic-us-politics.jpg",
  "assets/markets/classic-nato.jpg",
  "assets/markets/classic-football-action.jpg",
  "assets/markets/market-fifa-v3.jpg",
  "assets/markets/classic-gta-wall.jpg",
  "assets/markets/classic-cinema.jpg",
];

const DISPLAY_VOLUME_BASES = [128, 245, 386, 472, 620, 755, 890, 1040, 1215, 1380, 1660, 1945];

function getSeedMarketImage(index) {
  return MARKET_IMAGES[index] || CATEGORY_IMAGES.finance;
}

function formatDisplayVolume(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(value)}`;
}

const FALLBACK_MARKETS = [
  ["Will Bitcoin reach $150,000 before December 31, 2026?", "crypto", 43, "BTC", "Dec 31, 2026"],
  ["Will Ethereum reach $6,000 before December 31, 2026?", "crypto", 31, "ETH", "Dec 31, 2026"],
  ["Will the Federal Reserve cut rates before September 2026?", "finance", 67, "FED", "Sep 30, 2026"],
  ["Will gold trade above $4,000 before December 31, 2026?", "finance", 39, "XAU", "Dec 31, 2026"],
  ["Will a major AI lab release a new flagship model before August 2026?", "tech", 74, "AI", "Aug 31, 2026"],
  ["Will Apple announce a foldable iPhone in 2026?", "tech", 24, "APL", "Dec 31, 2026"],
  ["Will the United States enter a recession in 2026?", "politics", 28, "US", "Dec 31, 2026"],
  ["Will a new country join NATO before 2027?", "politics", 18, "NATO", "Dec 31, 2026"],
  ["Will a team from England win the 2026 Champions League?", "sports", 46, "UCL", "Jun 30, 2026"],
  ["Will the 2026 FIFA World Cup final be decided in extra time?", "sports", 22, "FIFA", "Jul 31, 2026"],
  ["Will GTA VI release before December 31, 2026?", "entertainment", 71, "GTA", "Dec 31, 2026"],
  ["Will a 2026 movie gross more than $2 billion worldwide?", "entertainment", 35, "MOV", "Dec 31, 2026"],
];

const ARC_MARKETS = FALLBACK_MARKETS.map(([q, cat, yes, icon, closes], index) => {
  const volume = DISPLAY_VOLUME_BASES[index] || 420;
  return {
    id: index + 1,
    cat,
    q,
    yes,
    vol: formatDisplayVolume(volume),
    volume,
    liquidity: formatDisplayVolume(Math.round(volume * (0.38 + ((index % 4) * 0.04)))),
    bettors: String(8 + (index * 3) % 29),
    closes,
    closeShort: closes.replace(", 2026", ""),
    icon,
    image: getSeedMarketImage(index),
    creator: "PredictArc Testnet",
    rule: "This PredictArc testnet market uses the displayed reference probability for discovery. Final resolution follows the market question and published resolution source.",
    source: "PredictArc reference",
  };
});

function inferCategory(question) {
  const q = question.toLowerCase();
  if (/bitcoin|ethereum|crypto|solana|token|xrp|dogecoin/.test(q)) return "crypto";
  if (/election|president|government|congress|senate|war|ceasefire|nato/.test(q)) return "politics";
  if (/nba|nfl|fifa|world cup|champions league|win the|tournament/.test(q)) return "sports";
  if (/ai|openai|apple|google|tesla|spacex|launch|model/.test(q)) return "tech";
  if (/movie|film|album|gta|game|box office|award/.test(q)) return "entertainment";
  return "finance";
}

function categoryIcon(category) {
  return { crypto: "CR", politics: "POL", sports: "SP", tech: "TECH", entertainment: "ENT", finance: "FIN" }[category];
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function formatCloseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function loadReferenceMarkets() {
  try {
    const query = new URLSearchParams({
      active: "true",
      closed: "false",
      limit: "36",
      order: "volume24hr",
      ascending: "false",
    });
    const response = await fetch(`${POLYMARKET_API}/markets?${query}`);
    if (!response.ok) throw new Error("Reference feed unavailable");
    const markets = await response.json();
    const usable = markets.filter((market) => {
      const outcomes = parseJsonArray(market.outcomes);
      const prices = parseJsonArray(market.outcomePrices);
      return outcomes.length === 2 && prices.length === 2 && market.question;
    }).slice(0, ARC_MARKETS.length);

    usable.forEach((market, index) => {
      const outcomes = parseJsonArray(market.outcomes);
      const prices = parseJsonArray(market.outcomePrices);
      const yesIndex = Math.max(0, outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes"));
      const yes = Math.max(1, Math.min(99, Math.round(Number(prices[yesIndex]) * 100)));
      const cat = inferCategory(market.question);
      const closes = formatCloseDate(market.endDate || market.endDateIso);
      Object.assign(ARC_MARKETS[index], {
        q: market.question,
        cat,
        yes,
        icon: categoryIcon(cat),
        image: getSeedMarketImage(index),
        closes,
        closeShort: closes.replace(", 2026", ""),
        rule: market.description || ARC_MARKETS[index].rule,
        source: "Polymarket reference odds",
        referenceUrl: market.slug ? `https://polymarket.com/event/${market.slug}` : "https://polymarket.com",
      });
    });
    window.dispatchEvent(new CustomEvent("PredictArc:markets-updated"));
    return ARC_MARKETS;
  } catch (error) {
    console.warn("Using current PredictArc fallback markets:", error.message);
    return ARC_MARKETS;
  }
}

async function loadOnchainMarkets() {
  if (!window.PredictArcContracts || !window.PredictArcContracts.hasContractAddress()) return ARC_MARKETS;
  try {
    const markets = await window.PredictArcContracts.getOnchainMarkets();
    markets.forEach((market, index) => {
      if (!ARC_MARKETS[index]) return;
      const realVolume = Number(market.yesPool) + Number(market.noPool);
      const hasTradeLiquidity = realVolume > 0;
      const displayVolume = (DISPLAY_VOLUME_BASES[index] || 420) + realVolume;
      const closes = formatCloseDate(market.deadline * 1000);
      Object.assign(ARC_MARKETS[index], {
        q: market.question,
        cat: market.category,
        image: getSeedMarketImage(index),
        yes: hasTradeLiquidity ? market.yesOdds : ARC_MARKETS[index].yes,
        vol: formatDisplayVolume(displayVolume),
        volume: displayVolume,
        liquidity: formatDisplayVolume(Math.round(displayVolume * (0.38 + ((index % 4) * 0.04)))),
        bettors: String(8 + (index * 3) % 29 + Math.floor(realVolume)),
        closes,
        closeShort: closes.replace(", 2026", ""),
        creator: formatShortAddress(market.creator),
        source: hasTradeLiquidity ? "PredictArc on-chain odds" : "PredictArc reference odds",
        status: market.status,
      });
    });
    window.dispatchEvent(new CustomEvent("PredictArc:markets-updated"));
    return ARC_MARKETS;
  } catch (error) {
    console.warn("Unable to load PredictArc contract markets:", error.message);
    return ARC_MARKETS;
  }
}

function getMarketById(id) {
  return ARC_MARKETS.find((market) => market.id === Number(id)) || ARC_MARKETS[0];
}

function getMarketFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return getMarketById(params.get("id") || 1);
}

function formatShortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect Wallet";
}

function setConnectedWallet(address) {
  localStorage.setItem("PredictArc_wallet", address);
  document.querySelectorAll(".btn-connect").forEach((button) => {
    button.textContent = formatShortAddress(address);
    button.title = "Disconnect wallet";
    button.style.cssText = "background:var(--surface2);border:1px solid var(--border2);font-family:JetBrains Mono,monospace;font-size:12px;box-shadow:none";
  });
}

function migrateBrandStorage() {
  const legacyWallet = localStorage.getItem("arcodds_wallet");
  const legacyPositions = localStorage.getItem("arcodds_positions");
  if (legacyWallet && !localStorage.getItem("PredictArc_wallet")) {
    localStorage.setItem("PredictArc_wallet", legacyWallet);
  }
  if (legacyPositions && !localStorage.getItem("PredictArc_positions")) {
    localStorage.setItem("PredictArc_positions", legacyPositions);
  }
}

function clearConnectedWallet() {
  localStorage.removeItem("PredictArc_wallet");
  document.querySelectorAll(".btn-connect").forEach((button) => {
    button.textContent = "Connect Wallet";
    button.title = "Connect wallet";
    button.removeAttribute("style");
  });
}

function disconnectWallet() {
  clearConnectedWallet();
  window.dispatchEvent(new CustomEvent("PredictArc:wallet-disconnected"));
}

async function ensureArcWallet() {
  if (!window.PredictArcContracts) throw new Error("Contract helper not loaded");
  if (!window.ethereum) throw new Error("MetaMask not found. Please install MetaMask or open this in a wallet browser.");

  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_TESTNET.chainId }] });
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_TESTNET] });
    } else {
      throw error;
    }
  }

  const result = await window.PredictArcContracts.connectWallet();
  setConnectedWallet(result.account);
  return result;
}

function restoreWalletLabel() {
  const saved = localStorage.getItem("PredictArc_wallet");
  if (saved) setConnectedWallet(saved);
}

function updateLogoFallbacks() {
  document.querySelectorAll('img[src*="predictarc-bird.png"]').forEach((img) => {
    img.onerror = () => {
      img.onerror = () => {
        img.onerror = null;
        img.src = "assets/predictarc-mark.svg";
        img.style.filter = "none";
      };
      img.src = "assets/predictarc-bird-compact.png";
    };
  });
}

function openArcFaucet() {
  window.open(ARC_FAUCET_URL, "_blank", "noopener,noreferrer");
}

function updateNetworkLabels() {
  document.querySelectorAll(".network-badge").forEach((badge) => {
    const dot = badge.querySelector(".net-dot");
    badge.innerHTML = "";
    if (dot) badge.appendChild(dot);
    badge.append(" Arc Testnet");
  });
}

window.PredictArcApp = {
  ARC_TESTNET,
  ARC_FAUCET_URL,
  POLYMARKET_API,
  CATEGORY_IMAGES,
  MARKET_IMAGES,
  ARC_MARKETS,
  getMarketById,
  getMarketFromUrl,
  loadReferenceMarkets,
  loadOnchainMarkets,
  ensureArcWallet,
  openArcFaucet,
  restoreWalletLabel,
  setConnectedWallet,
  clearConnectedWallet,
  disconnectWallet,
  updateNetworkLabels,
  updateLogoFallbacks,
};

window.openArcFaucet = openArcFaucet;

window.addEventListener("DOMContentLoaded", () => {
  migrateBrandStorage();
  updateLogoFallbacks();
  restoreWalletLabel();
  updateNetworkLabels();
  const loadMarkets = window.PredictArcContracts && window.PredictArcContracts.hasContractAddress()
    ? loadOnchainMarkets
    : loadReferenceMarkets;
  loadMarkets();
  window.setInterval(loadMarkets, 60000);

  if (window.ethereum && typeof window.ethereum.on === "function") {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts && accounts[0]) setConnectedWallet(accounts[0]);
      else clearConnectedWallet();
    });
  }
});
