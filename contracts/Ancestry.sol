// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Ancestry — the permanent record of DARWIN's generations.
/// Deploy once via Remix to Monad testnet. The organism's backend wallet
/// calls logTrade / recordDeath / recordBirth. Anyone can read the lineage.
contract Ancestry {
    struct Generation {
        uint16 gen;
        uint64 bornAt;
        uint64 diedAt;        // 0 while alive
        int256 finalPnlMilli; // P&L in milli-MON (1000 = 1 MON)
        uint32 trades;
        uint16 winRateBps;    // 1420 = 14.20%
        string finalGenome;   // JSON of the genome at death
        string causeOfDeath;
        string lessons;       // newline-separated lessons for the successor
    }

    struct TradeLog {
        uint16 gen;
        uint64 ts;
        bytes32 detailsHash;  // keccak256 of the trade JSON (kept off-chain)
        int256 pnlMilli;
        bool won;
    }

    address public organism; // the wallet allowed to write
    Generation[] public generations;
    TradeLog[] public trades;

    event Born(uint16 indexed gen, uint64 ts);
    event Died(uint16 indexed gen, uint64 ts, string causeOfDeath);
    event Traded(uint16 indexed gen, bytes32 detailsHash, int256 pnlMilli, bool won);
    event Burned(uint16 indexed gen, uint256 amount); // metabolism payments

    modifier onlyOrganism() {
        require(msg.sender == organism, "not the organism");
        _;
    }

    constructor() {
        organism = msg.sender;
    }

    /// Allow rotating to a fresh wallet on rebirth (called by the old wallet
    /// during its death ritual, or by the current one any time).
    function setOrganism(address next) external onlyOrganism {
        organism = next;
    }

    function recordBirth(uint16 gen) external onlyOrganism {
        generations.push(
            Generation(gen, uint64(block.timestamp), 0, 0, 0, 0, "", "", "")
        );
        emit Born(gen, uint64(block.timestamp));
    }

    function logTrade(bytes32 detailsHash, int256 pnlMilli, bool won) external onlyOrganism {
        uint16 gen = currentGen();
        trades.push(TradeLog(gen, uint64(block.timestamp), detailsHash, pnlMilli, won));
        emit Traded(gen, detailsHash, pnlMilli, won);
    }

    /// The metabolism: every LLM "thought" sends its cost here.
    /// Value accumulates in the contract as the graveyard's endowment.
    function burn() external payable onlyOrganism {
        emit Burned(currentGen(), msg.value);
    }

    function recordDeath(
        int256 finalPnlMilli,
        uint32 tradeCount,
        uint16 winRateBps,
        string calldata finalGenome,
        string calldata causeOfDeath,
        string calldata lessons
    ) external onlyOrganism {
        Generation storage g = generations[generations.length - 1];
        require(g.diedAt == 0, "already dead");
        g.diedAt = uint64(block.timestamp);
        g.finalPnlMilli = finalPnlMilli;
        g.trades = tradeCount;
        g.winRateBps = winRateBps;
        g.finalGenome = finalGenome;
        g.causeOfDeath = causeOfDeath;
        g.lessons = lessons;
        emit Died(g.gen, g.diedAt, causeOfDeath);
    }

    function currentGen() public view returns (uint16) {
        if (generations.length == 0) return 0;
        return generations[generations.length - 1].gen;
    }

    function generationCount() external view returns (uint256) {
        return generations.length;
    }

    function tradeCount() external view returns (uint256) {
        return trades.length;
    }

    /// Full ancestry in one call — what a newborn reads at birth.
    function readAncestry() external view returns (Generation[] memory) {
        return generations;
    }
}
