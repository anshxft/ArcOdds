// Poring: a mascot that roams the whole site and guides visitors.
// - Welcomes new visitors (offers a tour) and greets returning ones.
// - Tour + one-off page guides: hops to each [data-tour] target, highlights it and explains it.
// - Roams: hops along the bottom, climbs cards and headings, peeks from edges, does tricks.
// - Tap: help menu (tour, tip, nap). Hold and drag: it follows smoothly, and when let go it is
//   thrown with real momentum (gravity, wall and floor bounces).
// - Reacts to trades through `mascot()` (see ./react.ts). Reduced motion: sits still in the corner.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { createAvatar, type AvatarController } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import definition from './poring.avatar.json'
import { setMascotHandler, type Mood } from './react'
import { reducedMotion } from '@/lib/motion'
import { formatDate, formatUsdc, marketState, shortAddress, useMarkets } from '@/lib/markets'
import { useWallet } from '@/lib/wallet'
import type { Market } from '@/lib/chain'

gsap.registerPlugin(Draggable)

const Poring = createAvatar(definition)
const DOZE_AFTER = 30_000
const SLEEP_AFTER = 15_000
const NAP_FOR = 5 * 60_000
const GRAVITY = 2600 // px/s²
const PERCH_TARGETS = 'a.cell[href^="/market/"], h1, [data-perch]'
const JUMPY: Mood[] = ['celebrate', 'excited', 'happy', 'proud', 'party', 'golden', 'greedy']

interface Step {
  target?: string // CSS selector; the first visible match is used, the step is skipped if none
  text: string
  mood?: Mood
}

const TOUR: Step[] = [
  { text: 'PredictArc lets you bet YES or NO on real-world questions, with free test USDC. Let me show you around!', mood: 'welcome' },
  { target: '[data-tour="faucet"]', text: 'Step 1: grab free test USDC here. It also pays the gas on Arc.' },
  { target: '[data-tour="wallet"]', text: 'Step 2: connect a wallet. I switch it to Arc Testnet for you.' },
  { target: '[data-tour="markets"]', text: 'Step 3: every market lives here. Search, filter, pick one.' },
  { target: 'a.cell[href^="/market/"]', text: 'Tap any market to see the odds and place a bet.' },
  { target: '[data-tour="portfolio"]', text: 'Your bets and winnings live here. When you win, claim it there!' },
  { text: "That's the tour! Tap me anytime for help, or drag me around for fun.", mood: 'party' },
]

/** Shown once per visitor the first time they open each kind of page. */
const PAGE_GUIDES: [RegExp, Step[]][] = [
  [/^\/markets\/?$/, [{ target: '[data-tour="search"]', text: 'Looking for something? Search here, or filter by topic just below.' }]],
  [
    /^\/market\//,
    [
      { target: '[data-tour="trade"]', text: 'Pick YES or NO, type an amount, then Buy. Your payout estimate updates as you type.' },
      { target: '[data-tour="rules"]', text: 'Read the rules first. They say exactly how this market gets decided.' },
    ],
  ],
  [/^\/portfolio\/?$/, [{ target: '[data-tour="portfolio-wallet"]', text: 'Connect here to see your bets. When you win, a Claim button lights up below.' }]],
  [/^\/status\/?$/, [{ text: 'This page shows how PredictArc is doing on-chain right now.', mood: 'explain' }]],
  [/^\/docs\/?$/, [{ target: '[data-tour="poring"]', text: 'Want to see all my moods? Tap the buttons down here!', mood: 'kawaii' }]],
  [/^\/admin\/?$/, [{ text: 'Owner tools. Double-check every outcome before you resolve!', mood: 'nervous' }]],
]

const TRICK_MOODS: Mood[] = ['wink', 'nod', 'star-struck', 'smug', 'cool', 'side-eye', 'silly', 'kawaii', 'eye-roll', 'amazed', 'pleading', 'ghost', 'love']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const short = (text: string, max = 54) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
/** True the first time `key` is seen in that storage (false if storage is blocked). */
const firstTime = (storage: () => Storage, key: string) => {
  try {
    if (storage().getItem(key)) return false
    storage().setItem(key, '1')
    return true
  } catch {
    return false
  }
}
const timeGreeting = () => {
  const hour = new Date().getHours()
  return hour < 5 ? 'Up late?' : hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : hour < 22 ? 'Good evening!' : 'Up late?'
}

