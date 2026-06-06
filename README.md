# PredictArc

PredictArc is a simple prediction market MVP built for Arc Testnet.

Market discovery questions and displayed probabilities refresh from Polymarket's public read-only Gamma API. PredictArc testnet trades, volume, and settlement remain separate.

Current Arc Testnet deployment: `0x19D638Af6b2De9718Eff496fc27a304155D6Af44`

## Arc Testnet

- RPC: `https://rpc.testnet.arc.network`
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

## Resolve A Market

After its deadline, resolve a market from the owner wallet:

```bash
npm run resolve:arc -- 1 yes
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
