import { Link } from 'react-router'
import NumberFlow from '@number-flow/react'
import PixelTransition from '@/components/PixelTransition'
import { Asterisk, Label, Orb } from '@/components/site'
import type { Bet, Market } from '@/lib/chain'
import { formatDate, formatUsdc, marketImage, marketState, stateLabel } from '@/lib/markets'

export function Halftone({ src, alt = '', className = '', parallax = false, eager = false, color = false }: { src: string; alt?: string; className?: string; parallax?: boolean; eager?: boolean; color?: boolean }) {
  return (
    <div className={`halftone ${color ? 'in-color' : ''} ${className}`}>
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className={parallax ? 'scale-[1.15]' : ''} data-parallax={parallax || undefined} />
    </div>
  )
}

/** YES is ink, NO is signal red; both are labelled so colour never carries meaning alone. */
export function OddsBar({ yes, className = '' }: { yes: number; className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-2 w-full overflow-hidden bg-signal" role="img" aria-label={`YES ${yes} percent, NO ${100 - yes} percent`}>
        <div className="h-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${yes}%` }} />
      </div>
      <div className="label mt-2 flex justify-between">
        <span>Yes {yes}%</span>
        <span>No {100 - yes}%</span>
      </div>
    </div>
  )
}

function StateBadge({ market }: { market: Market }) {
  const state = marketState(market)
  return (
    <span className={`label inline-flex items-center gap-1.5 px-1.5 py-0.5 ${state === 'open' ? 'border border-line-strong' : 'bg-ink text-paper'}`}>
      {state === 'closed' && <Orb state="solving" size={20} label="Awaiting resolution" />}
      {stateLabel(market)}
    </span>
  )
}

function CardBody({ market, bettors }: { market: Market; bettors: number }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <Label>#{String(market.id).padStart(2, '0')} / {market.category}</Label>
        <span className="flex items-center gap-1.5">
          {market.version === 1 && <span className="label px-1.5 py-0.5 text-muted" title="Older ArcOdds contract: positions stay claimable, new bets go to v2 markets">Legacy</span>}
          <StateBadge market={market} />
        </span>
      </div>
      <h3 className="text-lg font-medium leading-snug text-balance">{market.question}</h3>
      <OddsBar yes={market.yesOdds} className="mt-auto" />
      <div className="label flex flex-wrap justify-between gap-x-3 gap-y-1 text-muted">
        <span>{formatUsdc(market.volume)}</span>
        <span>{bettors} traders</span>
        <span>{formatDate(market.deadline)}</span>
      </div>
    </div>
  )
}

/** Featured variant swaps photo for live odds through a pixel dissolve on hover. */
export function MarketCard({ market, bettors, featured = false }: { market: Market; bettors: number; featured?: boolean }) {
  return (
    <Link to={`/market/${market.key}`} className="cell hover-lift group flex flex-col bg-paper" data-reveal>
      {featured ? (
        <PixelTransition
          aspectRatio="62%"
          gridSize={10}
          pixelColor="#0b0b0b"
          animationStepDuration={0.35}
          firstContent={<Halftone src={marketImage(market)} className="size-full" color />}
          secondContent={
            <div className="flex size-full flex-col justify-between bg-ink p-4 text-paper">
              <span className="label">Pool odds</span>
              <span className="font-display text-6xl font-extrabold">{market.yesOdds}%</span>
              <span className="label">Yes / {formatUsdc(market.yesPool)} vs {formatUsdc(market.noPool)}</span>
            </div>
          }
        />
      ) : (
        <Halftone src={marketImage(market)} className="aspect-[16/9] border-b border-line" color />
      )}
      <CardBody market={market} bettors={bettors} />
    </Link>
  )
}

/** YES share of the pool after each bet, drawn as a stepped line. */
export function PoolChart({ bets }: { bets: Bet[] }) {
  if (!bets.length) return null
  let yes = 0
  let no = 0
  const points = bets.map((bet) => {
    if (bet.side === 'YES') yes += bet.amount
    else no += bet.amount
    return (yes / (yes + no)) * 100
  })
  const width = 600
  const height = 200
  const step = width / Math.max(points.length, 1)
  const y = (value: number) => height - (value / 100) * height
  const path = points.map((value, index) => `${index ? 'H' : 'M0 '}${index * step} V${y(value)}`).join(' ') + ` H${width}`
  const last = points[points.length - 1]
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible" role="img" aria-label={`YES share moved to ${Math.round(last)} percent over ${bets.length} trades`}>
        {[25, 50, 75].map((line) => (
          <line key={line} x1="0" x2={width} y1={y(line)} y2={y(line)} stroke="var(--line)" strokeDasharray="2 4" />
        ))}
        <path d={`${path} V${height} H0 Z`} fill="var(--ink)" opacity="0.06" />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" className="draw-line" pathLength={1} />
        <circle cx={width} cy={y(last)} r="5" fill="var(--signal)" />
      </svg>
      <figcaption className="label mt-3 flex items-center gap-2 text-muted">
        <Asterisk className="size-3" /> Yes share of pool after each of {bets.length} trades
      </figcaption>
    </figure>
  )
}

export function BigOdds({ market }: { market: Market }) {
  return (
    <div className="grid grid-cols-2">
      <div className="cell p-5">
        <Label>Yes</Label>
        <div className="font-display text-[clamp(48px,7vw,96px)] font-extrabold leading-none">
          <NumberFlow value={market.yesOdds} suffix="%" />
        </div>
        <Label className="mt-2 block">{formatUsdc(market.yesPool)} in pool</Label>
      </div>
      <div className="cell bg-signal p-5 text-on-signal">
        <span className="label">No</span>
        <div className="font-display text-[clamp(48px,7vw,96px)] font-extrabold leading-none">
          <NumberFlow value={100 - market.yesOdds} suffix="%" />
        </div>
        <span className="label mt-2 block">{formatUsdc(market.noPool)} in pool</span>
      </div>
    </div>
  )
}
