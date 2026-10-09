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

/** GSAP: endless horizontal ticker. The track must contain its content twice. */
export function useMarquee(track: RefObject<HTMLElement | null>, ready = true) {
  useGSAP(() => {
    if (!ready || !track.current || reducedMotion()) return
    const tween = gsap.to(track.current, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 })
    const el = track.current
    const pause = () => tween.pause()
    const play = () => tween.play()
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', play)
    el.addEventListener('focusin', pause)
    el.addEventListener('focusout', play)
    return () => {
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', play)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('focusout', play)
    }
  }, { dependencies: [ready] })
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
