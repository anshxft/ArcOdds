import { useSyncExternalStore } from 'react'

// Starred markets, kept in this browser only.
const KEY = 'pa_watchlist'
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
let keys = read()

export function toggleWatch(key: string) {
  keys = keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
  try {
    localStorage.setItem(KEY, JSON.stringify(keys))
  } catch {
    /* storage blocked: the star still works for this visit */
  }
  listeners.forEach((listener) => listener())
}

export function useWatchlist() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => keys,
  )
}
