// Read-side access to the PredictArc contracts on Arc Testnet (viem).
// v2 (PredictArcV2) is current; v1 (ArcOdds) is legacy: its positions stay readable and claimable.
import { createPublicClient, decodeAbiParameters, defineChain, formatEther, getAddress, http, parseAbi, type Address } from 'viem'

export const ARC = {
  chainId: 5042002,
  chainIdHex: '0x4cef52',
  name: 'Arc Testnet',
  rpc: 'https://rpc.testnet.arc.network',
  explorer: 'https://explorer.testnet.arc.io',
  faucet: 'https://faucet.circle.com',
}
const BET_PLACED_TOPIC = '0x4af71b021e799c62c158bd54636ca8da2fa26115a21a2dc6efe486ec104fd15f' // same event in v1 and v2

export const arcTestnet = defineChain({
  id: ARC.chainId,
  name: ARC.name,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC.rpc] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: ARC.explorer } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
})

// Arc RPC mishandles JSON-RPC batches, so keep transport batching off; reads fold into Multicall3 instead.
export const publicClient = createPublicClient({ chain: arcTestnet, transport: http(ARC.rpc, { batch: false }) })

const SHARED = [
  'function marketCount() view returns (uint256)',
  'function owner() view returns (address)',
  'function getPosition(uint256, address) view returns (uint256 yesAmount, uint256 noAmount, bool hasClaimed)',
  'function placeBet(uint256, bool) payable',
  'function claimWinnings(uint256)',
  'function resolveMarket(uint256, bool)',
] as const
const ABI_V2 = parseAbi([
  ...SHARED,
  'function getMarket(uint256) view returns ((string question, string category, string rules, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator))',
  'function refund(uint256)',
  'function createMarket(string question, string category, string rules, uint256 deadline) returns (uint256)',
  'function cancelMarket(uint256, string reason)',
])
const ABI_V1 = parseAbi([
  ...SHARED,
  'function getMarket(uint256) view returns (string question, string category, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator)',
])

export const CONTRACTS = {
  2: { address: '0xfadbE0877379F3a6CBC8A612b9B28b1B25baa796' as Address, abi: ABI_V2 },
  1: { address: '0x19D638Af6b2De9718Eff496fc27a304155D6Af44' as Address, abi: ABI_V1 },
} as const
export type Version = keyof typeof CONTRACTS
const VERSIONS: Version[] = [2, 1]

export type Side = 'YES' | 'NO'
export interface Market {
  key: string // route key, e.g. "v2-3"
  version: Version
  id: number
  question: string
  category: string
  rules: string | null // v1 markets have no on-chain rules
  deadline: number
  yesPool: number
  noPool: number
  volume: number
  outcome: Side
  status: number // 0 open, 1 resolved, 2 cancelled
  creator: string
  yesOdds: number
}
export interface Bet {
  key: string
  user: string
  side: Side
  amount: number
  time: number
  txHash: string | null
}
export interface Position {
  key: string
  version: Version
  marketId: number
  side: Side
  amount: number
  claimed: boolean
}

export const marketKey = (version: Version, id: number) => `v${version}-${id}`
/** "v2-3" -> v2 market 3; a bare "3" is an old v1 link. */
export function parseMarketKey(key: string): { version: Version; id: number } | null {
  const match = /^(?:v([12])-)?(\d+)$/.exec(key)
  return match ? { version: Number(match[1] ?? 1) as Version, id: Number(match[2]) } : null
}

const toNumber = (value: bigint) => Number(formatEther(value))
export const txUrl = (hash: string) => `${ARC.explorer}/tx/${hash}`
export const addressUrl = (address: string) => `${ARC.explorer}/address/${address}`

// One eth_call per batch through Multicall3; results come back in call order.
async function readMany(version: Version, functionName: string, argsList: unknown[][]): Promise<unknown[]> {
  const { address, abi } = CONTRACTS[version]
  return publicClient.multicall({
    allowFailure: false,
    contracts: argsList.map((args) => ({ address, abi, functionName, args })) as never,
  }) as Promise<unknown[]>
}

async function marketIds(version: Version) {
  const { address, abi } = CONTRACTS[version]
  const count = (await publicClient.readContract({ address, abi, functionName: 'marketCount' } as never)) as bigint
  return Array.from({ length: Number(count) }, (_, index) => index + 1)
}

