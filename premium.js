(function () {
  const esc = (value) => window.PredictArcApp?.escapeHtml(value) ?? String(value ?? "");
  const shortAddr = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  function animateNumber(el, target, options = {}) {
    const duration = 1100;
    const start = performance.now();
    const prefix = options.prefix || "";
    const suffix = options.suffix || "";
    const decimals = options.decimals || 0;
    el.textContent = `${prefix}${target.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${suffix}`;
    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = target * eased;
      el.textContent = `${prefix}${value.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function replaceBrandingAndLabels() {
    document.querySelectorAll('img[src*="predictarc-bird"]').forEach((img) => {
      img.src = "assets/predictarc-mark.svg";
      img.alt = img.alt || "PredictArc";
    });
    document.querySelectorAll("button, a").forEach((el) => {
      const text = el.textContent.trim();
      if (text === "Get Test USDC" || text === "Claim Faucet" || text === "Claim Test USDC") {
        el.textContent = "Claim Free Test USDC";
      }
    });
    document.querySelectorAll(".footer-links").forEach((links) => {
      const labels = Array.from(links.querySelectorAll("a")).map((a) => a.textContent.trim().toLowerCase());
      const extra = [
        ["X (Twitter)", "https://x.com/imalanxx"],
        ["Privacy", "docs.html#faq"],
        ["Terms", "docs.html#faq"],
        ["Contact", "mailto:hello@predictarc.xyz"],
      ];
      extra.forEach(([label, href]) => {
        if (labels.includes(label.toLowerCase())) return;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        if (href.startsWith("http")) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        li.appendChild(a);
        links.appendChild(li);
      });
    });
  }

  function markets() {
    return window.PredictArcApp?.ARC_MARKETS || [];
  }

  function allBets() {
    return markets().flatMap((market) => (market.bets || []).map((bet) => ({ ...bet, market })));
  }

  // Everything below is derived from the contract pools and BetPlaced history.
  function statSummary() {
    const list = markets();
    const bets = allBets();
    return {
      markets: list.length,
      volume: list.reduce((sum, market) => sum + Number(market.volume || 0), 0),
      traders: new Set(bets.map((bet) => bet.user)).size,
      predictions: bets.length,
      resolved: list.filter((market) => market.status === 1).length,
    };
  }

  function injectHomeStats() {
    if (!isHomePage() || !document.querySelector(".hero")) return;
    const data = statSummary();
    const key = JSON.stringify(data);
    let section = document.querySelector(".protocol-stats");
    if (section?.dataset.key === key) return;
    const html = `
        <article class="protocol-card"><div class="protocol-label">Total Markets</div><div class="protocol-value" data-count="${data.markets}">0</div><div class="protocol-note">On the Arc Testnet contract</div></article>
        <article class="protocol-card"><div class="protocol-label">Total Volume</div><div class="protocol-value" data-count="${data.volume}" data-suffix=" USDC" data-decimals="1">0</div><div class="protocol-note">Test USDC in market pools</div></article>
        <article class="protocol-card"><div class="protocol-label">Traders</div><div class="protocol-value" data-count="${data.traders}">0</div><div class="protocol-note">Unique wallets that bet</div></article>
        <article class="protocol-card"><div class="protocol-label">Total Predictions</div><div class="protocol-value" data-count="${data.predictions}">0</div><div class="protocol-note">Confirmed on-chain bets</div></article>
        <article class="protocol-card"><div class="protocol-label">Resolved Markets</div><div class="protocol-value" data-count="${data.resolved}">0</div><div class="protocol-note">Settled by the contract owner</div></article>`;
    if (!section) {
      document.querySelector(".hero").insertAdjacentHTML("afterend", `<section class="protocol-stats" aria-label="PredictArc live statistics"></section>`);
      section = document.querySelector(".protocol-stats");
    }
    section.dataset.key = key;
    section.innerHTML = html;
    section.querySelectorAll("[data-count]").forEach((el) => {
      animateNumber(el, Number(el.dataset.count || 0), { suffix: el.dataset.suffix, decimals: Number(el.dataset.decimals || 0) });
    });
  }

  function injectHeroTrust() {
    if (!isHomePage()) return;
    const heroCopy = document.querySelector(".hero > div:first-child");
    if (!heroCopy || heroCopy.querySelector(".trust-row")) return;
    const actions = heroCopy.querySelector(".hero-actions");
    if (!actions) return;
    actions.insertAdjacentHTML("beforebegin", `
      <div class="trust-row">
        <span class="trust-chip">Powered by Arc Testnet</span>
        <span class="trust-chip">On-chain Pools</span>
        <span class="trust-chip">No Real Funds</span>
        <span class="trust-chip">Your Wallet, Your Keys</span>
      </div>
    `);
  }

  function homeCard(market, label) {
    return `<article class="pa-panel" onclick="window.location.href='market-detail.html?id=${market.id}'">
      <div class="mcard-topline"><span class="mtag mtag-${esc(market.cat)}">${esc(market.cat)}</span><span class="status-badge">${esc(label)}</span></div>
      <h3>${esc(market.q)}</h3>
      <div class="prog-track"><div class="prog-fill" style="width:${market.yes}%"></div></div>
      <div class="pa-meta"><span>YES ${market.yes}%</span><span>NO ${100 - market.yes}%</span><span>${esc(market.vol)}</span><span>${esc(market.bettors)} traders</span></div>
    </article>`;
  }

  function leaderboardMarkup() {
    const byWallet = new Map();
    allBets().forEach((bet) => {
      const row = byWallet.get(bet.user) || { wallet: bet.user, staked: 0, predictions: 0, markets: new Set() };
      row.staked += bet.amount;
      row.predictions += 1;
      row.markets.add(bet.marketId);
      byWallet.set(bet.user, row);
    });
    const rows = [...byWallet.values()].sort((a, b) => b.staked - a.staked).slice(0, 5);
    if (!rows.length) return `<div class="leaderboard-pro"><div class="leaderboard-pro-row"><span>-</span><strong>No on-chain bets yet</strong><span></span><span></span><span></span></div></div>`;
    return `<div class="leaderboard-pro">
      <div class="leaderboard-pro-row"><span>Rank</span><strong>Wallet</strong><span>Markets</span><span>Staked</span><span>Predictions</span></div>
      ${rows.map((row, index) => `<div class="leaderboard-pro-row"><span>#${index + 1}</span><strong>${shortAddr(row.wallet)}</strong><span>${row.markets.size}</span><span class="lb-profit">${Number(row.staked.toFixed(2))} USDC</span><span>${row.predictions}</span></div>`).join("")}
    </div>`;
  }

  function activityMarkup() {
    const latest = allBets().sort((a, b) => b.time - a.time).slice(0, 5);
    if (!latest.length) return `<div class="activity-item"><span class="activity-dot"></span><div>No on-chain bets yet.</div><span></span></div>`;
    const ago = (ms) => {
      const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
      return min < 60 ? `${min}m ago` : min < 1440 ? `${Math.round(min / 60)}h ago` : `${Math.round(min / 1440)}d ago`;
    };
    return latest.map((bet) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${shortAddr(bet.user)}</strong> put ${bet.amount} USDC on ${bet.side} · ${esc(bet.market.q.slice(0, 58))}${bet.market.q.length > 58 ? "..." : ""}</div><span>${ago(bet.time)}</span></div>`).join("");
  }

  function injectHomeSections() {
    if (!isHomePage()) return;
    const content = document.querySelector(".content");
    const list = markets();
    if (!content || !list.length) return;
    const featured = [...list].sort((a, b) => b.volume - a.volume).slice(0, 3);
    const settled = list.filter((m) => m.status === 1);
    const awaiting = list.filter((m) => window.PredictArcApp.marketState(m) === "closed");
    const resolutionCards = settled.length
      ? settled.slice(0, 3).map((m) => homeCard(m, `${m.outcome} won`))
      : awaiting.slice(0, 3).map((m) => homeCard(m, "Awaiting resolution"));
    const categories = ["Crypto", "Finance", "Tech", "Sports", "Politics", "Entertainment"];
    const html = `
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Most traded</div><div class="pa-title">Featured Predictions</div></div><a class="link-sm" href="markets.html">Explore all</a></div>
        <div class="pa-grid-3">${featured.map((m) => homeCard(m, window.PredictArcApp.marketStateLabel(m))).join("")}</div>
      </section>
      ${resolutionCards.length ? `<section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Resolution</div><div class="pa-title">${settled.length ? "Recently Resolved Markets" : "Closed, Awaiting Resolution"}</div></div></div>
        <div class="pa-grid-3">${resolutionCards.join("")}</div>
      </section>` : ""}
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Discovery</div><div class="pa-title">Popular Categories</div></div></div>
        <div class="pa-grid-3">${categories.map((cat) => `<article class="pa-panel" onclick="window.location.href='markets.html'"><div class="pa-kicker">${cat}</div><h3>${cat} prediction markets</h3><div class="pa-meta"><span>${list.filter((m) => m.cat === cat.toLowerCase()).length} markets</span></div></article>`).join("")}</div>
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">On-chain</div><div class="pa-title">Activity Feed</div></div></div>
        <div class="activity-list">${activityMarkup()}</div>
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Rankings</div><div class="pa-title">Top Predictors by Stake</div></div><a class="link-sm" href="leaderboard.html">Status page</a></div>
        ${leaderboardMarkup()}
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">How it works</div><div class="pa-title">Built for transparent testnet prediction flows</div></div></div>
        <div class="trust-grid">
          <article class="pa-panel"><h3>Funds Held by Contract</h3><div class="pa-meta"><span>Pools live on Arc Testnet</span></div></article>
          <article class="pa-panel"><h3>Secure Wallet Connection</h3><div class="pa-meta"><span>Injected wallet only</span></div></article>
          <article class="pa-panel"><h3>Owner-Resolved Markets</h3><div class="pa-meta"><span>Outcome set after the deadline</span></div></article>
          <article class="pa-panel"><h3>Powered by Arc Testnet</h3><div class="pa-meta"><span>No real funds</span></div></article>
        </div>
      </section>
    `;
    let host = document.getElementById("featuredPredictions");
    if (!host) {
      const anchor = document.querySelector(".portfolio-preview") || document.querySelector(".lb");
      (anchor || content).insertAdjacentHTML(anchor ? "afterend" : "beforeend", `<div id="featuredPredictions"></div>`);
      host = document.getElementById("featuredPredictions");
    }
    host.innerHTML = html;
  }

  async function probe(url, init) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function refreshStatusChips() {
    const contracts = window.PredictArcContracts;
    const checks = {
      network: probe("https://rpc.testnet.arc.network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      }),
      contract: contracts?.hasContractAddress() ? contracts.getOnchainMarkets().then(() => true, () => false) : Promise.resolve(false),
      explorer: probe(`${contracts?.ARC_EXPLORER || "https://explorer.testnet.arc.io"}/api/v2/stats`),
      reference: probe("https://gamma-api.polymarket.com/markets?limit=1"),
    };
    await Promise.all(Object.entries(checks).map(async ([name, check]) => {
      const ok = await check;
      const chip = document.querySelector(`[data-status="${name}"]`);
      if (chip) chip.textContent = ok ? "Operational" : "Unavailable";
    }));
  }

  function enhanceStatusPage() {
    const title = document.querySelector(".page-title");
    if (!title || !/status/i.test(title.textContent)) return;
    if (!document.querySelector(".status-dashboard")) {
      title.insertAdjacentHTML("afterend", `
        <section class="status-dashboard">
          <article class="status-panel"><span class="status-chip" data-status="network">Checking...</span><h3>Arc Network</h3><div class="pa-meta">Public RPC responding</div></article>
          <article class="status-panel"><span class="status-chip" data-status="contract">Checking...</span><h3>PredictArc Contract</h3><div class="pa-meta">Markets readable on-chain</div></article>
          <article class="status-panel"><span class="status-chip" data-status="explorer">Checking...</span><h3>Arc Explorer</h3><div class="pa-meta">Trade history source</div></article>
          <article class="status-panel"><span class="status-chip" data-status="reference">Checking...</span><h3>Reference Odds API</h3><div class="pa-meta">Polymarket Gamma (read-only)</div></article>
        </section>
      `);
      document.querySelector(".table")?.insertAdjacentHTML("afterend", `
        <section class="pa-section">
          <div class="pa-section-head"><div><div class="pa-kicker">Leaderboard</div><div class="pa-title">Top Predictors by Stake</div></div></div>
          <div id="statusLeaderboard"></div>
        </section>
        <section class="pa-section">
          <div class="pa-section-head"><div><div class="pa-kicker">How resolution works</div><div class="pa-title">Settlement</div></div></div>
          <div class="status-list">
            <div class="status-item"><span class="activity-dot"></span><div>Trading closes automatically at each market's deadline.</div><span>Contract</span></div>
            <div class="status-item"><span class="activity-dot"></span><div>The contract owner sets the outcome after the deadline.</div><span>Manual</span></div>
            <div class="status-item"><span class="activity-dot"></span><div>Winners claim their share of the pool from Portfolio (2% fee on the losing pool).</div><span>Claim</span></div>
          </div>
        </section>
      `);
      refreshStatusChips();
    }
    const board = document.getElementById("statusLeaderboard");
    if (board) board.innerHTML = leaderboardMarkup();
  }

  function enhanceDocsPage() {
    const hero = document.querySelector(".hero");
    if (!hero || !document.title.toLowerCase().includes("docs") || document.querySelector(".docs-index")) return;
    hero.insertAdjacentHTML("afterend", `
      <section class="docs-index">
        ${["Getting Started", "Connect Wallet", "Claim Test USDC", "Create Prediction", "Resolve Markets", "FAQ"].map((label) => `<a class="pa-panel" href="#${label.toLowerCase().replaceAll(" ", "-")}"><div class="pa-kicker">Guide</div><h3>${label}</h3></a>`).join("")}
      </section>
    `);
    const grid = document.querySelector(".doc-grid");
    grid?.insertAdjacentHTML("beforeend", `
      <article class="doc-card" id="getting-started"><h2>Getting Started</h2><p>Open Markets, choose an event, review the YES/NO pool odds, then connect a test wallet before placing a position.</p></article>
      <article class="doc-card" id="connect-wallet"><h2>Connect Wallet</h2><p>Use a browser wallet, approve Arc Testnet, and keep this as a no-real-funds testing workflow.</p></article>
      <article class="doc-card" id="claim-test-usdc"><h2>Claim Test USDC</h2><p>Use Claim Free Test USDC to open the faucet and fund your Arc Testnet wallet.</p></article>
      <article class="doc-card" id="create-prediction"><h2>Create Prediction</h2><p>Select YES or NO, enter test USDC, and confirm the transaction. Your stake joins that side's pool; if your side wins you get your share of the whole pool minus a 2% fee on the losing side.</p></article>
      <article class="doc-card" id="resolve-markets"><h2>Resolve Markets</h2><p>Trading closes at the deadline. The contract owner then sets the outcome, and winning positions can be claimed from Portfolio.</p></article>
      <article class="doc-card" id="faq"><h2>FAQ</h2><p>PredictArc uses no real funds in this build. Reference odds are informational, while settlement happens on Arc Testnet.</p></article>
    `);
  }

  function isHomePage() {
    const path = location.pathname.split("/").pop() || "predictarc.html";
    return path === "predictarc.html" || path === "arcodds.html" || path === "index.html";
  }

  function runEnhancements() {
    replaceBrandingAndLabels();
    injectHeroTrust();
    injectHomeStats();
    injectHomeSections();
    enhanceStatusPage();
    enhanceDocsPage();
  }

  window.PredictArcPremium = { runEnhancements, leaderboardMarkup };
  document.addEventListener("DOMContentLoaded", runEnhancements);
  window.addEventListener("load", () => setTimeout(runEnhancements, 120));
  window.addEventListener("PredictArc:markets-updated", () => setTimeout(runEnhancements, 80));
})();
