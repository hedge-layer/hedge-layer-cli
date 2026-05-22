import { describe, expect, it, vi } from "vitest";
import {
  allocationsFromDecisions,
  displayAllocatorCycleResult,
  feedMarketsToAllocatorMarkets,
} from "./allocator-display.js";
import type { AllocatorCycleResult, FeedResultMarket } from "./types.js";

function feedMarket(overrides: Partial<FeedResultMarket> = {}): FeedResultMarket {
  return {
    rank: 1,
    score: 80,
    question: "Will the example resolve yes?",
    slug: "will-example-resolve-yes",
    eventSlug: "example-event",
    yesTokenId: "yes-token",
    noTokenId: "no-token",
    yesPrice: 0.52,
    noPrice: 0.48,
    volume24h: 20_000,
    liquidity: 10_000,
    spread: 0.04,
    oneDayPriceChange: 0.01,
    rewardsDailyRate: 50,
    daysToEnd: 30,
    active: true,
    endDate: "2026-06-01T00:00:00Z",
    polymarketUrl: "https://polymarket.com/event/example-event/will-example-resolve-yes",
    components: {
      volume: 1,
      liquidity: 1,
      movement: 1,
      spread: 1,
      recency: 1,
      extremity: 1,
      rewards: 1,
      rewardYield: 1,
      lpExpectedReturn: 1,
      horizon: 1,
    },
    ...overrides,
  };
}

describe("feedMarketsToAllocatorMarkets", () => {
  it("maps feed rows into allocator market payloads", () => {
    expect(feedMarketsToAllocatorMarkets([feedMarket()])).toEqual([
      {
        slug: "will-example-resolve-yes",
        question: "Will the example resolve yes?",
        yesTokenId: "yes-token",
        noTokenId: "no-token",
        yesPrice: 0.52,
        noPrice: 0.48,
        liquidity: 10_000,
        volume24h: 20_000,
        spread: 0.04,
        rewardsDailyRate: 50,
        oneDayPriceChange: 0.01,
        daysToEnd: 30,
        active: true,
      },
    ]);
  });

  it("caps allocator market payloads at the API limit", () => {
    const markets = Array.from({ length: 30 }, (_, i) =>
      feedMarket({ slug: `market-${i}`, question: `Market ${i}` }),
    );

    expect(feedMarketsToAllocatorMarkets(markets)).toHaveLength(25);
  });
});

describe("allocationsFromDecisions", () => {
  it("turns allocator decisions into repeat-cycle allocation state", () => {
    expect(
      allocationsFromDecisions([
        {
          market_slug: "market-a",
          action: "ALLOCATE",
          target_capital: 100,
          order_plan: [{ notional: 25 }, { notional: 15 }],
        },
      ]),
    ).toEqual([
      {
        market_slug: "market-a",
        status: "allocate",
        allocated_capital: 100,
        locked_capital: 0,
        inventory_yes: 0,
        inventory_no: 0,
        open_order_notional: 40,
      },
    ]);
  });
});

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
