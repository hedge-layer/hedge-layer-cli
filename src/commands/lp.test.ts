import { describe, expect, it } from "vitest";
import {
  buildLpEvaluatePayload,
  buildLpRecommendPayload,
  buildLpRunPayload,
  buildLpScanPayload,
} from "./lp.js";

describe("LP command payload builders", () => {
  it("builds scan payloads and removes empty fields", () => {
    expect(
      buildLpScanPayload("liquidity opportunities", {
        profile: "liquidity-provider",
        tag: "",
        limit: 10,
        minLiquidity: 500,
      }),
    ).toEqual({
      topic: "liquidity opportunities",
      profile: "liquidity-provider",
      limit: 10,
      minLiquidity: 500,
    });
  });

  it("builds recommendation payloads with scan and strategy ids", () => {
    expect(
      buildLpRecommendPayload({
        strategyId: "strategy-1",
        scanId: "scan-1",
        limit: 5,
        syncPnl: true,
      }),
    ).toEqual({
      strategyId: "strategy-1",
      scanId: "scan-1",
      limit: 5,
      syncPnl: true,
    });
  });

  it("preserves disabled PnL sync for evaluation and chained runs", () => {
    expect(buildLpEvaluatePayload({ syncPnl: false, limit: 20 })).toEqual({
      syncPnl: false,
      limit: 20,
    });
    expect(buildLpRunPayload({ syncPnl: false, limit: 15 })).toEqual({
      syncPnl: false,
      limit: 15,
    });
  });
});
