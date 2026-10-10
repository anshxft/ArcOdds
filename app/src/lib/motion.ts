// Motion roles, one tool per job:
//   anime.js -> the boot sequence: grid cells above the fold wipe in when a page opens
//   GSAP     -> scroll: reveals, parallax, the marquee ticker (ScrollTrigger + Lenis share its ticker)
//   CSS      -> every hover/press interaction (interruptible transitions, Emil's curves)
import { type RefObject, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { animate, stagger } from 'animejs'

gsap.registerPlugin(ScrollTrigger, useGSAP)
export { gsap, ScrollTrigger, useGSAP }

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** anime.js: [data-boot] cells draw in left-to-right like a terminal booting. */
export function useBoot(scope: RefObject<HTMLElement | null>, ready = true) {
  useGSAP(() => {
    const cells = scope.current?.querySelectorAll<HTMLElement>('[data-boot]')
    if (!ready || !cells?.length || reducedMotion()) return
    const run = animate(cells, {
      clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'],
      opacity: [0, 1],
      duration: 700,
      delay: stagger(55),
      ease: 'outExpo',
    })
    return () => {
      run.revert()
    }
  }, { scope, dependencies: [ready] })
}

/** GSAP: [data-reveal] rises in once on scroll, [data-parallax] drifts with it. */
export function useScrollMotion(scope: RefObject<HTMLElement | null>, ready = true) {
  useGSAP(() => {
    if (!ready || reducedMotion()) return
    const reveal = gsap.utils.toArray<HTMLElement>('[data-reveal]')
    gsap.set(reveal, { opacity: 0, y: 32 })
    ScrollTrigger.batch(reveal, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, overwrite: true }),
    })
    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
      gsap.fromTo(el, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el.parentElement, scrub: true } })
    })
    ScrollTrigger.refresh()
  }, { scope, dependencies: [ready] })
}

const MARQUEE_SPEED = 45 // px per second

/**
 * Endless horizontal ticker. The track must contain its content twice.
 * Runs as a Web Animation so the browser moves it on the compositor (no main-thread work per
 * frame), at a constant reading speed however many items there are. Hover/focus eases it to a
 * stop and back instead of freezing mid-frame.
 */
export function useMarquee(track: RefObject<HTMLElement | null>, ready = true) {
  useEffect(() => {
    const el = track.current
    if (!ready || !el || reducedMotion()) return
    const distance = el.scrollWidth / 2
    const anim = el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-distance}px)` }], {
      duration: (distance / MARQUEE_SPEED) * 1000,
      iterations: Infinity,
    })
    let frame = 0
    const easeTo = (target: number, ms: number) => {
      cancelAnimationFrame(frame)
      const from = anim.playbackRate
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - start) / ms, 1)
        const eased = target < from ? 1 - (1 - p) ** 2 : p * p // ease out when stopping, in when starting
        anim.updatePlaybackRate(from + (target - from) * eased)
        if (p < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    const pause = () => easeTo(0, 600)
    const play = () => easeTo(1, 800)
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', play)
    el.addEventListener('focusin', pause)
    el.addEventListener('focusout', play)
    return () => {
      cancelAnimationFrame(frame)
      anim.cancel()
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', play)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('focusout', play)
    }
  }, [track, ready])
}

/** True while the element is on screen (never true for display:none), so canvas effects can sleep. */
export function useInView(ref: RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return inView
}
