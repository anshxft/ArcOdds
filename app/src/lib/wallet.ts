// Injected-wallet connection (EIP-6963 discovery, window.ethereum fallback) and signed actions.
import { useSyncExternalStore } from 'react'
import { BrowserProvider, Contract, parseEther } from 'ethers'
import { ABI, ARC, CONTRACT_ADDRESS } from './chain'

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, handler: (...args: unknown[]) => void): void
}
export interface WalletOption {
  name: string
  icon?: string
  provider: Eip1193
}

declare global {
  interface Window {
    ethereum?: Eip1193
  }
}

const announced: WalletOption[] = []
window.addEventListener('eip6963:announceProvider', ((event: CustomEvent) => {
  const { info, provider } = event.detail
  if (!announced.some((item) => item.provider === provider)) announced.push({ name: info.name, icon: info.icon, provider })
}) as EventListener)
window.dispatchEvent(new Event('eip6963:requestProvider'))

export function walletOptions(): WalletOption[] {
  if (announced.length) return announced
  return window.ethereum ? [{ name: 'Browser wallet', provider: window.ethereum }] : []
}

const STORAGE_KEY = 'PredictArc_wallet'
let state: { account: string | null; provider: Eip1193 | null } = {
  account: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })(),
  provider: null,
}
const listeners = new Set<() => void>()
function set(next: Partial<typeof state>) {
  state = { ...state, ...next }
  try {
    if (state.account) localStorage.setItem(STORAGE_KEY, state.account)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: the session still works */
  }
  listeners.forEach((listener) => listener())
}

export function useWallet() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

async function ensureArc(provider: Eip1193) {
  if (Number(await provider.request({ method: 'eth_chainId' })) === ARC.chainId) return
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC.chainIdHex }] })
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw new Error('Please switch your wallet to Arc Testnet.')
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: ARC.chainIdHex,
        chainName: ARC.name,
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: [ARC.rpc],
        blockExplorerUrls: [ARC.explorer],
      }],
    })
  }
}

export async function connect(option: WalletOption) {
  const accounts = (await option.provider.request({ method: 'eth_requestAccounts' })) as string[]
  await ensureArc(option.provider)
  option.provider.on?.('accountsChanged', (...args: unknown[]) => {
    const next = args[0] as string[] | undefined
    set({ account: next?.[0] ?? null })
  })
  set({ account: accounts[0], provider: option.provider })
  return accounts[0]
}

export function disconnect() {
  set({ account: null, provider: null })
}

async function signedContract() {
  const provider = state.provider ?? walletOptions()[0]?.provider
  if (!provider) throw new Error('No browser wallet found. Install MetaMask, Rabby or OKX Wallet.')
  await provider.request({ method: 'eth_requestAccounts' })
  await ensureArc(provider) // never sign on the wrong network
  const signer = await new BrowserProvider(provider).getSigner()
  return new Contract(CONTRACT_ADDRESS, ABI, signer)
}

export async function placeBet(marketId: number, side: boolean, amount: number) {
  const tx = await (await signedContract()).placeBet(marketId, side, { value: parseEther(String(amount)) })
  await tx.wait()
  return tx.hash as string
}

export async function claimWinnings(marketId: number) {
  const tx = await (await signedContract()).claimWinnings(marketId)
  await tx.wait()
  return tx.hash as string
}