type Mode = 'roam' | 'perch' | 'drag' | 'sleep' | 'guide'
interface Bubble {
  text: string
  offset: number // px from the mascot's left edge, chosen so the bubble stays on screen
  width: number // max width in px
  below: boolean // show under the mascot (mascot near the top)
  actions?: { label: string; choose(): void }[]
}
interface Brain {
  onRoute(): void
  tap(): void
}

export default function Mascot() {
  const mover = useRef<HTMLDivElement>(null) // fixed; travels with x/y
  const body = useRef<HTMLDivElement>(null) // squash, stretch, spin; the drag handle
  const avatar = useRef<AvatarController>(null)
  const brain = useRef<Brain | null>(null)
  const marketsRef = useRef<Market[]>([])
  const accountRef = useRef<string | null>(null)
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [still] = useState(reducedMotion)
  const { markets } = useMarkets()
  const { account } = useWallet()
  const { pathname } = useLocation()

  useEffect(() => {
    marketsRef.current = markets
  }, [markets])

  useEffect(() => {
    accountRef.current = account
  }, [account])

  useEffect(() => {
    brain.current?.onRoute()
  }, [pathname])

  useEffect(() => {
    const el = mover.current
    const inner = body.current
    if (still || !el || !inner) return

    const fine = matchMedia('(pointer: fine)').matches
    const size = () => el.offsetWidth
    const ground = () => innerHeight - size() - (fine ? 14 : 8)
    const maxX = () => innerWidth - size() - 8
    const getX = () => Number(gsap.getProperty(el, 'x'))
    const getY = () => Number(gsap.getProperty(el, 'y'))

    let mode: Mode = 'roam'
    let busy = false
    let gen = 0 // bumped on interrupt so stale actions stop after their next await
    let reactUntil = 0
    let napUntil = 0
    let lastSaid = Date.now()
    let current: Mood = 'idle'
    let pokes: number[] = []
    let physics: (() => void) | null = null
    const timers = new Set<number>()
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id)
        fn()
      }, ms)
      timers.add(id)
      return id
    }
    const cancel = (id: number) => {
      clearTimeout(id)
      timers.delete(id)
    }
    const wait = (ms: number) => new Promise<void>((done) => later(done, ms))
    const play = (mood: Mood) => {
      current = mood
      avatar.current?.play(mood)
    }

    // ---- speech ----

    let bubbleTimer = 0
    let pending: ((answer: string) => void) | null = null
    let under = false // standing under a tour target: talk below so the bubble does not cover it
    const place = () => {
      const width = Math.min(240, innerWidth - 16)
      const x = getX()
      const wanted = x + size() / 2 > innerWidth / 2 ? x + size() - width : x // lean toward the middle
      return { offset: clamp(wanted, 8, innerWidth - 8 - width) - x, width, below: under || getY() < 170 }
    }
    const closeAsk = (answer = 'cancel') => {
      const resolve = pending
      pending = null
      resolve?.(answer)
    }
    const say = (text: string, ms = 3400) => {
      closeAsk()
      cancel(bubbleTimer)
      lastSaid = Date.now()
      setBubble({ text, ...place() })
      bubbleTimer = later(() => setBubble(null), ms)
    }
    /** Speech bubble with buttons; resolves with the chosen label, or 'cancel' if interrupted. */
    const ask = (text: string, labels: string[]) =>
      new Promise<string>((resolve) => {
        closeAsk()
        cancel(bubbleTimer)
        lastSaid = Date.now()
        pending = resolve
        setBubble({
          text,
          ...place(),
          actions: labels.map((label) => ({
            label,
            choose: () => {
              setBubble(null)
              closeAsk(label)
            },
          })),
        })
      })

    let settleTimer = 0
    const settle = (ms: number) => {
      cancel(settleTimer)
      settleTimer = later(() => {
        if (mode === 'sleep' || pending) return
        play(mode === 'perch' ? 'watch-down' : 'idle')
      }, ms)
    }

    // ---- highlight for guides ----

    let spot: Element | null = null
    const spotlight = (node: Element | null) => {
      spot?.classList.remove('poring-spot')
      spot = node
      node?.classList.add('poring-spot')
    }

    const interrupt = () => {
      gen += 1
      busy = false
      if (pending) {
        closeAsk()
        setBubble(null)
      }
      spotlight(null)
      under = false
      gsap.killTweensOf([el, inner])
      gsap.to(inner, { rotation: 0, scaleX: 1, scaleY: 1, y: 0, duration: 0.2 })
    }

    const run = async (action: (my: number) => Promise<void>) => {
      if (busy) return
      busy = true
      const my = gen
      try {
        await action(my)
      } finally {
        if (my === gen) busy = false
      }
    }

    const timeline = (tl: gsap.core.Timeline) => new Promise<void>((done) => tl.eventCallback('onComplete', () => done()))
    const squash = (amount = 0.22) =>
      gsap.fromTo(inner, { scaleX: 1 + amount, scaleY: 1 - amount }, { scaleX: 1, scaleY: 1, duration: 0.45, ease: 'elastic.out(1, 0.45)' })

    // ---- movement ----

    /** One arc from here to (tx, ty). */
    const arc = (tl: gsap.core.Timeline, tx: number, ty: number, fromY: number, height: number, duration: number) => {
      const at = tl.duration()
      tl.to(inner, { scaleX: 0.9, scaleY: 1.12, duration: 0.07, ease: 'power1.out' }, at)
        .to(el, { x: tx, duration, ease: 'none' }, at)
        .to(el, { y: Math.min(fromY, ty) - height, duration: duration / 2, ease: 'power2.out' }, at)
        .to(el, { y: ty, duration: duration / 2, ease: 'power2.in' }, at + duration / 2)
        .to(inner, { scaleX: 1, scaleY: 1, duration: 0.1 }, at + 0.07)
        .to(inner, { scaleX: 1.2, scaleY: 0.8, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out' }, at + duration)
    }

    /** Hop along the ground, or leap in one arc when the height changes a lot. */
    const hopTo = (tx: number, ty = ground(), mood?: Mood) => {
      const x0 = getX()
      const y0 = getY()
      tx = clamp(tx, 4, maxX()) // fully on screen; only peekEdge slides it past the edge
      play(mood ?? (tx < x0 ? 'walk-left' : 'walk-right'))
      const tl = gsap.timeline()
      if (Math.abs(ty - y0) > 50) {
        arc(tl, tx, ty, y0, 70, clamp(Math.hypot(tx - x0, ty - y0) / 900, 0.45, 0.8))
      } else {
        const hops = Math.max(1, Math.round(Math.abs(tx - x0) / 85))
        for (let i = 1; i <= hops; i++) arc(tl, x0 + ((tx - x0) * i) / hops, y0 + ((ty - y0) * i) / hops, y0, 26, 0.34)
      }
      return timeline(tl)
    }

    /** Ballistic flight from the current spot: gravity, wall and floor bounces, rolling to a stop. */
    const throwIt = (vx: number, vy: number, my: number) =>
      new Promise<void>((done) => {
        let x = getX()
        let y = getY()
        if (y >= ground() - 1 && Math.abs(vx) < 30 && vy >= 0) return done()
        let rotation = Number(gsap.getProperty(inner, 'rotation'))
        const hard = Math.hypot(vx, vy) > 1100
        play(hard ? 'dizzy' : 'surprised')
        let last = performance.now()
        const step = () => {
          if (my !== gen) {
            gsap.ticker.remove(step)
            physics = null
            return done()
          }
          const now = performance.now()
          const dt = Math.min((now - last) / 1000, 1 / 30)
          last = now
          vy += GRAVITY * dt
          x += vx * dt
          y += vy * dt
          if (x < 4) {
            x = 4
            vx = Math.abs(vx) * 0.55
          } else if (x > maxX()) {
            x = maxX()
            vx = -Math.abs(vx) * 0.55
          }
          if (y < 0) {
            y = 0
            vy = Math.abs(vy) * 0.4
          }
          if (y >= ground()) {
            y = ground()
            if (vy > 280) {
              vy = -vy * 0.45
              vx *= 0.82
              squash(clamp(Math.abs(vy) / 4000, 0.1, 0.28))
            } else {
              vy = 0
              vx *= Math.pow(0.02, dt) // floor friction
            }
          }
          rotation += vx * dt * 0.35
          gsap.set(el, { x, y })
          gsap.set(inner, { rotation })
          if (y === ground() && vy === 0 && Math.abs(vx) < 15) {
            gsap.ticker.remove(step)
            physics = null
            gsap.to(inner, { rotation: Math.round(rotation / 360) * 360, duration: 0.35, ease: 'back.out(2)', onComplete: () => void gsap.set(inner, { rotation: 0 }) })
            play(hard ? 'dizzy' : 'oof')
            settle(hard ? 1600 : 900)
            done()
          }
        }
        physics = step
        gsap.ticker.add(step)
      })

    // ---- guiding ----

    const visible = (node: Element) => {
      const r = node.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const findTarget = (selector: string) => [...document.querySelectorAll(selector)].find(visible) ?? null

    /** Hop next to `node`: on top of it, or under it when it is near the top of the screen. */
    const goNear = async (node: Element, my: number) => {
      let r = node.getBoundingClientRect()
      if (r.bottom < 60 || r.top > innerHeight - 60) {
        node.scrollIntoView({ block: 'center' })
        await wait(450)
        if (my !== gen) return
        r = node.getBoundingClientRect()
      }
      const x = clamp(r.left + r.width / 2 - size() / 2, 4, maxX())
      under = r.top <= size() + 150
      const y = under ? clamp(r.bottom + 8, 0, ground()) : r.top - size() * 0.82
      await hopTo(x, y, 'hop')
    }
    const pointAt = (node: Element | null): Mood => {
      if (!node) return 'explain'
      const r = node.getBoundingClientRect()
      const offset = r.left + r.width / 2 - (getX() + size() / 2)
      return offset < -30 ? 'point-left' : offset > 30 ? 'point-right' : 'explain'
    }

    const tour = async (steps: Step[], my: number) => {
      const shown = steps.filter((step) => !step.target || findTarget(step.target))
      if (!shown.length) return
      mode = 'guide'
      for (let i = 0; i < shown.length; i++) {
        const step = shown[i]
        const node = step.target ? findTarget(step.target) : null
        under = false
        if (node) await goNear(node, my)
        if (my !== gen) return
        spotlight(node)
        play(step.mood ?? pointAt(node))
        const last = i === shown.length - 1
        const answer = await ask(step.text, last ? [shown.length > 1 ? 'Done' : 'Got it'] : ['Next', 'Skip'])
        if (my !== gen || answer === 'cancel') return
        if (answer === 'Skip') break
      }
      spotlight(null)
      under = false
      mode = 'roam'
      play('happy')
      await throwIt(0, 0, my) // hop down if it ended up on something
      if (my === gen) settle(1400)
    }

    const guidePage = () => {
      const steps = PAGE_GUIDES.find(([pattern]) => pattern.test(location.pathname))?.[1]
      if (!steps || mode !== 'roam' || busy) return
      if (!firstTime(() => localStorage, `poring_guide_${location.pathname.split('/')[1] || 'home'}`)) return
      run((my) => tour(steps, my))
    }

    // ---- things it does on its own ----

    const wander = async (my: number) => {
      let tx = rand(8, maxX())
      if (Math.abs(tx - getX()) < 140) tx = clamp(getX() + pick([-1, 1]) * rand(160, 360), 8, maxX())
      await hopTo(tx)
      if (my === gen) play('idle')
    }

    const perchLine = (target: Element) => {
      const key = target.getAttribute('href')?.split('/market/')[1]
      const market = marketsRef.current.find((item) => item.key === key)
      if (!market) return pick(['Nice view from up here.', 'What are we reading?', 'Comfy spot!'])
      return pick([
        `${market.yesOdds}% say YES here. You?`,
        `This one closes ${formatDate(market.deadline)}.`,
        market.volume > 0 ? `${formatUsdc(market.volume)} in this pool.` : 'Nobody has bet here yet. Be first?',
      ])
    }

    const perch = async (my: number) => {
      const top = fine ? 96 : 120
      const targets = [...document.querySelectorAll(PERCH_TARGETS)].filter((node) => {
        const r = node.getBoundingClientRect()
        return r.top > top && r.top < innerHeight - size() * 2 && r.width > size() * 1.5 && r.left >= 0 && r.right <= innerWidth
      })
      if (!targets.length) return wander(my)
      const target = pick(targets)
      const r = target.getBoundingClientRect()
      await hopTo(r.left + rand(0, r.width - size()), r.top - size() * 0.82, 'hop')
      if (my !== gen) return
      mode = 'perch'
      play('watch-down')
      if (Math.random() < 0.7) say(perchLine(target))
      await wait(rand(5000, 9000))
      if (my !== gen || mode !== 'perch') return
      mode = 'roam'
      await hopTo(getX() + pick([-1, 1]) * 60, ground(), 'hop')
      if (my === gen) play('idle')
    }

    const trick = async (my: number) => {
      const night = new Date().getHours() >= 22 || new Date().getHours() < 5
      const which = pick(['spin', 'jump', 'dance', 'party', 'mood', 'mood', 'mood', ...(night ? (['night'] as const) : [])] as const)
      if (which === 'spin') {
        play('dizzy')
        await timeline(gsap.timeline().to(inner, { rotation: 360, duration: 0.8, ease: 'power2.inOut' }).set(inner, { rotation: 0 }))
        await wait(900)
      } else if (which === 'jump') {
        play('hop')
        await timeline(gsap.timeline().to(el, { y: getY() - 130, duration: 0.32, ease: 'power2.out' }).to(el, { y: getY(), duration: 0.32, ease: 'power2.in' }))
        squash(0.25)
        play('star-struck')
        await wait(1200)
      } else if (which === 'dance' || which === 'party') {
        play(which)
        await timeline(gsap.timeline().to(inner, { rotation: 10, y: -8, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }).to(inner, { rotation: -10, y: -8, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }).set(inner, { rotation: 0, y: 0 }))
      } else if (which === 'night') {
        play('dreamy')
        say(pick(['So sleepy…', 'Markets never sleep. I do.']), 2600)
        await wait(2600)
      } else {
        const mood = pick(TRICK_MOODS)
        play(mood)
        if (mood === 'ghost' && Math.random() < 0.6) say('Boo!', 1400)
        if (mood === 'cool' && Math.random() < 0.4) say('Too cool.', 1400)
        await wait(2000)
      }
      if (my === gen) play('idle')
    }

    const lookAround = async (my: number) => {
      play(pick(['curious', 'searching', 'watch-up', 'listening', 'watch-left', 'watch-right', 'bored'] as const))
      await wait(rand(2200, 3600))
      if (my === gen) play('idle')
    }

    const peekEdge = async (my: number) => {
      const left = getX() < innerWidth / 2
      await hopTo(left ? 8 : maxX())
      if (my !== gen) return
      play('peek')
      await timeline(gsap.timeline().to(el, { x: left ? -size() * 0.55 : innerWidth - size() * 0.45, duration: 0.5, ease: 'power2.inOut' }))
      await wait(rand(2200, 3400))
      if (my !== gen) return
      await timeline(gsap.timeline().to(el, { x: left ? 12 : maxX() - 4, duration: 0.35, ease: 'back.out(2)' }))
      if (my === gen) play('idle')
    }

    const tip = () => {
      const soon = marketsRef.current.filter((m) => marketState(m) === 'open').sort((a, b) => a.deadline - b.deadline)[0]
      const tips = [
        'Drag me anywhere and let go. I bounce!',
        'Free test USDC is up in the header.',
        'Odds are just the pool split. They move with every bet.',
        'Winners split the losing side, minus 2%.',
        'Try the AI brief on any market.',
        'Tap me for a tour anytime.',
      ]
      if (soon) tips.push(`"${short(soon.question)}" closes ${formatDate(soon.deadline)}.`)
      play('explain')
      say(pick(tips), 4600)
      settle(2400)
    }

    const ACTIONS: [number, (my: number) => Promise<void>][] = [
      [4, wander],
      [2.5, perch],
      [2, trick],
      [1.5, lookAround],
      [1, peekEdge],
    ]
    const total = ACTIONS.reduce((sum, [weight]) => sum + weight, 0)
    const chooseAction = () => {
      let roll = Math.random() * total
      return ACTIONS.find(([weight]) => (roll -= weight) < 0)![1]
    }

    const tick = () => {
      later(tick, rand(3500, 7500) * (fine ? 1 : 1.6))
      if (document.hidden || busy || mode !== 'roam' || Date.now() < reactUntil) return
      if (Date.now() - lastSaid > 55_000 && Math.random() < 0.35) return tip()
      run(chooseAction())
    }

    // ---- the visitor ----

    let px = -9999
    let py = -9999
    let lastMove = 0
    let speed = 0
    let watching = false
    let lastFlee = 0
    let frame = 0
    const lookAtCursor = () => {
      frame = 0
      if (mode !== 'roam' || busy || Date.now() < reactUntil) return
      const cx = getX() + size() / 2
      const cy = getY() + size() / 2
      const distance = Math.hypot(px - cx, py - cy)
      if (distance < 120 && speed > 1.8 && Date.now() - lastFlee > 5000 && Math.random() < 0.6) {
        lastFlee = Date.now()
        run(async (my) => {
          play('scared')
          say(pick(['Eek!', 'Too fast!', 'Whoa there!']), 1600)
          await hopTo(getX() + (px < cx ? 1 : -1) * rand(180, 280), ground(), 'scared')
          if (my === gen) play('idle')
        })
      } else if (distance < 420) {
        const side: Mood = Math.abs(px - cx) < size() / 2 ? (py < cy ? 'watch-up' : 'watch-down') : px < cx ? 'watch-left' : 'watch-right'
        if (side !== current) play(side)
        watching = true
      } else if (watching) {
        watching = false
        play('idle')
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      const now = performance.now()
      speed = Math.hypot(event.clientX - px, event.clientY - py) / Math.max(now - lastMove, 1)
      px = event.clientX
      py = event.clientY
      lastMove = now
      if (fine && !frame) frame = requestAnimationFrame(lookAtCursor)
    }

    const pet = () => {
      if (mode !== 'roam' || busy) return
      reactUntil = Date.now() + 2200
      play(pick(['blush', 'love', 'kawaii'] as const))
      if (Math.random() < 0.5) say(pick(['Hehe.', 'That tickles!', 'Again!']), 1600)
      settle(2200)
    }

    let lastPlead = 0
    const onLeaveWindow = () => {
      if (!fine || mode !== 'roam' || busy || Date.now() - lastPlead < 90_000) return
      lastPlead = Date.now()
      play('pleading')
      say(pick(["Don't go! Markets are closing soon.", 'Come back soon!']), 2600)
      settle(2600)
    }

    const sleepNow = () =>
      run(async (my) => {
        mode = 'sleep'
        await throwIt(0, 0, my)
        if (my !== gen) return
        await hopTo(fine ? 16 : 8)
        if (my !== gen) return
        play('yawn')
        await wait(2200)
        if (my !== gen) return
        play('drowsy')
        await wait(SLEEP_AFTER)
        if (my === gen) play('sleeping')
      })

    const wake = (text?: string) => {
      interrupt()
      mode = 'roam'
      napUntil = 0
      play('waking')
      reactUntil = Date.now() + 1800
      if (text) say(text, 1800)
      settle(1800)
    }

    /** Tap: help menu. Second tap closes it; poking too much gets it grumpy, then furious. */
    const tap = () => {
      const now = Date.now()
      pokes = [...pokes.filter((time) => now - time < 4000), now]
      if (mode === 'sleep') return wake("I'm up, I'm up!")
      if (pokes.length >= 8) {
        pokes = []
        interrupt()
        play('furious')
        say("That's it, I'm out!", 2200)
        run(async (my) => {
          await wait(900)
          if (my === gen) await hopTo(getX() < innerWidth / 2 ? maxX() : 8, ground(), 'furious')
          if (my === gen) settle(600)
        })
        return
      }
      if (pokes.length >= 5) {
        interrupt()
        reactUntil = now + 2200
        play('grumpy')
        say('Okay, okay, enough poking!', 2200)
        settle(2200)
        return
      }
      if (mode === 'guide') return // the bubble buttons drive the tour
      if (pending) {
        interrupt()
        play('wink')
        settle(900)
        return
      }
      interrupt()
      play(pick(['happy', 'laughing', 'kawaii', 'playful'] as const))
      gsap.to(inner, { y: -22, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' })
      run(async (my) => {
        const answer = await ask(pick(['Need a hand?', 'Hi! What can I do?', 'Yes? How can I help?']), ['Tour', 'Tip', 'Nap', 'Close'])
        if (my !== gen) return
        if (answer === 'Tour') await tour(TOUR, my)
        else if (answer === 'Tip') tip()
        else if (answer === 'Nap') {
          napUntil = Date.now() + NAP_FOR
          busy = false
          sleepNow()
        } else play('idle')
      })
    }

    // ---- drag: Draggable moves a hidden proxy; Poring eases after it, tilting with speed ----

    const proxy = document.createElement('div')
    proxy.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden'
    document.body.appendChild(proxy)
    let xTo: gsap.QuickToFunc | null = null
    let yTo: gsap.QuickToFunc | null = null
    let tiltTo: gsap.QuickToFunc | null = null
    let trail: { x: number; y: number; t: number }[] = []

    const [drag] = Draggable.create(proxy, {
      trigger: inner,
      type: 'x,y',
      minimumMovement: 4,
      onPress() {
        gsap.set(proxy, { x: getX(), y: getY() })
        this.update()
        this.applyBounds({ minX: -size() * 0.3, maxX: innerWidth - size() * 0.7, minY: 0, maxY: ground() })
      },
      onDragStart() {
        interrupt()
        mode = 'drag'
        xTo = gsap.quickTo(el, 'x', { duration: 0.14, ease: 'power3.out' })
        yTo = gsap.quickTo(el, 'y', { duration: 0.14, ease: 'power3.out' })
        tiltTo = gsap.quickTo(inner, 'rotation', { duration: 0.35, ease: 'power3.out' })
        gsap.to(inner, { scaleX: 0.92, scaleY: 1.1, duration: 0.2, ease: 'power2.out' })
        play(pick(['scared', 'nervous', 'amazed'] as const))
        say(pick(['Hey! Put me down!', 'Wheee!', 'Where are we going?', 'Careful with me!']), 1800)
        trail = []
      },
      onDrag() {
        xTo?.(this.x)
        yTo?.(this.y)
        const now = performance.now()
        trail = [...trail.filter((point) => now - point.t < 100), { x: this.x, y: this.y, t: now }]
        const first = trail[0]
        tiltTo?.(clamp(((this.x - first.x) / Math.max(now - first.t, 16)) * 25, -35, 35))
      },
      onDragEnd() {
        const now = performance.now()
        const first = trail.find((point) => now - point.t < 100)
        const dt = first ? Math.max(now - first.t, 16) / 1000 : 1
        const vx = first ? clamp((this.x - first.x) / dt, -2600, 2600) : 0
        const vy = first ? clamp((this.y - first.y) / dt, -2600, 2600) : 0
        gsap.killTweensOf(el)
        gsap.killTweensOf(inner)
        gsap.to(inner, { scaleX: 1, scaleY: 1, duration: 0.2 })
        mode = 'roam'
        run((my) => throwIt(vx, vy, my))
      },
      onClick: tap,
    })

    // ---- the page ----

    let lastScroll = scrollY
    let lastScrollAt = performance.now()
    let lastWhee = 0
    let bottomSaid = ''
    const onScroll = () => {
      const now = performance.now()
      const velocity = Math.abs(scrollY - lastScroll) / Math.max(now - lastScrollAt, 1)
      lastScroll = scrollY
      lastScrollAt = now
      if (mode === 'guide' || mode === 'drag' || mode === 'sleep') return
      if (mode === 'perch') {
        interrupt()
        mode = 'roam'
        if (Math.random() < 0.4) say('Whoa!', 1200)
        run((my) => throwIt(0, 0, my))
      } else if (velocity > 4 && !busy && Date.now() - lastWhee > 20_000) {
        lastWhee = Date.now()
        play('surprised')
        say(pick(['Slow down!', 'Wheee, scrolling!']), 1500)
        settle(1500)
      } else if (!busy && bottomSaid !== location.pathname && innerHeight + scrollY >= document.documentElement.scrollHeight - 40) {
        bottomSaid = location.pathname
        play('cool')
        say('You made it to the bottom!', 2200)
        settle(2200)
      }
    }

    const onResize = () => {
      if (mode === 'drag') return
      interrupt()
      if (mode !== 'sleep') mode = 'roam'
      gsap.set(el, { x: clamp(getX(), 8, maxX()), y: ground() })
    }

    // ---- dozing ----

    let doze = 0
    const armDoze = () => {
      cancel(doze)
      doze = later(() => {
        if (mode === 'guide' || mode === 'drag' || pending) return armDoze()
        interrupt()
        sleepNow()
      }, DOZE_AFTER)
    }
    const onActivity = () => {
      if (mode === 'sleep' && Date.now() > napUntil) wake()
      if (mode !== 'sleep') armDoze()
    }

    // ---- reactions from the rest of the app ----

    setMascotHandler((mood, { ms = 2600, say: text }) => {
      if (mode === 'guide' || mode === 'drag') return
      if (mode === 'sleep') wake()
      armDoze()
      if (mode !== 'perch') interrupt()
      reactUntil = Date.now() + ms
      play(mood)
      if (JUMPY.includes(mood)) gsap.to(inner, { y: -34, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.out' })
      if (text) say(text, Math.max(ms, 2400))
      settle(ms)
    })

    brain.current = {
      tap,
      onRoute() {
        if (mode === 'drag') return
        if (mode === 'guide' || mode === 'perch' || pending) {
          interrupt()
          mode = 'roam'
          run((my) => throwIt(0, 0, my))
        } else if (!pending) setBubble(null)
        if (mode === 'roam' && !busy) {
          play('curious')
          settle(1600)
        }
        later(guidePage, 1600)
      },
    }

    // ---- start: welcome first-time visitors, greet returning ones ----

    gsap.set(el, { x: fine ? 24 : 8, y: ground(), autoAlpha: 1 })
    play('waking')
    settle(2000)
    armDoze()
    later(tick, 9000)
    later(() => {
      if (firstTime(() => localStorage, 'poring_seen')) {
        run(async (my) => {
          await hopTo(innerWidth / 2 - size() / 2)
          if (my !== gen) return
          play('welcome')
          squash(0.2)
          const answer = await ask("Welcome to PredictArc! I'm Poring, your guide. Want a quick tour?", ['Show me', 'Maybe later'])
          if (my !== gen) return
          if (answer === 'Show me') await tour(TOUR, my)
          else {
            play('wink')
            say('Okay! Tap me anytime for help.', 2800)
            settle(1400)
          }
          if (my === gen) later(guidePage, 3000)
        })
      } else if (firstTime(() => sessionStorage, 'poring_hi')) {
        const who = accountRef.current ? `, ${shortAddress(accountRef.current)}` : ''
        play('welcome')
        say(`${timeGreeting()} Welcome back${who}!`, 3600)
        settle(2000)
        later(guidePage, 4200)
      } else later(guidePage, 600)
    }, 1800)

    inner.addEventListener('pointerenter', pet)
    document.documentElement.addEventListener('mouseleave', onLeaveWindow)
    const activity = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    activity.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      setMascotHandler(null)
      brain.current = null
      closeAsk()
      spotlight(null)
      drag.kill()
      proxy.remove()
      if (physics) gsap.ticker.remove(physics)
      gsap.killTweensOf([el, inner])
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      inner.removeEventListener('pointerenter', pet)
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow)
      activity.forEach((name) => window.removeEventListener(name, onActivity))
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [still])

  if (still) {
    return (
      <div className="fixed bottom-3 left-3 z-50 w-12 md:w-20" aria-hidden="true">
        <Poring defaultExpression="neutral" autoplay={false} size="100%" ariaLabel="Poring" />
      </div>
    )
  }

  return (
    <div ref={mover} className="invisible fixed top-0 left-0 z-50 w-12 will-change-transform select-none md:w-[72px]">
      <div
        ref={body}
        role="button"
        tabIndex={0}
        aria-label="Poring, your guide. Press for help, or drag to move."
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            brain.current?.tap()
          }
        }}
        className="origin-bottom cursor-grab touch-none active:cursor-grabbing"
      >
        <Poring ref={avatar} defaultAnimation="idle" size="100%" ariaLabel="Poring" />
      </div>
      <div
        role="status"
        className={
          bubble
            ? `mascot-bubble label absolute w-max border border-ink bg-paper px-3 py-2 normal-case tracking-normal text-ink shadow-[3px_3px_0_var(--ink)] ${bubble.below ? 'top-full mt-2' : 'bottom-full mb-2'} ${bubble.actions ? '' : 'pointer-events-none'}`
            : 'sr-only'
        }
        style={bubble ? { left: bubble.offset, maxWidth: bubble.width } : undefined}
      >
        {bubble?.text}
        {bubble?.actions && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {bubble.actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                onClick={action.choose}
                className={`press label px-2.5 py-1.5 ${index === 0 ? 'bg-signal text-on-signal' : 'border border-ink hover-ink'}`}
              >
                {action.label}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
