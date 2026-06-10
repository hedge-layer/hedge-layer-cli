import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parsePositiveNumber, readMarketPayload } from "./allocator.js";

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
