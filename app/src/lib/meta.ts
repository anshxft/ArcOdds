import { useEffect } from 'react'

const SITE_TITLE = 'PredictArc — prediction markets on Arc'
const SITE_DESCRIPTION = 'Prediction markets settled in USDC on Arc.'

/** Per-page <title> and meta description (index.html holds the defaults for the home page). */
export function usePageMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — PredictArc` : SITE_TITLE
    document.querySelector('meta[name="description"]')?.setAttribute('content', description || SITE_DESCRIPTION)
  }, [title, description])
}
