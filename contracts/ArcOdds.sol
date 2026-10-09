// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArcOdds {
    enum MarketStatus {
        Open,
        Resolved,
        Cancelled
    }

    struct Market {
        string question;
        string category;
        uint256 deadline;
        uint256 yesPool;
        uint256 noPool;
        bool outcome;
        MarketStatus status;
        address creator;
    }

    address public owner;
    uint256 public marketCount;
    uint256 public accruedFees;
    uint256 public constant FEE_BPS = 200;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    bool private locked;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    mapping(uint256 => mapping(address => uint256)) public noBets;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed marketId, string question, string category, uint256 deadline, address indexed creator);
    event BetPlaced(uint256 indexed marketId, address indexed user, bool side, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);

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
    }

    function createMarket(
        string calldata _question,
        string calldata _category,
        uint256 _deadline
    ) external onlyOwner returns (uint256) {
        require(bytes(_question).length > 0, "Question required");
        require(_deadline > block.timestamp, "Deadline must be future");

        marketCount += 1;
        markets[marketCount] = Market({
            question: _question,
            category: _category,
            deadline: _deadline,
            yesPool: 0,
            noPool: 0,
            outcome: false,
            status: MarketStatus.Open,
            creator: msg.sender
        });

        emit MarketCreated(marketCount, _question, _category, _deadline, msg.sender);
        return marketCount;
    }

    function placeBet(uint256 _marketId, bool _side) external payable {
        Market storage market = markets[_marketId];
        require(market.creator != address(0), "Market not found");
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

    function resolveMarket(uint256 _marketId, bool _outcome) external onlyOwner {
        Market storage market = markets[_marketId];
        require(market.creator != address(0), "Market not found");
        require(market.status == MarketStatus.Open, "Already resolved");
        require(block.timestamp >= market.deadline, "Deadline not reached");

        market.outcome = _outcome;
        market.status = MarketStatus.Resolved;

        emit MarketResolved(_marketId, _outcome);
    }

    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Resolved, "Not resolved");
        require(!claimed[_marketId][msg.sender], "Already claimed");

        uint256 userWinningBet = market.outcome ? yesBets[_marketId][msg.sender] : noBets[_marketId][msg.sender];
        require(userWinningBet > 0, "No winning bet");

        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome ? market.noPool : market.yesPool;
        uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributablePool = winningPool + losingPool - fee;
        uint256 payout = (userWinningBet * distributablePool) / winningPool;

        claimed[_marketId][msg.sender] = true;
        accruedFees += (fee * userWinningBet) / winningPool;
        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        require(sent, "Payout failed");

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    function getOdds(uint256 _marketId) external view returns (uint256 yesOdds, uint256 noOdds) {
        Market storage market = markets[_marketId];
        uint256 total = market.yesPool + market.noPool;
        if (total == 0) return (50, 50);
        yesOdds = (market.yesPool * 100) / total;
        noOdds = 100 - yesOdds;
    }

    function getMarket(uint256 _marketId)
        external
        view
        returns (
            string memory question,
            string memory category,
            uint256 deadline,
            uint256 yesPool,
            uint256 noPool,
            bool outcome,
            MarketStatus status,
            address creator
        )
    {
        Market storage market = markets[_marketId];
        require(market.creator != address(0), "Market not found");
        return (
            market.question,
            market.category,
            market.deadline,
            market.yesPool,
            market.noPool,
            market.outcome,
            market.status,
            market.creator
        );
    }

    function getPosition(uint256 _marketId, address user)
        external
        view
        returns (uint256 yesAmount, uint256 noAmount, bool hasClaimed)
    {
        return (yesBets[_marketId][user], noBets[_marketId][user], claimed[_marketId][user]);
    }

    function withdrawFees(uint256 amount, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount <= accruedFees, "Insufficient fees");
        accruedFees -= amount;
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Withdraw failed");
    }
}
