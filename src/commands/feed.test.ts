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
    slug: overrides.slug ?? "market",
    eventSlug: overrides.eventSlug ?? overrides.slug ?? "event",
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
        { source: "liquid-core", result: result([market({ slug: "a", rank: 2 })]) },
        { source: "active-volume", result: result([market({ slug: "a", rank: 4, rewardsDailyRate: 5 })]) },
      ],
      10,
      "out.json",
      "2026-01-01T00:00:00.000Z",
    );

    expect(ensemble.totalRawMarkets).toBe(2);
    expect(ensemble.totalCandidates).toBe(1);
    expect(ensemble.candidates[0].sourceProfiles).toEqual(["liquid-core", "active-volume"]);
    expect(ensemble.candidates[0].sourceRanks).toEqual({
      "liquid-core": 2,
      "active-volume": 4,
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

  it("penalizes markets with probabilities outside the 7% to 93% band", () => {
    const ensemble = buildFeedEnsemble(
      [
        {
          source: "spread",
          result: result([
            market({ slug: "in-band", yesPrice: 0.5, probability: 0.5, oneDayPriceChange: 0 }),
            market({ slug: "low-tail", yesPrice: 0.01, probability: 0.01, noPrice: 0.99, oneDayPriceChange: 0 }),
            market({ slug: "low-edge", yesPrice: 0.07, probability: 0.07, noPrice: 0.93, oneDayPriceChange: 0 }),
            market({ slug: "high-edge", yesPrice: 0.93, probability: 0.93, noPrice: 0.07, oneDayPriceChange: 0 }),
            market({ slug: "high-tail", yesPrice: 0.99, probability: 0.99, noPrice: 0.01, oneDayPriceChange: 0 }),
          ]),
        },
      ],
      5,
    );

    const scores = Object.fromEntries(
      ensemble.candidates.map((candidate) => [candidate.slug, candidate.ensembleScore]),
    );

    expect(scores["low-edge"]).toBe(scores["in-band"]);
    expect(scores["high-edge"]).toBe(scores["in-band"]);
    expect(scores["low-tail"]).toBeLessThan(scores["in-band"]);
    expect(scores["high-tail"]).toBeLessThan(scores["in-band"]);
  });

  it("lowers horizon scores for markets longer than one year", () => {
    const ensemble = buildFeedEnsemble(
      [
        {
          source: "spread",
          result: result([
            market({ slug: "one-year", daysToEnd: 365, oneDayPriceChange: 0 }),
            market({ slug: "two-years", daysToEnd: 730, oneDayPriceChange: 0 }),
            market({ slug: "three-years", daysToEnd: 1_095, oneDayPriceChange: 0 }),
          ]),
        },
      ],
      3,
    );

    const scores = Object.fromEntries(
      ensemble.candidates.map((candidate) => [candidate.slug, candidate.ensembleScore]),
    );

    expect(scores["two-years"]).toBeLessThan(scores["one-year"]);
    expect(scores["three-years"]).toBeLessThan(scores["two-years"]);
  });

  it("limits repeated markets from the same event", () => {
    const ensemble = buildFeedEnsemble(
      [
        {
          source: "liquid-core",
          result: result([
            market({ slug: "event-a-1", eventSlug: "event-a", liquidity: 500_000, volume24h: 80_000 }),
            market({ slug: "event-a-2", eventSlug: "event-a", liquidity: 490_000, volume24h: 80_000 }),
            market({ slug: "event-a-3", eventSlug: "event-a", liquidity: 480_000, volume24h: 80_000 }),
            market({ slug: "event-b-1", eventSlug: "event-b", liquidity: 300_000, volume24h: 80_000 }),
          ]),
        },
      ],
      4,
    );

    expect(ensemble.candidates.map((candidate) => candidate.slug)).toEqual([
      "event-a-1",
      "event-a-2",
      "event-b-1",
    ]);
  });

  it("limits single-source candidates from one source to keep the daily list broad", () => {
    const activeVolumeMarkets = Array.from({ length: 6 }, (_, i) =>
      market({
        slug: `active-${i + 1}`,
        eventSlug: `active-${i + 1}`,
        liquidity: 500_000 - i * 1_000,
        volume24h: 100_000 - i * 1_000,
      }),
    );
    const ensemble = buildFeedEnsemble(
      [
        { source: "active-volume", result: result(activeVolumeMarkets) },
        {
          source: "uncertainty",
          result: result([
            market({ slug: "uncertain-1", eventSlug: "uncertain-1", liquidity: 10_000, volume24h: 1_000 }),
          ]),
        },
      ],
      7,
    );

    const activeVolumeCount = ensemble.candidates.filter(
      (candidate) => candidate.sourceProfiles.length === 1 && candidate.sourceProfiles[0] === "active-volume",
    ).length;

    expect(activeVolumeCount).toBe(5);
    expect(ensemble.candidates.map((candidate) => candidate.slug)).toContain("uncertain-1");
  });
});
