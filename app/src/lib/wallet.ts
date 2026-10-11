// Injected-wallet connection (EIP-6963 discovery, window.ethereum fallback) and signed actions.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createWalletClient, custom, parseEther, type Address } from 'viem'
import { ARC, arcChain, contract, fetchOwner, publicClient, type Version } from './chain'

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
    if ((error as { code?: number }).code !== 4902) throw new Error(`Please switch your wallet to ${ARC.name}.`)
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

/** Sends one contract call from the connected wallet and waits for it to be mined. */
async function write(version: Version, functionName: string, args: unknown[], value?: bigint) {
  const provider = state.provider ?? walletOptions()[0]?.provider
  if (!provider) throw new Error('No browser wallet found. Install MetaMask, Rabby or OKX Wallet.')
  const [account] = (await provider.request({ method: 'eth_requestAccounts' })) as Address[]
  await ensureArc(provider) // never sign on the wrong network
  const wallet = createWalletClient({ account, chain: arcChain, transport: custom(provider) })
  const { address, abi } = contract(version)
  const hash = await wallet.writeContract({ address, abi, functionName, args, value } as never)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain')
  return hash
}

/** Short, human message for a failed wallet/contract call (viem errors are long). */
export function errorText(error: unknown, fallback = 'Transaction failed') {
  const e = error as { shortMessage?: string; message?: string }
  const text = e?.shortMessage || e?.message || fallback
  return text.split('\n')[0].slice(0, 160)
}

export const placeBet = (version: Version, marketId: number, side: boolean, amount: number) =>
  write(version, 'placeBet', [BigInt(marketId), side], parseEther(String(amount)))

export const claimWinnings = (version: Version, marketId: number) => write(version, 'claimWinnings', [BigInt(marketId)])

/** v2 only: take back both sides of a stake from a cancelled market. */
export const refund = (marketId: number) => write(2, 'refund', [BigInt(marketId)])

// ---- owner actions (the contract rejects anyone else) ----

export const createMarket = (question: string, category: string, rules: string, deadline: number) =>
  write(2, 'createMarket', [question, category, rules, BigInt(deadline)])

export const resolveMarket = (version: Version, marketId: number, outcome: boolean) =>
  write(version, 'resolveMarket', [BigInt(marketId), outcome])

export const cancelMarket = (marketId: number, reason: string) => write(2, 'cancelMarket', [BigInt(marketId), reason])

let ownerRequest: Promise<string> | null = null
/** True when the connected wallet owns the v2 contract (gates the admin page; the contract enforces it). */
export function useIsOwner() {
  const { account } = useWallet()
  const [owner, setOwner] = useState<string | null>(null)
  useEffect(() => {
    ownerRequest ??= fetchOwner()
    ownerRequest.then(setOwner).catch(() => {
      ownerRequest = null
    })
  }, [])
  return Boolean(account && owner && account.toLowerCase() === owner.toLowerCase())
}
