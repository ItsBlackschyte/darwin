import { think } from "./brain.js";
import { chain } from "./chain.js";
import { FAST_LOOP_MS, summary } from "./config.js";
import { checkGap, isStarved, paperExecute } from "./executor.js";
import { die } from "./lifecycle.js";
import { getPrices } from "./prices.js";
import { startServer } from "./server.js";
import { Organism } from "./state.js";

const o = new Organism();
o.load();
o.pushBalance();
startServer(o);
console.log(`DARWIN GEN-${o.gen} waking up\n  ${summary()}`);

// ---------------- FAST LOOP: the reflexes (no LLM) ----------------
let ticking = false;
setInterval(async () => {
  if (!o.alive || ticking) return;
  ticking = true;
  try {
    const prices = await getPrices();
    o.emitEvent({ type: "prices", prices });

    const signal = checkGap(prices, o.genome, o.balanceMon);
    if (signal) {
      o.emitEvent({ type: "gap", signal });
      const trade = paperExecute(signal, o.genome);
      trade.txHash = await chain.logTrade(trade);
      o.applyTrade(trade);
      if (isStarved(o)) await die(o, "energy depleted — burn outpaced income");
    }
  } catch (err) {
    console.error("fast loop:", err);
  } finally {
    ticking = false;
  }
}, FAST_LOOP_MS);

// ---------------- SLOW LOOP: the brain (paid thoughts) ----------------
async function brainCycle() {
  if (o.alive) {
    try {
      o.emitEvent({ type: "thought_started" });
      const burnTx = await chain.payBurn();
      o.applyBurn(); // thinking costs money BEFORE the thought lands

      if (isStarved(o)) {
        await die(o, "starved mid-thought — the last idea was too expensive");
      } else {
        const { patch, monologue } = await think(o);
        o.applyPatch(patch);
        o.recordThought(monologue);
        o.emitEvent({ type: "thought", monologue, patch, burnTx });
        console.log(`GEN-${o.gen} thought: ${monologue}`);
      }
    } catch (err) {
      console.error("slow loop:", err);
    }
  }
  setTimeout(brainCycle, o.genome.brainIntervalSec * 1000);
}
setTimeout(brainCycle, 8000); // first thought shortly after boot
