import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label, Orb, WalletButton } from '@/components/site'
import { BigOdds, Halftone, OddsBar, PoolChart } from '@/components/market'
import { ARC, addressUrl, fetchBalance, marketKey, parseMarketKey, txUrl, type Market as MarketT, type Side } from '@/lib/chain'
import { bettorCount, formatDate, formatUsdc, marketImage, marketState, refreshMarkets, shortAddress, stateLabel, timeAgo, useMarkets } from '@/lib/markets'
import { quote } from '@/lib/payout'
import { useBoot, useScrollMotion } from '@/lib/motion'
import { placeBet, useWallet } from '@/lib/wallet'

interface Brief {
  summary: string
  yesCase: string[]
  noCase: string[]
  risks: string[]
  watchlist: string[]
}

function localBrief(market: MarketT): Brief {
  const yes = market.yesOdds
  return {
    summary: `The pool prices "${market.question}" at ${yes}% YES and ${100 - yes}% NO.`,
    yesCase: [`The pool leans ${yes >= 50 ? 'toward' : 'against'} YES at ${yes}%.`, `A clear catalyst before ${formatDate(market.deadline)} could move it.`, 'The question resolves on a single, checkable outcome.'],
    noCase: [`NO still holds ${100 - yes}% of the pool.`, 'Timing risk: the event must happen before the deadline.', 'Weak or late evidence favours NO.'],
    risks: ['Testnet pools are small, so one bet can swing the odds.', 'Pool odds reflect stakes, not a forecast.', 'The contract owner sets the outcome after the deadline.'],
    watchlist: [`News around ${market.category}.`, 'Large bets landing on either side.', 'The resolution source near the deadline.'],
  }
}

