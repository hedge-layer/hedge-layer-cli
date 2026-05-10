import type { GlobalOptions } from "./types.js";
import { loadConfig, DEFAULT_API_URL } from "./config.js";

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private verbose: boolean;

  constructor(opts: GlobalOptions = {}) {
    const config = loadConfig();
    this.baseUrl = (opts.apiUrl ?? config.api_url ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.token = opts.token ?? config.token ?? null;
    this.verbose = opts.verbose ?? false;
  }

  get isAuthenticated(): boolean {
    return this.token !== null;
  }

  get apiUrl(): string {
    return this.baseUrl;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      ...extra,
    };
    if (this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  private log(method: string, path: string, status?: number): void {
    if (!this.verbose) return;
    const statusStr = status ? ` → ${status}` : "";
    process.stderr.write(`[verbose] ${method} ${this.baseUrl}${path}${statusStr}\n`);
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }

    this.log("GET", `${url.pathname}${url.search}`);
    const res = await fetch(url.toString(), { headers: this.headers() });
    this.log("GET", `${url.pathname}${url.search}`, res.status);

    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body);
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    this.log("POST", path);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.log("POST", path, res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text);
    }
    return res.json() as Promise<T>;
  }

  /**
   * POST /api/brief with stream: false — returns the Market Brief JSON body
   * plus optional telemetry from response headers.
   */
  async postBriefSync(query: string): Promise<{
    brief: Record<string, unknown>;
    durationMs: number | null;
    stepsCompleted: number | null;
    toolsUsed: string[];
  }> {
    const path = "/api/brief";
    this.log("POST", path);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query, stream: false }),
    });
    this.log("POST", path, res.status);

    const text = await res.text();
    if (!res.ok) {
      throw new ApiError(res.status, text);
    }

    let brief: Record<string, unknown>;
    try {
      brief = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(res.status, text || "Invalid JSON from /api/brief");
    }

    const dur = res.headers.get("X-Duration-Ms");
    const steps = res.headers.get("X-Steps-Completed");
    const tools = res.headers.get("X-Tools-Used");

    return {
      brief,
      durationMs: dur != null ? Number(dur) : null,
      stepsCompleted: steps != null ? Number(steps) : null,
      toolsUsed: tools ? tools.split(",").filter(Boolean) : [],
    };
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    this.log("PATCH", path);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    this.log("PATCH", path, res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text);
    }
    return res.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    this.log("DELETE", path);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    this.log("DELETE", path, res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text);
    }
  }

  async stream(path: string, body: unknown): Promise<ReadableStream<Uint8Array>> {
    this.log("POST (stream)", path);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ Accept: "text/event-stream" }),
      body: JSON.stringify(body),
    });
    this.log("POST (stream)", path, res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text);
    }
    if (!res.body) {
      throw new ApiError(0, "No response body for stream");
    }
    return res.body;
  }

  async streamNdjson(path: string, body: unknown): Promise<ReadableStream<Uint8Array>> {
    this.log("POST (ndjson)", path);
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers({ Accept: "application/x-ndjson" }),
      body: JSON.stringify(body),
    });
    this.log("POST (ndjson)", path, res.status);

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text);
    }
    if (!res.body) {
      throw new ApiError(0, "No response body for stream");
    }
    return res.body;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    let msg: string;
    try {
      const parsed = JSON.parse(body);
      msg = parsed.error ?? parsed.message ?? body;
    } catch {
      msg = body;
    }
    super(`API error ${status}: ${msg}`);
    this.name = "ApiError";
  }
}
