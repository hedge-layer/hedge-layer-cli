import { describe, expect, it } from "vitest";
import {
  buildQuotePayload,
  parsePositiveNumber,
  parseQuoteAction,
  parseQuoteOutcome,
  parseQuoteRoute,
} from "./quote.js";

describe("quote request payload", () => {
  it("builds a saved BUY cash preview and normalizes CLI enums", () => {
    expect(
      buildQuotePayload(" example-market ", {
        action: parseQuoteAction("buy"),
        outcome: parseQuoteOutcome("yes"),
        cash: 25,
        signalId: "signal-1",
        capital: 1_000,
        route: parseQuoteRoute("aggressive"),
        save: true,
      }),
    ).toEqual({
      instrument: "example-market",
      action: "BUY",
      outcome: "YES",
      size: { type: "cash", amount_usd: 25 },
      signal_forecast_id: "signal-1",
      portfolio_capital_usd: 1_000,
      route: "aggressive",
      persist: true,
    });
  });

  it("builds a SELL shares preview without optional sizing context", () => {
    expect(
      buildQuotePayload("https://polymarket.com/event/example", {
        action: "SELL",
        outcome: "NO",
        shares: 10.5,
        route: "auto",
      }),
    ).toEqual({
      instrument: "https://polymarket.com/event/example",
      action: "SELL",
      outcome: "NO",
      size: { type: "shares", shares: 10.5 },
      route: "auto",
      persist: false,
    });
  });

  it("requires exactly one sizing mode", () => {
    expect(() => buildQuotePayload("market", {
      action: "BUY",
      outcome: "YES",
      route: "auto",
    })).toThrow("exactly one of --cash or --shares");

    expect(() => buildQuotePayload("market", {
      action: "BUY",
      outcome: "YES",
      cash: 10,
      shares: 10,
      route: "auto",
    })).toThrow("exactly one of --cash or --shares");
  });

  it("rejects cash-sized SELL previews", () => {
    expect(() => buildQuotePayload("market", {
      action: "SELL",
      outcome: "YES",
      cash: 10,
      route: "auto",
    })).toThrow("SELL quotes require --shares");
  });
});

describe("quote option validation", () => {
  it("normalizes action, outcome, and route values", () => {
    expect(parseQuoteAction("buy")).toBe("BUY");
    expect(parseQuoteOutcome("no")).toBe("NO");
    expect(parseQuoteRoute("PASSIVE")).toBe("passive");
  });

  it("rejects invalid enums and non-positive sizes", () => {
    expect(() => parseQuoteAction("hold")).toThrow("buy or sell");
    expect(() => parseQuoteOutcome("maybe")).toThrow("yes or no");
    expect(() => parseQuoteRoute("market")).toThrow("auto, aggressive, or passive");
    expect(() => parsePositiveNumber("0")).toThrow("positive number");
    expect(() => parsePositiveNumber("NaN")).toThrow("positive number");
  });
});
