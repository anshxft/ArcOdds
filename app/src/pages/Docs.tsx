import { Suspense, lazy, useRef } from 'react'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label } from '@/components/site'
import { ARC, CONTRACTS, CURRENT_VERSION, IS_TESTNET, addressUrl, type Version } from '@/lib/chain'
import { useBoot, useScrollMotion } from '@/lib/motion'

const Gallery = lazy(() => import('@/mascot/Gallery'))

const SECTIONS = [
  ['Getting started', 'Open Markets, pick a question, read the YES/NO pool odds, then connect a wallet to trade.'],
  ['Connect a wallet', `Any injected wallet works (MetaMask, Rabby, OKX, Coinbase). PredictArc adds and switches to ${ARC.name} before every signature.`],
  IS_TESTNET
    ? ['Get test USDC', `Use the Circle faucet (${ARC.faucet}) and pick Arc Testnet. USDC pays for bets and gas.`]
    : ['Get USDC', 'Bridge USDC to Arc from another chain with CCTP, or buy it in a wallet that supports Arc. USDC pays for bets and gas. Want to practise first? Switch to Testnet in the header for free test USDC.'],
  ['How payouts work', 'Each market has a YES pool and a NO pool. Winners split both pools pro-rata to their stake, minus a 2% fee taken from the losing pool. If nobody bet against you, you get your stake back.'],
  ['Cash out', 'Changed your mind? Until one hour before a market closes you can take all or part of your stake back from the market page or Portfolio, minus a 2% exit fee. The fee stops anyone from moving the odds with a big bet and leaving for free; the last hour is locked so the final odds stay put.'],
  ['Resolution', 'Trading stops at the deadline. The owner sets the outcome following the rules stored on-chain for each market. If nobody backed the winning side, the market is cancelled instead and everyone is refunded. If the owner does not resolve within 30 days, anyone can cancel it so bettors can refund.'],
  ['Legacy markets', 'Markets from older contracts that someone bet on stay visible, so those positions can still be claimed or refunded. New bets always go to the current contract.'],
  IS_TESTNET
    ? ['FAQ', 'This is the testnet version: no real funds. Odds are pool shares, not forecasts, and small pools move a lot.']
    : ['Risks', 'Mainnet uses real USDC and an unaudited contract, and the owner decides outcomes from the published rules. Only bet what you can afford to lose, and check that prediction markets are legal where you live. Odds are pool shares, not forecasts.'],
]

export default function Docs() {
  const scope = useRef<HTMLDivElement>(null)
  useBoot(scope)
  useScrollMotion(scope)
  return (
    <div ref={scope}>
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell p-6 md:col-span-8 md:p-8" data-boot>
          <Decode text="Manual / read me first" className="text-muted" />
          <SplitText text="Docs" tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(56px,10vw,150px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
        </div>
        <div className="cell flex flex-col justify-end gap-2 p-6 md:col-span-4 md:p-8" data-boot>
          {([3, 2, 1] as Version[]).map((version) => {
            const found = CONTRACTS[version]
            if (!found) return null
            return (
              <div key={version} className="flex flex-col gap-1">
                <Label>{version === CURRENT_VERSION ? `Contract v${version} (current, verified)` : `Legacy v${version} (verified)`}</Label>
                <a href={addressUrl(found.address)} target="_blank" rel="noreferrer" className="break-all font-mono text-sm hover:underline">{found.address}</a>
              </div>
            )
          })}
          <Label className="mt-2">Network</Label>
          <span className="font-mono text-sm">{ARC.name} · chain {ARC.chainId}</span>
        </div>
      </section>
      <section className="frame grid border-t-0 md:grid-cols-2">
        {SECTIONS.map(([title, body], index) => (
          <article key={title} id={title.toLowerCase().replaceAll(' ', '-')} className="cell p-6" data-reveal>
            <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label>{String(index + 1).padStart(2, '0')}</Label></span>
            <h2 className="font-display mt-3 text-2xl font-bold">{title}</h2>
            <p className="mt-2 text-muted">{body}</p>
          </article>
        ))}
      </section>
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    </div>
  )
}
