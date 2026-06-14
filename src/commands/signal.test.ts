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

  it("builds URL-only signal-agent payloads from candidates", () => {
    const payload = signalPayloadForCandidate(
      market({
        spread: 0.03,
        liquidity: 200_000,
        volume24h: 50_000,
        lpExpectedReturnDailyPct: 1.25,
        lpRiskFlags: ["wide_spread"],
      }) as FeedResultMarket & { sourceProfiles: string[] },
    );

    expect(payload).not.toHaveProperty("market");
    expect(payload).not.toHaveProperty("previous_analysis_context");
    expect(payload.url).toBe("https://polymarket.com/event/test-event/test-market");
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

  it("maps signal gaps into research review actions", () => {
    const signal = { signal_strength: "strong" as const, probability_gap: 0.1, confidence: "High" };
    expect(recommendedPlanAction(signal)).toBe("REVIEW_BUY_YES");
    expect(recommendedPlanAction({ ...signal, probability_gap: -0.1 })).toBe("REVIEW_BUY_NO");
    expect(recommendedPlanAction({ ...signal, probability_gap: 0 })).toBe("WATCH");
    expect(recommendedPlanAction({ ...signal, signal_strength: "weak" })).toBe("WATCH");
    expect(recommendedPlanAction(null)).toBe("SKIP");
  });

  it("scores high-confidence plans above low-confidence or high-movement plans", () => {
    const candidate = market({ oneDayPriceChange: 0 });
    const moving = market({ oneDayPriceChange: 0.1 });
    const high = { signal_strength: "strong" as const, probability_gap: 0.1, confidence: "High" };
    const low = { signal_strength: "strong" as const, probability_gap: 0.1, confidence: "Low" };

    expect(signalPlanPriority(candidate, high)).toBeGreaterThan(signalPlanPriority(candidate, low));
    expect(signalPlanPriority(candidate, high)).toBeGreaterThan(signalPlanPriority(moving, high));
  });
});
