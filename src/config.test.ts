import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ directory: "" }));
vi.mock("node:os", async (original) => ({
  ...await original<typeof import("node:os")>(),
  homedir: () => state.directory,
}));

let config: typeof import("./config.js");
beforeAll(async () => {
  state.directory = mkdtempSync(join(tmpdir(), "hl-config-test-"));
  config = await import("./config.js");
});
afterAll(() => rmSync(state.directory, { recursive: true, force: true }));

describe("configuration", () => {
  it("saves tokens with private permissions, including overwriting an existing file", () => {
    config.saveConfig({ api_url: "https://test.example", token: "test-secret" });
    expect(statSync(config.configPath()).mode & 0o777).toBe(0o600);
    expect(config.loadConfig()).toEqual({ api_url: "https://test.example", token: "test-secret" });
    expect(readFileSync(config.configPath(), "utf8")).toContain("test-secret");
    chmodSync(config.configPath(), 0o644);
    config.saveConfig({ api_url: "https://test.example", token: "replacement" });
    expect(statSync(config.configPath()).mode & 0o777).toBe(0o600);
    expect(config.loadConfig().token).toBe("replacement");
  });

  it("handles invalid configuration without sending non-string credentials", () => {
    writeFileSync(config.configPath(), '{"token":{"secret":true},"api_url":42}');
    expect(config.loadConfig()).toEqual({ api_url: "https://hedgelayer.ai", token: null });
    writeFileSync(config.configPath(), "bad-json");
    expect(config.loadConfig().token).toBeNull();
  });

  it("removes saved credentials", () => {
    config.clearConfig();
    config.clearConfig();
    expect(config.loadConfig().token).toBeNull();
  });
});
