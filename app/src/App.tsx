// Stack check page: every library the redesign will use, wired together once.
// Replace with the real pages when the redesign starts.
import { useEffect, useRef, useState } from 'react'
import { JsonRpcProvider, Contract } from 'ethers'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ReactLenis, type LenisRef } from 'lenis/react'
import 'lenis/dist/lenis.css'
import { ThinkingOrb } from 'thinking-orbs'
import SplitText from '@/components/SplitText'
import CountUp from '@/components/CountUp'
import Aurora from '@/components/Aurora'
import ShinyText from '@/components/ShinyText'
import { Button } from '@/components/ui/button'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const CONTRACT = '0x19D638Af6b2De9718Eff496fc27a304155D6Af44'
const STATES = ['working', 'searching', 'solving', 'listening', 'connecting', 'weaving', 'composing', 'breathing', 'shaping'] as const

export default function App() {
  const lenisRef = useRef<LenisRef>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [markets, setMarkets] = useState<number | null>(null)

  // Lenis on GSAP's ticker so ScrollTrigger and smooth scroll share one clock.
  useEffect(() => {
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => gsap.ticker.remove(update)
  }, [])

  useGSAP(() => {
    gsap.from(boxRef.current, {
      x: -120, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: boxRef.current, start: 'top 85%' },
    })
  })

  useEffect(() => {
    const provider = new JsonRpcProvider('https://rpc.testnet.arc.network', 5042002, { staticNetwork: true, batchMaxCount: 1 })
    new Contract(CONTRACT, ['function marketCount() view returns (uint256)'], provider)
      .marketCount()
      .then((count: bigint) => setMarkets(Number(count)))
      .catch(() => setMarkets(-1))
  }, [])

  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      <main className="dark min-h-screen bg-neutral-950 text-neutral-100">
        <section className="relative grid h-screen place-items-center overflow-hidden">
          <div className="absolute inset-0 opacity-60">
            <Aurora colorStops={['#7c3aed', '#22c55e', '#7c3aed']} amplitude={1} blend={0.5} />
          </div>
          <div className="relative text-center">
            <SplitText text="PredictArc stack check" tag="h1" className="text-5xl font-bold" splitType="chars" />
            <p className="mt-4 text-lg">
              <ShinyText text="React Bits · GSAP · Lenis · thinking-orbs" speed={3} />
            </p>
            <p className="mt-6 text-sm text-neutral-400">
              On-chain markets:{' '}
              <span data-check="ethers">{markets === null ? '…' : markets === -1 ? 'error' : <CountUp to={markets} duration={1} />}</span>
            </p>
            <Button className="mt-6" onClick={() => lenisRef.current?.lenis?.scrollTo('#orbs')}>Scroll to orbs</Button>
          </div>
        </section>

        <section id="orbs" className="mx-auto flex min-h-screen max-w-4xl flex-wrap content-center justify-center gap-8 p-8">
          {STATES.map((state) => (
            <figure key={state} className="text-center text-xs text-neutral-400">
              <ThinkingOrb state={state} size={64} />
              <figcaption className="mt-2">{state}</figcaption>
            </figure>
          ))}
          <div ref={boxRef} data-check="gsap" className="w-full rounded-xl border border-neutral-800 p-6 text-center">
            GSAP ScrollTrigger slid this in
          </div>
        </section>
      </main>
    </ReactLenis>
  )
}
