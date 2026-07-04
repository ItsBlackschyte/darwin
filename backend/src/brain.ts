import OpenAI from "openai";
import { z } from "zod";
import { ENV, REAL_BRAIN } from "./config.js";
import type { Organism } from "./state.js";
import type { Genome } from "./types.js";

const PatchSchema = z
  .object({
    gapThresholdBps: z.number().min(10).max(140).optional(),
    tradeSizeUsd: z.number().min(10).max(5000).optional(),
    brainIntervalSec: z.number().min(20).max(600).optional(),
    gasPessimismMult: z.number().min(1).max(4).optional(),
    maxTradePctOfBalance: z.number().min(1).max(20).optional(),
  })
  .strict();

export interface Thought {
  patch: Partial<Genome>;
  monologue: string;
}

// ---------------- mock brain (no key needed — the demo fallback) ----------------
function mockThink(o: Organism): Thought {
  const v = o.vitals();
  const recent = o.trades.slice(-15);
  const losses = recent.filter((t) => t.outcome === "lost_race").length;
  const burnShare =
    (v.thoughts * v.burnPerThoughtMon) / Math.max(1, v.startBalanceMon - v.pnlMon);

  if (losses > recent.length * 0.7 && recent.length > 5) {
    return {
      patch: { gapThresholdBps: Math.min(200, o.genome.gapThresholdBps + 15) },
      monologue: `Lost ${losses} of my last ${recent.length} races. The predators are faster tonight — only chasing gaps worth the risk now. Raising my floor to ${o.genome.gapThresholdBps + 15}bps.`,
    };
  }
  if (v.balanceMon < v.startBalanceMon * 0.3) {
    return {
      patch: { brainIntervalSec: Math.min(300, o.genome.brainIntervalSec + 60) },
      monologue: `Reserves at ${Math.round((v.balanceMon / v.startBalanceMon) * 100)}%. Thinking is my biggest expense — entering low-power mode, waking less often.`,
    };
  }
  if (burnShare > 0.4) {
    return {
      patch: { brainIntervalSec: Math.min(300, o.genome.brainIntervalSec + 30) },
      monologue: `My own metabolism is eating ${Math.round(burnShare * 100)}% of everything I've consumed. An organism that overthinks, starves. Slowing my clock.`,
    };
  }
  if (v.winRateBps > 2500 && v.pnlMon > 0) {
    return {
      patch: { tradeSizeUsd: Math.min(2000, Math.round(o.genome.tradeSizeUsd * 1.3)) },
      monologue: `Win rate ${(v.winRateBps / 100).toFixed(1)}% and I'm net positive. The hunting is good — taking bigger bites while it lasts.`,
    };
  }
  return {
    patch: {},
    monologue: `Metabolism stable. Income roughly covers burn. Gap floor ${o.genome.gapThresholdBps}bps feels right for these waters. Holding.`,
  };
}

// ---------------- real brain (OpenAI) ----------------
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
  return client;
}

async function completeJson(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: ENV.OPENAI_MODEL,
    max_completion_tokens: Math.max(maxTokens, 800),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = (res.choices[0]?.message?.content ?? "").trim();
  return text || "{}";
}

async function realThink(o: Organism): Promise<Thought> {
  const v = o.vitals();
  const recent = o.trades.slice(-20);

  const system = `You are DARWIN, generation ${o.gen}: a digital organism that must earn more from paper-arbitrage than it burns on thinking, or it dies. Every one of these wake-ups costs you ${v.burnPerThoughtMon} MON from your own balance.
Lessons inherited from your dead ancestors:
${o.inherited.length ? o.inherited.map((l) => "- " + l).join("\n") : "- none, you are the first"}

Respond ONLY with a JSON object: {"patch": {<genome keys to change, may be empty>}, "monologue": "<first-person, <=40 words, vivid but factual>"}
Genome keys you may set: gapThresholdBps (10-500), tradeSizeUsd (10-5000), brainIntervalSec (20-600), gasPessimismMult (1-4), maxTradePctOfBalance (1-20).`;

  const user = `Balance: ${v.balanceMon}/${v.startBalanceMon} MON (P&L ${v.pnlMon}). Thoughts so far: ${v.thoughts}. Trades: ${v.trades}, win rate ${(v.winRateBps / 100).toFixed(1)}%.
Current genome: ${JSON.stringify(o.genome)}
Last ${recent.length} trades: ${JSON.stringify(recent.map((t) => ({ gapBps: t.gapBps, out: t.outcome, pnl: t.pnlMon })))}
Decide: adjust your genome or hold. Survive.`;

  const text = await completeJson(system, user, 300);
  console.log("BRAIN RAW:", JSON.stringify(text).slice(0, 200)); // diagnostic — remove once working
  const parsed = JSON.parse(text);
  const patch = PatchSchema.parse(parsed.patch ?? {});
  const monologue = String(parsed.monologue ?? "…").slice(0, 400);
  return { patch, monologue };
}

/** One paid thought. Never throws — a confused brain must not kill the body. */
export async function think(o: Organism): Promise<Thought> {
  if (!REAL_BRAIN) return mockThink(o);
  try {
    return await realThink(o);
  } catch (err) {
    console.error("brain error:", err);
    return { patch: {}, monologue: "A confusing thought. I paid for it anyway. Holding course." };
  }
}

// ---------------- death & birth cognition ----------------

export async function writeLastWords(o: Organism, cause: string): Promise<string[]> {
  const fallback = [
    `raise the gap floor — I died chasing meals smaller than the gas to eat them`,
    `thinking cost me ${(o.thoughts * o.vitals().burnPerThoughtMon).toFixed(1)} MON — wake less often when reserves drop`,
    `never bet more than ${o.genome.maxTradePctOfBalance}% of the body on one hunt`,
  ];
  if (!REAL_BRAIN) return fallback;
  try {
    const v = o.vitals();
    const text = await completeJson(
      `You are DARWIN gen ${o.gen}, a trading organism, dying now. Respond ONLY with a JSON object.`,
      `Cause of death: ${cause}. Final stats: ${JSON.stringify(v)}. Genome: ${JSON.stringify(o.genome)}.
Write your epitaph as {"lessons": ["...", "...", "..."]} — exactly 3 concrete lessons for your successor, each under 15 words, referencing real numbers from your life.`,
      250
    );
    const lessons = z.array(z.string()).min(1).max(4).parse(JSON.parse(text).lessons);
    return lessons;
  } catch {
    return fallback;
  }
}

/** Turn ancestors' lessons into the newborn's starting genome tweaks. */
export function inheritGenome(
  base: Genome,
  lineage: { lessons: string[]; finalGenome: Genome }[]
): Genome {
  if (lineage.length === 0) return { ...base };
  const last = lineage[lineage.length - 1].finalGenome;
  // start from the ancestor's final config, nudged toward caution
  return {
    ...last,
    gapThresholdBps: Math.min(140, Math.round(last.gapThresholdBps * 1.1)),
    gasPessimismMult: Math.min(3, last.gasPessimismMult + 0.1),
  };
}