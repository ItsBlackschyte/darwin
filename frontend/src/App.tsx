import { useEffect, useRef, useState } from "react";
import Specimen from "./components/Specimen";
import { donate, kill, useSocket } from "./useSocket";
import type { Epitaph, Genome, Trade } from "./types";
import TargetCursor from "./components/TargetCursor";
import PanelGlow from "./components/PanelGlow";

const fmt = (n: number | undefined, d = 2) => (n ?? 0).toFixed(d);
const mins = (sec: number) => `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
const pad = (g: number) => String(g).padStart(2, "0");
const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

type ModalKind = null | "vitals" | "neural" | "metabolic" | "instincts" | "archive";

export default function App() {
  const v = useSocket();
  const vit = v.vitals;
  const [modal, setModal] = useState<ModalKind>(null);
  const health = vit ? Math.max(0, vit.balanceMon / vit.startBalanceMon) : 1;
  const gen = `GEN-${pad(vit?.gen ?? 1)}`;
  const gapBps = v.prices
    ? (Math.abs(v.prices.priceA - v.prices.priceB) /
        ((v.prices.priceA + v.prices.priceB) / 2)) *
      10000
    : 0;
  const threshold = v.genome?.gapThresholdBps ?? 60;

return (
    <div className="app">
      <TargetCursor scopeSelector=".box" targetSelector=".cursor-target" spinDuration={2.5} />
      <PanelGlow selector=".panel" spotlightRadius={280} glowColor="124, 227, 168" />
      {/* ============ HEADER ============ */}
      <div className="header">
        <div>
          <div className="brand">DARWIN</div>
          <div className="sub">
            <span className={`dot ${v.phase === "alive" ? "ok" : "bad"}`}>●</span> specimen{" "}
            {gen} · {v.phase} · uptime {mins(vit?.uptimeSec ?? 0)}
            {!v.connected && " · reconnecting…"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="big">{fmt(vit?.balanceMon)}</span>{" "}
          <span className="dim">MON</span>
          <div className="dim">
            win rate {((vit?.winRateBps ?? 0) / 100).toFixed(1)}% · P&L{" "}
            {(vit?.pnlMon ?? 0) >= 0 ? "+" : ""}
            {fmt(vit?.pnlMon)} MON
          </div>
        </div>
      </div>

      {/* ============ MAIN ROW: containment box + right rail ============ */}
      <div className="main">
        <div className="box">
          <Specimen
            phase={v.phase}
            health={health}
            thinking={v.thinking}
            winPulse={v.winPulse}
            lossPulse={v.lossPulse}
          />
          <div className="boxlabel">containment unit 01</div>
          <div className="boxbtn left">
            {/* <button className="labbtn kill" onClick={() => kill()} disabled={v.phase !== "alive"}> */}
            <button className="labbtn kill cursor-target" onClick={() => kill()} disabled={v.phase !== "alive"}>
              ⚠ terminate
            </button>
          </div>
          <div className="boxbtn right">
            {/* <button className="labbtn feed" onClick={() => donate()} disabled={v.phase !== "alive"}> */}
            <button className="labbtn feed cursor-target" onClick={() => donate()} disabled={v.phase !== "alive"}>
              ⚡ donate 0.25
            </button>
          </div>
          {v.phase === "dead" && v.epitaph && <EpitaphCard e={v.epitaph} />}
        </div>

        <div className="rail">
          <div className="panel">
            <PanelHead title="vitals" onExpand={() => setModal("vitals")} />
            <Ecg balance={vit?.balanceMon ?? null} max={vit?.startBalanceMon ?? 10} />
            <div className="dim">
              burn {fmt(vit?.burnPerThoughtMon, 1)} MON/thought · thoughts paid: {vit?.thoughts ?? 0}
            </div>
            {v.prices && (
              <>
                <div className="gapbar">
                  <div
                    className={`gapfill ${gapBps >= threshold ? "hot" : ""}`}
                    style={{ width: `${Math.min(100, (gapBps / (threshold * 1.5)) * 100)}%` }}
                  />
                  <div className="gapmark" />
                </div>
                <div className={`dim ${gapBps >= threshold ? "ok" : ""}`}>
                  {v.prices.pair} gap {gapBps.toFixed(0)}bps / floor {threshold}bps
                  {gapBps >= threshold ? " — PREY IN RANGE" : ""}
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <PanelHead
              title="neural log"
              extra={
                v.thinking ? (
                  <span className="think">▚ paying {fmt(vit?.burnPerThoughtMon, 1)} MON to think…</span>
                ) : undefined
              }
              onExpand={() => setModal("neural")}
            />
            <Typewriter text={v.monologue} />
          </div>

          <div className="panel grow">
            <PanelHead title="metabolic events" onExpand={() => setModal("metabolic")} />
            {v.feed.length === 0 && <div className="dim">waiting for the first meal…</div>}
            {v.feed.slice(0, 6).map((t) => (
              <TradeRow key={t.ts} t={t} />
            ))}
          </div>
        </div>
      </div>

      {/* ============ GENOME + INHERITANCE ============ */}
      <div className="panels">
        <GenomeCard genome={v.genome} />
        <div className="panel">
          <PanelHead
            title={`inherited instincts (${v.inherited.length})`}
            onExpand={() => setModal("instincts")}
          />
          {v.inherited.length === 0 && (
            <div className="dim">none — this line has no ancestors yet</div>
          )}
          {v.inherited.slice(-3).map((l, i) => (
            <div key={i} className="lesson">“{l}”</div>
          ))}
        </div>
      </div>

      {/* ============ SPECIMEN ARCHIVE ============ */}
      <div className="archive panel">
        <PanelHead title="specimen archive" onExpand={() => setModal("archive")} />
        <div className="tombs">
          {v.lineage.map((e) => (
            <div className="tomb" key={e.gen}>
              <div>
                ✝ GEN-{pad(e.gen)} · {e.lifespanMin}m · P&L {fmt(e.finalPnlMon)}
              </div>
              <LifeBar minutes={e.lifespanMin} lineage={v.lineage} />
              <div className="dim">{e.causeOfDeath}</div>
              <div className="dim">“{e.lessons[0]}”</div>
            </div>
          ))}
          <div className="tomb live">
            <div>
              ● {gen} · alive · {mins(vit?.uptimeSec ?? 0)}
            </div>
            <div className="dim">
              {v.inherited.length} lessons inherited — lifespan record attempt in progress
            </div>
          </div>
        </div>
      </div>

      {/* ============ MODALS ============ */}
      {modal === "vitals" && (
        <Modal title="Vitals — balance vs time" onClose={() => setModal(null)}>
          <HistoryGraph startBalance={vit?.startBalanceMon ?? 10} />
          <div className="dim" style={{ marginTop: 8 }}>
            burn {fmt(vit?.burnPerThoughtMon, 1)} MON/thought · thoughts paid {vit?.thoughts ?? 0} ·
            uptime {mins(vit?.uptimeSec ?? 0)}
          </div>
        </Modal>
      )}
      {modal === "neural" && (
        <Modal title="Neural log — all thoughts" onClose={() => setModal(null)}>
          <ThoughtList />
        </Modal>
      )}
      {modal === "metabolic" && (
        <Modal title="Metabolic events — full history" onClose={() => setModal(null)}>
          <MetabolicList />
        </Modal>
      )}
      {modal === "instincts" && (
        <Modal title={`Inherited instincts (${v.inherited.length})`} onClose={() => setModal(null)}>
          {v.inherited.length === 0 && <div className="dim">no ancestors yet — GEN-01 starts from nothing</div>}
          {v.inherited.map((l, i) => (
            <div key={i} className="lesson" style={{ marginBottom: 6 }}>
              {i + 1}. “{l}”
            </div>
          ))}
        </Modal>
      )}
      {modal === "archive" && (
        <Modal title="Specimen archive — full lineage" onClose={() => setModal(null)}>
          {v.lineage.length === 0 && <div className="dim">no deaths yet</div>}
          {v.lineage.map((e) => (
            <div key={e.gen} className="tomb" style={{ marginBottom: 10 }}>
              <div>
                ✝ GEN-{pad(e.gen)} · lived {e.lifespanMin}m · {e.trades} trades · win rate{" "}
                {(e.winRateBps / 100).toFixed(1)}% · P&L {fmt(e.finalPnlMon)} MON
              </div>
              <div className="dim">cause: {e.causeOfDeath}</div>
              {e.lessons.map((l, i) => (
                <div key={i} className="dim">
                  {i + 1}. {l}
                </div>
              ))}
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

/* ---------- shared bits ---------- */

function PanelHead({
  title,
  extra,
  onExpand,
}: {
  title: string;
  extra?: React.ReactNode;
  onExpand: () => void;
}) {
  return (
    <div className="phead">
      <span className="label">
        {title} {extra}
      </span>
      <button className="expand" onClick={onExpand} title="show full log" aria-label={`expand ${title}`}>
        ⤢
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="phead">
          <span className="label">{title}</span>
          <button className="expand" onClick={onClose} aria-label="close">✕</button>
        </div>
        <div className="modalbody">{children}</div>
      </div>
    </div>
  );
}

function TradeRow({ t }: { t: Trade }) {
  return (
    <div className={`mono ${t.pnlMon >= 0 ? "ok" : "bad"}`}>
      {t.pnlMon >= 0 ? "+" : "−"}
      {Math.abs(t.pnlMon).toFixed(2)} MON ·{" "}
      {t.pair === "DONATION"
        ? "donation"
        : t.outcome === "won"
        ? `absorbed (${t.gapBps}bps)`
        : "race lost"}
    </div>
  );
}

/** Full balance-vs-time graph — live, repolls every 3s while open. */
function HistoryGraph({ startBalance }: { startBalance: number }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<{ ts: number; bal: number }[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/api/history").then((r) => r.json()).then(setPts).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || pts.length === 0) return;
    cv.width = cv.clientWidth;
    cv.height = 220;
    const ctx = cv.getContext("2d")!;
    const W = cv.width, H = cv.height, padL = 40, padB = 22, padT = 10;
    ctx.clearRect(0, 0, W, H);
    const hi = Math.max(startBalance, ...pts.map((p) => p.bal)) * 1.08;
    const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts || t0 + 1;
    const X = (ts: number) => padL + ((ts - t0) / Math.max(1, t1 - t0)) * (W - padL - 8);
    const Y = (b: number) => padT + (1 - b / hi) * (H - padT - padB);

    ctx.strokeStyle = "rgba(124,227,168,.10)";
    ctx.fillStyle = "#5E7268";
    ctx.font = "10px 'IBM Plex Mono', monospace";
    for (const frac of [0, 0.5, 1]) {
      const val = hi * frac;
      const y = Y(val);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - 8, y); ctx.stroke();
      ctx.fillText(val.toFixed(1), 4, y + 3);
    }
    ctx.fillText(clock(t0), padL, H - 6);
    const endLabel = clock(t1);
    ctx.fillText(endLabel, W - 8 - endLabel.length * 6, H - 6);

    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.ts), Y(p.bal)) : ctx.moveTo(X(p.ts), Y(p.bal))));
    const last = pts[pts.length - 1].bal;
    ctx.strokeStyle = last < startBalance * 0.25 ? "#FF6B4A" : "#7CE3A8";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }, [pts, startBalance]);

  if (pts.length === 0) return <div className="dim">no history yet — the organism just woke up</div>;
  return <canvas ref={cvRef} style={{ width: "100%", height: 220 }} />;
}

/** All thoughts — live, repolls every 3s while open. */
function ThoughtList() {
  const [rows, setRows] = useState<{ ts: number; monologue: string }[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/thoughts").then((r) => r.json()).then(setRows).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);
  if (rows.length === 0) return <div className="dim">no thoughts yet</div>;
  return (
    <>
      {[...rows].reverse().map((r) => (
        <div key={r.ts} style={{ marginBottom: 8 }}>
          <span className="dim">{clock(r.ts)}</span>
          <div>{r.monologue}</div>
        </div>
      ))}
    </>
  );
}

/** All metabolic events + colored total — with generation tabs for comparison. */
function MetabolicList() {
  const [rows, setRows] = useState<Trade[]>([]);
  const [gens, setGens] = useState<{ current: number; archived: number[] }>({ current: 1, archived: [] });
  const [sel, setSel] = useState<number | null>(null); // null = follow the living gen

  useEffect(() => {
    const load = () =>
      fetch("/api/gens").then((r) => r.json()).then(setGens).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const g = sel ?? gens.current;
    const load = () =>
      fetch(`/api/trades?limit=1000&gen=${g}`).then((r) => r.json()).then(setRows).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [sel, gens.current]);

  const total = rows.reduce((s, t) => s + t.pnlMon, 0);
  const cls = total > 0 ? "ok" : total < 0 ? "bad" : "dim";
  const allGens = [...gens.archived, gens.current].sort((a, b) => a - b);
  const active = sel ?? gens.current;

  return (
    <>
      <div className="gentabs">
        {allGens.map((g) => (
          <button
            key={g}
            className={`gtab ${g === active ? "on" : ""}`}
            onClick={() => setSel(g === gens.current ? null : g)}
          >
            GEN-{String(g).padStart(2, "0")}
            {g === gens.current ? " ●" : ""}
          </button>
        ))}
      </div>
      {rows.length === 0 && <div className="dim">no metabolic events recorded for this generation</div>}
      {[...rows].reverse().map((t) => (
        <div key={t.ts} style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="dim">{clock(t.ts)}</span>
          <TradeRow t={t} />
        </div>
      ))}
      <div className="totalrow">
        <span className="dim">total earnings — GEN-{String(active).padStart(2, "0")}</span>
        <span className={cls}>
          {total > 0 ? "+" : ""}
          {total.toFixed(2)} MON
        </span>
      </div>
    </>
  );
}

/** Hospital-monitor balance sparkline (panel-sized, live). */
function Ecg({ balance, max }: { balance: number | null; max: number }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>([]);

  useEffect(() => {
    if (balance === null) return;
    hist.current.push(balance);
    if (hist.current.length > 120) hist.current.shift();
    const cv = cvRef.current;
    if (!cv) return;
    if (cv.width !== cv.clientWidth) cv.width = cv.clientWidth;
    cv.height = 34;
    const ctx = cv.getContext("2d")!;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const h = hist.current;
    const hi = Math.max(max, ...h) * 1.05;
    ctx.beginPath();
    h.forEach((b, i) => {
      const x = (i / Math.max(1, h.length - 1)) * W;
      const y = H - (b / hi) * (H - 4) - 2;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    const last = h[h.length - 1] ?? 0;
    ctx.strokeStyle = last < max * 0.25 ? "#FF6B4A" : "#7CE3A8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [balance, max]);

  return <canvas ref={cvRef} className="ecg" />;
}

function GenomeCard({ genome }: { genome: Genome | null }) {
  const prev = useRef<Genome | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (genome && prev.current) {
      const diff = new Set<string>();
      (Object.keys(genome) as (keyof Genome)[]).forEach((k) => {
        if (prev.current![k] !== genome[k]) diff.add(k);
      });
      if (diff.size) {
        setChanged(diff);
        const id = setTimeout(() => setChanged(new Set()), 4000);
        return () => clearTimeout(id);
      }
    }
    prev.current = genome;
  }, [genome]);

  if (!genome) return <div className="panel dim">genome loading…</div>;
  const rows: [string, string][] = [
    ["gap floor", `${genome.gapThresholdBps} bps`],
    ["trade size", `$${genome.tradeSizeUsd}`],
    ["think every", `${genome.brainIntervalSec}s`],
    ["gas pessimism", `×${genome.gasPessimismMult}`],
    ["risk cap", `${genome.maxTradePctOfBalance}% of body`],
  ];
  const keys = ["gapThresholdBps", "tradeSizeUsd", "brainIntervalSec", "gasPessimismMult", "maxTradePctOfBalance"];
  return (
    <div className="panel">
      <div className="label">genome — the brain edits this</div>
      {rows.map(([k, val], i) => (
        <div key={k} className={`gene ${changed.has(keys[i]) ? "mut" : ""}`}>
          <span className="dim">{k}</span>
          <span>{val}</span>
        </div>
      ))}
    </div>
  );
}

function LifeBar({ minutes, lineage }: { minutes: number; lineage: Epitaph[] }) {
  const maxLife = Math.max(1, ...lineage.map((e) => e.lifespanMin));
  return (
    <div className="lifebar">
      <div className="lifefill" style={{ width: `${(minutes / maxLife) * 100}%` }} />
    </div>
  );
}

function Typewriter({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text]);
  return (
    <div className="mono-line">
      {shown}
      <span className="cursor">▌</span>
    </div>
  );
}

function EpitaphCard({ e }: { e: Epitaph }) {
  return (
    <div className="epitaph">
      <div className="bad">
        ✝ SPECIMEN GEN-{pad(e.gen)} LOST · lived {e.lifespanMin}m · P&L {fmt(e.finalPnlMon)} MON
      </div>
      <div className="dim">cause: {e.causeOfDeath}</div>
      <div className="dim">
        lessons for the successor:
        {e.lessons.map((l, i) => (
          <div key={i}>
            {i + 1}. {l}
          </div>
        ))}
      </div>
      <div className="ok">✓ autopsy written to Monad — permanent, unfalsifiable</div>
    </div>
  );
}