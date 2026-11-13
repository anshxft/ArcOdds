import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import SplitText from '@/components/SplitText'
import { Decode, Orb } from '@/components/site'
import { MarketCard } from '@/components/market'
import { bettorCount, byRelevance, marketState, refreshMarkets, useMarkets } from '@/lib/markets'
import { useWatchlist } from '@/lib/watchlist'
import { ARC } from '@/lib/chain'
import { useBoot, useScrollMotion } from '@/lib/motion'
import { mascot } from '@/mascot/react'
import { usePageMeta } from '@/lib/meta'

const SORTS = { volume: 'Featured', closing: 'Closing soon', newest: 'Newest', traders: 'Most traders', yes: 'Yes %' } as const
type Sort = keyof typeof SORTS
const STATUSES = { all: 'All', open: 'Open', closed: 'Awaiting result', resolved: 'Resolved', watch: 'Watchlist' } as const
type Status = keyof typeof STATUSES

export default function Markets() {
  const scope = useRef<HTMLDivElement>(null)
  const { cat: pathCat } = useParams()
  const navigate = useNavigate()
  usePageMeta(
    pathCat ? `${pathCat[0].toUpperCase()}${pathCat.slice(1)} prediction markets` : 'Markets',
    pathCat ? `Bet YES or NO in USDC on ${pathCat} questions. Pool odds, rules on-chain, settled on Arc.` : 'Every open PredictArc market: crypto, finance, politics, sports and more. Bet YES or NO in USDC on Arc.',
  )
  const { markets, bets, loading, error } = useMarkets()
  const watchlist = useWatchlist()
  // Filters live in the URL (?cat=crypto&sort=closing&status=open&q=btc) so links and Back keep them.
  const [params, setParams] = useSearchParams()
  const category = pathCat || params.get('cat') || 'all'
  const sort = (params.get('sort') as Sort) in SORTS ? (params.get('sort') as Sort) : 'volume'
  const status = (params.get('status') as Status) in STATUSES ? (params.get('status') as Status) : 'all'
  const query = params.get('q') || ''
  const setParam = (name: string, value: string, fallback: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === fallback) next.delete(name)
      else next.set(name, value)
      return next
    }, { replace: true })
  // Categories have their own URL (/markets/crypto) so they can be shared and indexed.
  const setCategory = (value: string) => navigate({ pathname: value === 'all' ? '/markets' : `/markets/${value}`, search: params.toString() }, { replace: true })
  const setSort = (value: Sort) => setParam('sort', value, 'volume')
  const setStatus = (value: Status) => setParam('status', value, 'all')
  const setQuery = (value: string) => setParam('q', value, '')
  useBoot(scope)
  useScrollMotion(scope, markets.length > 0)

  const categories = useMemo(() => ['all', ...new Set(markets.map((market) => market.category))], [markets])
  const list = markets
    .filter((market) => (category === 'all' || market.category === category) && market.question.toLowerCase().includes(query.toLowerCase()))
    .filter((market) => (status === 'watch' ? watchlist.includes(market.key) : status === 'resolved' ? market.status !== 0 : status === 'all' || marketState(market) === status))
    .sort((a, b) => {
      if (sort === 'closing') return Number(marketState(a) !== 'open') - Number(marketState(b) !== 'open') || a.deadline - b.deadline
      if (sort === 'newest') return b.version - a.version || b.id - a.id
      if (sort === 'traders') return bettorCount(bets, b.key) - bettorCount(bets, a.key) || byRelevance(a, b)
      if (sort === 'yes') return b.yesOdds - a.yesOdds
      return byRelevance(a, b)
    })
  const open = markets.filter((market) => marketState(market) === 'open').length
  const found = list.length

  // Poring searches along with the visitor, and shrugs when nothing matches.
  useEffect(() => {
    if (!query.trim() || !markets.length) return
    const id = setTimeout(() => {
      if (found) mascot('searching', { ms: 1400 })
      else mascot('confused', { ms: 2600, say: `No "${query.trim().slice(0, 20)}" here. Try another word?` })
    }, 500)
    return () => clearTimeout(id)
  }, [query, found, markets.length])

  return (
    <div ref={scope}>
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell p-6 md:col-span-8 md:p-8" data-boot>
          <Decode text={`Index / ${markets.length} markets / ${open} open`} className="text-muted" />
          <SplitText text="Markets" tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(56px,10vw,150px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
        </div>
        <div className="cell flex flex-col justify-end gap-3 p-6 md:col-span-4 md:p-8" data-boot>
          <label className="label text-muted" htmlFor="search">Search</label>
          <input
            id="search"
            data-tour="search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bitcoin, NATO, GTA…"
            className="w-full border border-line-strong bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted focus:border-ink"
          />
        </div>
      </section>

      <section className="frame border-t-0">
        <div className="cell flex flex-wrap" role="group" aria-label="Status">
          {(Object.keys(STATUSES) as Status[]).map((key) => (
            <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key} className={`press label min-h-11 border-r border-line px-4 ${status === key ? 'bg-ink text-paper' : 'hover-ink'}`}>
              {STATUSES[key]}{key === 'watch' && watchlist.length ? ` (${watchlist.length})` : ''}
            </button>
          ))}
        </div>
      </section>
      <section className="frame grid border-t-0 md:grid-cols-[1fr_auto]">
        <div className="cell flex flex-wrap" role="group" aria-label="Category">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              aria-pressed={category === name}
              className={`press label min-h-11 border-r border-line px-4 ${category === name ? 'bg-ink text-paper' : 'hover-ink'}`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="cell flex flex-wrap" role="group" aria-label="Sort">
          {(Object.keys(SORTS) as Sort[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
              className={`press label min-h-11 border-r border-line px-4 last:border-r-0 ${sort === key ? 'bg-signal text-on-signal' : 'hover-ink'}`}
            >
              {SORTS[key]}
            </button>
          ))}
        </div>
      </section>

      <section className="frame grid border-t-0 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="cell flex flex-col" aria-hidden="true">
              <div className="skeleton aspect-[16/9] border-b border-line" />
              <div className="space-y-3 p-4">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-5 w-11/12" />
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-2 w-full" />
              </div>
            </div>
          ))}
        {loading && <span className="sr-only"><Orb state="searching" size={20} label={`Loading markets from ${ARC.name}`} /></span>}
        {error && !markets.length && (
          <div className="cell col-span-full flex flex-wrap items-center gap-4 p-10 text-sm">
            <span>Could not reach {ARC.name}: {error}</span>
            <button type="button" onClick={() => refreshMarkets()} className="press label bg-ink px-4 py-2.5 text-paper">Retry</button>
            <a href="/status" className="label underline">Check status</a>
          </div>
        )}
        {!loading && !list.length && !error && <p className="cell col-span-full p-10 text-sm text-muted">{status === 'watch' ? 'Your watchlist is empty. Tap the star on any market to follow it.' : 'No markets match. Try another search, status or category.'}</p>}
        {list.map((market) => <MarketCard key={market.key} market={market} bettors={bettorCount(bets, market.key)} />)}
      </section>
    </div>
  )
}
