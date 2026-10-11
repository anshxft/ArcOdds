import { useEffect, useRef, useState } from 'react'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label, Orb } from '@/components/site'
import { ARC, fetchMarkets } from '@/lib/chain'
import { useBoot, useScrollMotion } from '@/lib/motion'
import { usePageMeta } from '@/lib/meta'

async function probe(check: () => Promise<unknown>) {
  try {
    await Promise.race([check(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))])
    return true
  } catch {
    return false
  }
}

const CHECKS = [
  ['Arc network', 'Public RPC answering', () => fetch(ARC.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }) }).then((r) => { if (!r.ok) throw new Error() })],
  ['PredictArc contracts', 'current + legacy contracts readable on-chain', () => fetchMarkets()],
  ['Arc explorer', 'Trade history source', () => fetch(`${ARC.explorer}/api/v2/stats`).then((r) => { if (!r.ok) throw new Error() })],
] as const

export default function Status() {
  const scope = useRef<HTMLDivElement>(null)
  usePageMeta('Status', 'Live checks for the Arc network, the PredictArc contracts and the Arc explorer.')
  const [results, setResults] = useState<(boolean | null)[]>(CHECKS.map(() => null))
  useBoot(scope)
  useScrollMotion(scope)

  useEffect(() => {
    CHECKS.forEach(([, , check], index) => {
      probe(check).then((ok) => setResults((prev) => prev.map((value, i) => (i === index ? ok : value))))
    })
  }, [])

  return (
    <div ref={scope}>
      <section className="frame border-t-0">
        <div className="cell p-6 md:p-8" data-boot>
          <Decode text="System / live checks" className="text-muted" />
          <SplitText text="Status" tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(56px,10vw,150px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
        </div>
      </section>
      <section className="frame grid border-t-0 md:grid-cols-3">
        {CHECKS.map(([name, note], index) => (
          <div key={name} className="cell flex min-h-48 flex-col justify-between p-5" data-boot>
            <span className={`label w-fit px-2 py-1 ${results[index] === false ? 'bg-signal text-on-signal' : results[index] ? 'bg-ink text-paper' : 'border border-line-strong'}`}>
              {results[index] === null ? 'Checking' : results[index] ? 'Operational' : 'Unavailable'}
            </span>
            {results[index] === null && <Orb state="listening" size={20} label="Checking" />}
            <div>
              <h2 className="font-display text-2xl font-bold">{name}</h2>
              <Label>{note}</Label>
            </div>
          </div>
        ))}
      </section>
      <section className="frame grid border-t-0 md:grid-cols-3">
        {[
          ['Trading closes', "Automatically at each market's deadline, enforced by the contract."],
          ['Resolution', 'The owner sets the outcome per the on-chain rules. One-sided markets auto-refund; unresolved after 30 days, anyone can cancel. No oracle yet.'],
          ['Claiming', 'Winners claim their share of the pool from Portfolio. 2% of the losing pool is the fee.'],
        ].map(([title, body]) => (
          <div key={title} className="cell p-5" data-reveal>
            <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label className="text-ink">{title}</Label></span>
            <p className="mt-3 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
