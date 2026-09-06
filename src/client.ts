import { loadConfig, DEFAULT_API_URL } from "./config.js";
import type { GlobalOptions, ToolCatalog, ToolResult } from "./types.js";

export function validateApiUrl(value: string): string {
  const url = new URL(value);
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]"
    || /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("API URL must use HTTPS (HTTP is allowed for loopback development servers).");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("API URL must be an origin, for example https://hedgelayer.ai.");
  }
  return url.origin;
}

export class ApiClient {
  readonly apiUrl: string;
  private readonly token: string | null;
  private readonly verbose: boolean;

  constructor(opts: GlobalOptions = {}) {
    const config = loadConfig();
    this.apiUrl = validateApiUrl(opts.apiUrl ?? process.env.HL_API_URL ?? config.api_url ?? DEFAULT_API_URL);
    this.token = opts.token ?? process.env.HL_TOKEN ?? config.token;
    this.verbose = opts.verbose ?? false;
  }

  get isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  async listTools(): Promise<ToolCatalog> {
    const result = await this.request<ToolCatalog>("GET", "/api/v1/tools");
    if (!Array.isArray(result?.tools)) throw new Error("API returned an invalid tool catalog.");
    return result;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error("Tool names may contain only letters, numbers, underscores, and hyphens.");
    }
    const result = await this.request<ToolResult>("POST", `/api/v1/tools/${name}`, { arguments: args });
    if (!Array.isArray(result?.content) || (result.isError !== undefined && typeof result.isError !== "boolean")) {
      throw new Error("API returned an invalid tool result.");
    }
    return result;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const url = `${this.apiUrl}${path}`;
    if (this.verbose) process.stderr.write(`${method} ${url}\n`);

    // Never retry a tool call: it may submit or cancel an order.
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(65_000),
    });
    if (this.verbose) process.stderr.write(`HTTP ${response.status}\n`);
    const text = await response.text();
    if (!response.ok) throw new ApiError(response.status, text);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`API returned invalid JSON (HTTP ${response.status}).`);
    }
  }
}

export class ApiError extends Error {
  constructor(readonly status: number, body: string) {
    let message = body || "Request failed";
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.error === "string") message = parsed.error;
      else if (typeof parsed?.error?.message === "string") message = parsed.error.message;
      else if (typeof parsed?.message === "string") message = parsed.message;
    } catch {
      // Keep the response text for non-JSON errors.
    }
    super(`API error ${status}: ${message}`);
    this.name = "ApiError";
  }
}
