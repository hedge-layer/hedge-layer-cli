import { describe, expect, it } from "vitest";

import { parsePositiveNumber } from "./allocator.js";

describe("allocator numeric validation", () => {
  it("rejects zero for sizing fields that the API requires to be positive", () => {
    expect(() => parsePositiveNumber("0")).toThrow("Expected a positive number");
  });

  it("accepts positive sizing values", () => {
    expect(parsePositiveNumber("0.01")).toBe(0.01);
  });
});
