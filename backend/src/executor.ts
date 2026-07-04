import { LOST_RACE_GAS_MON, MON_PER_USD } from "./config.js";
import type { GapSignal, Genome, PairPrices, Trade } from "./types.js";
import type { Organism } from "./state.js";

/** REFLEX: hardcoded, runs every tick, no LLM anywhere near it. */
export function checkGap(
  prices: PairPrices[],
  genome: Genome,
  balanceMon: number
): GapSignal | null {
  for (const p of prices) {
    const mid = (p.priceA + p.priceB) / 2;
    const gapBps = (Math.abs(p.priceA - p.priceB) / mid) * 10000;
    if (gapBps < genome.gapThresholdBps) continue;

    // risk cap: never bet more than N% of the body
    const capUsd = (balanceMon / MON_PER_USD) * (genome.maxTradePctOfBalance / 100);
    const sizeUsd = Math.min(genome.tradeSizeUsd, capUsd);
    if (sizeUsd < 10) continue; // too broke to hunt

    return {
      pair: p.pair,
      gapBps: Math.round(gapBps * 10) / 10,
      buyOn: p.priceA < p.priceB ? "A" : "B",
      sizeUsd: Math.round(sizeUsd),
    };
  }
  return null;
}

/**
 * PAPER EXECUTOR with the pessimism layer:
 *  - slippage grows with trade size (constant-product heuristic)
 *  - gas priced at a pessimistic multiple
 *  - a race dice decides if a faster bot ate the gap first;
 *    lost races still cost gas (the reverted-tx tax)
 */
export function paperExecute(sig: GapSignal, genome: Genome): Trade {
  const won = Math.random() < genome.raceWinProb;
  const ts = Date.now();

  if (!won) {
    return {
      ts,
      pair: sig.pair,
      gapBps: sig.gapBps,
      sizeUsd: sig.sizeUsd,
      outcome: "lost_race",
      pnlMon: -LOST_RACE_GAS_MON,
    };
  }

  const grossUsd = sig.sizeUsd * (sig.gapBps / 10000);
  // crude but honest: assume ~$1M effective pool depth per venue,
  // slippage eats proportionally to how much of it you consume
  const slippageUsd = sig.sizeUsd * (sig.sizeUsd / 1_000_000);
  const gasUsd = 0.5 * genome.gasPessimismMult; // two legs
  const netUsd = grossUsd - slippageUsd - gasUsd;

  return {
    ts,
    pair: sig.pair,
    gapBps: sig.gapBps,
    sizeUsd: sig.sizeUsd,
    outcome: "won",
    pnlMon: Math.round(netUsd * MON_PER_USD * 100) / 100,
  };
}

/** Death check helper. */
export function isStarved(o: Organism): boolean {
  return o.balanceMon <= 0;
}
