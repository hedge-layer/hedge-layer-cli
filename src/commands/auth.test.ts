import { PassThrough, Writable } from "node:stream";
import readline from "node:readline/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as auth from "./auth.js";
import { createProgram } from "../program.js";

const mocks = vi.hoisted(() => ({ saveConfig: vi.fn() }));
vi.mock("../config.js", () => ({
  DEFAULT_API_URL: "https://hedgelayer.ai",
  loadConfig: () => ({ api_url: "https://hedgelayer.ai", token: null }),
  saveConfig: mocks.saveConfig,
  clearConfig: vi.fn(),
  configPath: () => "/test/config.json",
}));

beforeEach(() => {
  mocks.saveConfig.mockClear();
  vi.stubEnv("HL_TOKEN", undefined);
  vi.stubEnv("HL_API_URL", undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

type PromptHidden = (
  prompt: string,
  options: {
    input: PassThrough;
    output: Writable;
    createInterface: typeof readline.createInterface;
  },
) => Promise<string>;

describe("promptHidden", () => {
  it("returns the token without writing token characters to the terminal", async () => {
    const secret = `hl_${"a".repeat(40)}`;
    let terminalOutput = "";
    const output = new Writable({
      write(chunk, _encoding, callback) {
        terminalOutput += chunk.toString();
        callback();
      },
    });
    const close = vi.fn();
    const createInterface = vi.fn(({ output: promptOutput }) => ({
      question: async () => {
        promptOutput.write(secret);
        return `  ${secret}  `;
      },
      close,
    })) as unknown as typeof readline.createInterface;

    const promptHidden = (auth as unknown as { promptHidden?: PromptHidden }).promptHidden;
    expect(promptHidden).toBeTypeOf("function");

    const token = await promptHidden!("Paste your API token: ", {
      input: new PassThrough(),
      output,
      createInterface,
    });

    expect(token).toBe(secret);
    expect(terminalOutput).toBe("Paste your API token: \n");
    expect(terminalOutput).not.toContain(secret);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("auth login", () => {
  it("validates a supplied token using the catalog before saving it", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ tools: [] }));
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await createProgram("test").parseAsync([
      "--api-url", "https://custom.example", "--token", "test-secret", "auth", "login",
    ], { from: "user" });
    expect(fetch).toHaveBeenCalledWith("https://custom.example/api/v1/tools", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
    }));
    expect(mocks.saveConfig).toHaveBeenCalledWith({ api_url: "https://custom.example", token: "test-secret" });
    expect(stdout.mock.calls.map(([line]) => line).join("")).not.toContain("test-secret");
  });

  it("never saves a rejected token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 }));
    vi.stubEnv("HL_TOKEN", "invalid-token");
    await expect(createProgram("test").parseAsync(["auth", "login"], { from: "user" })).rejects.toThrow("Unauthorized");
    expect(mocks.saveConfig).not.toHaveBeenCalled();
  });
});
