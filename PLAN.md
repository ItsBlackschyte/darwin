# DARWIN — build spec (paste-into-copilot context)

## Concept
Self-funding digital organism for Monad Blitz Pune V2. It paper-trades
arbitrage on real(-istic) price gaps; every LLM "thought" costs it MON from
its own wallet (metabolism). Balance ≤ 0 = death: it writes an epitaph with
3 lessons on-chain; the next generation reads the full ancestry and starts
with an adjusted genome. Themes covered: identity, ownership, provable
track record, memory, reputation (5/6 of the event's gap list).

## Stack
- Backend: Node 20 + tsx + TypeScript, viem (mainnet reads + Monad writes),
  openai sdk, zod, express + ws. State in memory + JSON file.
- Frontend: Vite + React + TS, plain Canvas 2D specimen, plain CSS lab theme.
- Contract: contracts/Ancestry.sol — generations, trade log, burn sink.
  Deployed via Remix to Monad testnet.

## Key design rules
1. Reflexes trade, brain tunes: the LLM is NEVER in the trade hot path; it
   wakes every genome.brainIntervalSec, pays a burn, and patches the genome.
2. Pessimism layer on paper trades: slippage from size, pessimistic gas,
   race dice (raceWinProb); lost races still cost gas.
3. Every subsystem has a mock: no keys = full demo still works. Mock is the
   on-stage fallback; chain/brain/prices flip to real independently via .env.
4. Frontend is a pure renderer of WS events. Demo triggers are backend
   endpoints (/api/demo/kill, /api/demo/donate) so the pitch is hotkey-able.
5. Zod-guard every LLM output; a malformed thought never crashes the body.

## Event vocabulary (WS)
vitals, prices, gap, trade, thought_started, thought, dying, epitaph,
born, lineage.

## Demo script beats (2 min)
alive+trading (60s) → QR donations from crowd → terminate: dying(3s) →
flatline(3s, silence) → epitaph card + Monad tx (7s, read one lesson aloud)
→ egg/inherit (3s) → GEN+1 born with genome diff (4s) → archive table shows
lifespans increasing across generations → close.

## Economy tuning knobs (backend/src/config.ts)
START_BALANCE_MON=40, BURN_PER_THOUGHT_MON=0.5, LOST_RACE_GAS_MON=0.04,
FAST_LOOP_MS=1500. Tune so: 4-6 thoughts + 2-3 wins visible per 2 minutes.

## TODO at venue
- Monad RPC/chainId/faucet from workshop → deploy Ancestry.sol via Remix.
- Flip chain, brain, prices to real. Pre-run 3 fast generations for history.
- Stretch: second organism sharing the Ancestry contract (co-evolution),
  ECG sparkline, r3f 3D cell, QR overlay for donations.
