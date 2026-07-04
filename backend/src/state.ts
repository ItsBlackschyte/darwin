import { EventEmitter } from "node:events";
import fs from "node:fs";
import {
  DEFAULT_GENOME,
  START_BALANCE_MON,
  BURN_PER_THOUGHT_MON,
} from "./config.js";
import type { Epitaph, Genome, Trade, Vitals, WsEvent } from "./types.js";

const DATA_FILE = "darwin-data.json";

/** Single source of truth. Every mutation emits a WsEvent on the bus. */
export class Organism extends EventEmitter {
  gen = 1;
  alive = true;
  balanceMon = START_BALANCE_MON;
  bornTs = Date.now();
  trades: Trade[] = [];
  thoughts = 0;
  genome: Genome = { ...DEFAULT_GENOME };
  lineage: Epitaph[] = [];
  inherited: string[] = [];
  thoughtLog: { ts: number; monologue: string }[] = [];
  balanceHistory: { ts: number; bal: number }[] = [];

  emitEvent(e: WsEvent) {
    this.emit("event", e);
  }

  vitals(): Vitals {
    const wins = this.trades.filter((t) => t.outcome === "won").length;
    const total = this.trades.length;
    return {
      gen: this.gen,
      alive: this.alive,
      balanceMon: round(this.balanceMon),
      startBalanceMon: START_BALANCE_MON,
      burnPerThoughtMon: BURN_PER_THOUGHT_MON,
      uptimeSec: Math.floor((Date.now() - this.bornTs) / 1000),
      trades: total,
      wins,
      winRateBps: total ? Math.round((wins / total) * 10000) : 0,
      thoughts: this.thoughts,
      pnlMon: round(this.balanceMon - START_BALANCE_MON),
    };
  }

  applyTrade(t: Trade) {
    this.trades.push(t);
    this.balanceMon += t.pnlMon;
    this.pushBalance();
    this.emitEvent({ type: "trade", trade: t });
    this.emitEvent({ type: "vitals", vitals: this.vitals() });
  }

  applyBurn() {
    this.thoughts += 1;
    this.balanceMon -= BURN_PER_THOUGHT_MON;
    this.pushBalance();
    this.emitEvent({ type: "vitals", vitals: this.vitals() });
  }

  applyPatch(patch: Partial<Genome>) {
    this.genome = { ...this.genome, ...patch };
  }

  recordThought(monologue: string) {
    this.thoughtLog.push({ ts: Date.now(), monologue });
    if (this.thoughtLog.length > 500) this.thoughtLog.shift();
  }

  pushBalance() {
    this.balanceHistory.push({ ts: Date.now(), bal: round(this.balanceMon) });
    if (this.balanceHistory.length > 2000) this.balanceHistory.shift();
  }

  save() {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        { gen: this.gen, lineage: this.lineage, genome: this.genome },
        null,
        2
      )
    );
  }

  load() {
    if (!fs.existsSync(DATA_FILE)) return;
    try {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      this.gen = (d.gen ?? 0) + 1; // restart = a new generation
      this.lineage = d.lineage ?? [];
      if (d.genome) this.genome = { ...DEFAULT_GENOME, ...d.genome };
    } catch {
      /* corrupted state file — start fresh, the chain has the real record */
    }
  }
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}