import "dotenv/config";
import type { Genome } from "./types.js";

export const PORT = Number(process.env.PORT ?? 3000);

// Each subsystem goes real only when its keys exist. No keys = full mock,
// which must always work — it's the demo fallback.
export const REAL_BRAIN = Boolean(process.env.OPENAI_API_KEY);
export const REAL_PRICES = Boolean(
  process.env.MAINNET_RPC && process.env.PAIR_A && process.env.PAIR_B
);
export const REAL_CHAIN = Boolean(
  process.env.MONAD_RPC && process.env.PRIVATE_KEY && process.env.ANCESTRY_ADDRESS
);

export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  MAINNET_RPC: process.env.MAINNET_RPC ?? "",
  PAIR_A: (process.env.PAIR_A ?? "") as `0x${string}`,
  PAIR_B: (process.env.PAIR_B ?? "") as `0x${string}`,
  MONAD_RPC: process.env.MONAD_RPC ?? "",
  MONAD_CHAIN_ID: Number(process.env.MONAD_CHAIN_ID ?? 10143),
  PRIVATE_KEY: (process.env.PRIVATE_KEY ?? "") as `0x${string}`,
  ANCESTRY_ADDRESS: (process.env.ANCESTRY_ADDRESS ?? "") as `0x${string}`,
};

// ---- economy tuning (the knobs that decide how dramatic the demo is) ----
export const START_BALANCE_MON = 10;
export const BURN_PER_THOUGHT_MON = 0.5;   // each brain wake-up costs this
export const LOST_RACE_GAS_MON = 0.04;     // reverted-tx cost on lost races
export const MON_PER_USD = 0.02;           // paper conversion for P&L display
export const FAST_LOOP_MS = 1500;
export const PAIR_NAME = "WETH/USDC";

export const DEFAULT_GENOME: Genome = {
  gapThresholdBps: 60,
  tradeSizeUsd: 500,
  brainIntervalSec: 60,
  gasPessimismMult: 1.5,
  raceWinProb: 0.15,
  maxTradePctOfBalance: 5,
};

export function summary(): string {
  return [
    `prices: ${REAL_PRICES ? "REAL mainnet" : "mock random-walk"}`,
    `brain:  ${REAL_BRAIN ? "REAL OpenAI" : "mock canned reasoning"}`,
    `chain:  ${REAL_CHAIN ? "REAL Monad testnet" : "mock tx hashes"}`,
  ].join("\n  ");
}
