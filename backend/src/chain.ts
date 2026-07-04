import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseAbi,
  parseEther,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BURN_PER_THOUGHT_MON, ENV } from "./config.js";
import type { Epitaph, Trade } from "./types.js";

const keyOk = /^0x[0-9a-fA-F]{64}$/.test(process.env.PRIVATE_KEY ?? "");
export const REAL_CHAIN = Boolean(
  process.env.MONAD_RPC && keyOk && process.env.ANCESTRY_ADDRESS
);
if (process.env.PRIVATE_KEY && !keyOk)
  console.warn("PRIVATE_KEY is malformed (need 0x + 64 hex chars) — chain running in MOCK mode");


const ancestryAbi = parseAbi([
  "function recordBirth(uint16 gen)",
  "function logTrade(bytes32 detailsHash, int256 pnlMilli, bool won)",
  "function burn() payable",
  "function recordDeath(int256 finalPnlMilli, uint32 tradeCount, uint16 winRateBps, string finalGenome, string causeOfDeath, string lessons)",
]);

function mockHash(): `0x${string}` {
  const hex = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

class MonadChain {
  private wallet: ReturnType<typeof createWalletClient> | null = null;
  private account: ReturnType<typeof privateKeyToAccount> | null = null;
  private chain: ReturnType<typeof defineChain> | null = null;

  private init() {
    if (this.wallet || !REAL_CHAIN) return;
    this.chain = defineChain({
      id: ENV.MONAD_CHAIN_ID,
      name: "Monad Testnet",
      nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [ENV.MONAD_RPC] } },
    });
    this.account = privateKeyToAccount(ENV.PRIVATE_KEY);
    this.wallet = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(ENV.MONAD_RPC),
    });
  }

  private async write(
    functionName: "recordBirth" | "logTrade" | "burn" | "recordDeath",
    args: readonly unknown[],
    valueMon?: number
  ): Promise<`0x${string}`> {
    if (!REAL_CHAIN) return mockHash();
    try {
      this.init();
      if (functionName === "burn") {
        return await this.wallet!.writeContract({
          chain: this.chain!,
          account: this.account!,
          address: ENV.ANCESTRY_ADDRESS,
          abi: ancestryAbi,
          functionName: "burn",
          value: parseEther(String(valueMon ?? 0)),
        });
      }
      return await this.wallet!.writeContract({
        chain: this.chain!,
        account: this.account!,
        address: ENV.ANCESTRY_ADDRESS,
        abi: ancestryAbi,
        functionName,
        args: args as never,
      });
    } catch (err) {
      console.error(`chain write ${functionName} failed:`, err);
      return mockHash(); // never let a chain hiccup kill the organism
    }
  }

  recordBirth(gen: number) {
    return this.write("recordBirth", [gen]);
  }

  logTrade(t: Trade) {
    const detailsHash = keccak256(toHex(JSON.stringify(t)));
    const pnlMilli = BigInt(Math.round(t.pnlMon * 1000));
    return this.write("logTrade", [detailsHash, pnlMilli, t.outcome === "won"]);
  }

  payBurn() {
    return this.write("burn", [], BURN_PER_THOUGHT_MON);
  }

  recordDeath(e: Epitaph) {
    return this.write("recordDeath", [
      BigInt(Math.round(e.finalPnlMon * 1000)),
      e.trades,
      e.winRateBps,
      JSON.stringify(e.finalGenome),
      e.causeOfDeath,
      e.lessons.join("\n"),
    ]);
  }
}

export const chain = new MonadChain();
