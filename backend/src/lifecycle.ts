import { chain } from "./chain.js";
import { inheritGenome, writeLastWords } from "./brain.js";
import { DEFAULT_GENOME, START_BALANCE_MON } from "./config.js";
import { Organism, round } from "./state.js";
import type { Epitaph } from "./types.js";

/** The death ritual: last words -> on-chain autopsy -> rebirth. */
export async function die(o: Organism, cause: string): Promise<void> {
  if (!o.alive) return;
  o.alive = false;

  const lessons = await writeLastWords(o, cause);
  o.emitEvent({
    type: "dying",
    lastWords: lessons[0] ?? "the evenings… watch the evenings.",
  });

  const v = o.vitals();
  const epitaph: Epitaph = {
    gen: o.gen,
    bornTs: o.bornTs,
    diedTs: Date.now(),
    lifespanMin: Math.round((Date.now() - o.bornTs) / 60000),
    finalPnlMon: v.pnlMon,
    trades: v.trades,
    winRateBps: v.winRateBps,
    causeOfDeath: cause,
    lessons,
    finalGenome: { ...o.genome },
  };

  const txHash = await chain.recordDeath(epitaph);
  o.tradeArchive[o.gen] = [...o.trades]; // preserve the full feed for cross-gen comparison
  o.lineage.push(epitaph);
  o.save();
  o.emitEvent({ type: "epitaph", epitaph, txHash });
  o.emitEvent({ type: "lineage", lineage: o.lineage });

  // let the flatline breathe on screen, then resurrect
  setTimeout(() => beBorn(o), 6000);
}

/** The birth ritual: read ancestry -> inherit -> live. */
export async function beBorn(o: Organism): Promise<void> {
  o.gen += 1;
  o.alive = true;
  o.balanceMon = START_BALANCE_MON;
  o.bornTs = Date.now();
  o.trades = [];
  o.thoughts = 0;
  o.thoughtLog = [];
  o.balanceHistory = [];
  o.pushBalance();
  o.inherited = o.lineage.flatMap((e) => e.lessons).slice(-9); // last 3 gens
  o.genome = inheritGenome(DEFAULT_GENOME, o.lineage);
  o.save();

  await chain.recordBirth(o.gen);
  o.emitEvent({
    type: "born",
    gen: o.gen,
    inherited: o.inherited,
    genome: o.genome,
  });
  o.emitEvent({ type: "vitals", vitals: o.vitals() });
  console.log(
    `GEN-${String(o.gen).padStart(2, "0")} born · balance ${round(
      o.balanceMon
    )} MON · inherited ${o.inherited.length} lessons`
  );
}
