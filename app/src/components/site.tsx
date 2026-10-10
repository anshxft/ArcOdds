import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ReactLenis, type LenisRef } from 'lenis/react'
import 'lenis/dist/lenis.css'
import { Toaster, toast } from 'sonner'
import { ThinkingOrb } from 'thinking-orbs'
import Noise from '@/components/Noise'
import VariableProximity from '@/components/VariableProximity'
import DecryptedText from '@/components/DecryptedText'
import { ARC, CONTRACTS, fetchPositions } from '@/lib/chain'
import { shortAddress, useMarkets } from '@/lib/markets'
import { gsap, reducedMotion } from '@/lib/motion'
import { connect, disconnect, useIsOwner, useWallet, walletOptions, type WalletOption } from '@/lib/wallet'
import { mascot } from '@/mascot/react'

const Mascot = lazy(() => import('@/mascot/Mascot'))

const NAV = [
  ['/markets', 'Markets'],
  ['/portfolio', 'Portfolio'],
  ['/status', 'Status'],
  ['/docs', 'Docs'],
] as const

/** The red ✳ of the reference, as SVG (no emoji icons). */
export function Asterisk({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 text-signal`} aria-hidden="true">
      <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`label text-muted ${className}`}>{children}</span>
}

/** Mono caption that decodes the first time it scrolls into view. */
export function Decode({ text, className = '' }: { text: string; className?: string }) {
  return <DecryptedText text={text} animateOn="view" sequential speed={28} parentClassName={`label block! ${className}`} encryptedClassName="text-signal" />
}

export function Orb({ state, size = 64, label }: { state: Parameters<typeof ThinkingOrb>[0]['state']; size?: 20 | 64; label?: string }) {
  return <ThinkingOrb state={state} size={size} aria-label={label} />
}

function Logo() {
  return (
    <Link to="/" className="font-display text-[22px] font-extrabold leading-none tracking-tight lowercase" aria-label="PredictArc home">
      predictarc
    </Link>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])
  return (
    <button type="button" onClick={() => {
      setDark(!dark)
      mascot(dark ? 'amazed' : 'dreamy', { ms: 1800, say: dark ? 'Lights on!' : 'Lights off!' })
    }} className="press label hover-ink flex h-full items-center px-4" aria-label="Toggle dark mode">
      {dark ? 'Light' : 'Dark'}
    </button>
  )
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const options = walletOptions()

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function pick(option: WalletOption) {
    setPending(option.name)
    try {
      const account = await connect(option)
      toast.success(`Connected ${shortAddress(account)}`)
      mascot('happy', { say: 'Wallet connected. Pick a market!' })
      onClose()
    } catch (error) {
      toast.error((error as Error).message || 'Wallet connection failed')
      mascot('confused', { say: 'Wallet did not connect.' })
      setPending(null)
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      className="wallet-dialog m-auto w-[min(420px,calc(100%-32px))] border border-line-strong bg-paper p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      data-lenis-prevent
    >
      <div className="cell flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2">
          <Asterisk />
          <span className="label">Connect wallet</span>
        </span>
        <button type="button" onClick={() => dialog.current?.close()} className="press label hover-ink px-2 py-1" aria-label="Close">
          Close
        </button>
      </div>
      {pending ? (
        <div className="flex flex-col items-center gap-4 px-5 py-10">
          <Orb state="connecting" label={`Connecting ${pending}`} />
          <span className="label">Approve in {pending}…</span>
        </div>
      ) : options.length ? (
        <ul>
          {options.map((option) => (
            <li key={option.name} className="cell border-r-0">
              <button type="button" onClick={() => pick(option)} className="press hover-ink flex w-full items-center gap-3 px-5 py-4 text-left">
                {option.icon ? <img src={option.icon} alt="" className="size-7" /> : <span className="grid size-7 place-items-center bg-ink font-mono text-xs text-paper">W</span>}
                <span className="font-medium">{option.name}</span>
                <span className="label ml-auto">{ARC.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-sm text-muted">No browser wallet found. Install MetaMask, Rabby or OKX Wallet, or open PredictArc inside a wallet browser.</p>
      )}
    </dialog>
  )
}

export function WalletButton({ className = '' }: { className?: string }) {
  const { account } = useWallet()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => (account ? (disconnect(), toast('Wallet disconnected'), mascot('sad', { ms: 2500, say: 'Bye for now!' })) : setOpen(true))}
        className={`press label flex items-center gap-2 bg-ink px-4 text-paper hover:bg-signal hover:text-on-signal ${className}`}
        title={account ? 'Disconnect wallet' : 'Connect wallet'}
      >
        <span className={`size-1.5 ${account ? 'bg-signal' : 'bg-paper'}`} aria-hidden="true" />
        {account ? shortAddress(account) : 'Connect wallet'}
      </button>
      {open && <WalletModal onClose={() => setOpen(false)} />}
    </>
  )
}

/** Markets where the connected wallet has a win or refund waiting. Toasts once per wallet per visit. */
const alerted = new Set<string>()
function useReadyToClaim() {
  const { account } = useWallet()
  const { markets } = useMarkets()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!account || !markets.length) return setCount(0)
    let live = true
    fetchPositions(account).then((positions) => {
      if (!live) return
      const ready = new Set(positions.filter((position) => {
        const market = markets.find((item) => item.key === position.key)
        return market && !position.claimed && ((market.status === 1 && market.outcome === position.side) || market.status === 2)
      }).map((position) => position.key)).size
      setCount(ready)
      if (ready && !alerted.has(account)) {
        alerted.add(account)
        toast(`${ready} ${ready === 1 ? 'market has' : 'markets have'} a payout ready`, { action: { label: 'Claim', onClick: () => navigate('/portfolio') }, duration: 10000 })
        mascot('excited', { ms: 4000, say: 'You have a payout waiting!' })
      }
    }).catch(() => {})
    return () => {
      live = false
    }
  }, [account, markets, navigate])
  return count
}

function NavBadge({ count }: { count: number }) {
  return count ? <span className="ml-2 bg-signal px-1.5 text-on-signal" aria-label={`${count} ready to claim`}>{count}</span> : null
}

function Header() {
  const isOwner = useIsOwner()
  const ready = useReadyToClaim()
  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md">
      <div className="frame grid h-14 grid-cols-[auto_1fr_auto] border-t-0">
        <div className="cell flex items-center px-4 md:px-6">
          <Logo />
        </div>
        <nav className="cell hidden items-stretch md:flex" aria-label="Main">
          <span className="hidden items-center gap-3 border-r border-line px-5 xl:flex">
            <span className="h-px w-10 bg-line-strong" aria-hidden="true" />
            <span className="label text-muted">Testnet / 2026</span>
          </span>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} data-tour={label.toLowerCase()} className={({ isActive }) => `press label hover-ink flex items-center px-4 lg:px-5 ${isActive ? 'bg-ink text-paper' : ''}`}>
              {label}{to === '/portfolio' && <NavBadge count={ready} />}
            </NavLink>
          ))}
          {isOwner && (
            <NavLink to="/admin" className={({ isActive }) => `press label flex items-center gap-2 px-4 lg:px-5 ${isActive ? 'bg-signal text-on-signal' : 'hover-ink'}`}>
              <Asterisk className="size-3" /> Admin
            </NavLink>
          )}
          <a href={ARC.faucet} target="_blank" rel="noreferrer" data-tour="faucet" className="press label hover-ink ml-auto hidden items-center gap-2 border-l border-line px-5 whitespace-nowrap lg:flex">
            <Asterisk className="size-3" /> Free test USDC
          </a>
        </nav>
        <div className="cell flex items-stretch" data-tour="wallet">
          <span className="hidden md:block">
            <ThemeToggle />
          </span>
          <WalletButton />
        </div>
      </div>
      <nav className="frame flex overflow-x-auto border-t-0 md:hidden" aria-label="Main mobile">
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} data-tour={label.toLowerCase()} className={({ isActive }) => `cell label flex min-h-11 flex-1 items-center justify-center px-3 ${isActive ? 'bg-ink text-paper' : ''}`}>
            {label}{to === '/portfolio' && <NavBadge count={ready} />}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

function Footer() {
  const wordmark = useRef<HTMLDivElement>(null)
  return (
    <footer className="mt-24">
      <div className="frame grid md:grid-cols-4">
        <div className="cell p-6 md:col-span-2">
          <p className="max-w-sm text-lg leading-snug">Prediction markets settled in USDC on Arc Testnet. No real funds, real contracts.</p>
          <p className="label mt-3 text-muted">/a testnet experiment/</p>
        </div>
        <div className="cell flex flex-col gap-2 p-6">
          <Label>Explore</Label>
          {NAV.map(([to, label]) => (
            <Link key={to} to={to} className="link-line w-fit">{label}</Link>
          ))}
        </div>
        <div className="cell flex flex-col gap-2 p-6">
          <Label>Elsewhere</Label>
          <a href={`${ARC.explorer}/address/${CONTRACTS[2].address}`} target="_blank" rel="noreferrer" className="link-line w-fit">Contract</a>
          <a href={ARC.faucet} target="_blank" rel="noreferrer" className="link-line w-fit">Faucet</a>
          <a href="https://x.com/imalanxx" target="_blank" rel="noreferrer" className="link-line w-fit">X (Twitter)</a>
          <a href="https://github.com/anshxft/ArcOdds" target="_blank" rel="noreferrer" className="link-line w-fit">Source code (AGPL-3.0)</a>
        </div>
        {/* Letters near the cursor thin out and condense (Tektur's wght + wdth axes) */}
        <div ref={wordmark} className="cell overflow-hidden px-4 md:col-span-4" aria-hidden="true">
          <p className="font-display select-none text-center leading-[0.85] tracking-[-0.045em] lowercase" style={{ fontSize: 'clamp(48px, calc((min(100vw, 1440px) - 44px) / 4.85), 290px)' }} data-reveal>
            <VariableProximity label="predictarc" containerRef={wordmark} fromFontVariationSettings="'wght' 800, 'wdth' 100" toFontVariationSettings="'wght' 400, 'wdth' 75" radius={260} falloff="gaussian" />
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Shell: Lenis on the GSAP ticker, grain overlay, toasts, and scroll-to-top on navigation. */
export function Layout() {
  const lenis = useRef<LenisRef>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const update = (time: number) => lenis.current?.lenis?.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => gsap.ticker.remove(update)
  }, [])

  useEffect(() => {
    lenis.current?.lenis?.scrollTo(0, { immediate: true })
  }, [pathname])

  return (
    <ReactLenis root ref={lenis} options={{ autoRaf: false, lerp: reducedMotion() ? 1 : 0.1 }}>
      <div className="relative mx-auto min-h-screen max-w-[1440px] border-x border-line">
        <Header />
        <main>
          <Outlet />
        </main>
        <Footer />
      </div>
      <Suspense fallback={null}>
        <Mascot />
      </Suspense>
      <Noise fixed opacity={0.06} fps={0} blendMode="multiply" zIndex={60} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: 'flex w-[356px] items-start gap-3 border border-line-strong bg-paper p-4 font-sans text-sm text-ink',
            title: 'font-medium',
            description: 'label mt-1 text-muted',
            actionButton: 'label bg-ink px-2 py-1 text-paper',
          },
        }}
      />
    </ReactLenis>
  )
}
