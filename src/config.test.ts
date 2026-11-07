import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, chmodSync: vi.fn(fs.chmodSync) };
});

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
afterEach(() => { vi.mocked(chmodSync).mockReset(); vi.unstubAllGlobals(); });

describe("configuration", () => {
  it.skipIf(process.platform === "win32")("restricts existing storage before replacing a token", async () => {
    config.saveConfig({ api_url: "https://test.example", token: "old-token" });
    const fs = await vi.importActual<typeof import("node:fs")>("node:fs");
    fs.chmodSync(join(state.directory, ".hedgelayer"), 0o755);
    fs.chmodSync(config.configPath(), 0o644);
    vi.mocked(chmodSync).mockImplementation((path, mode) => {
      expect(readFileSync(config.configPath(), "utf8")).toContain("old-token");
      fs.chmodSync(path, mode);
    });
    config.saveConfig({ api_url: "https://test.example", token: "new-token" });
    expect(statSync(join(state.directory, ".hedgelayer")).mode & 0o777).toBe(0o700);
    expect(statSync(config.configPath()).mode & 0o777).toBe(0o600);
    expect(config.loadConfig().token).toBe("new-token");
  });

  it.skipIf(process.platform === "win32").each([1, 2])("leaves credentials intact when permission change %s fails", (failure) => {
    config.saveConfig({ api_url: "https://test.example", token: "old-token" });
    if (failure === 2) vi.mocked(chmodSync).mockImplementationOnce(() => {});
    vi.mocked(chmodSync).mockImplementationOnce(() => { throw new Error("Permission denied"); });
    expect(() => config.saveConfig({ api_url: "https://test.example", token: "new-token" })).toThrow("Permission denied");
    expect(config.loadConfig().token).toBe("old-token");
  });

  it("uses inherited Windows ACLs", () => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    vi.mocked(chmodSync).mockImplementation(() => { throw new Error("No POSIX permissions"); });
    expect(() => config.saveConfig({ api_url: "https://test.example", token: "test-token" })).not.toThrow();
    expect(config.loadConfig().token).toBe("test-token");
  });

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