function AiBrief({ market }: { market: MarketT }) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const response = await fetch('/api/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: { id: market.id, q: market.question, cat: market.category, yes: market.yesOdds, closes: formatDate(market.deadline), rule: market.rules ?? 'Resolved by the owner from the question wording.', source: 'PredictArc on-chain pool odds' } }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setBrief(data.brief)
      setNote('')
    } catch {
      setBrief(localBrief(market))
      setNote('Local preview: the AI service is not reachable from this build.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cell" data-reveal>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label className="text-ink">AI brief</Label></span>
        <button type="button" onClick={generate} disabled={loading} className="press label hover-ink border border-line-strong px-3 py-2 disabled:opacity-50">
          {brief ? 'Refresh' : 'Generate'}
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-4 p-6"><Orb state="composing" label="Writing brief" /><Label>Reading the question, pools and deadline…</Label></div>
      ) : brief ? (
        <div className="p-5">
          <p className="text-lg leading-snug">{brief.summary}</p>
          <div className="mt-5 grid gap-px bg-line sm:grid-cols-2">
            {([['Yes case', brief.yesCase], ['No case', brief.noCase], ['Risks', brief.risks], ['Watch', brief.watchlist]] as const).map(([title, items]) => (
              <div key={title} className="bg-paper p-4">
                <Label>{title}</Label>
                <ul className="mt-2 space-y-1.5 text-sm">{items.map((item) => <li key={item}>— {item}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="label mt-4 text-muted">{note || 'Informational only, not financial advice.'}</p>
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">A neutral summary of the YES and NO cases, risks and what to watch. Not financial advice.</p>
      )}
    </div>
  )
}

function TradePanel({ market }: { market: MarketT }) {
  const { account } = useWallet()
  const [side, setSide] = useState<Side>('YES')
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceTick, setBalanceTick] = useState(0)
  const stake = Number(amount) || 0
  const GAS_RESERVE = 0.02 // USDC is also Arc's gas token, so keep a little back
  const tooMuch = balance !== null && stake > balance - GAS_RESERVE

  useEffect(() => {
    if (!account) return setBalance(null)
    let live = true
    fetchBalance(account).then((value) => live && setBalance(value)).catch(() => {})
    return () => {
      live = false
    }
  }, [account, balanceTick])
  const sidePool = side === 'YES' ? market.yesPool : market.noPool
  const otherPool = side === 'YES' ? market.noPool : market.yesPool
  const q = quote(stake, sidePool, otherPool)
  const state = marketState(market)
  const odds = side === 'YES' ? market.yesOdds : 100 - market.yesOdds

  async function submit() {
    if (!(stake > 0)) return
    setPending(true)
    const run = placeBet(market.version, market.id, side === 'YES', stake)
    toast.promise(run, {
      loading: `Placing ${stake} USDC on ${side}…`,
      success: (hash) => ({ message: 'Bet confirmed on Arc Testnet', action: { label: 'View tx', onClick: () => window.open(txUrl(hash), '_blank', 'noopener') } }),
      error: (error) => (error as Error).message?.split('(')[0] || 'Bet failed',
    })
    try {
      await run
      setAmount('')
      await refreshMarkets()
    } catch {
      /* toast already reported it */
    } finally {
      setPending(false)
      setBalanceTick((tick) => tick + 1)
    }
  }

  return (
    <div className="cell lg:sticky lg:top-[57px]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <Label className="text-ink">Trade</Label>
        <Label>USDC / Arc</Label>
      </div>
      <div className="grid grid-cols-2 border-b border-line" role="group" aria-label="Side">
        {(['YES', 'NO'] as Side[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSide(option)}
            aria-pressed={side === option}
            className={`press font-display min-h-14 text-2xl font-bold ${option === 'NO' ? 'border-l border-line' : ''} ${side === option ? (option === 'YES' ? 'bg-ink text-paper' : 'bg-signal text-on-signal') : 'hover:bg-paper-2'}`}
          >
            {option} <span className="text-base">{option === 'YES' ? market.yesOdds : 100 - market.yesOdds}%</span>
          </button>
        ))}
      </div>
      <div className="space-y-4 p-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="amount" className="label text-muted">Amount</label>
            {balance !== null && (
              <span className="label text-muted">
                Balance {Number(balance.toFixed(4))} USDC
                <button type="button" onClick={() => setAmount(String(Math.max(0, Math.floor((balance - GAS_RESERVE) * 100) / 100)))} className="press ml-2 border border-line-strong px-1.5 py-0.5 text-ink hover:bg-ink hover:text-paper">Max</button>
              </span>
            )}
          </div>
          <div className="mt-2 flex border border-line-strong focus-within:border-ink">
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="font-display w-full bg-transparent px-3 py-3 text-2xl outline-none"
            />
            <span className="label grid place-items-center px-3 text-muted">USDC</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-px bg-line">
            {[1, 5, 10, 25].map((value) => (
              <button key={value} type="button" onClick={() => setAmount(String(value))} className="press label hover-ink bg-paper py-2.5">{value}</button>
            ))}
          </div>
        </div>
        <dl className="space-y-2 border-y border-line py-4 text-sm">
          {[
            ['Pool odds', `${odds}%`],
            ['Your share of side', stake ? `${q.share.toFixed(1)}%` : '—'],
            ['Payout if right', stake ? `${q.payout.toFixed(4)} USDC` : '—'],
            ['Profit', stake ? (q.noCounterparty ? 'No one on the other side yet' : `+${q.profit.toFixed(4)} USDC`) : '—'],
            ['Fee (2% of losing pool)', stake ? `${q.fee.toFixed(4)} USDC` : '—'],
          ].map(([term, value]) => (
            <div key={term} className="flex justify-between gap-4"><dt className="text-muted">{term}</dt><dd className="font-mono">{value}</dd></div>
          ))}
        </dl>
        {state !== 'open' ? (
          <p className="label bg-ink p-3 text-paper">
            {state === 'resolved' ? `Resolved ${market.outcome}. Winners claim from Portfolio.` : state === 'cancelled' ? 'Cancelled. Every bettor can refund their full stake from Portfolio.' : 'Trading closed. Waiting for the owner to resolve.'}
          </p>
        ) : market.version === 1 ? (
          <p className="label border border-line-strong p-3">Legacy contract: new bets are closed here. Existing positions stay claimable. <Link to="/markets" className="underline">See live v2 markets</Link></p>
        ) : account ? (
          <>
          <button
            type="button"
            onClick={submit}
            disabled={!stake || pending || tooMuch}
            className={`press label flex min-h-13 w-full items-center justify-center gap-3 disabled:opacity-40 ${side === 'YES' ? 'bg-ink text-paper' : 'bg-signal text-on-signal'}`}
          >
            {pending && <Orb state="working" size={20} label="Submitting" />}
            {pending ? 'Confirm in wallet…' : tooMuch ? 'Not enough USDC' : `Buy ${side} for ${stake || 0} USDC`}
          </button>
          {tooMuch && <a href={ARC.faucet} target="_blank" rel="noreferrer" className="label block text-center underline">Get free test USDC</a>}
          </>
        ) : (
          <WalletButton className="min-h-13 w-full justify-center" />
        )}
        <p className="text-xs leading-relaxed text-muted">Pool-based: winners split the whole pool pro-rata, minus 2% of the losing side. Estimates move as others bet.</p>
      </div>
    </div>
  )
}

export default function Market() {
  const { id = '' } = useParams()
  const parsed = parseMarketKey(id)
  const key = parsed ? marketKey(parsed.version, parsed.id) : ''
  const scope = useRef<HTMLDivElement>(null)
  const { markets, bets, loading } = useMarkets()
  const market = markets.find((item) => item.key === key)
  useBoot(scope, Boolean(market))
  useScrollMotion(scope, Boolean(market))

  if (!market) {
    return (
      <div className="frame border-t-0">
        <div className="cell flex flex-col items-center gap-4 p-24">
          {loading ? <><Orb state="searching" label="Loading market" /><Label>Loading market…</Label></> : <><Label>Market not found</Label><Link to="/markets" className="underline">Back to markets</Link></>}
        </div>
      </div>
    )
  }

  const marketBets = bets.filter((bet) => bet.key === market.key)
  return (
    <div ref={scope}>
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell label flex items-center gap-2 px-5 py-3 md:col-span-12" data-boot>
          <Link to="/markets" className="hover:underline">Markets</Link> / <span>v{market.version} #{String(market.id).padStart(2, '0')}</span> / <span>{market.category}</span>{market.version === 1 && <span className="text-muted">/ legacy</span>}
          <span className="ml-auto flex items-center gap-2">{marketState(market) === 'closed' && <Orb state="solving" size={20} />}{stateLabel(market)}</span>
        </div>
        <div className="cell h-48 overflow-hidden md:col-span-4 md:h-auto" data-boot>
          <Halftone src={marketImage(market)} className="size-full" parallax eager />
        </div>
        <div className="cell flex flex-col justify-between gap-6 p-6 md:col-span-8 md:p-8" data-boot>
          <span className="flex items-center gap-2"><Asterisk /><Decode text={`Market ${String(market.id).padStart(2, '0')} / ${market.category}`} /></span>
          <SplitText text={market.question} tag="h1" splitType="words" className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-balance md:text-5xl" textAlign="left" />
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {[
              ['Volume', formatUsdc(market.volume)],
              ['Traders', String(bettorCount(bets, market.key))],
              ['Closes', formatDate(market.deadline)],
              ['Creator', shortAddress(market.creator)],
            ].map(([term, value]) => (
              <div key={term} className="bg-paper py-2 pr-3">
                <Label>{term}</Label>
                <div className="font-mono text-sm">{term === 'Creator' ? <a href={addressUrl(market.creator)} target="_blank" rel="noreferrer" className="hover:underline">{value}</a> : value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="frame grid border-t-0 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div data-reveal><BigOdds market={market} /></div>
          <div className="cell p-5" data-reveal>
            <OddsBar yes={market.yesOdds} />
          </div>
          <div className="cell p-5" data-reveal>
            <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label className="text-ink">Resolution rules</Label>{market.rules && <Label>· stored on-chain</Label>}</span>
            <p className="mt-3 max-w-2xl leading-relaxed">{market.rules ?? 'Legacy market: resolved by the contract owner from the plain wording of the question after the deadline.'}</p>
            {market.version === 2 && <p className="mt-2 text-sm text-muted">If the owner does not resolve within 30 days of the deadline, anyone can cancel the market and every bettor gets a full refund.</p>}
          </div>
          <div className="cell p-5" data-reveal>
            <Label className="text-ink">Pool odds history</Label>
            <div className="mt-4">{marketBets.length ? <PoolChart bets={marketBets} /> : <p className="text-sm text-muted">No trades yet. Odds start at 50/50 until the first bet lands.</p>}</div>
          </div>
          <AiBrief market={market} />
          <div className="cell" data-reveal>
            <div className="label border-b border-line px-5 py-3 text-ink">Arc Testnet activity</div>
            {marketBets.length ? [...marketBets].reverse().slice(0, 12).map((bet, index) => (
              <a key={index} href={bet.txHash ? txUrl(bet.txHash) : undefined} target="_blank" rel="noreferrer" className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 hover:bg-paper-2">
                <span className={`label px-1.5 py-0.5 text-center ${bet.side === 'YES' ? 'bg-ink text-paper' : 'bg-signal text-on-signal'}`}>{bet.side}</span>
                <span className="font-mono text-sm">{shortAddress(bet.user)}</span>
                <span className="label text-muted">{bet.amount} USDC · {timeAgo(bet.time)}</span>
              </a>
            )) : <p className="p-5 text-sm text-muted">No confirmed trades for this market yet.</p>}
          </div>
        </div>
        <TradePanel market={market} />
      </section>
    </div>
  )
}
