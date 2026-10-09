// Read-side access to the ArcOdds contract on Arc Testnet.
import { AbiCoder, Contract, Interface, JsonRpcProvider, formatEther, getAddress } from 'ethers'

export const CONTRACT_ADDRESS = '0x19D638Af6b2De9718Eff496fc27a304155D6Af44'
export const ARC = {
  chainId: 5042002,
  chainIdHex: '0x4cef52',
  name: 'Arc Testnet',
  rpc: 'https://rpc.testnet.arc.network',
  explorer: 'https://explorer.testnet.arc.io',
  faucet: 'https://faucet.circle.com',
}
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const BET_PLACED_TOPIC = '0x4af71b021e799c62c158bd54636ca8da2fa26115a21a2dc6efe486ec104fd15f'

export const ABI = [
  'function marketCount() view returns (uint256)',
  'function getMarket(uint256) view returns (string question, string category, uint256 deadline, uint256 yesPool, uint256 noPool, bool outcome, uint8 status, address creator)',
  'function getPosition(uint256, address) view returns (uint256 yesAmount, uint256 noAmount, bool hasClaimed)',
  'function placeBet(uint256, bool) payable',
  'function claimWinnings(uint256)',
]
const iface = new Interface(ABI)

export type Side = 'YES' | 'NO'
export interface Market {
  id: number
  question: string
  category: string
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
  marketId: number
  user: string
  side: Side
  amount: number
  time: number
  txHash: string | null
}
export interface Position {
  marketId: number
  side: Side
  amount: number
  claimed: boolean
}

// Arc RPC mishandles JSON-RPC batches, so send calls one by one and fold reads into Multicall3.
const provider = new JsonRpcProvider(ARC.rpc, ARC.chainId, { staticNetwork: true, batchMaxCount: 1 })
const contract = new Contract(CONTRACT_ADDRESS, ABI, provider)
const multicall = new Contract(
  MULTICALL3,
  ['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)'],
  provider,
)

const toNumber = (value: bigint) => Number(formatEther(value))
export const txUrl = (hash: string) => `${ARC.explorer}/tx/${hash}`
export const addressUrl = (address: string) => `${ARC.explorer}/address/${address}`

async function readMany(calls: [string, unknown[]][]) {
  const results = await multicall.aggregate3(
    calls.map(([fn, args]) => ({ target: CONTRACT_ADDRESS, allowFailure: false, callData: iface.encodeFunctionData(fn, args) })),
  )
  return results.map((result: { returnData: string }, index: number) => iface.decodeFunctionResult(calls[index][0], result.returnData))
}

async function marketIds() {
  const count = Number(await contract.marketCount())
  return Array.from({ length: count }, (_, index) => index + 1)
}

function parseMarket(id: number, raw: { question: string; category: string; deadline: bigint; yesPool: bigint; noPool: bigint; outcome: boolean; status: bigint; creator: string }): Market {
  const total = raw.yesPool + raw.noPool
  const yesPool = toNumber(raw.yesPool)
  const noPool = toNumber(raw.noPool)
  return {
    id,
    question: raw.question,
    category: raw.category,
    deadline: Number(raw.deadline),
    yesPool,
    noPool,
    volume: yesPool + noPool,
    outcome: raw.outcome ? 'YES' : 'NO',
    status: Number(raw.status),
    creator: raw.creator,
    yesOdds: total === 0n ? 50 : Number((raw.yesPool * 100n) / total), // same math as ArcOdds.getOdds
  }
}

export async function fetchMarkets(): Promise<Market[]> {
  const ids = await marketIds()
  const rows = await readMany(ids.map((id) => ['getMarket', [id]]))
  return rows.map((row: never, index: number) => parseMarket(ids[index], row))
}

/** One entry per side: a wallet can hold both YES and NO in the same market. */
export async function fetchPositions(account: string): Promise<Position[]> {
  const ids = await marketIds()
  const rows = await readMany(ids.map((id) => ['getPosition', [id, account]]))
  return ids.flatMap((id, index) => {
    const row = rows[index]
    return ([['YES', toNumber(row.yesAmount)], ['NO', toNumber(row.noAmount)]] as [Side, number][])
      .filter(([, amount]) => amount > 0)
      .map(([side, amount]) => ({ marketId: id, side, amount, claimed: row.hasClaimed }))
  })
}

/** BetPlaced history from the Arc explorer (the public RPC prunes old logs). */
export async function fetchBets(): Promise<Bet[]> {
  const bets: Bet[] = []
  let params = ''
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(`${ARC.explorer}/api/v2/addresses/${CONTRACT_ADDRESS}/logs${params}`)
    if (!response.ok) throw new Error(`Explorer request failed: ${response.status}`)
    const data = await response.json()
    for (const log of data.items ?? []) {
      if (log.topics?.[0] !== BET_PLACED_TOPIC) continue
      const [side, amount] = AbiCoder.defaultAbiCoder().decode(['bool', 'uint256'], log.data)
      bets.push({
        marketId: Number(BigInt(log.topics[1])),
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
  return bets.sort((a, b) => a.time - b.time)
}
