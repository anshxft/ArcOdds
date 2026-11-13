import { useRef } from 'react'
import { Link } from 'react-router'
import SplitText from '@/components/SplitText'
import { Decode, Label, Orb } from '@/components/site'
import { txUrl } from '@/lib/chain'
import { formatDateTime, formatUtc, useMarkets } from '@/lib/markets'
import { usePageMeta } from '@/lib/meta'
import { useBoot } from '@/lib/motion'

/** Every outcome the owner set and every cancellation, read from the contract's events. */
export default function Resolutions() {
  const scope = useRef<HTMLDivElement>(null)
  usePageMeta('Resolutions', 'Every PredictArc market outcome and cancellation, with the rules it followed and the on-chain transaction.')
  const { markets, resolutions, loading } = useMarkets()
  useBoot(scope)
  const byKey = new Map(markets.map((market) => [market.key, market]))

  return (
    <div ref={scope}>
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell p-6 md:col-span-8 md:p-8" data-boot>
          <Decode text="Public record / on-chain" className="text-muted" />
          <SplitText text="Resolutions" tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(48px,9vw,130px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
        </div>
        <p className="cell flex items-end p-6 text-sm text-muted md:col-span-4 md:p-8" data-boot>
          Each outcome is set by the contract owner after the deadline, following the rules stored on-chain for that market. Every entry links to its transaction so anyone can check it.
        </p>
      </section>
      <section className="frame border-t-0">
        {resolutions.length ? (
          resolutions.map((entry) => {
            const market = byKey.get(entry.key)
            const badge = entry.kind === 'cancelled' ? 'Cancelled' : `Resolved ${entry.outcome}`
            return (
              <article key={`${entry.key}-${entry.txHash}`} className="cell grid gap-3 p-5 md:grid-cols-[150px_1fr_auto] md:items-start">
                <span className={`label w-fit px-2 py-1 ${entry.kind === 'cancelled' ? 'border border-line-strong' : entry.outcome === 'YES' ? 'bg-ink text-paper' : 'bg-signal text-on-signal'}`}>{badge}</span>
                <div className="min-w-0">
                  <Link to={`/market/${entry.key}`} className="font-medium hover:underline">{market?.question ?? entry.key}</Link>
                  {market?.rules && <p className="mt-1 text-sm text-muted">Rules: {market.rules}</p>}
                  {entry.reason && <p className="mt-1 text-sm">Reason: {entry.reason}</p>}
                </div>
                <div className="flex flex-col gap-1 md:items-end">
                  <Label title={formatUtc(entry.time / 1000)}>{formatDateTime(entry.time / 1000)}</Label>
                  {entry.txHash && <a href={txUrl(entry.txHash)} target="_blank" rel="noopener noreferrer" className="label underline">View transaction</a>}
                </div>
              </article>
            )
          })
        ) : (
          <div className="cell flex flex-col items-center gap-3 p-16 text-center">
            {loading ? <Orb state="searching" label="Loading resolutions" /> : <Label>No market has been resolved or cancelled yet.</Label>}
          </div>
        )}
      </section>
    </div>
  )
}
