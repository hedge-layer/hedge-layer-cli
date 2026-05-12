import { describe, expect, it } from "vitest";

import { resolveFeedProfile } from "./feed.js";

describe("resolveFeedProfile", () => {
  it("rejects unknown --profile values before calling the API", () => {
    expect(() => resolveFeedProfile(undefined, "typo-profile")).toThrow(
      'Unknown feed profile "typo-profile". Use: lp-opportunity or liquid-new-or-long',
    );
  });

  it("keeps existing positional screening validation", () => {
    expect(() => resolveFeedProfile("typo-profile", undefined)).toThrow(
      'Unknown screening "typo-profile". Use: lp-opportunity or liquid-new-or-long',
    );
  });
});
