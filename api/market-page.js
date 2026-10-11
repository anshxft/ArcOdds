// Served only to link-preview crawlers (see the user-agent rewrite in vercel.json):
// the SPA can't set per-market <meta> tags for bots that don't run JavaScript.
import { MAINNET_LIVE, formatDate, pickNet, readMarket, statusLabel } from "./_market.js";

const SITE = "https://www.arcpredict.xyz";
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const market = await readMarket(params.get("key"), pickNet(params.get("net")));
  // Testnet links keep ?net=testnet once mainnet is the default, so they open the same market.
  const netQuery = market?.testnet && MAINNET_LIVE ? "net=testnet" : "";
  const url = market ? `${SITE}/market/${market.key}${netQuery ? `?${netQuery}` : ""}` : SITE;
  const title = market ? `${market.question} — PredictArc` : "PredictArc — prediction markets on Arc";
  const description = market
    ? `${statusLabel(market)}. YES ${market.yes}% / NO ${100 - market.yes}% · closes ${formatDate(market.deadline)} · ${market.category}. Bet with ${market.testnet ? "free test USDC" : "USDC"} on Arc.`
    : "Prediction markets settled in USDC on Arc.";
  const image = market ? `${SITE}/api/og?key=${market.key}${netQuery ? `&${netQuery}` : ""}` : `${SITE}/api/og`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${escape(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PredictArc">
<meta property="og:url" content="${escape(url)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${escape(image)}">
</head><body><a href="${escape(url)}">${escape(title)}</a></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=600" },
  });
}
