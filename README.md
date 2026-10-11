# PredictArc

Parimutuel YES/NO prediction markets on Arc Testnet, paid in native USDC. Live at https://www.arcpredict.xyz.

- `contracts/`: `PredictArcV3.sol` (current: V2 + cash-out), `PredictArcV2.sol` and `ArcOdds.sol` (legacy)
- `app/`: the site (Vite, React 19, Tailwind 4, viem, GSAP, Lenis, anime.js, React Bits, thinking-orbs)
- `api/`: Vercel functions: AI brief (`ai-brief.js`), share images (`og.js`), per-market link previews (`market-page.js`)
- `scripts/`: deploy, resolve and resolution-check scripts

## Contracts

Addresses live in `networks.json`. The newest contract on a network is current; older ones are legacy (their markets stay visible if anyone bet, and stay claimable).

- **PredictArcV3** (current): V2 plus cash-out. Mainnet `0x7718408EA41a92F1f2A356535BAE43cBe73275eb`, testnet `0x73318b5D028c1f8873a8b2c344Ef12397Fa6F0d1` (both verified).
- **PredictArcV2**: rules on-chain, cancel + refunds, auto-refund for one-sided markets, 30-day stale-market escape hatch, two-step ownership. Mainnet `0xA5C7BC89827a67d794DF11ee9D90c4331b34d15A`, testnet `0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796` (both verified).
- **ArcOdds** (v1, testnet only): `0x19D638Af6b2De9718Eff496fc27a304155D6Af44`.

Fee: 2% of the losing pool. Payout = stake × (winning pool + losing pool − fee) / winning pool.

Cash-out (V3): until 1 hour before the deadline a bettor can take all or part of a stake back for a 2% exit fee (`cashOut(marketId, side, amount)`).

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

Networks and contract addresses live in `networks.json` (repo root). The site, the share cards and the scripts all read it; the deploy script writes to it.

### Testnet

Copy `.env.example` to `.env`, set `PRIVATE_KEY` (testnet-only wallet), then `npm run deploy:arc` and `npm run markets:arc` (markets come from `scripts/markets-v2.js`).

### Mainnet (real USDC)

The contract is unaudited and the owner decides outcomes. Every mainnet write needs `CONFIRM_MAINNET=yes` (bash: `CONFIRM_MAINNET=yes npm run ...`; PowerShell: `$env:CONFIRM_MAINNET="yes"; npm run ...`).

1. Make a fresh wallet for the owner and fund it with a little USDC on Arc mainnet (bridge with CCTP). Deploying plus ~30 markets costs well under 1 USDC in gas.
2. Put its key in `.env` as `MAINNET_PRIVATE_KEY` (never the testnet key).
3. `CONFIRM_MAINNET=yes npm run deploy:mainnet` deploys PredictArcV3 and writes its address into `networks.json`.
4. `CONFIRM_MAINNET=yes npm run markets:mainnet` creates the markets (skips any that close within the hour).
5. `npx hardhat verify --network arcMainnet <address>` verifies the source on explorer.arc.io (if the explorer API refuses, verify by hand with the flattened source: `npx hardhat flatten contracts/PredictArcV2.sol`).
6. Commit `networks.json` and push. Once `arcMainnet.v2` is set, the site opens on mainnet by default, with a Mainnet / Testnet switch in the header and footer (`?net=testnet` in a link opens testnet).
7. Later, hand ownership to a multisig: `transferOwnership(safe)` from the owner, then `acceptOwnership()` from the Safe.

## Owner tasks

Connect the owner wallet and open `/admin` to create markets, resolve closed ones, or cancel (refund) a market. The same from the command line:

```bash
npm run check:arc                                           # what needs resolving, what closes soon
MARKET=1 OUTCOME=yes npm run resolve:arc                    # v1
VERSION=2 MARKET=1 OUTCOME=yes npm run resolve:arc          # v2
VERSION=2 MARKET=1 CANCEL="reason" npm run resolve:arc      # v2: void, bettors refund
CONFIRM_MAINNET=yes VERSION=2 MARKET=1 OUTCOME=yes npm run resolve:mainnet   # mainnet
```

Winners claim (and cancelled-market bettors refund) from the Portfolio page.

Never commit `.env`. Keep API keys in Vercel environment variables.

## Mascot

Poring (`app/src/mascot/`) is the site guide: `poring.avatar.json`, designed in [Bible Strong Avatar Lab](https://avatars.bible-strong.app) by Stéphane Montlouis-Calixte and rendered with `@bible-strong/avatar-react`.

- New visitors get a welcome and an optional tour; returning visitors get a greeting. Each page type has a one-time guide. Tour stops are elements marked `data-tour="..."`; edit `TOUR` and `PAGE_GUIDES` in `Mascot.tsx`.
- It roams (hops, climbs cards, peeks, tricks), watches the cursor, can be tapped (help menu: tour, tip, nap) or dragged and thrown.
- Make it react from any page: `mascot('happy', { say: 'Hi' })` from `app/src/mascot/react.ts`.
- The Docs page lists every mood ("Meet Poring").

The renderer caps a definition at 64 animations. After re-exporting Poring from the Studio, run `node scripts/extend-mascot.js app/src/mascot/poring.avatar.json` to add back the site's extra moods.

## License

AGPL-3.0-only (see `LICENSE`), because the mascot renderer is AGPL. If you run a modified copy as a public site, its source has to stay available; the site footer links to this repo.
