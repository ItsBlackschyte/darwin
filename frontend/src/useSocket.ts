import { useEffect, useRef, useState } from "react";
import type { Epitaph, Genome, PairPrices, Phase, Trade, Vitals, WsEvent } from "./types";

export interface OrganismView {
  vitals: Vitals | null;
  prices: PairPrices | null;
  feed: Trade[];
  monologue: string;
  thinking: boolean;
  phase: Phase;
  epitaph: Epitaph | null;
  lineage: Epitaph[];
  inherited: string[];
  genome: Genome | null;
  winPulse: number;   // counters: increment = one animation trigger
  lossPulse: number;
  connected: boolean;
}

export function useSocket(): OrganismView {
  const [view, setView] = useState<OrganismView>({
    vitals: null,
    prices: null,
    feed: [],
    monologue: "…booting sensors…",
    thinking: false,
    phase: "alive",
    epitaph: null,
    lineage: [],
    inherited: [],
    genome: null,
    winPulse: 0,
    lossPulse: 0,
    connected: false,
  });
  const rebirthTimer = useRef<number | null>(null);

  // initial genome + inherited lessons snapshot
  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) =>
        setView((v) => ({ ...v, genome: s.genome ?? null, inherited: s.inherited ?? [] }))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setView((v) => ({ ...v, connected: true }));
      ws.onclose = () => {
        setView((v) => ({ ...v, connected: false }));
        if (!closed) setTimeout(connect, 1500);
      };
      ws.onmessage = (msg) => {
        const e: WsEvent = JSON.parse(msg.data);
        setView((v) => {
          switch (e.type) {
            case "vitals":
              return { ...v, vitals: e.vitals };
            case "prices":
              return { ...v, prices: e.prices[0] ?? null };
            case "trade": {
              const feed = [e.trade, ...v.feed].slice(0, 8);
              return e.trade.outcome === "won"
                ? { ...v, feed, winPulse: v.winPulse + 1 }
                : { ...v, feed, lossPulse: v.lossPulse + 1 };
            }
            case "thought_started":
              return { ...v, thinking: true };
            case "thought":
              return {
                ...v,
                thinking: false,
                monologue: e.monologue,
                genome: v.genome ? { ...v.genome, ...e.patch } : v.genome,
              };
            case "dying":
              return { ...v, phase: "dying", thinking: false, monologue: e.lastWords };
            case "epitaph":
              return { ...v, phase: "dead", epitaph: e.epitaph };
            case "born": {
              if (rebirthTimer.current) window.clearTimeout(rebirthTimer.current);
              rebirthTimer.current = window.setTimeout(
                () => setView((x) => ({ ...x, phase: "alive" })),
                2400
              );
              return {
                ...v,
                phase: "rebirth",
                epitaph: null,
                feed: [],
                inherited: e.inherited,
                genome: e.genome,
                monologue: `GEN-${String(e.gen).padStart(2, "0")} online. ${e.inherited.length} lessons inherited from the archive.`,
              };
            }
            case "lineage":
              return { ...v, lineage: e.lineage };
            default:
              return v;
          }
        });
      };
    };
    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, []);

  return view;
}

export const kill = () => fetch("/api/demo/kill", { method: "POST" });
export const donate = () => fetch("/api/demo/donate", { method: "POST" });