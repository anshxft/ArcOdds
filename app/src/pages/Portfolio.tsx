import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import SplitText from '@/components/SplitText'
import CountUp from '@/components/CountUp'
import { Decode, Label, Orb, WalletButton } from '@/components/site'
import { Halftone } from '@/components/market'
import { fetchPositions, txUrl, type Position, type Version } from '@/lib/chain'
import { formatUsdc, marketImage, marketState, refreshMarkets, stateLabel, useMarkets } from '@/lib/markets'
import { poolPayout } from '@/lib/payout'
import { useBoot, useScrollMotion } from '@/lib/motion'
import { claimWinnings, refund, useWallet, errorText } from '@/lib/wallet'

export default function Portfolio() {
  const scope = useRef<HTMLDivElement>(null)
  const { account } = useWallet()
  const { markets } = useMarkets()
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [version, setVersion] = useState(0)
  useBoot(scope)
  useScrollMotion(scope, Boolean(positions?.length))

  useEffect(() => {
    if (!account) return
    let live = true
    setPositions(null)
    fetchPositions(account)
      .then((rows) => live && setPositions(rows))
      .catch(() => live && setPositions([]))
    return () => {
      live = false
    }
  }, [account, version])

  const rows = (positions ?? []).flatMap((position) => {
    const market = markets.find((m) => m.key === position.key)
    if (!market) return []
    const sidePool = position.side === 'YES' ? market.yesPool : market.noPool
    const otherPool = position.side === 'YES' ? market.noPool : market.yesPool
    const ifRight = poolPayout(position.amount, sidePool, otherPool) || position.amount
    const resolved = market.status === 1
    const won = resolved && market.outcome === position.side
    const refundable = market.status === 2 && !position.claimed
    return [{ ...position, market, ifRight, resolved, won, refundable, claimable: won && !position.claimed }]
  })
  const staked = rows.reduce((sum, row) => sum + row.amount, 0)
  // Only one side of a market can win, so count the best side per market.
  const best = Object.values(rows.filter((row) => !row.resolved && row.market.status !== 2).reduce<Record<string, number>>((map, row) => {
    map[row.key] = Math.max(map[row.key] ?? 0, row.ifRight)
    return map
  }, {})).reduce((sum, value) => sum + value, 0)
  const claimable = rows.filter((row) => row.claimable).reduce((sum, row) => sum + row.ifRight, 0)

  async function claim(version: Version, marketId: number, isRefund: boolean) {
    const run = isRefund ? refund(marketId) : claimWinnings(version, marketId)
    toast.promise(run, {
      loading: isRefund ? 'Refunding your stake…' : 'Claiming winnings…',
      success: (hash) => ({ message: isRefund ? 'Stake refunded' : 'Winnings claimed', action: { label: 'View tx', onClick: () => window.open(txUrl(hash), '_blank', 'noopener') } }),
      error: (error) => errorText(error, 'Transaction failed'),
    })
    try {
      await run
      await refreshMarkets()
      setVersion((value) => value + 1)
    } catch {
      /* reported by toast */
    }
  }

  return (
    <div ref={scope}>
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell p-6 md:col-span-8 md:p-8" data-boot>
          <Decode text="Your / positions / on Arc" className="text-muted" />
          <SplitText text="Portfolio" tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(56px,10vw,150px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
        </div>
        <div className="cell flex flex-col justify-end gap-3 p-6 md:col-span-4 md:p-8" data-boot>
          <Label>Wallet</Label>
          <WalletButton className="min-h-12 justify-center" />
        </div>
      </section>

      {!account ? (
        <section className="frame border-t-0">
          <div className="cell flex flex-col items-center gap-4 p-20 text-center">
            <Orb state="breathing" label="Waiting for a wallet" />
            <p className="max-w-sm text-muted">Connect a wallet to see your Arc Testnet positions, payouts and anything ready to claim.</p>
          </div>
        </section>
      ) : positions === null ? (
        <section className="frame border-t-0">
          <div className="cell flex items-center justify-center gap-3 p-20"><Orb state="searching" label="Loading positions" /><Label>Reading your positions…</Label></div>
        </section>
      ) : (
        <>
          <section className="frame grid grid-cols-2 border-t-0 md:grid-cols-4">
            {([
              ['Positions', rows.length, ''],
              ['Total staked', staked, ' USDC'],
              ['Best-case payout', best, ' USDC'],
              ['Claimable', claimable, ' USDC'],
            ] as const).map(([label, value, suffix], index) => (
              <div key={label} className={`cell p-5 ${index === 3 && value > 0 ? 'bg-signal text-on-signal' : ''}`} data-reveal>
                <span className="label">{label}</span>
                <div className="font-display mt-2 text-3xl font-bold md:text-4xl"><CountUp to={Number(value.toFixed(2))} duration={1} separator="," />{suffix && <span className="text-base">{suffix}</span>}</div>
              </div>
            ))}
          </section>
          <section className="frame border-t-0">
            {rows.length ? rows.map((row) => (
              <div key={`${row.key}-${row.side}`} className="cell grid grid-cols-[64px_1fr] items-center gap-4 p-4 md:grid-cols-[88px_1fr_90px_140px_140px_150px]" data-reveal>
                <Halftone src={marketImage(row.market)} className="aspect-square" color />
                <Link to={`/market/${row.key}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-medium">{row.market.question}</span>
                  <Label>{row.market.category} · {stateLabel(row.market)}{row.version === 1 ? ' · legacy' : ''}</Label>
                </Link>
                <span className={`label w-fit px-2 py-0.5 ${row.side === 'YES' ? 'bg-ink text-paper' : 'bg-signal text-on-signal'}`}>{row.side}</span>
                <div><Label>Staked</Label><div className="font-mono text-sm">{formatUsdc(row.amount)}</div></div>
                <div><Label>{row.resolved ? 'Payout' : 'If right'}</Label><div className="font-mono text-sm">{row.resolved && !row.won ? '0 USDC' : formatUsdc(row.ifRight)}</div></div>
                <div className="col-span-2 md:col-span-1">
                  {row.claimable || row.refundable ? (
                    <button type="button" onClick={() => claim(row.version, row.marketId, row.refundable)} className="press label w-full bg-signal px-3 py-3 text-on-signal">
                      {row.refundable ? 'Refund stake' : 'Claim'}
                    </button>
                  ) : (
                    <span className="label text-muted">{row.claimed ? (row.market.status === 2 ? 'Refunded' : 'Claimed') : row.resolved ? (row.won ? 'Won' : 'Lost') : marketState(row.market) === 'closed' ? 'Awaiting resolution' : 'Open'}</span>
                  )}
                </div>
              </div>
            )) : (
              <div className="cell flex flex-col items-center gap-3 p-16 text-center">
                <p className="text-muted">No positions yet.</p>
                <Link to="/markets" className="press label bg-ink px-5 py-3 text-paper">Explore markets</Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
