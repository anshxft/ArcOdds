import { Suspense, lazy, useRef } from 'react'
import { Link } from 'react-router'
import Shuffle from '@/components/Shuffle'
import CountUp from '@/components/CountUp'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label, Orb } from '@/components/site'
import { Halftone, MarketCard } from '@/components/market'
import { ARC, IS_TESTNET, switchNetwork, txUrl } from '@/lib/chain'
import { bettorCount, byRelevance, marketImage, marketState, shortAddress, timeAgo, useMarkets } from '@/lib/markets'
import { useBoot, useInView, useMarquee, useScrollMotion } from '@/lib/motion'
import { poolPayout } from '@/lib/payout'

function Ticker() {
  const { markets } = useMarkets()
  const track = useRef<HTMLDivElement>(null)
  useMarquee(track, markets.length > 0)
  const items = markets.filter((market) => marketState(market) === 'open').sort(byRelevance).map((market) => (
    <Link key={market.key} to={`/market/${market.key}`} className="label flex shrink-0 items-center gap-3 px-6 py-3 hover:bg-ink hover:text-paper">
      <Asterisk className="size-3" />
      <span className="normal-case tracking-normal">{market.question}</span>
      <span className="bg-ink px-1.5 text-paper">{market.yesOdds}%</span>
    </Link>
  ))
  return (
    <div className="frame overflow-hidden border-t-0" aria-label="Market ticker">
      <div className="cell">
        <div ref={track} className="flex w-max">
          {items}
          <div className="flex" aria-hidden="true">{items}</div>
        </div>
      </div>
    </div>
  )
}

function SectionHead({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="frame grid grid-cols-[1fr_auto] border-t-0">
      <div className="cell flex flex-col gap-2 p-5 md:p-6">
        <Decode text={kicker} className="text-muted" />
        <SplitText text={title} tag="h2" splitType="words" className="font-display text-3xl font-bold tracking-tight md:text-5xl" textAlign="left" />
      </div>
      <div className="cell flex items-end p-5 md:p-6">{action}</div>
    </div>
  )
}

// Decorative canvas effects load after the page, so they never block first paint.
const DotGrid = lazy(() => import('@/components/DotGrid'))
const FaultyTerminal = lazy(() => import('@/components/FaultyTerminal'))

// "predictarc" in Tektur 800 is ~4.73em wide; size it to fill the frame edge to edge.
const WORDMARK_SIZE = 'clamp(48px, calc((min(100vw, 1440px) - 76px) / 4.85), 290px)'

const TERMINAL_GRID: [number, number] = [2, 1] // stable reference: a new array would rebuild the WebGL context

