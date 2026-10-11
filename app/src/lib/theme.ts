// Light by default; dark only when the visitor picks it. One store, so every toggle stays in sync.
import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

// New key on purpose: the old HTML site saved `theme` = 'dark' (its default) on this domain,
// which made the new site open dark for anyone who had visited it.
const KEY = 'pa_theme'
const BAR = { light: '#e4e4e0', dark: '#0d0d0c' } // browser / phone status bar colour
const listeners = new Set<() => void>()

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme])
}

/** Call once before the first render. */
export function initTheme() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
    localStorage.removeItem('theme')
  } catch {
    /* storage blocked: light */
  }
  apply(saved === 'dark' ? 'dark' : 'light')
}

export function setTheme(theme: Theme) {
  apply(theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage blocked: this visit only */
  }
  listeners.forEach((listener) => listener())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
  )
}
