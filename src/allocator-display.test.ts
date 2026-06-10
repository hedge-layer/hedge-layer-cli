import { describe, expect, it, vi } from "vitest";
import { displayAllocatorCycleResult } from "./allocator-display.js";
import type { AllocatorCycleResult } from "./types.js";

describe("displayAllocatorCycleResult", () => {
  it("prints JSON unchanged in json mode", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result: AllocatorCycleResult = {
      dry_run: true,
      decisions: [{ market_slug: "market-a", action: "WATCH" }],
    };

    displayAllocatorCycleResult(result, { json: true });

    expect(spy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + "\n");
    spy.mockRestore();
  });
});
