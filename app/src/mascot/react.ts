// Lets any page make Poring (the floating mascot) react, and lets visitors hide it.
// The mascot itself is lazy-loaded; calls made while it is not mounted return false.
import { useSyncExternalStore } from 'react'
import type definition from './poring.avatar.json'

export type Mood = keyof typeof definition.animations

/**
 * `ms`: how long to hold the mood before going back to idle. `say`: a short speech bubble.
 * `action`: a button in the bubble (shown with "Later"), e.g. Claim or Open.
 */
export interface Reaction {
  ms?: number
  say?: string
  action?: { label: string; run(): void }
}

let handler: ((mood: Mood, reaction: Reaction) => boolean) | null = null

export function setMascotHandler(next: typeof handler) {
  handler = next
}

/** Returns false when Poring is hidden, not loaded yet, or busy (dragged, mid-tour). */
export function mascot(mood: Mood, reaction: Reaction = {}): boolean {
  return handler?.(mood, reaction) ?? false
}

// ---- hide / show, remembered per browser ----

const HIDDEN_KEY = 'poring_hidden'
let hidden = (() => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
})()
const listeners = new Set<() => void>()

export function setPoringHidden(next: boolean) {
  hidden = next
  try {
    if (next) localStorage.setItem(HIDDEN_KEY, '1')
    else {
      localStorage.removeItem(HIDDEN_KEY)
      sessionStorage.setItem('poring_back', '1') // so it can say "I'm back!"
    }
  } catch {
    /* storage blocked: applies to this visit only */
  }
  listeners.forEach((listener) => listener())
}

export function usePoringHidden() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => hidden,
  )
}
