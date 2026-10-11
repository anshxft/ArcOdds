// GET /sitemap.xml (rewritten here in vercel.json): the site's pages plus every market on the
// current mainnet contract, read live so new markets show up without a deploy.
import { currentMarketKeys } from "./_market.js";

const SITE = "https://www.arcpredict.xyz";
const PAGES = ["/", "/markets", "/status", "/docs", "/privacy", "/terms"];

export async function GET() {
  const keys = await currentMarketKeys().catch(() => []); // RPC hiccup: still list the pages
  const urls = [...PAGES, ...keys.map((key) => `/market/${key}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE}${url}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
