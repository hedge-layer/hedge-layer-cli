import { describe, expect, it } from "vitest";
import {
  buildDepositInstructions,
  buildWithdrawIntent,
  normalizeWalletAsset,
} from "./wallet.js";
import type { WalletBalances } from "../types.js";

const balances: WalletBalances = {
  walletAddress: "0x0000000000000000000000000000000000000001",
  chainId: 137,
  updatedAt: "2026-06-04T00:00:00.000Z",
  available: {
    symbol: "pUSD",
    name: "Polymarket USD",
    address: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
    decimals: 6,
    balanceRaw: "125000000",
    balance: "125",
    ok: true,
  },
  assets: {
    pUsd: {
      symbol: "pUSD",
      name: "Polymarket USD",
      address: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
      decimals: 6,
      balanceRaw: "125000000",
      balance: "125",
      ok: true,
    },
    usdcE: {
      symbol: "USDC.e",
      name: "Bridged USDC",
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      decimals: 6,
      balanceRaw: "25000000",
      balance: "25",
      ok: true,
    },
    matic: {
      symbol: "MATIC",
      name: "Polygon gas token",
      address: null,
      decimals: 18,
      balanceRaw: "1000000000000000000",
      balance: "1",
      ok: true,
    },
  },
};

describe("wallet command helpers", () => {
  it("normalizes supported asset aliases", () => {
    expect(normalizeWalletAsset("pUSD")).toBe("pUsd");
    expect(normalizeWalletAsset("USDC.e")).toBe("usdcE");
    expect(normalizeWalletAsset("bridged-usdc")).toBe("usdcE");
    expect(normalizeWalletAsset("MATIC")).toBe("matic");
    expect(normalizeWalletAsset(undefined)).toBeUndefined();
  });

  it("rejects unknown assets", () => {
    expect(() => normalizeWalletAsset("eth")).toThrow("Unknown wallet asset");
  });

  it("builds deposit instructions for one asset", () => {
    const instructions = buildDepositInstructions(balances, "usdcE");

    expect(instructions).toMatchObject({
      action: "deposit",
      walletAddress: balances.walletAddress,
      chainId: 137,
      network: "Polygon",
      asset: { symbol: "USDC.e" },
    });
    expect(instructions.assets).toHaveLength(1);
    expect(instructions.assets[0].address).toBe(balances.assets.usdcE.address);
  });

  it("builds a non-executable withdrawal intent", () => {
    const intent = buildWithdrawIntent(balances, {
      asset: "pUSD",
      amount: 10,
      to: "0x0000000000000000000000000000000000000002",
    });

    expect(intent).toMatchObject({
      action: "withdraw",
      supported: false,
      asset: { symbol: "pUSD" },
      amount: 10,
      availableBalance: "125",
    });
    expect(intent.reason).toContain("cannot sign wallet transactions");
  });
});
