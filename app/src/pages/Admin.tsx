import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import SplitText from '@/components/SplitText'
import { Asterisk, Decode, Label, Orb, WalletButton } from '@/components/site'
import { CURRENT_VERSION, fetchBalance, txUrl, type Market } from '@/lib/chain'
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
      <span className="flex items-center gap-2"><Asterisk className="size-3" /><Label className="text-ink">New market (v{CURRENT_VERSION})</Label></span>
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

type Pending = { kind: 'resolve'; outcome: boolean } | { kind: 'cancel' }

/** Final, irreversible owner actions: show the facts and make the owner type the outcome to confirm. */
function ConfirmDialog({ market, pending, onClose }: { market: Market; pending: Pending; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const word = pending.kind === 'cancel' ? 'CANCEL' : pending.outcome ? 'YES' : 'NO'
  const oneSided = pending.kind === 'resolve' && (pending.outcome ? market.yesPool : market.noPool) === 0 && market.volume > 0
  const ready = typed.trim().toUpperCase() === word && (pending.kind === 'resolve' || reason.trim().length > 0)
  const confirm = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    if (pending.kind === 'resolve') run(`Resolve ${market.key} ${word}`, () => resolveMarket(market.version, market.id, pending.outcome))
    else run(`Cancel ${market.key}`, () => cancelMarket(market.version, market.id, reason.trim()))
    onClose()
  }
  return (
    <dialog ref={dialog} onClose={onClose} className="m-auto w-[min(92vw,520px)] border border-ink bg-paper p-0 text-ink backdrop:bg-black/50">
      <form onSubmit={confirm} className="space-y-4 p-6">
        <Label className="text-ink">{pending.kind === 'cancel' ? 'Cancel market' : `Resolve ${word}`} · final, cannot be undone</Label>
        <p className="font-display text-xl font-bold leading-snug">{market.question}</p>
        <dl className="grid grid-cols-2 gap-px bg-line text-sm">
          <div className="bg-paper py-2"><dt className="label text-muted">YES pool</dt><dd className="font-mono">{formatUsdc(market.yesPool)}</dd></div>
          <div className="bg-paper py-2 pl-3"><dt className="label text-muted">NO pool</dt><dd className="font-mono">{formatUsdc(market.noPool)}</dd></div>
        </dl>
        {market.rules && <p className="text-sm text-muted">Rules: {market.rules}</p>}
        {oneSided && <p className="label border border-signal p-3">Nobody backed {word}, so the contract will cancel the market and refund everyone.</p>}
        {pending.kind === 'cancel' && (
          <label className="block">
            <span className="label text-muted">Reason (stored on-chain)</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} required className="mt-1 w-full border border-line-strong bg-transparent px-3 py-2" />
          </label>
        )}
        <label className="block">
          <span className="label text-muted">Type {word} to confirm</span>
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" className="mt-1 w-full border border-line-strong bg-transparent px-3 py-2 font-mono" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="press label border border-line-strong px-4 py-2.5">Back</button>
          <button type="submit" disabled={!ready} className={`press label px-4 py-2.5 disabled:opacity-40 ${word === 'NO' ? 'bg-signal text-on-signal' : 'bg-ink text-paper'}`}>{pending.kind === 'cancel' ? 'Cancel market' : `Resolve ${word}`}</button>
        </div>
      </form>
    </dialog>
  )
}

function MarketRow({ market }: { market: Market }) {
  const state = marketState(market)
  const [pending, setPending] = useState<Pending | null>(null)
  const resolve = (outcome: boolean) => setPending({ kind: 'resolve', outcome })
  const cancel = () => setPending({ kind: 'cancel' })
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
      {pending && <ConfirmDialog market={market} pending={pending} onClose={() => setPending(null)} />}
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
