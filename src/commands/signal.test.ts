import { describe, expect, it } from "vitest";

import {
  buildSignalPayload,
  extractPlanCandidates,
  firstSignalAnalysis,
  parseProbability,
  recommendedPlanAction,
  signalPayloadForCandidate,
  signalPlanPriority,
} from "./signal.js";
import type { FeedResultMarket, SignalAnalysisApiResponse } from "../types.js";

describe("signal analyze payload", () => {
  it("builds a single-url signal payload", async () => {
    await expect(
      buildSignalPayload("https://polymarket.com/event/example", {}),
    ).resolves.toEqual({
      url: "https://polymarket.com/event/example",
    });
  });

  it("builds a multi-url signal payload from repeated options", async () => {
    await expect(
      buildSignalPayload("https://polymarket.com/event/one", {
        url: ["https://polymarket.com/event/two"],
        context: "Recent search notes.",
      }),
    ).resolves.toEqual({
      urls: [
        "https://polymarket.com/event/one",
        "https://polymarket.com/event/two",
      ],
      previous_analysis_context: "Recent search notes.",
    });
  });

  it("builds an inline market payload", async () => {
    await expect(
      buildSignalPayload(undefined, {
        question: "Will this resolve yes?",
        yesProb: 0.42,
        noProb: 0.58,
        slug: "inline-market",
      }),
    ).resolves.toEqual({
      market: {
        question: "Will this resolve yes?",
        yesPrice: 0.42,
        noPrice: 0.58,
        slug: "inline-market",
      },
    });
  });

  it("rejects mixed url and market inputs", async () => {
    await expect(
      buildSignalPayload("https://polymarket.com/event/example", {
        question: "Will this resolve yes?",
        yesProb: 52,
      }),
    ).rejects.toThrow("Use either URL input or market JSON/options, not both.");
  });
});

describe("signal probability validation", () => {
  it("accepts decimal and percentage values", () => {
    expect(parseProbability("0.52")).toBe(0.52);
    expect(parseProbability("52")).toBe(52);
  });

  it("rejects values outside 0-100", () => {
    expect(() => parseProbability("-0.1")).toThrow("Expected a probability");
    expect(() => parseProbability("101")).toThrow("Expected a probability");
  });
});

function market(overrides: Partial<FeedResultMarket> = {}): FeedResultMarket {
  return {
    rank: 1,
    score: 50,
    question: "Will this happen?",
    slug: "test-market",
    eventSlug: "test-event",
    yesPrice: 0.5,
    noPrice: 0.5,
    volume24h: 10_000,
    liquidity: 100_000,
    spread: 0.02,
    oneDayPriceChange: 0.01,
    rewardsDailyRate: 0,
    daysToEnd: 30,
    endDate: "2027-01-01",
    polymarketUrl: "https://polymarket.com/event/test-event/test-market",
    components: {
      volume: 50,
      liquidity: 50,
      movement: 50,
      spread: 50,
      recency: 50,
      extremity: 50,
      rewards: 50,
    },
    ...overrides,
  };
}

describe("signal plan helpers", () => {
  it("extracts candidates from ensemble payloads", () => {
    const row = market();
    expect(extractPlanCandidates({ candidates: [row] })).toEqual([row]);
    expect(extractPlanCandidates({ markets: [row] })).toEqual([row]);
    expect(extractPlanCandidates([])).toEqual([]);
  });

  it("builds structured market payloads for the signal-agent API", () => {
    const payload = signalPayloadForCandidate(
      market({
        spread: 0.03,
        liquidity: 200_000,
        volume24h: 50_000,
      }) as FeedResultMarket & { sourceProfiles: string[] },
    );

    expect(payload).toEqual({
      market: expect.objectContaining({
        question: "Will this happen?",
        yesPrice: 0.5,
        noPrice: 0.5,
        slug: "test-market",
        spread: 0.03,
        liquidity: 200_000,
        volume24h: 50_000,
      }),
    });
  });

  it("normalizes the first signal analysis from single or multi responses", () => {
    const single: SignalAnalysisApiResponse = {
      result: { analysis: { market_slug: "a", probability_gap: 0.1 } },
    };
    const multi: SignalAnalysisApiResponse = {
      result: { analyses: [{ analysis: { market_slug: "b", probability_gap: -0.1 } }] },
    };

    expect(firstSignalAnalysis(single)?.market_slug).toBe("a");
    expect(firstSignalAnalysis(multi)?.market_slug).toBe("b");
  });

  it("maps signal and quote into recommended actions", () => {
    const signal = { signal_strength: "strong" as const, probability_gap: 0.1, confidence: "High" };
    expect(recommendedPlanAction(signal, { decision: "EXECUTABLE", route: "aggressive", outcome: "YES" })).toBe("AGGRESSIVE_BUY_YES");
    expect(recommendedPlanAction(signal, { decision: "PASSIVE_ONLY", route: "passive", outcome: "NO" })).toBe("PASSIVE_BUY_NO");
    expect(recommendedPlanAction({ ...signal, signal_strength: "weak" }, { decision: "EXECUTABLE", route: "aggressive", outcome: "YES" })).toBe("WATCH");
    expect(recommendedPlanAction(signal, { decision: "SKIP", route: "skip", outcome: "YES" })).toBe("SKIP");
  });

  it("scores strong executable plans above passive or low-confidence plans", () => {
    const candidate = market({ oneDayPriceChange: 0 });
    const high = { signal_strength: "strong" as const, probability_gap: 0.1, confidence: "High" };
    const low = { signal_strength: "strong" as const, probability_gap: 0.1, confidence: "Low" };
    const aggressive = { decision: "EXECUTABLE", route: "aggressive", outcome: "YES" };
    const passive = { decision: "PASSIVE_ONLY", route: "passive", outcome: "YES" };

    expect(signalPlanPriority(candidate, high, aggressive)).toBeGreaterThan(signalPlanPriority(candidate, high, passive));
    expect(signalPlanPriority(candidate, high, aggressive)).toBeGreaterThan(signalPlanPriority(candidate, low, aggressive));
  });
});
