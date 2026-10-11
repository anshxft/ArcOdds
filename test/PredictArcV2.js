const { expect } = require("chai");
const { ethers } = require("hardhat");

const RULES = "Resolves YES if the official source reports the event before the deadline (UTC).";
const usdc = (value) => ethers.parseEther(String(value));

// V3 adds cash-out on top of V2, so every V2 guarantee is checked on both.
for (const NAME of ["PredictArcV2", "PredictArcV3"]) describe(NAME, function () {
  async function deployFixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const contract = await (await ethers.getContractFactory(NAME)).deploy();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await contract.createMarket("Will the test pass?", "tech", RULES, deadline);
    return { contract, owner, alice, bob, carol, deadline };
  }

  async function passDeadline(timestamp) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await ethers.provider.send("evm_mine");
  }

  it("stores the resolution rules on-chain and requires them", async function () {
    const { contract, deadline } = await deployFixture();
    expect((await contract.getMarket(1)).rules).to.equal(RULES);
    await expect(contract.createMarket("No rules", "tech", "", deadline)).to.be.revertedWith("Rules required");
  });

  it("pays winners the pool minus 2% of the losing side", async function () {
    const { contract, alice, bob, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(1) });
    await contract.connect(bob).placeBet(1, false, { value: usdc(1) });
    await passDeadline(deadline);
    await contract.resolveMarket(1, true);
    await expect(() => contract.connect(alice).claimWinnings(1)).to.changeEtherBalance(alice, usdc(1.98));
    expect(await contract.accruedFees()).to.equal(usdc(0.02));
  });

  it("refunds everyone when the owner cancels, including both sides of a hedged wallet", async function () {
    const { contract, alice, bob } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(2) });
    await contract.connect(alice).placeBet(1, false, { value: usdc(1) });
    await contract.connect(bob).placeBet(1, false, { value: usdc(4) });
    await contract.cancelMarket(1, "Ambiguous question");

    await expect(() => contract.connect(alice).refund(1)).to.changeEtherBalance(alice, usdc(3));
    await expect(() => contract.connect(bob).refund(1)).to.changeEtherBalance(bob, usdc(4));
    await expect(contract.connect(alice).refund(1)).to.be.revertedWith("Already refunded");
    await expect(contract.connect(alice).claimWinnings(1)).to.be.revertedWith("Not resolved");
    await expect(contract.connect(alice).placeBet(1, true, { value: usdc(1) })).to.be.revertedWith("Market closed");
  });

  it("cancels instead of resolving when nobody backed the winning side (no stuck funds)", async function () {
    const { contract, alice, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(0.5) });
    await passDeadline(deadline);
    await expect(contract.resolveMarket(1, false)).to.emit(contract, "MarketCancelled");
    expect((await contract.getMarket(1)).status).to.equal(2);
    await expect(() => contract.connect(alice).refund(1)).to.changeEtherBalance(alice, usdc(0.5));
  });

  it("lets anyone cancel a market the owner never resolved, after the window", async function () {
    const { contract, carol, alice, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: usdc(1) });
    const window = Number(await contract.RESOLUTION_WINDOW());
    await passDeadline(deadline + window - 10);
    await expect(contract.connect(carol).cancelStaleMarket(1)).to.be.revertedWith("Resolution window open");
    await passDeadline(deadline + window);
    await contract.connect(carol).cancelStaleMarket(1);
    await expect(() => contract.connect(alice).refund(1)).to.changeEtherBalance(alice, usdc(1));
  });

  it("only lets the owner create, resolve and cancel", async function () {
    const { contract, alice, deadline } = await deployFixture();
    await expect(contract.connect(alice).createMarket("x", "tech", RULES, deadline + 1)).to.be.revertedWith("Only owner");
    await expect(contract.connect(alice).cancelMarket(1, "no")).to.be.revertedWith("Only owner");
    await passDeadline(deadline);
    await expect(contract.connect(alice).resolveMarket(1, true)).to.be.revertedWith("Only owner");
  });

  it("hands ownership over in two steps (for a multisig)", async function () {
    const { contract, owner, alice, bob } = await deployFixture();
    await contract.transferOwnership(alice.address);
    expect(await contract.owner()).to.equal(owner.address);
    await expect(contract.connect(bob).acceptOwnership()).to.be.revertedWith("Not pending owner");
    await contract.connect(alice).acceptOwnership();
    expect(await contract.owner()).to.equal(alice.address);
    await expect(contract.cancelMarket(1, "old owner")).to.be.revertedWith("Only owner");
  });
});
