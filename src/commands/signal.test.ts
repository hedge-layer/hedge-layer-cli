import { describe, expect, it } from "vitest";

import {
  buildSignalPayload,
  parseProbability,
} from "./signal.js";

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
