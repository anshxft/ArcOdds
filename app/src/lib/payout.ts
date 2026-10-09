// Pure money math, no imports, so the Hardhat test can load it and compare with the contract.

export const FEE_BPS = 200 // mirrors ArcOdds.FEE_BPS: 2% of the losing pool

/** Parimutuel payout for `stake` on a side if that side wins. `sidePool` must
 * already include the stake. Mirrors ArcOdds.claimWinnings. */
export function poolPayout(stake: number, sidePool: number, otherPool: number): number {
  if (!(stake > 0) || !(sidePool > 0)) return 0
  const fee = (otherPool * FEE_BPS) / 10000
  return (stake * (sidePool + otherPool - fee)) / sidePool
}

/** Quote for a new stake on one side of a pool. */
export function quote(stake: number, sidePool: number, otherPool: number) {
  const payout = poolPayout(stake, sidePool + stake, otherPool)
  return {
    payout,
    profit: payout - stake,
    fee: stake > 0 ? (otherPool * (FEE_BPS / 10000) * stake) / (sidePool + stake) : 0,
    share: stake > 0 ? (stake / (sidePool + stake)) * 100 : 0,
    noCounterparty: otherPool === 0,
  }
}
