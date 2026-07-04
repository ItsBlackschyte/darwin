// The organism's vocabulary. Every state change becomes one of these
// events; the frontend is a pure renderer of this stream.

export interface Genome {
  gapThresholdBps: number;      // minimum gap to consider, 60 = 0.60%
  tradeSizeUsd: number;         // paper trade size
  brainIntervalSec: number;     // how often the brain wakes (and pays)
  gasPessimismMult: number;     // 1.5 = assume 50% worse gas than average
  raceWinProb: number;          // 0.15 — humility dial for lost races
  maxTradePctOfBalance: number; // risk cap, e.g. 5
}

export type TradeOutcome = "won" | "lost_race";

export interface Trade {
  ts: number;
  pair: string;
  gapBps: number;
  sizeUsd: number;
  outcome: TradeOutcome;
  pnlMon: number;   // negative on lost races (wasted gas)
  txHash?: string;  // Monad log tx (real or mock)
}

export interface Epitaph {
  gen: number;
  bornTs: number;
  diedTs: number;
  lifespanMin: number;
  finalPnlMon: number;
  trades: number;
  winRateBps: number;
  causeOfDeath: string;
  lessons: string[];
  finalGenome: Genome;
}

export interface Vitals {
  gen: number;
  alive: boolean;
  balanceMon: number;
  startBalanceMon: number;
  burnPerThoughtMon: number;
  uptimeSec: number;
  trades: number;
  wins: number;
  winRateBps: number;
  thoughts: number;
  pnlMon: number;
}

export interface PairPrices {
  pair: string;      // "WETH/USDC"
  priceA: number;    // venue A (e.g. Uniswap)
  priceB: number;    // venue B (e.g. Sushi)
}

export interface GapSignal {
  pair: string;
  gapBps: number;
  buyOn: "A" | "B";
  sizeUsd: number;
}

export type WsEvent =
  | { type: "vitals"; vitals: Vitals }
  | { type: "prices"; prices: PairPrices[] }
  | { type: "gap"; signal: GapSignal }
  | { type: "trade"; trade: Trade }
  | { type: "thought_started" }
  | { type: "thought"; monologue: string; patch: Partial<Genome>; burnTx?: string }
  | { type: "dying"; lastWords: string }
  | { type: "epitaph"; epitaph: Epitaph; txHash?: string }
  | { type: "born"; gen: number; inherited: string[]; genome: Genome }
  | { type: "lineage"; lineage: Epitaph[] };
