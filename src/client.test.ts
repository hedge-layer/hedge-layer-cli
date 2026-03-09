import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiError } from "./client.js";

vi.mock("./config.js", () => ({
  loadConfig: () => ({ api_url: "https://test.example.com", token: null }),
  DEFAULT_API_URL: "https://hedgelayer.ai",
}));

describe("ApiClient", () => {
  describe("constructor", () => {
    it("uses config values by default", () => {
      const client = new ApiClient();
      expect(client.apiUrl).toBe("https://test.example.com");
      expect(client.isAuthenticated).toBe(false);
    });

    it("overrides with explicit options", () => {
      const client = new ApiClient({
        apiUrl: "https://custom.api",
        token: "hl_test123",
      });
      expect(client.apiUrl).toBe("https://custom.api");
      expect(client.isAuthenticated).toBe(true);
    });

    it("strips trailing slash from URL", () => {
      const client = new ApiClient({ apiUrl: "https://example.com/" });
      expect(client.apiUrl).toBe("https://example.com");
    });
  });

  describe("get", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it("makes a GET request and returns parsed JSON", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ data: "ok" }), { status: 200 }),
      );

      const client = new ApiClient({ apiUrl: "https://api.test" });
      const result = await client.get<{ data: string }>("/endpoint");
      expect(result).toEqual({ data: "ok" });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/endpoint");
    });

    it("appends query parameters", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const client = new ApiClient({ apiUrl: "https://api.test" });
      await client.get("/search", { q: "flood", limit: "10" });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("q=flood");
      expect(calledUrl).toContain("limit=10");
    });

    it("throws ApiError on non-ok response", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );

      const client = new ApiClient({ apiUrl: "https://api.test" });
      await expect(client.get("/missing")).rejects.toThrow("API error 404: Not found");
    });

    it("includes auth header when token is set", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const client = new ApiClient({
        apiUrl: "https://api.test",
        token: "hl_mytoken",
      });
      await client.get("/authed");

      const opts = fetchSpy.mock.calls[0][1] as RequestInit;
      const headers = opts.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer hl_mytoken");
    });
  });

  describe("post", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it("makes a POST request with JSON body", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: "abc" }), { status: 200 }),
      );

      const client = new ApiClient({ apiUrl: "https://api.test" });
      const result = await client.post<{ id: string }>("/create", {
        name: "test",
      });
      expect(result).toEqual({ id: "abc" });

      const opts = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(opts.method).toBe("POST");
      expect(opts.body).toBe(JSON.stringify({ name: "test" }));
    });
  });

  describe("delete", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it("makes a DELETE request", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));

      const client = new ApiClient({ apiUrl: "https://api.test" });
      await client.delete("/resource/123");

      const opts = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(opts.method).toBe("DELETE");
    });
  });
});

describe("ApiError", () => {
  it("parses JSON error body", () => {
    const err = new ApiError(400, JSON.stringify({ error: "Bad request" }));
    expect(err.message).toBe("API error 400: Bad request");
    expect(err.status).toBe(400);
  });

  it("falls back to raw body for non-JSON", () => {
    const err = new ApiError(500, "Internal Server Error");
    expect(err.message).toBe("API error 500: Internal Server Error");
  });

  it("uses message field if error field is absent", () => {
    const err = new ApiError(422, JSON.stringify({ message: "Validation failed" }));
    expect(err.message).toBe("API error 422: Validation failed");
  });
});
