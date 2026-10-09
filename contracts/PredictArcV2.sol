// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Parimutuel YES/NO markets paid in Arc's native USDC.
/// v2 over ArcOdds: published resolution rules, cancellation with refunds,
/// automatic refunds when nobody backed the winning side, a public escape hatch
/// if the owner never resolves, and two-step ownership (hand it to a multisig).
contract PredictArcV2 {
    enum MarketStatus {
        Open,
        Resolved,
        Cancelled
    }

    struct Market {
        string question;
        string category;
        string rules; // how and from which source the outcome is decided
        uint256 deadline;
        uint256 yesPool;
        uint256 noPool;
        bool outcome;
        MarketStatus status;
        address creator;
    }

    uint256 public constant FEE_BPS = 200; // 2% of the losing pool
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// After deadline + this window, anyone may cancel an unresolved market so bettors can refund.
    uint256 public constant RESOLUTION_WINDOW = 30 days;

    address public owner;
    address public pendingOwner;
    uint256 public marketCount;
    uint256 public accruedFees;
    bool private locked;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    mapping(uint256 => mapping(address => uint256)) public noBets;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed marketId, string question, string category, string rules, uint256 deadline, address indexed creator);
    event BetPlaced(uint256 indexed marketId, address indexed user, bool side, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event MarketCancelled(uint256 indexed marketId, string reason);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event Refunded(uint256 indexed marketId, address indexed user, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ---- ownership (two-step, so a typo can't brick the contract) ----

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ---- market lifecycle ----

    function createMarket(
        string calldata _question,
        string calldata _category,
        string calldata _rules,
        uint256 _deadline
    ) external onlyOwner returns (uint256) {
        require(bytes(_question).length > 0, "Question required");
        require(bytes(_rules).length > 0, "Rules required");
        require(_deadline > block.timestamp, "Deadline must be future");

        marketCount += 1;
        markets[marketCount] = Market({
            question: _question,
            category: _category,
            rules: _rules,
            deadline: _deadline,
            yesPool: 0,
            noPool: 0,
            outcome: false,
            status: MarketStatus.Open,
            creator: msg.sender
        });

        emit MarketCreated(marketCount, _question, _category, _rules, _deadline, msg.sender);
        return marketCount;
    }

    function placeBet(uint256 _marketId, bool _side) external payable {
        Market storage market = _market(_marketId);
        require(market.status == MarketStatus.Open, "Market closed");
        require(block.timestamp < market.deadline, "Deadline passed");
        require(msg.value > 0, "Amount required");

        if (_side) {
            yesBets[_marketId][msg.sender] += msg.value;
            market.yesPool += msg.value;
        } else {
            noBets[_marketId][msg.sender] += msg.value;
            market.noPool += msg.value;
        }
        emit BetPlaced(_marketId, msg.sender, _side, msg.value);
    }

    /// If nobody backed the winning side there is no one to pay, so the market
    /// is cancelled instead and every bettor gets their stake back.
    function resolveMarket(uint256 _marketId, bool _outcome) external onlyOwner {
        Market storage market = _market(_marketId);
        require(market.status == MarketStatus.Open, "Not open");
        require(block.timestamp >= market.deadline, "Deadline not reached");

        uint256 winningPool = _outcome ? market.yesPool : market.noPool;
        uint256 losingPool = _outcome ? market.noPool : market.yesPool;
        if (winningPool == 0 && losingPool > 0) {
            market.status = MarketStatus.Cancelled;
            emit MarketCancelled(_marketId, "No bets on the winning side");
            return;
        }
        market.outcome = _outcome;
        market.status = MarketStatus.Resolved;
        emit MarketResolved(_marketId, _outcome);
    }

    /// Owner can void a market at any time while it is open (bad question, ambiguous outcome).
    function cancelMarket(uint256 _marketId, string calldata _reason) external onlyOwner {
        Market storage market = _market(_marketId);
        require(market.status == MarketStatus.Open, "Not open");
        market.status = MarketStatus.Cancelled;
        emit MarketCancelled(_marketId, _reason);
    }

    /// Escape hatch: if the owner never resolves, anyone can cancel after the window.
    function cancelStaleMarket(uint256 _marketId) external {
        Market storage market = _market(_marketId);
        require(market.status == MarketStatus.Open, "Not open");
        require(block.timestamp >= market.deadline + RESOLUTION_WINDOW, "Resolution window open");
        market.status = MarketStatus.Cancelled;
        emit MarketCancelled(_marketId, "Not resolved in time");
    }

    // ---- payouts ----

    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = _market(_marketId);
        require(market.status == MarketStatus.Resolved, "Not resolved");
        require(!claimed[_marketId][msg.sender], "Already claimed");

        uint256 userWinningBet = market.outcome ? yesBets[_marketId][msg.sender] : noBets[_marketId][msg.sender];
        require(userWinningBet > 0, "No winning bet");

        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome ? market.noPool : market.yesPool;
        uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = (userWinningBet * (winningPool + losingPool - fee)) / winningPool;

        claimed[_marketId][msg.sender] = true;
        accruedFees += (fee * userWinningBet) / winningPool;
        _send(payable(msg.sender), payout);
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    /// Cancelled market: every bettor takes back both sides of their stake, no fee.
    function refund(uint256 _marketId) external nonReentrant {
        Market storage market = _market(_marketId);
        require(market.status == MarketStatus.Cancelled, "Not cancelled");
        require(!claimed[_marketId][msg.sender], "Already refunded");

        uint256 amount = yesBets[_marketId][msg.sender] + noBets[_marketId][msg.sender];
        require(amount > 0, "Nothing to refund");

        claimed[_marketId][msg.sender] = true;
        _send(payable(msg.sender), amount);
        emit Refunded(_marketId, msg.sender, amount);
    }

    function withdrawFees(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount <= accruedFees, "Insufficient fees");
        accruedFees -= amount;
        _send(to, amount);
    }

    // ---- views ----

    function getOdds(uint256 _marketId) external view returns (uint256 yesOdds, uint256 noOdds) {
        Market storage market = markets[_marketId];
        uint256 total = market.yesPool + market.noPool;
        if (total == 0) return (50, 50);
        yesOdds = (market.yesPool * 100) / total;
        noOdds = 100 - yesOdds;
    }

    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return _market(_marketId);
    }

    function getPosition(uint256 _marketId, address user)
        external
        view
        returns (uint256 yesAmount, uint256 noAmount, bool hasClaimed)
    {
        return (yesBets[_marketId][user], noBets[_marketId][user], claimed[_marketId][user]);
    }

    function _market(uint256 _marketId) private view returns (Market storage market) {
        market = markets[_marketId];
        require(market.creator != address(0), "Market not found");
    }

    function _send(address payable to, uint256 amount) private {
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }
}
