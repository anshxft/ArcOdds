import { useRef } from 'react'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label } from '@/components/site'
import { ARC, CONTRACT_ADDRESS, addressUrl } from '@/lib/chain'
import { useBoot, useScrollMotion } from '@/lib/motion'

const SECTIONS = [
  ['Getting started', 'Open Markets, pick a question, read the YES/NO pool odds, then connect a wallet to trade.'],
  ['Connect a wallet', 'Any injected wallet works (MetaMask, Rabby, OKX, Coinbase). PredictArc adds and switches to Arc Testnet before every signature.'],
  ['Get test USDC', `Use the Circle faucet (${ARC.faucet}) and pick Arc Testnet. USDC pays for bets and gas.`],
  ['How payouts work', 'Each market has a YES pool and a NO pool. Winners split both pools pro-rata to their stake, minus a 2% fee taken from the losing pool. If nobody bet against you, you get your stake back.'],
  ['Resolution', 'Trading stops at the deadline. The contract owner then sets the outcome; winning positions can be claimed from Portfolio.'],
  ['FAQ', 'PredictArc runs on testnet with no real funds. Odds are pool shares, not forecasts, and small pools move a lot.'],
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
          <Label>Contract</Label>
          <a href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="break-all font-mono text-sm hover:underline">{CONTRACT_ADDRESS}</a>
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
    </div>
  )
}
