import { describe, it, expect, vi, beforeEach } from "vitest";
import * as out from "./output.js";

describe("currency", () => {
  it("formats a whole number with two decimals", () => {
    expect(out.currency(1000)).toBe("$1,000.00");
  });

  it("formats zero", () => {
    expect(out.currency(0)).toBe("$0.00");
  });

  it("formats a fractional value", () => {
    expect(out.currency(42.5)).toBe("$42.50");
  });

  it("formats a large number with commas", () => {
    expect(out.currency(1234567.89)).toBe("$1,234,567.89");
  });
});

describe("percent", () => {
  it("converts a decimal to percentage string", () => {
    expect(out.percent(0.125)).toBe("12.5%");
  });

  it("handles zero", () => {
    expect(out.percent(0)).toBe("0.0%");
  });

  it("handles 1.0 as 100%", () => {
    expect(out.percent(1)).toBe("100.0%");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(out.truncate("hello", 10)).toBe("hello");
  });

  it("returns string at exact max length unchanged", () => {
    expect(out.truncate("hello", 5)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(out.truncate("hello world", 8)).toBe("hello w…");
  });
});

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns 'just now' for very recent dates", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    vi.setSystemTime(now);
    expect(out.relativeTime("2025-06-15T12:00:00Z")).toBe("just now");
  });

  it("returns minutes ago", () => {
    const now = new Date("2025-06-15T12:30:00Z");
    vi.setSystemTime(now);
    expect(out.relativeTime("2025-06-15T12:00:00Z")).toBe("30m ago");
  });

  it("returns hours ago", () => {
    const now = new Date("2025-06-15T15:00:00Z");
    vi.setSystemTime(now);
    expect(out.relativeTime("2025-06-15T12:00:00Z")).toBe("3h ago");
  });

  it("returns days ago", () => {
    const now = new Date("2025-06-18T12:00:00Z");
    vi.setSystemTime(now);
    expect(out.relativeTime("2025-06-15T12:00:00Z")).toBe("3d ago");
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("json", () => {
  it("writes pretty-printed JSON to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    out.json({ foo: "bar" });
    expect(spy).toHaveBeenCalledWith(
      JSON.stringify({ foo: "bar" }, null, 2) + "\n",
    );
    spy.mockRestore();
  });
});
