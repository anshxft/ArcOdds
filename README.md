# PredictArc

## New site (app/)

The redesigned React site lives in `app/` (Vite, React 19, Tailwind 4, GSAP, Lenis, anime.js, React Bits, thinking-orbs, Sonner). The HTML pages in this folder stay live until it replaces them.

```bash
cd app
npm install
npm run dev
```

Deploy (Vercel): import the repo, set **Root Directory** to `app` (framework: Vite), and add the `OPENROUTER_API_KEY` environment variable for AI briefs. `app/vercel.json` sends every non-`/api` path to the SPA; `app/api/ai-brief.js` is the AI brief function.

Owner tools: connect the contract owner's wallet and open `/admin` to create v2 markets, resolve closed ones, or cancel (refund) a market.

PredictArc is a simple prediction market MVP built for Arc Testnet.

Market discovery questions and displayed probabilities refresh from Polymarket's public read-only Gamma API. PredictArc testnet trades, volume, and settlement remain separate.

Arc Testnet deployments (both verified on the explorer):

- `PredictArcV2` (current): `0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796`. Rules on-chain, cancel + refunds, auto-refund for one-sided markets, 30-day stale-market escape hatch, two-step ownership. Deploy with `npx hardhat run scripts/deploy-v2.js --network arcTestnet` (markets in `scripts/markets-v2.js`).
- `ArcOdds` (legacy v1): `0x19D638Af6b2De9718Eff496fc27a304155D6Af44`. Existing positions stay claimable; no new bets from the new app.

## Arc Testnet

- RPC: `https://rpc.testnet.arc.network` (does not handle JSON-RPC batches; the app reads through Multicall3 instead)
- Explorer: `https://explorer.testnet.arc.io` (also the source of on-chain trade history)
- Chain ID: `5042002`
- Native gas token: `USDC`
- Faucet: `https://faucet.circle.com` (select Arc Testnet and claim test USDC)

## Deploy Contract

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add your deployer private key.

3. Deploy:

   ```bash
   npm run deploy:arc
   ```

4. Add the deployed contract address to the frontend:

   ```bash
   npm run set-address -- 0xYourContractAddress
   ```

The deploy script now creates the seeded markets and updates `contract.js` automatically.

## Test

```bash
npm test
```

Includes a check that the website's payout estimate matches the contract's real `claimWinnings` payout.

## Resolve A Market

After its deadline, resolve a market from the owner wallet:

```bash
MARKET=1 OUTCOME=yes npm run resolve:arc            # v1
VERSION=2 MARKET=1 OUTCOME=yes npm run resolve:arc  # v2
VERSION=2 MARKET=1 CANCEL="reason" npm run resolve:arc  # v2: void, bettors refund
```

Winning users can then claim from the Portfolio page.

## Open App

Open `predictarc.html` in a browser, connect MetaMask, OKX Wallet, Rabby, Trust Wallet, Coinbase Wallet, or another injected wallet, and switch/add Arc Testnet when prompted.

Do not upload `.env`, `node_modules`, `artifacts`, `cache`, or local deployment output when publishing the site. Add API keys in Vercel environment variables instead.

## Optional Supabase

PredictArc can run without Supabase. When configured, Supabase stores off-chain app data such as wallet profiles, activity events, portfolio cache, and watchlists. Arc Testnet smart contracts remain the source of truth for trading and settlement.

1. Create a Supabase project.
2. Open the SQL editor and run `supabase-schema.sql`.
3. Open `supabase.js` and add your public project URL and anon key:

   ```js
   const SUPABASE_URL = "https://your-project.supabase.co";
   const SUPABASE_ANON_KEY = "your-public-anon-key";
   ```

The anon key is public by design. Do not put service-role keys in frontend files.

## AI Briefs

The market detail page has an AI Brief panel. The server uses Gemini first when `GEMINI_API_KEY` is present, then OpenRouter when `OPENROUTER_API_KEY` is present, and can fall back to OpenAI when `OPENAI_API_KEY` is present.

For the free OpenRouter route, add these to `.env`:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
```

Then run:

```bash
npm run ai:server
```

Then open `http://localhost:4173/predictarc.html`. If the AI server or key is missing, the page still shows a local preview brief instead of breaking.
