import { describe, expect, it } from "vitest";

import { buildFeedEnsemble, resolveFeedProfile } from "./feed.js";
import type { FeedResult, FeedResultMarket } from "../types.js";

describe("resolveFeedProfile", () => {
  const choices = "lp-opportunity or liquidity-provider or liquid-new-or-long";

  it("rejects unknown --profile values before calling the API", () => {
    expect(() => resolveFeedProfile(undefined, "typo-profile")).toThrow(
      `Unknown feed profile "typo-profile". Use: ${choices}`,
    );
  });

  it("keeps existing positional screening validation", () => {
    expect(() => resolveFeedProfile("typo-profile", undefined)).toThrow(
      `Unknown screening "typo-profile". Use: ${choices}`,
    );
  });
});

function market(overrides: Partial<FeedResultMarket>): FeedResultMarket {
  return {
    id: overrides.slug ?? "m",
    rank: 1,
    score: 50,
    question: "Will this happen?",
    slug: "market",
    eventSlug: "event",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume24h: 1_000,
    liquidity: 10_000,
    spread: 0.02,
    oneDayPriceChange: 0.01,
    rewardsDailyRate: 0,
    lpExpectedReturnDailyPct: 0,
    daysToEnd: 30,
    endDate: "2027-01-01",
    polymarketUrl: "https://polymarket.com/event/event",
    components: {
      volume: 50,
      liquidity: 50,
      movement: 50,
      spread: 50,
      recency: 50,
      extremity: 50,
      rewards: 50,
      rewardYield: 50,
      lpExpectedReturn: 50,
      horizon: 50,
    },
    ...overrides,
  };
}

function result(markets: FeedResultMarket[]): FeedResult {
  return {
    totalScanned: markets.length,
    totalAfterFilter: markets.length,
    marketsReturned: markets.length,
    sortedBy: "score",
    preset: "default",
    markets,
  };
}

describe("buildFeedEnsemble", () => {
  it("deduplicates by slug and preserves source profiles/ranks", () => {
    const ensemble = buildFeedEnsemble(
      [
        { source: "liquid-new-or-long", result: result([market({ slug: "a", rank: 2 })]) },
        { source: "reward-yield", result: result([market({ slug: "a", rank: 4, rewardsDailyRate: 5 })]) },
      ],
      10,
      "out.json",
      "2026-01-01T00:00:00.000Z",
    );

    expect(ensemble.totalRawMarkets).toBe(2);
    expect(ensemble.totalCandidates).toBe(1);
    expect(ensemble.candidates[0].sourceProfiles).toEqual(["liquid-new-or-long", "reward-yield"]);
    expect(ensemble.candidates[0].sourceRanks).toEqual({
      "liquid-new-or-long": 2,
      "reward-yield": 4,
    });
    expect(ensemble.candidates[0].rewardsDailyRate).toBe(5);
  });

  it("ranks stronger liquid multi-source candidates first", () => {
    const ensemble = buildFeedEnsemble(
      [
        {
          source: "liquid-new-or-long",
          result: result([
            market({ slug: "weak", liquidity: 500, volume24h: 100, spread: 0.1 }),
            market({ slug: "strong", liquidity: 200_000, volume24h: 80_000, spread: 0.01 }),
          ]),
        },
        {
          source: "lp-opportunity",
          result: result([
            market({ slug: "strong", liquidity: 220_000, volume24h: 90_000, spread: 0.01, rewardsDailyRate: 50 }),
          ]),
        },
      ],
      2,
    );

    expect(ensemble.candidates.map((candidate) => candidate.slug)).toEqual(["strong", "weak"]);
    expect(ensemble.candidates[0].ensembleScore).toBeGreaterThan(ensemble.candidates[1].ensembleScore);
  });
});
