import { useEffect } from 'react'

const SITE_TITLE = 'PredictArc — prediction markets on Arc'
const SITE_DESCRIPTION = 'Prediction markets settled in USDC on Arc.'

/** Per-page <title> and meta description (index.html holds the defaults for the home page). */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — PredictArc` : SITE_TITLE
    document.querySelector('meta[name="description"]')?.setAttribute('content', description || SITE_DESCRIPTION)
    // One canonical host for every copy of the page (vercel.app, apex, ?net= links)
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = `https://www.arcpredict.xyz${location.pathname}`
  }, [title, description])
}
