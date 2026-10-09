import { useMemo, useRef, useState } from 'react'
import SplitText from '@/components/SplitText'
import { Decode, Label, Orb } from '@/components/site'
import { MarketCard } from '@/components/market'
import { bettorCount, byRelevance, marketState, useMarkets } from '@/lib/markets'
import { useBoot, useScrollMotion } from '@/lib/motion'

const SORTS = { volume: 'Featured', closing: 'Closing soon', yes: 'Yes %' } as const
type Sort = keyof typeof SORTS

export default function Markets() {
  const scope = useRef<HTMLDivElement>(null)
  const { markets, bets, loading, error } = useMarkets()
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<Sort>('volume')
  const [query, setQuery] = useState('')
  useBoot(scope)
  useScrollMotion(scope, markets.length > 0)

  const categories = useMemo(() => ['all', ...new Set(markets.map((market) => market.category))], [markets])
  const list = markets
    .filter((market) => (category === 'all' || market.category === category) && market.question.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'closing') return Number(marketState(a) !== 'open') - Number(marketState(b) !== 'open') || a.deadline - b.deadline
      if (sort === 'yes') return b.yesOdds - a.yesOdds
      return byRelevance(a, b)
    })
  const open = markets.filter((market) => marketState(market) === 'open').length

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
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bitcoin, NATO, GTA…"
            className="w-full border border-line-strong bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted focus:border-ink"
          />
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
        <div className="cell flex" role="group" aria-label="Sort">
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
        {loading && (
          <div className="cell col-span-full flex items-center justify-center gap-3 p-20">
            <Orb state="searching" label="Loading markets" />
            <Label>Reading Arc Testnet…</Label>
          </div>
        )}
        {error && !markets.length && <p className="cell col-span-full p-10 text-sm">Could not reach Arc Testnet: {error}</p>}
        {!loading && !list.length && !error && <p className="cell col-span-full p-10 text-sm text-muted">No markets match. Try another search or category.</p>}
        {list.map((market) => <MarketCard key={market.key} market={market} bettors={bettorCount(bets, market.key)} />)}
      </section>
    </div>
  )
}
