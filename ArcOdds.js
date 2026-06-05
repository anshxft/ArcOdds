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
