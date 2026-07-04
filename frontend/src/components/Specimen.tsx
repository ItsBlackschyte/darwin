import { useEffect, useRef } from "react";
import type { Phase } from "../types";

interface Props {
  phase: Phase;
  health: number;   // 0..1 — drives size, color, and trembling
  thinking: boolean;
  winPulse: number;
  lossPulse: number;
}

interface Particle {
  kind: "food" | "frag";
  x: number; y: number;
  vx?: number; vy?: number;
  tx?: number; ty?: number;
  life: number;
  col: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: number[], c2: number[], t: number) =>
  `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;

/** The organism's body. Pure renderer: phase + pulses in, pixels out. */
export default function Specimen({ phase, health, thinking, winPulse, lossPulse }: Props) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, health, thinking, flash: 0, kick: 0, phaseT: 0 });
  const partsRef = useRef<Particle[]>([]);
  const prevWin = useRef(winPulse);
  const prevLoss = useRef(lossPulse);
  const prevPhase = useRef(phase);

  // react world -> animation world
  useEffect(() => {
    const s = stateRef.current;
    if (winPulse !== prevWin.current) {
      prevWin.current = winPulse;
      s.flash = 14; s.kick = 0.06;
      const cv = cvRef.current;
      if (cv)
        for (let i = 0; i < 10; i++)
          partsRef.current.push({
            kind: "food",
            x: Math.random() < 0.5 ? -10 : cv.width + 10,
            y: Math.random() * cv.height,
            tx: cv.width * 0.5, ty: cv.height * 0.5,
            life: 70, col: "110,255,170",
          });
    }
    if (lossPulse !== prevLoss.current) {
      prevLoss.current = lossPulse;
      s.flash = -14;
    }
    if (phase !== prevPhase.current) {
      prevPhase.current = phase;
      s.phase = phase;
      s.phaseT = performance.now();
      if (phase === "dead" && cvRef.current) {
        const cv = cvRef.current;
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * 6.283, v = 0.6 + Math.random() * 1.8;
          partsRef.current.push({
            kind: "frag",
            x: cv.width * 0.5 + Math.cos(a) * 60,
            y: cv.height * 0.5 + Math.sin(a) * 60,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 160, col: Math.random() < 0.5 ? "207,228,255" : "176,104,126",
          });
        }
      }
    }
    s.health = health;
    s.thinking = thinking;
  }, [phase, health, thinking, winPulse, lossPulse]);

  useEffect(() => {
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    const R = Math.random;
    const amb = Array.from({ length: 14 }, () => ({
      fx: R(), fy: R(), r: 6 + R() * 26, a: 0.05 + R() * 0.16,
      dx: (R() - 0.5) * 0.08, dy: (R() - 0.5) * 0.08,
    }));
    const dots = Array.from({ length: 80 }, () => ({
      an: R() * 6.283, rd: Math.pow(R(), 0.6), sz: 1.5 + R() * 4.5,
    }));
    let raf = 0;

    const cell = (t: number, W: number, H: number, scale: number, alpha: number, wob: number) => {
      const s = stateRef.current;
      const h = Math.max(0, Math.min(1, s.health));
      // starvation tremble: below 25% health the whole body jitters
      const jit = h < 0.25 && s.phase === "alive" ? (0.25 - h) * 22 : 0;
      const cx = W * 0.5 + (R() - 0.5) * jit;
      const cy = H * 0.5 + (R() - 0.5) * jit;
      const healthR = 0.6 + 0.4 * h; // body shrinks as it starves
      const Ra = Math.max(50, Math.min(H * 0.3, 125)) * scale * healthR;
      const pulse = 1 + 0.028 * Math.sin(t * (s.thinking ? 0.006 : 0.0035)) + s.kick;
      s.kick *= 0.94;
      ctx.globalAlpha = alpha;

      let g = ctx.createRadialGradient(cx, cy, Ra * pulse, cx, cy, Ra * pulse * 1.75);
      g.addColorStop(0, `rgba(150,200,255,${0.1 + 0.12 * h})`);
      g.addColorStop(1, "rgba(150,200,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, Ra * pulse * 1.75, 0, 7); ctx.fill();

      ctx.beginPath();
      for (let i = 0; i <= 44; i++) {
        const a = (i / 44) * 6.283;
        const w = (3.5 * Math.sin(a * 5 + t * 0.0016) + 2.5 * Math.sin(a * 3 - t * 0.0011)) * wob;
        const r = (Ra + w) * pulse;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      g = ctx.createRadialGradient(cx, cy, Ra * pulse * 0.5, cx, cy, Ra * pulse);
      g.addColorStop(0, "rgba(200,225,255,.06)");
      g.addColorStop(0.72, "rgba(195,220,250,.18)");
      g.addColorStop(0.94, `rgba(235,248,255,${0.4 + 0.4 * h})`);
      g.addColorStop(1, "rgba(190,220,255,.3)");
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(225,242,255,${0.4 + 0.5 * h})`;
      ctx.lineWidth = 1.6; ctx.stroke();

      // nucleus desaturates from healthy mauve toward sickly gray as health drops
      const nHi = mix([120, 60, 80], [200, 140, 160], h);   // dark stop
      const nMid = mix([110, 100, 105], [160, 93, 119], h); // mid stop
      const nx = cx - Ra * 0.06, ny = cy - Ra * 0.08, nr = Ra * 0.55 * pulse;
      ctx.save();
      ctx.beginPath(); ctx.arc(nx, ny, nr, 0, 7); ctx.clip();
      g = ctx.createRadialGradient(nx - nr * 0.3, ny - nr * 0.35, nr * 0.15, nx, ny, nr);
      g.addColorStop(0, mix([150, 140, 145], [200, 140, 160], h));
      g.addColorStop(0.6, nMid);
      g.addColorStop(1, nHi);
      ctx.fillStyle = g; ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      ctx.fillStyle = s.flash > 0 ? "rgba(120,255,180,.28)" : "rgba(90,40,60,.5)";
      for (const d of dots) {
        const a = d.an + t * 0.00035;
        ctx.beginPath();
        ctx.arc(nx + Math.cos(a) * d.rd * nr * 0.85, ny + Math.sin(a) * d.rd * nr * 0.85, d.sz, 0, 7);
        ctx.fill();
      }
      ctx.restore();

      // outer ring: red on losses, bright + fast when the brain is paying to think
      const thinkGlow = s.thinking ? 0.85 : 0.4;
      ctx.strokeStyle = s.flash < 0 ? "rgba(255,110,110,.55)" : `rgba(125,211,252,${thinkGlow})`;
      ctx.setLineDash([4, 9]); ctx.lineDashOffset = -t * (s.thinking ? 0.09 : 0.02);
      ctx.lineWidth = s.thinking ? 1.8 : 1;
      ctx.beginPath(); ctx.arc(cx, cy, Ra * 1.38, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      const son = (t % 3200) / 3200;
      ctx.strokeStyle = `rgba(125,211,252,${0.35 * (1 - son)})`;
      ctx.beginPath(); ctx.arc(cx, cy, Ra * (1.1 + son * 0.9), 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      if (s.flash > 0) s.flash--; if (s.flash < 0) s.flash++;
    };

    const loop = (t: number) => {
      const pw = cv.clientWidth || 680, ph = cv.clientHeight || 420;
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      const W = cv.width, H = cv.height;
      const s = stateRef.current;

      ctx.fillStyle = "#060b18"; ctx.fillRect(0, 0, W, H);
      for (const a of amb) {
        a.fx = (a.fx + a.dx / W + 1) % 1; a.fy = (a.fy + a.dy / H + 1) % 1;
        const x = a.fx * W, y = a.fy * H;
        const g = ctx.createRadialGradient(x, y, a.r * 0.2, x, y, a.r);
        g.addColorStop(0, `rgba(190,150,180,${a.a})`);
        g.addColorStop(0.7, `rgba(160,190,230,${a.a * 0.6})`);
        g.addColorStop(1, "rgba(160,190,230,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, a.r, 0, 7); ctx.fill();
      }
      const parts = partsRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (p.kind === "frag") {
          p.x += p.vx!; p.y += p.vy!; p.vx! *= 0.99; p.vy! *= 0.99; p.life--;
          ctx.fillStyle = `rgba(${p.col},${Math.min(1, p.life / 80)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 7); ctx.fill();
        } else {
          p.x += (p.tx! - p.x) * 0.05; p.y += (p.ty! - p.y) * 0.05; p.life--;
          ctx.fillStyle = `rgba(${p.col},${Math.min(1, p.life / 40)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
        }
        if (p.life <= 0) parts.splice(i, 1);
      }

      if (s.phase === "alive") cell(t, W, H, 1, 1, 1);
      else if (s.phase === "dying") {
        const p = Math.min(1, (t - s.phaseT) / 2500);
        cell(t, W, H, 1 - p * 0.15, 1 - p * 0.75, 1 + p * 7);
      } else if (s.phase === "rebirth") {
        const p = Math.min(1, (t - s.phaseT) / 2200);
        cell(t, W, H, 0.15 + 0.85 * p, p, 1);
      }
      // dead: only fragments drift

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // const onClick = (e: React.MouseEvent) => {
  //   const s = stateRef.current;
  //   if (s.phase !== "alive") return;
  //   const cv = cvRef.current!;
  //   const r = cv.getBoundingClientRect();
  //   const x = e.clientX - r.left, y = e.clientY - r.top;
  //   for (let i = 0; i < 8; i++)
  //     partsRef.current.push({
  //       kind: "food",
  //       x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
  //       tx: cv.width * 0.5, ty: cv.height * 0.5,
  //       life: 60, col: "110,255,170",
  //     });
  //   donate();
  // };

    return (
    <canvas
      ref={cvRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}