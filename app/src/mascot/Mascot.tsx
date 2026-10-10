// Poring: a mascot that roams the whole site. It hops along the bottom of the screen, climbs onto
// market cards and headings, peeks in from the edges, does tricks, watches and flees the cursor,
// can be dragged and thrown, and reacts to trades through `mascot()` (see ./react.ts).
// Reduced motion: it sits still in the corner.
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { createAvatar, type AvatarController } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import definition from './poring.avatar.json'
import { setMascotHandler, type Mood } from './react'
import { reducedMotion } from '@/lib/motion'
import { formatDate, formatUsdc, marketState, useMarkets } from '@/lib/markets'
import type { Market } from '@/lib/chain'

gsap.registerPlugin(Draggable)

const Poring = createAvatar(definition)
const DOZE_AFTER = 30_000
const SLEEP_AFTER = 15_000
const PERCH_TARGETS = 'a.cell[href^="/market/"], h1, [data-perch]'
const JUMPY: Mood[] = ['celebrate', 'excited', 'happy', 'proud']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const short = (text: string, max = 54) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

type Mode = 'roam' | 'perch' | 'drag' | 'sleep'
interface Brain {
  onRoute(): void
  poke(): void
}

export default function Mascot() {
  const mover = useRef<HTMLDivElement>(null) // fixed; travels with x/y
  const body = useRef<HTMLDivElement>(null) // squash, stretch, spin
  const avatar = useRef<AvatarController>(null)
  const brain = useRef<Brain | null>(null)
  const marketsRef = useRef<Market[]>([])
  const [bubble, setBubble] = useState<{ text: string; flip: boolean } | null>(null)
  const [still] = useState(reducedMotion)
  const { markets } = useMarkets()
  const { pathname } = useLocation()

  useEffect(() => {
    marketsRef.current = markets
  }, [markets])

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
    let lastSaid = Date.now() // first tip waits a while
    let current: Mood = 'idle'
    let pokes: number[] = []
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

    let bubbleTimer = 0
    const say = (text: string, ms = 3400) => {
      cancel(bubbleTimer)
      lastSaid = Date.now()
      setBubble({ text, flip: getX() > innerWidth - 260 })
      bubbleTimer = later(() => setBubble(null), ms)
    }

    let settleTimer = 0
    const settle = (ms: number) => {
      cancel(settleTimer)
      settleTimer = later(() => mode !== 'sleep' && play(mode === 'perch' ? 'watch-down' : 'idle'), ms)
    }

    const interrupt = () => {
      gen += 1
      busy = false
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
      tx = clamp(tx, fine ? -size() * 0.5 : 4, innerWidth - size() * (fine ? 0.5 : 1) - 4)
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

    const fall = async (my: number) => {
      const distance = ground() - getY()
      if (distance < 4) return
      play('surprised')
      await timeline(gsap.timeline().to(el, { y: ground(), duration: clamp(distance / 900, 0.35, 0.9), ease: 'bounce.out' }))
      if (my !== gen) return
      play('oof')
      settle(1100)
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
      const which = pick(['spin', 'jump', 'dance', 'wink', 'nod', 'star'] as const)
      if (which === 'spin') {
        play('dizzy')
        await timeline(gsap.timeline().to(inner, { rotation: 360, duration: 0.8, ease: 'power2.inOut' }).set(inner, { rotation: 0 }))
        await wait(900)
      } else if (which === 'jump') {
        play('hop')
        await timeline(gsap.timeline().to(el, { y: getY() - 130, duration: 0.32, ease: 'power2.out' }).to(el, { y: getY(), duration: 0.32, ease: 'power2.in' }).to(inner, { scaleX: 1.25, scaleY: 0.78, duration: 0.08, yoyo: true, repeat: 1 }))
        play('star-struck')
        await wait(1200)
      } else if (which === 'dance') {
        play('dance')
        await timeline(gsap.timeline().to(inner, { rotation: 10, y: -8, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }).to(inner, { rotation: -10, y: -8, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }).set(inner, { rotation: 0, y: 0 }))
      } else {
        play(which === 'star' ? 'star-struck' : which)
        await wait(1800)
      }
      if (my === gen) play('idle')
    }

    const lookAround = async (my: number) => {
      play(pick(['curious', 'searching', 'watch-up', 'listening', 'watch-left', 'watch-right'] as const))
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
        'Drag me anywhere. I bounce!',
        'Free test USDC is up in the header.',
        'Odds are just the pool split. They move with every bet.',
        'Winners split the losing side, minus 2%.',
        'Try the AI brief on any market.',
      ]
      if (soon) tips.push(`"${short(soon.question)}" closes ${formatDate(soon.deadline)}.`)
      play('wink')
      say(pick(tips), 4200)
      settle(1500)
    }

    const ACTIONS: [number, (my: number) => Promise<void>][] = [
      [4, wander],
      [2.5, perch],
      [1.5, trick],
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
      if (mode === 'drag' || mode === 'sleep' || busy) return
      reactUntil = Date.now() + 2200
      play(pick(['blush', 'love'] as const))
      if (Math.random() < 0.5) say(pick(['Hehe.', 'That tickles!', 'Again!']), 1600)
      settle(2200)
    }

    const poke = () => {
      const now = Date.now()
      pokes = [...pokes.filter((time) => now - time < 4000), now]
      interrupt()
      reactUntil = now + 2400
      if (pokes.length >= 5) {
        pokes = []
        play('grumpy')
        say('Okay, okay, enough poking!', 2400)
      } else {
        play(pick(['laughing', 'playful', 'wink', 'happy'] as const))
        gsap.to(inner, { y: -26, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' })
      }
      settle(2400)
    }

    const [drag] = Draggable.create(el, {
      type: 'x,y',
      minimumMovement: 6,
      onPress() {
        this.applyBounds({ minX: 0, maxX: maxX(), minY: 56, maxY: ground() })
      },
      onDragStart() {
        interrupt()
        mode = 'drag'
        play('scared')
        say(pick(['Hey! Put me down!', 'Wheee!', 'Where are we going?']), 1800)
      },
      onDrag() {
        gsap.set(inner, { rotation: clamp(this.deltaX * 3, -30, 30) })
      },
      onDragEnd() {
        gsap.to(inner, { rotation: 0, duration: 0.3 })
        mode = 'roam'
        run(async (my) => {
          await fall(my)
          if (my !== gen) return
          play('dizzy')
          await wait(1000)
          if (my === gen) play('idle')
        })
      },
      onClick: poke,
    })

    // ---- the page ----

    let lastScroll = scrollY
    let lastScrollAt = performance.now()
    let lastWhee = 0
    const onScroll = () => {
      const now = performance.now()
      const velocity = Math.abs(scrollY - lastScroll) / Math.max(now - lastScrollAt, 1)
      lastScroll = scrollY
      lastScrollAt = now
      if (mode === 'perch') {
        interrupt()
        mode = 'roam'
        if (Math.random() < 0.4) say('Whoa!', 1200)
        run(fall)
      } else if (velocity > 4 && mode === 'roam' && !busy && Date.now() - lastWhee > 20_000) {
        lastWhee = Date.now()
        play('surprised')
        say(pick(['Slow down!', 'Wheee, scrolling!']), 1500)
        settle(1500)
      }
    }

    const onResize = () => {
      if (mode === 'drag') return
      interrupt()
      mode = mode === 'sleep' ? 'sleep' : 'roam'
      gsap.set(el, { x: clamp(getX(), 8, maxX()), y: ground() })
    }

    // ---- sleep ----

    let doze = 0
    const armDoze = () => {
      cancel(doze)
      doze = later(() => {
        interrupt()
        mode = 'sleep'
        run(async (my) => {
          await fall(my)
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
      }, DOZE_AFTER)
    }
    const onActivity = () => {
      if (mode === 'sleep') {
        interrupt()
        mode = 'roam'
        play('waking')
        reactUntil = Date.now() + 1800
        settle(1800)
      }
      armDoze()
    }

    // ---- reactions from the rest of the app ----

    setMascotHandler((mood, { ms = 2600, say: text }) => {
      if (mode === 'sleep') mode = 'roam'
      armDoze()
      if (mode !== 'perch') interrupt()
      reactUntil = Date.now() + ms
      play(mood)
      if (JUMPY.includes(mood)) gsap.to(inner, { y: -34, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.out' })
      if (text) say(text, Math.max(ms, 2400))
      settle(ms)
    })

    brain.current = {
      poke,
      onRoute() {
        setBubble(null)
        if (mode === 'perch') {
          interrupt()
          mode = 'roam'
            run(fall)
        } else if (mode === 'roam' && !busy) {
          play('curious')
          settle(1600)
        }
      },
    }

    // ---- start ----

    gsap.set(el, { x: fine ? 24 : 8, y: ground(), autoAlpha: 1 })
    play('waking')
    settle(2000)
    armDoze()
    later(tick, 4000)
    try {
      if (!sessionStorage.getItem('poring_hi')) {
        later(() => {
          sessionStorage.setItem('poring_hi', '1')
          play('wink')
          say(fine ? "Hi, I'm Poring! Drag me around, or pet me." : "Hi, I'm Poring! Drag me around.", 4500)
          settle(1500)
        }, 2600)
      }
    } catch {
      /* storage blocked: skip the greeting */
    }

    el.addEventListener('pointerenter', pet)
    const activity = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    activity.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      setMascotHandler(null)
      brain.current = null
      drag.kill()
      gsap.killTweensOf([el, inner])
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      el.removeEventListener('pointerenter', pet)
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
    <div
      ref={mover}
      role="button"
      tabIndex={0}
      aria-label="Poring, the PredictArc mascot. Press to poke."
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          brain.current?.poke()
        }
      }}
      className="invisible fixed top-0 left-0 z-50 w-12 cursor-grab touch-none select-none active:cursor-grabbing md:w-[72px]"
    >
      <div ref={body} className="origin-bottom">
        <Poring ref={avatar} defaultAnimation="idle" size="100%" ariaLabel="Poring" />
      </div>
      <p
        role="status"
        className={
          bubble
            ? `mascot-bubble label pointer-events-none absolute bottom-full mb-2 w-max max-w-56 border border-ink bg-paper px-3 py-2 normal-case tracking-normal text-ink shadow-[3px_3px_0_var(--ink)] ${bubble.flip ? 'right-0' : 'left-0'}`
            : 'sr-only'
        }
      >
        {bubble?.text}
      </p>
    </div>
  )
}
