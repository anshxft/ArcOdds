// GET /api/og?key=v2-3 -> 1200x630 PNG share card in the site's cybercore style.
// Without a (valid) key it renders the generic site card.
import { ImageResponse } from "@vercel/og";
import { formatDate, readMarket, statusLabel } from "./_market.js";

const PAPER = "#e4e4e0";
const INK = "#0b0b0b";
const MUTED = "#5c5c58";
const LINE = "rgba(11,11,11,0.22)";
const SIGNAL = "#ff3b1f";
const FONT_BASE = "https://cdn.jsdelivr.net/fontsource/fonts";

let fontsRequest;
function loadFonts() {
  // woff, not woff2: the renderer (Satori) cannot read woff2
  fontsRequest ??= Promise.all([
    ["Tektur", `${FONT_BASE}/tektur@latest/latin-800-normal.woff`, 800],
    ["Grotesk", `${FONT_BASE}/space-grotesk@latest/latin-500-normal.woff`, 500],
    ["Mono", `${FONT_BASE}/space-mono@latest/latin-700-normal.woff`, 700],
  ].map(async ([name, url, weight]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`font ${name}: ${response.status}`);
    return { name, data: await response.arrayBuffer(), weight, style: "normal" };
  })).catch((error) => {
    fontsRequest = undefined;
    throw error;
  });
  return fontsRequest;
}

// Minimal element factory so this file needs no JSX build step.
const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children } });

const label = (text, extra = {}) => h("div", { fontFamily: "Mono", fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: MUTED, ...extra }, text);
// Same SVG asterisk as the site (the fonts above have no ✳ glyph)
const asterisk = (size) => ({
  type: "svg",
  props: {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    children: { type: "path", props: { d: "M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1", stroke: SIGNAL, strokeWidth: 3 } },
  },
});

function marketCard(market) {
  const questionSize = market.question.length > 70 ? 54 : 64;
  return h("div", { width: "100%", height: "100%", flexDirection: "column", background: PAPER, color: INK, border: `1px solid ${LINE}` },
    h("div", { height: 96, alignItems: "center", justifyContent: "space-between", padding: "0 48px", borderBottom: `1px solid ${LINE}` },
      h("div", { fontFamily: "Tektur", fontSize: 44, letterSpacing: -1 }, "predictarc"),
      label(`Market ${market.key} / ${market.category}`),
    ),
    h("div", { flex: 1, flexDirection: "column", justifyContent: "center", padding: "0 48px", gap: 18, borderBottom: `1px solid ${LINE}` },
      h("div", { alignItems: "center", gap: 14 }, asterisk(30), label(statusLabel(market), { color: INK })),
      h("div", { fontFamily: "Grotesk", fontSize: questionSize, lineHeight: 1.12, letterSpacing: -1 }, market.question),
    ),
    h("div", { height: 190 },
      h("div", { width: 330, flexDirection: "column", justifyContent: "center", padding: "0 40px", background: INK, color: PAPER },
        label("Yes", { color: PAPER }),
        h("div", { fontFamily: "Tektur", fontSize: 104, lineHeight: 1 }, `${market.yes}%`),
      ),
      h("div", { width: 330, flexDirection: "column", justifyContent: "center", padding: "0 40px", background: SIGNAL, color: INK },
        label("No", { color: INK }),
        h("div", { fontFamily: "Tektur", fontSize: 104, lineHeight: 1 }, `${100 - market.yes}%`),
      ),
      h("div", { flex: 1, flexDirection: "column", justifyContent: "center", gap: 14, padding: "0 40px" },
        label(`Closes ${formatDate(market.deadline)}`, { color: INK }),
        label(`Pool ${Number(market.volume.toFixed(2))} USDC`),
        label("arcpredict.xyz"),
      ),
    ),
  );
}

function siteCard() {
  return h("div", { width: "100%", height: "100%", flexDirection: "column", justifyContent: "space-between", background: PAPER, color: INK, padding: 56, border: `1px solid ${LINE}` },
    h("div", { justifyContent: "space-between", alignItems: "center" }, h("div", { alignItems: "center", gap: 14 }, asterisk(30), label("Prediction + Markets", { color: INK })), asterisk(30)),
    h("div", { fontFamily: "Tektur", fontSize: 214, letterSpacing: -10, lineHeight: 0.9 }, "predictarc"),
    h("div", { justifyContent: "space-between", alignItems: "flex-end" },
      h("div", { fontFamily: "Grotesk", fontSize: 40, maxWidth: 720, lineHeight: 1.2 }, "The crowd's best guess, priced in USDC and settled on Arc."),
      h("div", { background: SIGNAL, padding: "16px 22px" }, label("arcpredict.xyz", { color: INK })),
    ),
  );
}

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  const [fonts, market] = await Promise.all([loadFonts(), key ? readMarket(key) : null]);
  return new ImageResponse(market ? marketCard(market) : siteCard(), {
    width: 1200,
    height: 630,
    fonts,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" },
  });
}
