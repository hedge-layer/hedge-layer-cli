import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, validateApiUrl } from "./client.js";

vi.mock("./config.js", () => ({
  loadConfig: () => ({ api_url: "https://saved.example", token: "saved-token" }),
  DEFAULT_API_URL: "https://hedgelayer.ai",
}));

beforeEach(() => {
  vi.stubEnv("HL_API_URL", undefined);
  vi.stubEnv("HL_TOKEN", undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("API origin", () => {
  it.each(["https://example.com", "http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])(
    "allows %s", (url) => expect(validateApiUrl(`${url}/`)).toBe(url),
  );

  it.each([
    "http://example.com", "http://localhost.example.com", "ftp://localhost", "https://user:pass@example.com",
    "https://example.com/mcp", "https://example.com/?token=secret", "https://example.com/#fragment",
  ])("rejects %s", (url) => expect(() => validateApiUrl(url)).toThrow());
});

describe("ApiClient", () => {
  it("uses flags before environment before saved configuration", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ tools: [] }));
    await new ApiClient().listTools();
    expect(fetch).toHaveBeenLastCalledWith("https://saved.example/api/v1/tools", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer saved-token" }),
    }));
    vi.stubEnv("HL_API_URL", "https://environment.example");
    vi.stubEnv("HL_TOKEN", "environment-token");
    await new ApiClient().listTools();
    expect(fetch).toHaveBeenLastCalledWith("https://environment.example/api/v1/tools", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer environment-token" }),
    }));
    await new ApiClient({ apiUrl: "https://flag.example", token: "flag-token" }).listTools();
    expect(fetch).toHaveBeenLastCalledWith("https://flag.example/api/v1/tools", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer flag-token" }),
    }));
  });

  it("preserves signed payload bytes inside the arguments envelope and returns the whole MCP result", async () => {
    const result = { content: [], structuredContent: { orderID: "order-1" }, isError: false };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result));
    const signedBody = '{ "order": { "signature": "signed-value" }, "orderType": "GTC" }';
    const args = { signed_body: signedBody, auth: { signature: "header-signature" } };
    expect(await new ApiClient().callTool("submit_polymarket_order", args)).toEqual(result);
    const [, request] = fetch.mock.calls[0];
    expect(JSON.parse(request!.body as string)).toEqual({ arguments: args });
    expect(request).toMatchObject({ method: "POST", redirect: "error" });
    expect(request!.signal).toBeInstanceOf(AbortSignal);
  });

  it.each(["../api/tokens", "..", "name?x=1", "name/other"])("rejects unsafe tool path %s", async (name) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(new ApiClient().callTool(name, {})).rejects.toThrow("Tool names");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not retry ambiguous execution network failures or log credentials", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const client = new ApiClient({ verbose: true, token: "private-token" });
    await expect(client.callTool("submit_polymarket_order", { signed_body: "private-order" })).rejects.toThrow("fetch failed");
    expect(fetch).toHaveBeenCalledOnce();
    expect(stderr.mock.calls.map(([line]) => line).join("")).toBe("POST https://saved.example/api/v1/tools/submit_polymarket_order\n");
  });

  it("surfaces HTTP errors without retrying", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Missing trade scope" }, { status: 403 }));
    await expect(new ApiClient().callTool("submit_polymarket_order", {})).rejects.toThrow("API error 403: Missing trade scope");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reports invalid JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>"));
    await expect(new ApiClient().listTools()).rejects.toThrow("API returned invalid JSON");
  });

  it("does not treat a malformed success response as a successful tool call", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({}));
    await expect(new ApiClient().callTool("submit_polymarket_order", {})).rejects.toThrow("invalid tool result");
    await expect(new ApiClient().listTools()).rejects.toThrow("invalid tool catalog");
  });
});

describe("ApiError", () => {
  it.each([
    ['{"error":"denied"}', "denied"],
    ['{"error":{"message":"denied"}}', "denied"],
    ['{"message":"denied"}', "denied"],
    ["upstream unavailable", "upstream unavailable"],
    ["", "Request failed"],
  ])("preserves useful failure information from %s", (body, expected) => {
    expect(new ApiError(403, body).message).toBe(`API error 403: ${expected}`);
  });
});
