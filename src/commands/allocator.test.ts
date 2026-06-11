import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  parseAllocationsInput,
  parsePnlContextInput,
  parsePositiveNumber,
  readMarketPayload,
} from "./allocator.js";

describe("allocator numeric validation", () => {
  it("rejects zero for sizing fields that the API requires to be positive", () => {
    expect(() => parsePositiveNumber("0")).toThrow("Expected a positive number");
  });

  it("accepts positive sizing values", () => {
    expect(parsePositiveNumber("0.01")).toBe(0.01);
  });
});

describe("allocator market payload", () => {
  it("reads a market array", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hl-allocator-"));
    const path = join(dir, "markets.json");
    await writeFile(path, JSON.stringify([{ slug: "a", question: "A?" }]), "utf8");

    await expect(readMarketPayload(path)).resolves.toEqual([
      { slug: "a", question: "A?" },
    ]);
    await rm(dir, { recursive: true, force: true });
  });

  it("reads an object with markets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hl-allocator-"));
    const path = join(dir, "markets.json");
    await writeFile(path, JSON.stringify({ markets: [{ slug: "b" }] }), "utf8");

    await expect(readMarketPayload(path)).resolves.toEqual([{ slug: "b" }]);
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects non-market payloads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hl-allocator-"));
    const path = join(dir, "markets.json");
    await writeFile(path, JSON.stringify({ market: { slug: "c" } }), "utf8");

    await expect(readMarketPayload(path)).rejects.toThrow("Markets JSON must be an array");
    await rm(dir, { recursive: true, force: true });
  });
});

describe("allocator allocations input", () => {
  it("accepts a bare array", () => {
    const rows = [{ market_slug: "m1", allocated_capital: 10 }];
    expect(parseAllocationsInput(rows)).toEqual(rows);
  });

  it("accepts an { allocations } wrapper, e.g. hl-trader pnl --json output", () => {
    const rows = [{ market_slug: "m1", inventory_yes: 20, inventory_no: 5 }];
    expect(parseAllocationsInput({ wallet: "0xabc", allocations: rows })).toEqual(rows);
  });

  it("rejects other shapes", () => {
    expect(() => parseAllocationsInput({ allocations: "nope" })).toThrow(
      "Allocations JSON must be an array or { allocations: [...] }",
    );
  });
});

describe("allocator pnl context input", () => {
  it("accepts a bare array", () => {
    const rows = [{ market_slug: "m1", realized_pnl: -2.5 }];
    expect(parsePnlContextInput(rows)).toEqual(rows);
  });

  it("accepts a { pnl_context } wrapper, e.g. hl-trader pnl --json output", () => {
    const rows = [
      { market_slug: "m1", realized_pnl: -2.5, capital_locked: 12, outcome: "loss" },
    ];
    expect(parsePnlContextInput({ wallet: "0xabc", pnl_context: rows })).toEqual(rows);
  });

  it("rejects other shapes", () => {
    expect(() => parsePnlContextInput(42)).toThrow(
      "PnL JSON must be an array or { pnl_context: [...] }",
    );
  });
});