export default function Home() {
  const scope = useRef<HTMLDivElement>(null)
  const { markets, bets, loading } = useMarkets()
  const ready = markets.length > 0
  const gridCell = useRef<HTMLDivElement>(null)
  const terminalCell = useRef<HTMLDivElement>(null)
  const gridOn = useInView(gridCell)
  const terminalOn = useInView(terminalCell)
  useBoot(scope)
  useScrollMotion(scope, ready)

  const featured = markets.filter((market) => marketState(market) === 'open').sort(byRelevance).slice(0, 3)
  const awaiting = markets.filter((market) => marketState(market) === 'closed')
  const resolved = markets.filter((market) => market.status === 1).sort((a, b) => b.deadline - a.deadline).slice(0, 4)
  const stats = [
    ['Markets', markets.length, '', 'On the Arc contract'],
    ['Volume', Math.round(markets.reduce((sum, m) => sum + m.volume, 0)), ' USDC', IS_TESTNET ? 'Test USDC in pools' : 'USDC in pools'],
    ['Traders', bettorCount(bets), '', 'Unique wallets'],
    ['Predictions', bets.length, '', 'Confirmed bets'],
    ['Resolved', markets.filter((m) => m.status === 1).length, '', 'Settled by owner'],
  ] as const
  // Profit counts settled markets only: winners get their pool share, losers lose the stake.
  const leaders = Object.values(
    bets.reduce<Record<string, { user: string; staked: number; count: number; pnl: number }>>((map, bet) => {
      map[bet.user] ??= { user: bet.user, staked: 0, count: 0, pnl: 0 }
      map[bet.user].staked += bet.amount
      map[bet.user].count += 1
      const market = markets.find((m) => m.key === bet.key)
      if (market?.status === 1) {
        const won = market.outcome === bet.side
        const [sidePool, otherPool] = bet.side === 'YES' ? [market.yesPool, market.noPool] : [market.noPool, market.yesPool]
        map[bet.user].pnl += won ? poolPayout(bet.amount, sidePool, otherPool) - bet.amount : -bet.amount
      }
      return map
    }, {}),
  ).sort((a, b) => b.pnl - a.pnl || b.staked - a.staked).slice(0, 5)
  const latest = [...bets].reverse().slice(0, 6)

  return (
    <div ref={scope}>
      {/* Boot strip: scans and captions, as in the reference header row */}
      <section className="frame grid grid-cols-2 border-t-0 md:grid-cols-12">
        <div className="cell col-span-1 h-28 md:col-span-4" data-boot>
          <Halftone src={marketImage({ question: 'bitcoin', category: 'crypto' })} className="size-full" eager />
          <Label className="absolute right-2 bottom-2 bg-paper px-1">Market 01 / crypto</Label>
        </div>
        <div className="cell hidden items-center justify-center md:col-span-4 md:flex" data-boot>
          <Decode text="Final / Market / Design 2026" className="text-muted" />
        </div>
        <div className="cell col-span-1 h-28 md:col-span-4" data-boot>
          <Halftone src={marketImage({ question: 'world cup', category: 'sports' })} className="size-full" eager />
          <Label className="absolute top-2 left-2 bg-paper px-1">Market 10 / sports</Label>
        </div>
      </section>

      {/* Wordmark */}
      <section className="frame border-t-0">
        <div className="cell overflow-hidden px-4 pt-6 pb-4 md:px-8" data-boot>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Asterisk /><Label className="text-ink">Prediction + Markets</Label></span>
            <Asterisk />
          </div>
          <Shuffle
            text="predictarc"
            tag="h1"
            className="font-display font-extrabold leading-[0.95] tracking-[-0.045em]"
            style={{ fontSize: WORDMARK_SIZE }}
            shuffleDirection="right"
            duration={0.45}
            shuffleTimes={2}
            stagger={0.035}
            triggerOnce
            triggerOnHover
            respectReducedMotion
            textAlign="center"
          />
        </div>
      </section>

      {/* Tagline / interactive grid / signal tile */}
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell flex flex-col justify-between gap-8 p-6 md:col-span-5 md:p-8" data-boot>
          <div>
            <p className="max-w-md text-2xl leading-snug md:text-[28px]">The crowd's best guess, priced in USDC and settled on Arc.</p>
            <p className="label mt-3 text-muted">{IS_TESTNET ? '/a testnet prediction market/' : '/live on Arc mainnet/'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/markets" className="press label bg-ink px-5 py-3.5 text-paper hover:bg-signal hover:text-on-signal">Explore markets</Link>
            {ARC.faucet ? (
              <a href={ARC.faucet} target="_blank" rel="noreferrer" className="press label border border-line-strong px-5 py-3.5 hover:bg-ink hover:text-paper">Claim free test USDC</a>
            ) : (
              <button type="button" onClick={() => switchNetwork('testnet')} className="press label border border-line-strong px-5 py-3.5 hover:bg-ink hover:text-paper">Try it free on testnet</button>
            )}
          </div>
        </div>
        <div ref={gridCell} className="cell relative hidden min-h-64 md:col-span-3 md:block" data-boot>
          {gridOn && <Suspense fallback={null}><DotGrid dotSize={4} gap={18} baseColor="#9a9a94" activeColor="#ff3b1f" proximity={110} shockRadius={200} shockStrength={4} /></Suspense>}
          <Label className="absolute bottom-3 left-3 bg-paper px-1">Move / click</Label>
        </div>
        <div className="md:col-span-4" data-boot>
          <div ref={terminalCell} className="cell relative h-56 overflow-hidden bg-signal md:h-[calc(100%-41px)]">
            <div className="absolute inset-0 mix-blend-screen">
              <Suspense fallback={null}><FaultyTerminal pause={!terminalOn} dpr={1} scale={1.6} gridMul={TERMINAL_GRID} digitSize={1.3} timeScale={0.4} scanlineIntensity={0.25} glitchAmount={0.6} flickerAmount={0.4} curvature={0} brightness={1.1} mouseStrength={0.3} /></Suspense>
            </div>
          </div>
          <div className="cell label flex h-[41px] items-center justify-center gap-2">Predict / Stake / Claim</div>
        </div>
      </section>

      {/* Stats */}
      <section className="frame grid grid-cols-2 border-t-0 md:grid-cols-5">
        {stats.map(([label, value, suffix, note], index) => (
          <div key={label} className="cell stat p-5" data-reveal style={{ '--i': index } as React.CSSProperties}>
            <span className="flex items-center gap-2">
              <span className="stat-dot" aria-hidden="true" />
              <Decode text={label} className="text-muted" />
            </span>
            <div className="stat-num font-display mt-2 text-4xl font-bold md:text-5xl">
              {loading ? <Orb state="searching" size={20} label="Loading" /> : <><CountUp to={value} duration={1.6} separator="," />{suffix && <span className="text-lg">{suffix}</span>}</>}
            </div>
            <Decode text={note} className="mt-1 text-muted" />
            <span className="stat-bar" aria-hidden="true" />
          </div>
        ))}
      </section>

      <Ticker />

      <div className="mt-20" />
      <SectionHead kicker="Live / v2 contract / rules on-chain" title="Fresh predictions" action={<Link to="/markets" className="press label hover-ink border border-line-strong px-4 py-2.5">All markets</Link>} />
      <section className="frame grid border-t-0 md:grid-cols-3">
        {loading
          ? <div className="cell col-span-full flex min-h-[460px] items-center justify-center gap-3 p-16"><Orb state="searching" label="Loading markets" /><Label>Reading {ARC.name}…</Label></div>
          : featured.map((market) => <MarketCard key={market.key} market={market} bettors={bettorCount(bets, market.key)} featured />)}
      </section>

      {awaiting.length > 0 && (
        <>
          <div className="mt-20" />
          <SectionHead kicker="Deadline passed / trading closed" title="Awaiting resolution" />
          <section className="frame grid border-t-0 sm:grid-cols-2 xl:grid-cols-4">
            {awaiting.map((market) => <MarketCard key={market.key} market={market} bettors={bettorCount(bets, market.key)} />)}
          </section>
        </>
      )}

      {resolved.length > 0 && (
        <>
          <div className="mt-20" />
          <SectionHead kicker="Settled / outcome on-chain" title="Recently resolved" />
          <section className="frame grid border-t-0 sm:grid-cols-2 xl:grid-cols-4">
            {resolved.map((market) => <MarketCard key={market.key} market={market} bettors={bettorCount(bets, market.key)} />)}
          </section>
        </>
      )}

      <div className="mt-20" />
      <SectionHead kicker="On-chain / Arc explorer" title="Activity & top predictors" />
      <section className="frame grid border-t-0 md:grid-cols-2">
        <div className="cell" data-reveal>
          <div className="label border-b border-line px-5 py-3 text-muted">Latest bets</div>
          {latest.length ? latest.map((bet, index) => {
            const market = markets.find((m) => m.key === bet.key)
            return (
              <a key={index} href={bet.txHash ? txUrl(bet.txHash) : undefined} target="_blank" rel="noreferrer" className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 hover:bg-paper-2">
                <span className={`label px-1.5 py-0.5 text-center ${bet.side === 'YES' ? 'bg-ink text-paper' : 'bg-signal text-on-signal'}`}>{bet.side}</span>
                <span className="truncate text-sm"><span className="font-mono">{shortAddress(bet.user)}</span> · {market?.question ?? bet.key}</span>
                <span className="label text-muted">{bet.amount} USDC · {timeAgo(bet.time)}</span>
              </a>
            )
          }) : <p className="p-5 text-sm text-muted">No on-chain bets yet.</p>}
        </div>
        <div className="cell" data-reveal>
          <div className="label grid grid-cols-[32px_1fr_auto_auto] gap-3 border-b border-line px-5 py-3 text-muted sm:grid-cols-[40px_1fr_auto_auto_auto] sm:gap-4"><span>Rank</span><span>Wallet</span><span className="hidden sm:block">Bets</span><span>Staked</span><span>P&amp;L</span></div>
          {leaders.map((row, index) => (
            <div key={row.user} className="grid grid-cols-[32px_1fr_auto_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[40px_1fr_auto_auto_auto] sm:gap-4">
              <span className="font-display text-xl font-bold">{String(index + 1).padStart(2, '0')}</span>
              <span className="font-mono text-sm">{shortAddress(row.user)}</span>
              <span className="label hidden sm:block">{row.count}</span>
              <span className="label">{Number(row.staked.toFixed(2))} USDC</span>
              <span className={`label px-1.5 ${row.pnl < 0 ? 'bg-signal text-on-signal' : 'bg-ink text-paper'}`}>{row.pnl >= 0 ? '+' : ''}{Number(row.pnl.toFixed(2))}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-20" />
      <SectionHead kicker="Human / expression / integration" title="How it works" />
      <section className="frame grid border-t-0 md:grid-cols-4">
        {[
          ['Connect', `Use any browser wallet. PredictArc switches it to ${ARC.name} for you.`],
          ['Fund', IS_TESTNET ? 'Claim free test USDC from the Circle faucet. It is also the gas token.' : 'Bring USDC to Arc (bridge it with CCTP). It is also the gas token.'],
          ['Predict', 'Stake on YES or NO. Your stake joins that side of the pool.'],
          ['Claim', 'After the deadline the owner sets the outcome. Winners split the pool minus 2%.'],
        ].map(([title, body], index) => (
          <div key={title} className="cell step flex min-h-56 flex-col justify-between p-5" data-reveal>
            <div className="flex items-start justify-between">
              <span className="step-num font-display text-6xl font-extrabold text-line-strong">{String(index + 1).padStart(2, '0')}</span>
              <svg viewBox="0 0 24 24" className="step-arrow size-6 text-signal" aria-hidden="true"><path d="M6 18 18 6M8 6h10v10" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>
            </div>
            <div className="step-copy">
              <h3 className="font-display text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
