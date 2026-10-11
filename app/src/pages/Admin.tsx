import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label, Orb, WalletButton } from '@/components/site'
import { fetchBalance, txUrl, type Market } from '@/lib/chain'
import { formatDate, formatUsdc, marketState, refreshMarkets, useMarkets } from '@/lib/markets'
import { useBoot } from '@/lib/motion'
import { cancelMarket, createMarket, resolveMarket, useIsOwner, useWallet, errorText } from '@/lib/wallet'
import { usePageMeta } from '@/lib/meta'

const CATEGORIES = ['crypto', 'finance', 'politics', 'sports', 'tech', 'entertainment']
const RESOLUTION_WINDOW = 30 * 86400 // PredictArcV2: after deadline + this, anyone can cancel

function daysFrom(seconds: number) {
  const days = Math.round((seconds * 1000 - Date.now()) / 86400000)
  return days === 0 ? 'today' : days > 0 ? `in ${days}d` : `${-days}d ago`
}

/** Wraps an owner transaction in a toast and refreshes the markets afterwards. */
async function run(label: string, action: () => Promise<string>) {
  const pending = action()
  toast.promise(pending, {
    loading: `${label}…`,
    success: (hash) => ({ message: `${label}: confirmed`, action: { label: 'View tx', onClick: () => window.open(txUrl(hash), '_blank', 'noopener') } }),
    error: (error) => errorText(error, `${label} failed`),
  })
  try {
    await pending
    await refreshMarkets()
    return true
  } catch {
    return false
  }
}

function CreateForm() {
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState('crypto')
  const [rules, setRules] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const deadlineTs = deadline ? Math.floor(Date.parse(`${deadline}:00Z`) / 1000) : 0
  const error = !deadline ? '' : deadlineTs * 1000 < Date.now() + 10 * 60 * 1000 ? 'Deadline must be at least 10 minutes from now.' : ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (error || !question.trim() || !rules.trim() || !deadlineTs) return
    setBusy(true)
    const ok = await run('Create market', () => createMarket(question.trim(), category, rules.trim(), deadlineTs))
    setBusy(false)
    if (ok) {
      setQuestion('')
      setRules('')
      setDeadline('')
    }
  }

  const field = 'mt-2 w-full border border-line-strong bg-transparent px-3 py-3 outline-none focus:border-ink'
  return (
    <form onSubmit={submit} className="cell space-y-5 p-6">
      <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label className="text-ink">New market (v2)</Label></span>
      <div>
        <label htmlFor="q" className="label text-muted">Question</label>
        <input id="q" required maxLength={160} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Will … before …?" className={field} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cat" className="label text-muted">Category</label>
          <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATEGORIES.map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deadline" className="label text-muted">Trading closes (UTC)</label>
          <input id="deadline" type="datetime-local" required value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} aria-describedby="deadline-help" />
          <p id="deadline-help" className={`mt-1 text-xs ${error ? 'text-ink' : 'text-muted'}`}>{error || 'The outcome must be knowable within 30 days of this, or anyone can cancel the market.'}</p>
        </div>
      </div>
      <div>
        <label htmlFor="rules" className="label text-muted">Resolution rules (stored on-chain)</label>
        <textarea id="rules" required rows={3} maxLength={400} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="YES if [source] reports [event] before [date, UTC]. Otherwise NO." className={field} />
      </div>
      <button type="submit" disabled={busy || Boolean(error)} className="press label flex min-h-12 items-center gap-3 bg-ink px-6 text-paper hover:bg-signal hover:text-on-signal disabled:opacity-40">
        {busy && <Orb state="working" size={20} label="Creating" />}
        {busy ? 'Confirm in wallet…' : 'Create market'}
      </button>
    </form>
  )
}

