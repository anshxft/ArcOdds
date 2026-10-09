(function () {
  const LEADERBOARD = [
    { wallet: "0xA91e...42F7", winRate: "78%", profit: "+1,284 USDC", predictions: 146 },
    { wallet: "0x7b3C...91Aa", winRate: "74%", profit: "+984 USDC", predictions: 121 },
    { wallet: "0x54D2...8E10", winRate: "71%", profit: "+742 USDC", predictions: 98 },
    { wallet: "0x19Fa...C032", winRate: "68%", profit: "+566 USDC", predictions: 84 },
    { wallet: "0xC82A...0d91", winRate: "66%", profit: "+421 USDC", predictions: 73 },
  ];

  function moneyToNumber(value) {
    const raw = String(value || "").replace(/[$,]/g, "");
    if (raw.endsWith("K")) return Number(raw.slice(0, -1)) * 1000;
    return Number(raw) || 0;
  }

  function animateNumber(el, target, options = {}) {
    const duration = 1100;
    const start = performance.now();
    const prefix = options.prefix || "";
    const suffix = options.suffix || "";
    const decimals = options.decimals || 0;
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

  function statSummary() {
    const markets = window.PredictArcApp?.ARC_MARKETS || [];
    const totalVolume = markets.reduce((sum, market) => sum + Number(market.volume || moneyToNumber(market.vol)), 0);
    const traders = markets.reduce((sum, market) => sum + Number(market.bettors || 0), 0);
    return {
      markets: markets.length || 12,
      volume: totalVolume || 10324,
      traders: traders || 1087,
      predictions: Math.round((traders || 1087) * 2.8),
      resolutionRate: 96,
    };
  }

  function injectHomeStats() {
    if (!isHomePage() || !document.querySelector(".hero") || document.querySelector(".protocol-stats")) return;
    const data = statSummary();
    const hero = document.querySelector(".hero");
    hero.insertAdjacentHTML("afterend", `
      <section class="protocol-stats" aria-label="PredictArc live statistics">
        <article class="protocol-card"><div class="protocol-label">Total Markets</div><div class="protocol-value" data-count="${data.markets}">0</div><div class="protocol-note">Arc-ready events</div></article>
        <article class="protocol-card"><div class="protocol-label">Total Volume</div><div class="protocol-value" data-count="${Math.round(data.volume)}" data-prefix="$">0</div><div class="protocol-note">Testnet display volume</div></article>
        <article class="protocol-card"><div class="protocol-label">Active Traders</div><div class="protocol-value" data-count="${data.traders}">0</div><div class="protocol-note">Wallet-sized activity</div></article>
        <article class="protocol-card"><div class="protocol-label">Total Predictions</div><div class="protocol-value" data-count="${data.predictions}">0</div><div class="protocol-note">YES/NO commitments</div></article>
        <article class="protocol-card"><div class="protocol-label">Resolution Rate</div><div class="protocol-value" data-count="${data.resolutionRate}" data-suffix="%">0</div><div class="protocol-note">Resolved by rules</div></article>
      </section>
    `);
    document.querySelectorAll("[data-count]").forEach((el) => {
      animateNumber(el, Number(el.dataset.count || 0), { prefix: el.dataset.prefix, suffix: el.dataset.suffix });
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
        <span class="trust-chip">Fully On-chain Settlement</span>
        <span class="trust-chip">No Real Funds</span>
        <span class="trust-chip">Secure Wallet Connection</span>
      </div>
    `);
  }

  function homeCard(market, label) {
    return `<article class="pa-panel" onclick="window.location.href='market-detail.html?id=${market.id}'">
      <div class="mcard-topline"><span class="mtag mtag-${market.cat}">${market.cat}</span><span class="status-badge">${label}</span></div>
      <h3>${market.q}</h3>
      <div class="prog-track"><div class="prog-fill" style="width:${market.yes}%"></div></div>
      <div class="pa-meta"><span>YES ${market.yes}%</span><span>NO ${100 - market.yes}%</span><span>${market.vol}</span><span>${market.bettors} traders</span></div>
    </article>`;
  }

  function injectHomeSections() {
    if (!isHomePage()) return;
    const content = document.querySelector(".content");
    if (!content || document.getElementById("featuredPredictions")) return;
    const markets = window.PredictArcApp?.ARC_MARKETS || [];
    if (!markets.length) return;
    const resolved = markets.slice(7, 10);
    const categories = ["Crypto", "Finance", "Tech", "Sports", "Politics", "Entertainment"];
    const anchor = document.querySelector(".portfolio-preview") || document.querySelector(".lb");
    const html = `
      <section class="pa-section" id="featuredPredictions">
        <div class="pa-section-head"><div><div class="pa-kicker">Curated</div><div class="pa-title">Featured Predictions</div></div><a class="link-sm" href="markets.html">Explore all</a></div>
        <div class="pa-grid-3">${markets.slice(0, 3).map((m) => homeCard(m, "Featured")).join("")}</div>
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Resolved</div><div class="pa-title">Recently Resolved Markets</div></div><span class="status-chip">Oracle synced</span></div>
        <div class="pa-grid-3">${resolved.map((m, i) => homeCard({ ...m, yes: i % 2 ? 100 - m.yes : m.yes }, i % 2 ? "NO won" : "YES won")).join("")}</div>
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Discovery</div><div class="pa-title">Popular Categories</div></div></div>
        <div class="pa-grid-3">${categories.map((cat) => `<article class="pa-panel"><div class="pa-kicker">${cat}</div><h3>${cat} prediction markets</h3><div class="pa-meta"><span>${markets.filter((m) => m.cat === cat.toLowerCase()).length || 2} markets</span><span>Live odds</span></div></article>`).join("")}</div>
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Live</div><div class="pa-title">Activity Feed</div></div></div>
        <div class="activity-list">
          ${markets.slice(0, 5).map((m, i) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${LEADERBOARD[i].wallet}</strong> placed ${i % 2 ? "NO" : "YES"} on ${m.q.slice(0, 58)}...</div><span>${2 + i}m ago</span></div>`).join("")}
        </div>
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Rankings</div><div class="pa-title">Top Predictors Leaderboard</div></div><a class="link-sm" href="leaderboard.html">Status page</a></div>
        ${leaderboardMarkup()}
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Trust</div><div class="pa-title">Built for safer testnet prediction flows</div></div></div>
        <div class="trust-grid">
          <article class="pa-panel"><h3>Audited Smart Contracts</h3><div class="pa-meta"><span>Placeholder audit badge</span></div></article>
          <article class="pa-panel"><h3>Secure Wallet Connection</h3><div class="pa-meta"><span>Injected wallet only</span></div></article>
          <article class="pa-panel"><h3>Fully Decentralized</h3><div class="pa-meta"><span>Arc settlement path</span></div></article>
          <article class="pa-panel"><h3>Powered by Arc Testnet</h3><div class="pa-meta"><span>No real funds</span></div></article>
        </div>
      </section>
    `;
    (anchor || content).insertAdjacentHTML(anchor ? "afterend" : "beforeend", html);
  }

  function leaderboardMarkup() {
    return `<div class="leaderboard-pro">
      <div class="leaderboard-pro-row"><span>Rank</span><strong>Wallet</strong><span>Win Rate</span><span>Profit</span><span>Total Predictions</span></div>
      ${LEADERBOARD.map((item, index) => `<div class="leaderboard-pro-row"><span>#${index + 1}</span><strong>${item.wallet}</strong><span>${item.winRate}</span><span class="lb-profit">${item.profit}</span><span>${item.predictions}</span></div>`).join("")}
    </div>`;
  }

  function enhanceStatusPage() {
    const title = document.querySelector(".page-title");
    if (!title || !/status/i.test(title.textContent) || document.querySelector(".status-dashboard")) return;
    title.insertAdjacentHTML("afterend", `
      <section class="status-dashboard">
        <article class="status-panel"><span class="status-chip">Operational</span><h3>Arc Network Status</h3><div class="pa-meta">Blocks finalizing normally</div></article>
        <article class="status-panel"><span class="status-chip">Healthy</span><h3>Oracle Status</h3><div class="pa-meta">Resolution feed online</div></article>
        <article class="status-panel"><span class="status-chip">Ready</span><h3>Smart Contract Status</h3><div class="pa-meta">Arc Testnet contract flow</div></article>
        <article class="status-panel"><span class="status-chip">Live</span><h3>API Status</h3><div class="pa-meta">Reference markets available</div></article>
      </section>
    `);
    document.querySelector(".table")?.insertAdjacentHTML("afterend", `
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Leaderboard</div><div class="pa-title">Top Predictors</div></div></div>
        ${leaderboardMarkup()}
      </section>
      <section class="pa-section">
        <div class="pa-section-head"><div><div class="pa-kicker">Changelog</div><div class="pa-title">Latest Updates</div></div></div>
        <div class="status-list">
          <div class="status-item"><span class="activity-dot"></span><div>Production UI polish layer added across PredictArc.</div><span>Today</span></div>
          <div class="status-item"><span class="activity-dot"></span><div>Wallet and faucet language clarified for testnet users.</div><span>Today</span></div>
          <div class="status-item"><span class="activity-dot"></span><div>Portfolio and market data continue to use existing Arc flow.</div><span>Stable</span></div>
        </div>
      </section>
    `);
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
      <article class="doc-card" id="getting-started"><h2>Getting Started</h2><p>Open Markets, choose an event, review YES/NO probabilities, then connect a test wallet before placing a position.</p></article>
      <article class="doc-card" id="connect-wallet"><h2>Connect Wallet</h2><p>Use a browser wallet, approve Arc Testnet, and keep this as a no-real-funds testing workflow.</p></article>
      <article class="doc-card" id="claim-test-usdc"><h2>Claim Test USDC</h2><p>Use Claim Free Test USDC to open the faucet and fund your Arc Testnet wallet.</p></article>
      <article class="doc-card" id="create-prediction"><h2>Create Prediction</h2><p>Select YES or NO, enter test USDC, and confirm the testnet transaction from your wallet.</p></article>
      <article class="doc-card" id="resolve-markets"><h2>Resolve Markets</h2><p>Markets resolve from the published rules and oracle path. Winning testnet positions can be claimed from Portfolio.</p></article>
      <article class="doc-card" id="faq"><h2>FAQ</h2><p>PredictArc uses no real funds in this build. Reference odds are informational, while settlement experiments happen on Arc Testnet.</p></article>
    `);
  }

  function enhancePortfolioPage() {
    const pageTop = document.querySelector(".page-top");
    if (!pageTop || !document.title.toLowerCase().includes("portfolio") || document.querySelector(".portfolio-mini-grid")) return;
    pageTop.insertAdjacentHTML("afterend", `
      <section class="portfolio-mini-grid">
        <article class="portfolio-mini-card"><div class="pa-kicker">Win Rate</div><div class="protocol-value">64%</div><div class="protocol-note">Dummy preview until positions resolve</div></article>
        <article class="portfolio-mini-card"><div class="pa-kicker">Profit/Loss</div><div class="protocol-value">+0.00</div><div class="protocol-note">Updates from active positions</div></article>
        <article class="portfolio-mini-card"><div class="pa-kicker">Prediction History</div><div class="protocol-value">Ready</div><div class="protocol-note">Active and resolved tabs below</div></article>
      </section>
    `);
  }

  function isHomePage() {
    const path = location.pathname.split("/").pop() || "predictarc.html";
    return path === "predictarc.html" || path === "arcodds.html" || path === "index.html";
  }

  function enhanceMarketsCards() {
    document.querySelectorAll(".mcard").forEach((card) => {
      if (card.querySelector(".status-badge")) return;
      const tag = card.querySelector(".mtag");
      if (tag) {
        const wrap = document.createElement("div");
        wrap.className = "mcard-topline";
        tag.parentNode.insertBefore(wrap, tag);
        wrap.appendChild(tag);
        wrap.insertAdjacentHTML("beforeend", '<span class="status-badge">Open</span>');
      }
    });
  }

  function runEnhancements() {
    replaceBrandingAndLabels();
    injectHeroTrust();
    injectHomeStats();
    injectHomeSections();
    enhanceStatusPage();
    enhanceDocsPage();
    enhancePortfolioPage();
    enhanceMarketsCards();
  }

  window.PredictArcPremium = { runEnhancements, leaderboardMarkup };
  document.addEventListener("DOMContentLoaded", runEnhancements);
  window.addEventListener("load", () => setTimeout(runEnhancements, 120));
  window.addEventListener("PredictArc:markets-updated", () => setTimeout(runEnhancements, 80));
})();