interface RawMarket { question: string; category: string; rules?: string; deadline: bigint; yesPool: bigint; noPool: bigint; outcome: boolean; status: number; creator: string }

function toRaw(version: Version, row: unknown): RawMarket {
  if (version === 2) return row as RawMarket // single struct output decodes to an object
  const [question, category, deadline, yesPool, noPool, outcome, status, creator] = row as [string, string, bigint, bigint, bigint, boolean, number, string]
  return { question, category, deadline, yesPool, noPool, outcome, status, creator }
}

function parseMarket(version: Version, id: number, raw: RawMarket): Market {
  const total = raw.yesPool + raw.noPool
  const yesPool = toNumber(raw.yesPool)
  const noPool = toNumber(raw.noPool)
  return {
    key: marketKey(version, id),
    version,
    id,
    question: raw.question,
    category: raw.category,
    rules: raw.rules ?? null,
    deadline: Number(raw.deadline),
    yesPool,
    noPool,
    volume: yesPool + noPool,
    outcome: raw.outcome ? 'YES' : 'NO',
    status: Number(raw.status),
    creator: raw.creator,
    yesOdds: total === 0n ? 50 : Number((raw.yesPool * 100n) / total), // same math as getOdds
  }
}

export async function fetchBalance(address: string) {
  return toNumber(await publicClient.getBalance({ address: address as Address }))
}

/** Owner of the current (v2) contract; the admin page only opens for this wallet. */
export async function fetchOwner(): Promise<string> {
  const { address, abi } = CONTRACTS[2]
  return (await publicClient.readContract({ address, abi, functionName: 'owner' })) as string
}

export async function fetchMarkets(): Promise<Market[]> {
  const perVersion = await Promise.all(VERSIONS.map(async (version) => {
    const ids = await marketIds(version)
    const rows = await readMany(version, 'getMarket', ids.map((id) => [BigInt(id)]))
    return rows.map((row, index) => parseMarket(version, ids[index], toRaw(version, row)))
  }))
  return perVersion.flat()
}

/** One entry per side: a wallet can hold both YES and NO in the same market. */
export async function fetchPositions(account: string): Promise<Position[]> {
  const perVersion = await Promise.all(VERSIONS.map(async (version) => {
    const ids = await marketIds(version)
    const rows = (await readMany(version, 'getPosition', ids.map((id) => [BigInt(id), account]))) as [bigint, bigint, boolean][]
    return ids.flatMap((id, index) => {
      const [yesAmount, noAmount, claimed] = rows[index]
      return ([['YES', toNumber(yesAmount)], ['NO', toNumber(noAmount)]] as [Side, number][])
        .filter(([, amount]) => amount > 0)
        .map(([side, amount]) => ({ key: marketKey(version, id), version, marketId: id, side, amount, claimed }))
    })
  }))
  return perVersion.flat()
}

/** BetPlaced history from the Arc explorer (the public RPC prunes old logs). */
async function fetchVersionBets(version: Version): Promise<Bet[]> {
  const bets: Bet[] = []
  let params = ''
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(`${ARC.explorer}/api/v2/addresses/${CONTRACTS[version].address}/logs${params}`)
    if (!response.ok) throw new Error(`Explorer request failed: ${response.status}`)
    const data = await response.json()
    for (const log of data.items ?? []) {
      if (log.topics?.[0] !== BET_PLACED_TOPIC) continue
      const [side, amount] = decodeAbiParameters([{ type: 'bool' }, { type: 'uint256' }], log.data)
      bets.push({
        key: marketKey(version, Number(BigInt(log.topics[1]))),
        user: getAddress('0x' + log.topics[2].slice(26)),
        side: side ? 'YES' : 'NO',
        amount: toNumber(amount),
        time: Date.parse(log.block_timestamp),
        txHash: log.transaction_hash || null,
      })
    }
    if (!data.next_page_params) break
    params = '?' + new URLSearchParams(data.next_page_params)
  }
  return bets
}

export async function fetchBets(): Promise<Bet[]> {
  return (await Promise.all(VERSIONS.map(fetchVersionBets))).flat().sort((a, b) => a.time - b.time)
}
