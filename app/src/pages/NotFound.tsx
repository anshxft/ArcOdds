import { useEffect } from 'react'
import { Link } from 'react-router'
import { Decode, Label } from '@/components/site'
import { usePageMeta } from '@/lib/meta'
import { mascot } from '@/mascot/react'

export default function NotFound() {
  usePageMeta('Page not found')
  useEffect(() => {
    mascot('sad', { ms: 4000, say: 'Nothing here. Try Markets?' })
  }, [])
  return (
    <section className="frame grid border-t-0 md:grid-cols-12">
      <div className="cell p-6 md:col-span-8 md:p-8">
        <Decode text="Error / 404" className="text-muted" />
        <h1 className="font-display mt-3 text-[clamp(96px,18vw,260px)] font-extrabold leading-[0.85] tracking-[-0.04em]">404</h1>
        <p className="mt-4 max-w-md text-lg leading-snug">This page does not exist. If you followed an old market link, the market may live on a newer contract now.</p>
      </div>
      <nav className="cell flex flex-col justify-end md:col-span-4" aria-label="Where to next">
        {[['/markets', 'Browse markets'], ['/', 'Home'], ['/docs', 'Read the docs']].map(([to, label]) => (
          <Link key={to} to={to} className="press label hover-ink flex min-h-14 items-center justify-between border-t border-line px-6">
            {label} <span aria-hidden="true">→</span>
          </Link>
        ))}
        <Label className="border-t border-line px-6 py-4">Lost? Tap Poring for a tour.</Label>
      </nav>
    </section>
  )
}
