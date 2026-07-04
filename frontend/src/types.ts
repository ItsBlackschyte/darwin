export interface Genome {
  gapThresholdBps: number;
  tradeSizeUsd: number;
  brainIntervalSec: number;
  gasPessimismMult: number;
  raceWinProb: number;
  maxTradePctOfBalance: number;
}

export interface Trade {
  ts: number;
  pair: string;
  gapBps: number;
  sizeUsd: number;
  outcome: "won" | "lost_race";
  pnlMon: number;
  txHash?: string;
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
  pair: string;
  priceA: number;
  priceB: number;
}

export type WsEvent =
  | { type: "vitals"; vitals: Vitals }
  | { type: "prices"; prices: PairPrices[] }
  | { type: "gap"; signal: { pair: string; gapBps: number } }
  | { type: "trade"; trade: Trade }
  | { type: "thought_started" }
  | { type: "thought"; monologue: string; patch: Partial<Genome>; burnTx?: string }
  | { type: "dying"; lastWords: string }
  | { type: "epitaph"; epitaph: Epitaph; txHash?: string }
  | { type: "born"; gen: number; inherited: string[]; genome: Genome }
  | { type: "lineage"; lineage: Epitaph[] };

export type Phase = "alive" | "dying" | "dead" | "rebirth";
