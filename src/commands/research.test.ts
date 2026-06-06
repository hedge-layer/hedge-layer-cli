import { describe, expect, it } from "vitest";

import { matchAssessmentId } from "./research.js";

const IDS = [
  "7f4fdace-a4b2-428d-87f1-fbf715165776",
  "7f4fbeef-1111-2222-3333-444455556666",
  "0b1ee66d-29d1-479e-9c8c-8f4d3c0aaec9",
];

describe("matchAssessmentId", () => {
  it("returns the full UUID for an unambiguous short prefix", () => {
    expect(matchAssessmentId("0b1ee66d", IDS)).toBe("0b1ee66d-29d1-479e-9c8c-8f4d3c0aaec9");
  });

  it("returns the full UUID when given the full UUID", () => {
    expect(matchAssessmentId("7f4fdace-a4b2-428d-87f1-fbf715165776", IDS)).toBe(
      "7f4fdace-a4b2-428d-87f1-fbf715165776",
    );
  });

  it("is case-insensitive", () => {
    expect(matchAssessmentId("0B1EE66D", IDS)).toBe("0b1ee66d-29d1-479e-9c8c-8f4d3c0aaec9");
  });

  it("throws a helpful error when no session matches", () => {
    expect(() => matchAssessmentId("deadbeef", IDS)).toThrow(
      /No research session found matching "deadbeef"/,
    );
  });

  it("throws an ambiguity error when a prefix matches multiple sessions", () => {
    expect(() => matchAssessmentId("7f4f", IDS)).toThrow(
      /matches 2 research sessions \(7f4fdace, 7f4fbeef\)/,
    );
  });

  it("rejects an empty identifier", () => {
    expect(() => matchAssessmentId("   ", IDS)).toThrow(/No research session ID provided/);
  });
});
