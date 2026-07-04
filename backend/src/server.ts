import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { PORT } from "./config.js";
import { die } from "./lifecycle.js";
import type { Organism } from "./state.js";
import type { Trade, WsEvent } from "./types.js";
import path from "node:path";

export function startServer(o: Organism) {
  const app = express();
  app.use(express.static(path.join(process.cwd(), "public")));
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  // --- broadcast every organism event to all sockets ---
  const broadcast = (e: WsEvent) => {
    const msg = JSON.stringify(e);
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(msg);
  };
  o.on("event", broadcast);

  wss.on("connection", (socket) => {
    // snapshot so a fresh page isn't blank
    socket.send(JSON.stringify({ type: "vitals", vitals: o.vitals() } satisfies WsEvent));
    socket.send(JSON.stringify({ type: "lineage", lineage: o.lineage } satisfies WsEvent));
  });

  // --- REST snapshots ---
  app.get("/api/state", (_req, res) => {
    res.json({ vitals: o.vitals(), genome: o.genome, inherited: o.inherited });
  });
  app.get("/api/lineage", (_req, res) => res.json(o.lineage));
  app.get("/api/thoughts", (_req, res) => res.json(o.thoughtLog));
  app.get("/api/history", (_req, res) => res.json(o.balanceHistory));
  app.get("/api/trades", (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    const gen = req.query.gen ? Number(req.query.gen) : o.gen;
    const rows = gen === o.gen ? o.trades : o.tradeArchive[gen] ?? [];
    res.json(rows.slice(-limit));
  });
  app.get("/api/gens", (_req, res) =>
    res.json({ current: o.gen, archived: Object.keys(o.tradeArchive).map(Number) })
  );

  // --- demo triggers (your on-stage hotkeys hit these) ---
  app.post("/api/demo/kill", async (_req, res) => {
    await die(o, "terminated on stage — for science");
    res.json({ ok: true });
  });
  app.post("/api/demo/donate", (_req, res) => {
    if (!o.alive) return res.status(409).json({ ok: false, reason: "specimen is dead" });
    const t: Trade = {
      ts: Date.now(),
      pair: "DONATION",
      gapBps: 0,
      sizeUsd: 0,
      outcome: "won",
      pnlMon: 0.25,
    };
    o.applyTrade(t);
    return res.json({ ok: true });
  });

  server.listen(PORT, () =>
    console.log(`DARWIN backend on http://localhost:${PORT} (ws at /ws)`)
  );
}
