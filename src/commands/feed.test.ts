import { describe, expect, it } from "vitest";

import { resolveFeedProfile } from "./feed.js";

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
