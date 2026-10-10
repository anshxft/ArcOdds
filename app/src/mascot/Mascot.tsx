// Poring: the floating mascot (bottom-left; toasts own bottom-right).
// Wakes on load, idles, reacts to trades through `mascot()`, dozes after 30s without input.
import { useEffect, useRef, useState } from 'react'
import { createAvatar, type AvatarController } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import definition from './poring.avatar.json'
import { setMascotHandler, type Mood } from './react'
import { reducedMotion } from '@/lib/motion'

const Poring = createAvatar(definition)
const DOZE_AFTER = 30_000
const SLEEP_AFTER = 15_000 // after dozing off

export default function Mascot() {
  const avatar = useRef<AvatarController>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [still] = useState(reducedMotion)
  const clicks = useRef(0)

  useEffect(() => {
    if (still) return
    let backToIdle = 0
    let bubbleTimer = 0
    let doze = 0
    let dozing = false
    const play = (mood: Mood) => avatar.current?.play(mood)
    const settle = (ms: number) => {
      clearTimeout(backToIdle)
      backToIdle = window.setTimeout(() => play('idle'), ms)
    }
    const say = (text: string | undefined, ms: number) => {
      clearTimeout(bubbleTimer)
      setBubble(text ?? null)
      if (text) bubbleTimer = window.setTimeout(() => setBubble(null), ms)
    }
    const armDoze = () => {
      clearTimeout(doze)
      doze = window.setTimeout(() => {
        dozing = true
        clearTimeout(backToIdle)
        play('drowsy')
        doze = window.setTimeout(() => play('sleeping'), SLEEP_AFTER)
      }, DOZE_AFTER)
    }
    const onActivity = () => {
      if (dozing) {
        dozing = false
        play('waking')
        settle(1600)
      }
      armDoze()
    }

    setMascotHandler((mood, { ms = 2600, say: text }) => {
      dozing = false
      armDoze()
      play(mood)
      settle(ms)
      say(text, Math.max(ms, 2400))
    })

    play('waking')
    settle(2000)
    armDoze()
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))
    return () => {
      setMascotHandler(null)
      events.forEach((name) => window.removeEventListener(name, onActivity))
      ;[backToIdle, bubbleTimer, doze].forEach(clearTimeout)
    }
  }, [still])

  function poke() {
    if (still) return
    clicks.current += 1
    avatar.current?.play(clicks.current % 2 ? 'laughing' : 'playful')
    window.setTimeout(() => avatar.current?.play('idle'), 2400)
  }

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-50 flex items-end gap-2 md:bottom-5 md:left-5">
      <button type="button" onClick={poke} aria-label="Poring, the PredictArc mascot" className="press pointer-events-auto w-12 md:w-24">
        {still ? <Poring defaultExpression="neutral" autoplay={false} size="100%" ariaLabel="Poring" /> : <Poring ref={avatar} defaultAnimation="idle" size="100%" ariaLabel="Poring" />}
      </button>
      <p role="status" className={bubble ? 'mascot-bubble label mb-6 max-w-48 border border-ink bg-paper px-3 py-2 normal-case tracking-normal text-ink shadow-[3px_3px_0_var(--ink)]' : 'sr-only'}>
        {bubble}
      </p>
    </div>
  )
}
