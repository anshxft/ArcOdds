// "Cash out" for a v3 position: first tap arms it and shows what you get back, second tap sends.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CASHOUT_FEE, txUrl, type Version } from '@/lib/chain'
import { formatUsdc, refreshMarkets } from '@/lib/markets'
import { cashOut, errorText } from '@/lib/wallet'
import { mascot } from '@/mascot/react'

interface CashOutProps {
  version: Version
  marketId: number
  side: 'YES' | 'NO'
  stakeWei: bigint
  stake: number
  onDone?: () => void
  className?: string
}

export function CashOutButton({ version, marketId, side, stakeWei, stake, onDone, className = '' }: CashOutProps) {
  const [armed, setArmed] = useState(false)
  const [pending, setPending] = useState(false)
  const receive = stake * (1 - CASHOUT_FEE)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(id)
  }, [armed])

  async function press() {
    if (!armed) return setArmed(true)
    setArmed(false)
    setPending(true)
    mascot('nervous', { ms: 60_000, say: `Cashing out your ${side}…` })
    const run = cashOut(version, marketId, side === 'YES', stakeWei)
    toast.promise(run, {
      loading: `Cashing out ${formatUsdc(stake)} ${side}…`,
      success: (hash) => ({ message: `Cashed out: ${formatUsdc(receive)} back`, action: { label: 'View tx', onClick: () => window.open(txUrl(hash), '_blank', 'noopener') } }),
      error: (error) => errorText(error, 'Cash-out failed'),
    })
    try {
      await run
      mascot('happy', { ms: 3000, say: `Got ${formatUsdc(receive)} back.` })
      await refreshMarkets()
      onDone?.()
    } catch {
      mascot('confused', { ms: 3000, say: 'That cash-out did not go through.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={press}
      disabled={pending}
      aria-live="polite"
      className={`press label px-3 py-2.5 disabled:opacity-50 ${armed ? 'bg-signal text-on-signal' : 'border border-ink hover-ink'} ${className}`}
    >
      {pending ? 'Cashing out…' : armed ? `Confirm: get ${formatUsdc(receive)}` : `Cash out ${side}`}
    </button>
  )
}
