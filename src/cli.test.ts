import { execFile, spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

interface RecordedRequest { method?: string; url?: string; authorization?: string; body: string }
const requests: RecordedRequest[] = [];
let respond: (request: IncomingMessage, response: ServerResponse) => void;
const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk.toString();
  requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
  respond(request, response);
});
let apiUrl: string;
let directory: string;
const catalog = { tools: [{ name: "search_markets", description: "Search markets", inputSchema: { type: "object" }, requiredScope: "read" }] };

beforeAll(async () => {
  await promisify(execFile)("npm", ["run", "build"]);
  directory = await mkdtemp(join(tmpdir(), "hl-cli-test-"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server failed to start");
  apiUrl = `http://127.0.0.1:${address.port}`;
}, 30_000);

beforeEach(() => {
  requests.length = 0;
  respond = (_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(catalog));
  };
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
});

function run(args: string[], stdin = ""): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/index.mjs", "--api-url", apiUrl, "--token", "test-token", ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => stdout += chunk);
    child.stderr.on("data", (chunk) => stderr += chunk);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

describe("built CLI against the HTTP API", () => {
  it("lists the server catalog and can inspect a single schema", async () => {
    const result = await run(["tools"]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(catalog);
    expect(result.stderr).toBe("");
    expect(requests[0]).toMatchObject({ method: "GET", url: "/api/v1/tools", authorization: "Bearer test-token" });
    expect(JSON.parse((await run(["tools", "search_markets"])).stdout)).toEqual(catalog.tools[0]);
    expect((await run(["tools", "missing_tool"])).code).toBe(1);
  });

  it.each(["--args", "--file", "--stdin"])("forwards exact arguments using %s", async (source) => {
    const result = { content: [{ type: "text", text: "Submitted" }], structuredContent: { orderID: "1" } };
    respond = (_request, response) => response.end(JSON.stringify(result));
    const args = { signed_body: '{ "order": {"signature":"signed-value"} }', auth: { signature: "signature-value" } };
    const input = JSON.stringify(args);
    const file = join(directory, "order.json");
    await writeFile(file, input);
    const options = source === "--stdin" ? [source] : [source, source === "--file" ? file : input];
    const output = await run(["call", "submit_polymarket_order", ...options], source === "--stdin" ? input : "");
    expect(output.code).toBe(0);
    expect(JSON.parse(output.stdout)).toEqual(result);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", url: "/api/v1/tools/submit_polymarket_order" });
    expect(JSON.parse(requests[0].body)).toEqual({ arguments: args });
  });

  it("uses an empty arguments object when none is supplied", async () => {
    respond = (_request, response) => response.end('{"content":[]}');
    expect((await run(["call", "list_polymarket_markets"])).code).toBe(0);
    expect(JSON.parse(requests[0].body)).toEqual({ arguments: {} });
  });

  it.each([
    ["--args", "[]"], ["--args", "null"], ["--args", "1"], ["--args", "{"],
    ["--args", "{}", "--stdin"], ["--args", "{}", "--file", "missing.json"],
  ])("rejects invalid or ambiguous arguments before requesting the API: %j", async (...options) => {
    const output = await run(["call", "search_markets", ...options]);
    expect(output.code).toBe(1);
    expect(output.stdout).toBe("");
    expect(JSON.parse(output.stderr).error).toBeTypeOf("string");
    expect(requests).toHaveLength(0);
  });

  it("returns nonzero for tool errors while preserving their JSON output", async () => {
    const result = { content: [{ type: "text", text: "Order rejected" }], isError: true };
    respond = (_request, response) => response.end(JSON.stringify(result));
    const output = await run(["call", "submit_polymarket_order"]);
    expect(output.code).toBe(1);
    expect(JSON.parse(output.stdout)).toEqual(result);
    expect(output.stderr).toBe("");
    expect(requests).toHaveLength(1);
  });

  it("fails HTTP errors without retrying or mixing diagnostics into stdout", async () => {
    respond = (_request, response) => { response.statusCode = 403; response.end('{"error":"Missing trade scope"}'); };
    const output = await run(["call", "submit_polymarket_order"]);
    expect(output.code).toBe(1);
    expect(output.stdout).toBe("");
    expect(JSON.parse(output.stderr).error).toContain("Missing trade scope");
    expect(requests).toHaveLength(1);
  });

  it("refuses redirects instead of forwarding credentials", async () => {
    respond = (_request, response) => { response.writeHead(307, { Location: `${apiUrl}/redirected` }); response.end(); };
    const output = await run(["call", "submit_polymarket_order"]);
    expect(output.code).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it("validates auth against the same catalog without exposing the token", async () => {
    const output = await run(["auth", "status"]);
    expect(output.code).toBe(0);
    expect(JSON.parse(output.stdout)).toEqual({ authenticated: true, api_url: apiUrl });
    expect(output.stdout + output.stderr).not.toContain("test-token");
    expect(requests[0].url).toBe("/api/v1/tools");
  });

  it("removes research workflows from help", async () => {
    const output = await run(["--help"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("tools [name]");
    expect(output.stdout).not.toMatch(/research|brief|signal|profile|ensemble/);
  });
});
