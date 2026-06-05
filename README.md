# ArcOdds

ArcOdds is a simple prediction market MVP built for Arc Testnet.

Market discovery questions and displayed probabilities refresh from Polymarket's public read-only Gamma API. ArcOdds testnet trades, volume, and settlement remain separate.

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

Open `arcodds.html` in a browser, connect MetaMask, and switch/add Arc Testnet when prompted.

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

Then open `http://localhost:4173/arcodds.html`. If the AI server or key is missing, the page still shows a local preview brief instead of breaking.
