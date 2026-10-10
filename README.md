# PredictArc

Parimutuel YES/NO prediction markets on Arc Testnet, paid in native USDC. Live at https://www.arcpredict.xyz.

- `contracts/`: `PredictArcV2.sol` (current) and `ArcOdds.sol` (legacy v1)
- `app/`: the site (Vite, React 19, Tailwind 4, viem, GSAP, Lenis, anime.js, React Bits, thinking-orbs)
- `api/`: Vercel functions: AI brief (`ai-brief.js`), share images (`og.js`), per-market link previews (`market-page.js`)
- `scripts/`: deploy, resolve and resolution-check scripts

## Contracts

Both verified on the Arc explorer:

- `PredictArcV2` (current): `0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796`. Rules on-chain, cancel + refunds, auto-refund for one-sided markets, 30-day stale-market escape hatch, two-step ownership.
- `ArcOdds` (legacy v1): `0x19D638Af6b2De9718Eff496fc27a304155D6Af44`. Existing positions stay claimable; no new bets from the app.

Fee: 2% of the losing pool. Payout = stake × (winning pool + losing pool − fee) / winning pool.

## Arc Testnet

- RPC: `https://rpc.testnet.arc.network` (does not handle JSON-RPC batches; the app reads through Multicall3 instead)
- Explorer: `https://explorer.testnet.arc.io` (also the source of on-chain trade history)
- Chain ID: `5042002`
- Native gas token: `USDC`
- Faucet: `https://faucet.circle.com`

## Run the site

```bash
cd app
npm install
npm run dev
```

Deploy: pushes to `main` on GitHub deploy to Vercel (project `arc-odds`, domain arcpredict.xyz). The root `vercel.json` builds `app/`, serves `app/dist`, sends app routes to the SPA, shows link-preview bots the per-market page, and redirects the old `.html` URLs. Set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) in Vercel for live AI briefs.

## Contracts: test and deploy

```bash
npm install
npm test
```

Tests include a check that the site's payout estimate (`app/src/lib/payout.ts`) matches the contract's real `claimWinnings` payout.

To deploy a fresh v2, copy `.env.example` to `.env`, add a testnet-only deployer key, then run `npm run deploy:arc` (markets come from `scripts/markets-v2.js`). Update the address in `app/src/lib/chain.ts`, `api/_market.js` and `scripts/check-resolutions.js`.

## Owner tasks

Connect the owner wallet and open `/admin` to create markets, resolve closed ones, or cancel (refund) a market. The same from the command line:

```bash
npm run check:arc                                           # what needs resolving, what closes soon
MARKET=1 OUTCOME=yes npm run resolve:arc                    # v1
VERSION=2 MARKET=1 OUTCOME=yes npm run resolve:arc          # v2
VERSION=2 MARKET=1 CANCEL="reason" npm run resolve:arc      # v2: void, bettors refund
```

Winners claim (and cancelled-market bettors refund) from the Portfolio page.

Never commit `.env`. Keep API keys in Vercel environment variables.
