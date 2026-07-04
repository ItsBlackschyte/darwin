import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { ENV, REAL_PRICES, PAIR_NAME } from "./config.js";
import type { PairPrices } from "./types.js";

const pairAbi = parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

// ---------------- mock feed ----------------
// A shared random walk plus independent venue noise, with occasional
// "divergence shocks" so real-looking gaps open every ~20-40s.
let base = 3000;
let skewA = 0;
let skewB = 0;

function mockPrices(): PairPrices[] {
  base *= 1 + (Math.random() - 0.5) * 0.002;
  skewA *= 0.95;
  skewB *= 0.95;
  if (Math.random() < 0.09) {
    // a whale trades on one venue — prices diverge
    const shock = (0.006 + Math.random() * 0.014) * (Math.random() < 0.5 ? 1 : -1);
    if (Math.random() < 0.5) skewA += shock;
    else skewB += shock;
  }
  return [
    {
      pair: PAIR_NAME,
      priceA: base * (1 + skewA + (Math.random() - 0.5) * 0.0004),
      priceB: base * (1 + skewB + (Math.random() - 0.5) * 0.0004),
    },
  ];
}

// ---------------- real feed ----------------
let client: ReturnType<typeof createPublicClient> | null = null;

async function pairPrice(pair: `0x${string}`): Promise<number> {
  if (!client) client = createPublicClient({ chain: mainnet, transport: http(ENV.MAINNET_RPC) });
  const [r0, r1] = await client.readContract({
    address: pair,
    abi: pairAbi,
    functionName: "getReserves",
  });
  // WETH/USDC v2 pairs: token0 = USDC (6 dp), token1 = WETH (18 dp)
  const usdc = Number(r0) / 1e6;
  const weth = Number(r1) / 1e18;
  return usdc / weth; // USD per ETH
}

async function realPrices(): Promise<PairPrices[]> {
  const [priceA, priceB] = await Promise.all([
    pairPrice(ENV.PAIR_A),
    pairPrice(ENV.PAIR_B),
  ]);
  return [{ pair: PAIR_NAME, priceA, priceB }];
}

export async function getPrices(): Promise<PairPrices[]> {
  if (!REAL_PRICES) return mockPrices();
  try {
    return await realPrices();
  } catch (err) {
    console.error("price feed error, falling back to mock:", err);
    return mockPrices();
  }
}
