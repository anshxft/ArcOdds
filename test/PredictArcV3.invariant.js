const { expect } = require("chai");
const { ethers } = require("hardhat");

// Random bets and cash-outs across several markets, then resolve/cancel and pay everyone out.
// Invariants: at every step the contract holds at least both pools plus the recorded fees, and at the
// end, after every claim, refund and fee withdrawal, only rounding dust is left.
const RULES = "Resolves from the official source after the deadline (UTC).";
const DAY = 86400;
const SEEDS = [1, 7, 42, 2026];

function rng(seed) {
  let state = seed;
  return () => ((state = (state * 16807) % 2147483647) / 2147483647);
}

describe("PredictArcV3 solvency (randomised)", function () {
  for (const seed of SEEDS) {
    it(`stays solvent and pays out in full (seed ${seed})`, async function () {
      const random = rng(seed);
      const [owner, ...users] = (await ethers.getSigners()).slice(0, 6);
      const contract = await (await ethers.getContractFactory("PredictArcV3")).deploy();
      const address = await contract.getAddress();
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + DAY;
      const MARKETS = 3;
      for (let i = 0; i < MARKETS; i++) await contract.createMarket(`Market ${i}`, "test", RULES, deadline);

      const solvent = async () => {
        let pools = 0n;
        for (let id = 1; id <= MARKETS; id++) {
          const market = await contract.getMarket(id);
          if (Number(market.status) === 0) pools += market.yesPool + market.noPool;
        }
        const balance = await ethers.provider.getBalance(address);
        expect(balance).to.be.at.least(pools + (await contract.accruedFees()));
      };

      for (let step = 0; step < 60; step++) {
        const user = users[Math.floor(random() * users.length)];
        const id = 1 + Math.floor(random() * MARKETS);
        const side = random() < 0.5;
        const position = await contract.getPosition(id, user.address);
        const stake = side ? position.yesAmount : position.noAmount;
        if (stake > 0n && random() < 0.3) {
          const amount = random() < 0.5 ? stake : stake / 2n + 1n;
          await contract.connect(user).cashOut(id, side, amount > stake ? stake : amount);
        } else {
          await contract.connect(user).placeBet(id, side, { value: ethers.parseEther((0.01 + random() * 3).toFixed(4)) });
        }
        await solvent();
      }

      await ethers.provider.send("evm_setNextBlockTimestamp", [deadline]);
      await ethers.provider.send("evm_mine");
      for (let id = 1; id <= MARKETS; id++) {
        if (random() < 0.2) await contract.cancelMarket(id, "test cancel");
        else await contract.resolveMarket(id, random() < 0.5);
        await solvent();
      }

      for (let id = 1; id <= MARKETS; id++) {
        const market = await contract.getMarket(id);
        for (const user of users) {
          const position = await contract.getPosition(id, user.address);
          if (position.yesAmount + position.noAmount === 0n) continue;
          if (Number(market.status) === 2) await contract.connect(user).refund(id);
          else {
            const winning = market.outcome ? position.yesAmount : position.noAmount;
            if (winning > 0n) await contract.connect(user).claimWinnings(id);
          }
        }
      }
      const fees = await contract.accruedFees();
      if (fees > 0n) await contract.withdrawFees(fees, owner.address);
      // Pro-rata division rounds down per claim: at most a few wei per payout can remain.
      expect(await ethers.provider.getBalance(address)).to.be.lessThan(100n);
    });
  }
});
