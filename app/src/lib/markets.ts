// Shared market data: one fetch for the whole app, refreshed every minute.
import { useSyncExternalStore } from 'react'
import { fetchBets, fetchMarkets, type Bet, type Market } from './chain'

const IMAGES = [
  'classic-btc', 'market-eth-v3', 'classic-finance', 'classic-gold-fixed', 'classic-ai-fixed', 'market-apple-v3',
  'classic-us-politics', 'classic-nato', 'classic-football-action', 'market-fifa-v3', 'classic-gta-wall', 'classic-cinema',
]
export const marketImage = (id: number) => `/markets/${IMAGES[(id - 1) % IMAGES.length]}.jpg`

export type MarketState = 'open' | 'closed' | 'resolved' | 'cancelled'
export function marketState(market: Market, now = Date.now()): MarketState {
  if (market.status === 1) return 'resolved'
  if (market.status === 2) return 'cancelled'
  return now / 1000 >= market.deadline ? 'closed' : 'open'
}
export function stateLabel(market: Market) {
  const state = marketState(market)
  if (state === 'resolved') return `Resolved ${market.outcome}`
  if (state === 'closed') return 'Awaiting resolution'
  if (state === 'cancelled') return 'Cancelled'
  return 'Open'
}

export const formatDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export const formatUsdc = (value: number) =>
  `${value >= 1000 ? `${(value / 1000).toFixed(1)}K` : Number(value.toFixed(2)).toLocaleString('en-US')} USDC`
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
export function timeAgo(ms: number) {
  const minutes = Math.max(1, Math.round((Date.now() - ms) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / 1440)}d ago`
}

interface Snapshot {
  markets: Market[]
  bets: Bet[]
  loading: boolean
  error: string | null
}
let snapshot: Snapshot = { markets: [], bets: [], loading: true, error: null }
const listeners = new Set<() => void>()
let timer: number | undefined

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((listener) => listener())
}

export async function refreshMarkets() {
  try {
    set({ markets: await fetchMarkets(), loading: false, error: null })
  } catch (error) {
    set({ loading: false, error: (error as Error).message })
  }
  // Bet history is secondary (bettor counts, charts, feed); a failure there keeps the markets.
  fetchBets().then((bets) => set({ bets })).catch(() => {})
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    refreshMarkets()
    timer = window.setInterval(refreshMarkets, 60000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.clearInterval(timer)
  }
}

export function useMarkets() {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function bettorCount(bets: Bet[], marketId?: number) {
  return new Set(bets.filter((bet) => marketId === undefined || bet.marketId === marketId).map((bet) => bet.user)).size
}