function MarketRow({ market }: { market: Market }) {
  const state = marketState(market)
  const resolve = (outcome: boolean) => {
    const side = outcome ? 'YES' : 'NO'
    const oneSided = (outcome ? market.yesPool : market.noPool) === 0 && market.volume > 0
    const note = oneSided && market.version >= 2 ? '\n\nNobody backed this side, so the contract will cancel the market and refund everyone.' : ''
    if (window.confirm(`Resolve "${market.question}" as ${side}?\n\nThis is final and cannot be undone.${note}`)) {
      run(`Resolve ${market.key} ${side}`, () => resolveMarket(market.version, market.id, outcome))
    }
  }
  const cancel = () => {
    const reason = window.prompt(`Cancel "${market.question}"? Everyone can then refund their stake.\n\nReason (shown on-chain):`)
    if (reason?.trim()) run(`Cancel ${market.key}`, () => cancelMarket(market.version, market.id, reason.trim()))
  }
  return (
    <div className="cell grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <Link to={`/market/${market.key}`} className="font-medium hover:underline">{market.question}</Link>
        <Label className="block">
          {market.key} · {state === 'closed' ? 'awaiting resolution' : state} · closes {formatDate(market.deadline)} ({daysFrom(market.deadline)})
          {market.version >= 2 && ` · resolve by ${formatDate(market.deadline + RESOLUTION_WINDOW)}`} · {formatUsdc(market.volume)}
        </Label>
      </div>
      <div className="flex flex-wrap gap-2">
        {state === 'closed' && (
          <>
            <button type="button" onClick={() => resolve(true)} className="press label bg-ink px-4 py-2.5 text-paper">Resolve YES</button>
            <button type="button" onClick={() => resolve(false)} className="press label bg-signal px-4 py-2.5 text-on-signal">Resolve NO</button>
          </>
        )}
        {market.version >= 2 && (state === 'open' || state === 'closed') && (
          <button type="button" onClick={cancel} className="press label border border-line-strong px-4 py-2.5 hover:bg-ink hover:text-paper">Cancel</button>
        )}
      </div>
    </div>
  )
}

export default function Admin() {
  const scope = useRef<HTMLDivElement>(null)
  usePageMeta('Admin')
  const { account } = useWallet()
  const isOwner = useIsOwner()
  const { markets } = useMarkets()
  const [gas, setGas] = useState<number | null>(null)
  useBoot(scope)

  useEffect(() => {
    if (account && isOwner) fetchBalance(account).then(setGas).catch(() => {})
  }, [account, isOwner, markets])

  const needsAction = markets.filter((market) => marketState(market) === 'closed')
  const upcoming = markets.filter((market) => marketState(market) === 'open').sort((a, b) => a.deadline - b.deadline)

  return (
    <div ref={scope}>
      <section className="frame grid border-t-0 md:grid-cols-12">
        <div className="cell p-6 md:col-span-8 md:p-8" data-boot>
          <Decode text="Owner / console" className="text-muted" />
          <SplitText text="Admin" tag="h1" splitType="chars" className="font-display mt-3 text-[clamp(56px,10vw,150px)] font-extrabold leading-[0.9] tracking-[-0.04em]" textAlign="left" />
        </div>
        <div className="cell flex flex-col justify-end gap-3 p-6 md:col-span-4 md:p-8" data-boot>
          <Label>Owner wallet</Label>
          <WalletButton className="min-h-12 justify-center" />
          {gas !== null && <Label>Gas balance {Number(gas.toFixed(4))} USDC</Label>}
        </div>
      </section>

      {!isOwner ? (
        <section className="frame border-t-0">
          <div className="cell p-16 text-center text-muted">
            {account ? 'This wallet is not the contract owner. Admin actions are owner-only.' : 'Connect the owner wallet to manage markets.'}
          </div>
        </section>
      ) : (
        <>
          <section className="frame border-t-0">
            <div className="label cell px-5 py-3 text-ink">Needs resolution ({needsAction.length})</div>
            {needsAction.length ? needsAction.map((market) => <MarketRow key={market.key} market={market} />) : <p className="cell p-5 text-sm text-muted">Nothing is waiting. Markets show up here once their deadline passes.</p>}
          </section>
          <section className="frame mt-12 grid lg:grid-cols-2">
            <CreateForm />
            <div className="min-w-0">
              <div className="label cell px-5 py-3 text-ink">Upcoming deadlines ({upcoming.length})</div>
              {upcoming.map((market) => <MarketRow key={market.key} market={market} />)}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
