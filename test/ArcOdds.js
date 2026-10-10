const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ArcOdds", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const ArcOdds = await ethers.getContractFactory("ArcOdds");
    const contract = await ArcOdds.deploy();
    await contract.waitForDeployment();
    const latest = await ethers.provider.getBlock("latest");
    const deadline = latest.timestamp + 3600;
    await contract.createMarket("Will the test pass?", "tech", deadline);
    return { contract, owner, alice, bob, deadline };
  }

  it("allows only the owner to create markets", async function () {
    const { contract, alice, deadline } = await deployFixture();
    await expect(
      contract.connect(alice).createMarket("Unauthorized", "tech", deadline + 1)
    ).to.be.revertedWith("Only owner");
  });

  it("accepts native USDC bets and updates pool odds", async function () {
    const { contract, alice, bob } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: ethers.parseEther("3") });
    await contract.connect(bob).placeBet(1, false, { value: ethers.parseEther("1") });

    const [yesOdds, noOdds] = await contract.getOdds(1);
    expect(yesOdds).to.equal(75);
    expect(noOdds).to.equal(25);
  });

  it("resolves and pays winners after the deadline", async function () {
    const { contract, alice, bob, deadline } = await deployFixture();
    await contract.connect(alice).placeBet(1, true, { value: ethers.parseEther("1") });
    await contract.connect(bob).placeBet(1, false, { value: ethers.parseEther("1") });

    await ethers.provider.send("evm_setNextBlockTimestamp", [deadline]);
    await ethers.provider.send("evm_mine");
    await contract.resolveMarket(1, true);

    await expect(() => contract.connect(alice).claimWinnings(1))
      .to.changeEtherBalance(alice, ethers.parseEther("1.98"));
    expect(await contract.accruedFees()).to.equal(ethers.parseEther("0.02"));
  });
});

describe("frontend payout estimate", function () {
  it("matches claimWinnings for an uneven pool", async function () {
    const [, alice, bob, carol] = await ethers.getSigners();
    const ArcOdds = await ethers.getContractFactory("ArcOdds");
    const contract = await ArcOdds.deploy();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await contract.createMarket("Uneven pool", "tech", deadline);
    await contract.connect(alice).placeBet(1, false, { value: ethers.parseEther("10") });
    await contract.connect(bob).placeBet(1, false, { value: ethers.parseEther("5") });
    await contract.connect(carol).placeBet(1, true, { value: ethers.parseEther("106") });

    await ethers.provider.send("evm_setNextBlockTimestamp", [deadline]);
    await ethers.provider.send("evm_mine");
    await contract.resolveMarket(1, false);

    const before = await ethers.provider.getBalance(alice.address);
    const tx = await contract.connect(alice).claimWinnings(1);
    const receipt = await tx.wait();
    const paid = (await ethers.provider.getBalance(alice.address)) - before + receipt.gasUsed * receipt.gasPrice;

    // The site's estimate (app/src/lib/payout.ts) must agree with the contract.
    const { poolPayout, quote } = await import(require("url").pathToFileURL(require("path").join(__dirname, "..", "app", "src", "lib", "payout.ts")).href);
    expect(Number(ethers.formatEther(paid))).to.be.closeTo(poolPayout(10, 15, 106), 1e-9);
    expect(quote(10, 5, 106).payout).to.be.closeTo(poolPayout(10, 15, 106), 1e-9);
  });
});
