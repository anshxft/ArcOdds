import { useRef } from 'react'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label } from '@/components/site'
import { usePageMeta } from '@/lib/meta'
import { useBoot, useScrollMotion } from '@/lib/motion'

const UPDATED = 'October 12, 2026'
const CONTACT = 'Questions: message @imalanxx on X or open an issue at github.com/anshxft/ArcOdds.'

const PRIVACY = [
  ['No accounts, no tracking', 'PredictArc has no sign-up, sets no cookies, runs no ads and no analytics. We do not collect your name, email or any other personal details.'],
  ['Stored in your browser', 'A few settings stay on your device only: theme, Mainnet or Testnet, the last wallet you connected (so it reconnects), the mainnet risk checkbox, and Poring preferences. Clear this site’s data in your browser to remove them.'],
  ['Public by design', 'Bets, cash-outs, claims and refunds are transactions on the Arc blockchain. Your wallet address and amounts are public and permanent, and nobody (including us) can delete them.'],
  ['Services your browser talks to', 'The site reads markets from the public Arc RPC and trade history from the Arc explorer. Your wallet (MetaMask, OKX and others) works under its own privacy policy. The site and its API are hosted on Vercel, which keeps standard server logs such as IP addresses.'],
  ['AI brief', 'Only when you press Generate, the market’s question, category, odds, deadline and rules are sent through our server to an AI model via OpenRouter. No wallet address or personal data is included.'],
  ['Sharing', 'The X, WhatsApp and Telegram buttons only open those apps with a link to the market, and only when you click them.'],
  ['Contact', CONTACT],
]

const TERMS = [
  ['What PredictArc is', 'An open-source website for parimutuel YES/NO prediction markets that run as smart contracts on Arc. Bets, payouts, refunds and cash-outs happen on-chain in USDC.'],
  ['Beta, unaudited, real money', 'On Arc mainnet you use real USDC with a contract that has not been audited. You can lose your whole stake. Only bet what you can afford to lose. Testnet uses free test USDC and has no real value.'],
  ['Your responsibility', 'You must be of legal age and allowed to use prediction markets where you live. Do not use PredictArc if it is not legal for you. You are responsible for your wallet, keys and any taxes.'],
  ['How markets resolve', 'The contract owner sets each outcome after the deadline, following the rules stored on-chain for that market. One-sided markets are cancelled and refunded. If a market is not resolved within 30 days, anyone can cancel it and bettors get their stake back.'],
  ['Fees', '2% of the losing pool when a market resolves, and 2% of the amount when you cash out early. Network fees on Arc are paid in USDC.'],
  ['No custody', 'We never hold your funds; the contract does. We cannot reverse, cancel or refund a transaction on your behalf.'],
  ['Not advice', 'Odds are pool shares, not forecasts. The AI brief and everything else on the site is information, not financial advice.'],
  ['No warranty', 'The site and contracts are provided “as is”, without warranties of any kind. To the extent the law allows, we are not liable for losses from using them, including bugs, downtime, wallet problems or network issues.'],
  ['Changes and license', 'These terms may change; the date below shows the latest version. Deployed contracts cannot be changed. The code is open source under AGPL-3.0.'],
  ['Contact', CONTACT],
]

function LegalPage({ eyebrow, title, description, sections }: { eyebrow: string; title: string; description: string; sections: string[][] }) {
  const scope = useRef<HTMLDivElement>(null)
  usePageMeta(title, description)
  useBoot(scope)
  useScrollMotion(scope)
  return (
    <div ref={scope}>
      <section className="frame border-t-0">
        <div className="cell p-6 md:p-8" data-boot>
          <Decode text={eyebrow} className="text-muted" />
          <SplitText text={title} tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(48px,9vw,130px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
          <Label className="mt-4 block">Last updated {UPDATED}</Label>
        </div>
      </section>
      <section className="frame grid border-t-0 md:grid-cols-2">
        {sections.map(([heading, body], index) => (
          <article key={heading} className="cell p-6" data-reveal>
            <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label>{String(index + 1).padStart(2, '0')}</Label></span>
            <h2 className="font-display mt-3 text-2xl font-bold">{heading}</h2>
            <p className="mt-2 text-muted">{body}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

export function Privacy() {
  return <LegalPage eyebrow="Legal / privacy" title="Privacy" description="What PredictArc stores, what is public on-chain, and which services your browser talks to." sections={PRIVACY} />
}

export function Terms() {
  return <LegalPage eyebrow="Legal / terms of use" title="Terms" description="Plain-language terms for using PredictArc prediction markets on Arc." sections={TERMS} />
}
