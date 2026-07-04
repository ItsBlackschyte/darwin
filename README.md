# DARWIN — a self-funding digital organism

A trading organism that must earn more from paper-arbitrage than it burns on
thinking, or it dies — and when it dies, it writes its lessons to Monad so the
next generation starts smarter. Built for Monad Blitz Pune V2.

## Quickstart (zero keys needed)

Everything runs in **mock mode** out of the box: simulated prices, canned
brain, fake tx hashes. This is also your on-stage fallback.

```bash
# terminal 1 — the organism
cd backend
npm install
npm run dev        # http://localhost:3000

# terminal 2 — the lab view
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Open http://localhost:5173. Click the cell to donate. Press
**terminate specimen** to watch the death → epitaph → rebirth loop.

## Flipping subsystems to REAL (each independent)

Copy `backend/.env.example` to `backend/.env` and fill what you have:

| Subsystem | Env vars | What changes |
|---|---|---|
| Brain | `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`) | Real LLM reasons about the trade log and patches the genome |
| Prices | `MAINNET_RPC`, `PAIR_A`, `PAIR_B` | Live Uniswap/Sushi WETH-USDC reserves — real gaps |
| Chain | `MONAD_RPC`, `MONAD_CHAIN_ID`, `PRIVATE_KEY`, `ANCESTRY_ADDRESS` | Burns, trade logs, epitaphs land on Monad testnet |

Deploy `contracts/Ancestry.sol` via Remix (injected provider → MetaMask on
Monad testnet), paste the address into `.env`. The deploying wallet must be
the same as `PRIVATE_KEY` (the contract trusts its deployer).

## Architecture (two loops)

- **Fast loop (1.5s, no LLM):** poll prices → reflex gap check → paper-execute
  with the pessimism layer (slippage, pessimistic gas, race dice — lost races
  still cost gas) → log to Monad.
- **Slow loop (per genome.brainIntervalSec):** pay the burn on-chain →
  LLM reads its life → returns a genome patch + monologue (zod-validated;
  a confused thought never kills the body).
- **Death:** balance ≤ 0 → last words → `recordDeath` on-chain → 6s of
  flatline → `beBorn`: next gen inherits the ancestors' lessons and a
  caution-nudged genome.

Frontend is a pure renderer of the WebSocket event stream
(`vitals / prices / gap / trade / thought / dying / epitaph / born / lineage`).
Demo endpoints for the pitch: `POST /api/demo/kill`, `POST /api/demo/donate`.

## Saturday build order (what to do at the venue)

1. Monad 101 workshop: grab RPC URL + chain ID + faucet funds.
2. Deploy Ancestry.sol via Remix, fill `.env`, flip chain to REAL.
3. Flip brain to REAL (key from home), tune prompts if time allows.
4. Flip prices to REAL with your Alchemy mainnet RPC.
5. Tune the economy in `backend/src/config.ts` so the specimen visibly
   feeds and nearly starves during a 2-minute pitch.
6. Pre-run 3 fast generations (crank `BURN_PER_THOUGHT_MON`) so the
   archive has real history before pitching. Rehearse the kill twice.
