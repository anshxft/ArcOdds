const { expect } = require("chai");
const { ethers } = require("hardhat");

const RULES = "Resolves YES if the official source reports the event before the deadline (UTC).";
const usdc = (value) => ethers.parseEther(String(value));
const DAY = 86400;

describe("PredictArcV3 cash-out", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const contract = await (await ethers.getContractFactory("PredictArcV3")).deploy();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + DAY;
    await contract.createMarket("Will the test pass?", "tech", RULES, deadline);
    return { contract, owner, alice, bob, deadline };
  }
  const at = async (timestamp) => {
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine");
  };

  it("returns the stake minus 2% and shrinks the pool", async function () {
    const { contract, alice, bob } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(10) });
    await contract.connect(bob).placeBet(1, false, { value: usdc(5) });
    await expect(() => contract.connect(alice).cashOut(1, true, usdc(10))).to.changeEtherBalance(alice, usdc(9.8));
    const market = await contract.getMarket(1);
    expect(market.yesPool).to.equal(0n);
    expect(market.noPool).to.equal(usdc(5));
    expect(await contract.accruedFees()).to.equal(usdc(0.2));
    expect((await contract.getPosition(1, alice.address)).yesAmount).to.equal(0n);
  });

  it("allows a partial cash-out and pays the rest out normally", async function () {
    const { contract, alice, bob, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(4) });
    await contract.connect(bob).placeBet(1, false, { value: usdc(2) });
    await contract.connect(alice).cashOut(1, true, usdc(1)); // 3 YES left, pool 3 vs 2
    await at(deadline);
    await contract.resolveMarket(1, true);
    // 3 * (3 + 2 - 0.04) / 3 = 4.96
    await expect(() => contract.connect(alice).claimWinnings(1)).to.changeEtherBalance(alice, usdc(4.96));
  });

  it("keeps the contract solvent: every claim still pays after cash-outs", async function () {
    const { contract, owner, alice, bob, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(3) });
    await contract.connect(bob).placeBet(1, true, { value: usdc(2) });
    await contract.connect(owner).placeBet(1, false, { value: usdc(5) });
    await contract.connect(bob).cashOut(1, true, usdc(2));
    await at(deadline);
    await contract.resolveMarket(1, true);
    await contract.connect(alice).claimWinnings(1);
    await contract.withdrawFees(await contract.accruedFees(), owner.address);
    expect(await ethers.provider.getBalance(await contract.getAddress())).to.be.lessThan(10n); // only rounding dust left
  });

  it("refuses more than your stake, the other side, zero, and closed markets", async function () {
    const { contract, alice } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(1) });
    await expect(contract.connect(alice).cashOut(1, true, usdc(2))).to.be.revertedWith("Exceeds stake");
    await expect(contract.connect(alice).cashOut(1, false, usdc(1))).to.be.revertedWith("Exceeds stake");
    await expect(contract.connect(alice).cashOut(1, true, 0)).to.be.revertedWith("Amount required");
    await contract.cancelMarket(1, "void");
    await expect(contract.connect(alice).cashOut(1, true, usdc(1))).to.be.revertedWith("Market closed");
  });

  it("closes cash-outs in the last hour before the deadline", async function () {
    const { contract, alice, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(1) });
    await at(deadline - 3600);
    await expect(contract.connect(alice).cashOut(1, true, usdc(1))).to.be.revertedWith("Cash-out closed");
  });
});
