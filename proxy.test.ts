import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("proxy", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, GRID_PIN: "1234" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function makeRequest(
    path: string,
    options?: { ip?: string; cookie?: string },
  ): NextRequest {
    const url = `http://localhost:3000${path}`;
    const headers: Record<string, string> = {};
    if (options?.ip) headers["x-forwarded-for"] = options.ip;
    if (options?.cookie) headers["cookie"] = `grid-session=${options.cookie}`;

    return new NextRequest(url, { headers });
  }

  // -------------------------------------------------------------------------
  // PIN auth
  // -------------------------------------------------------------------------

  describe("PIN authentication", () => {
    it("allows /api/auth/pin through without cookie", async () => {
      const { proxy } = await import("./proxy");
      const res = await proxy(makeRequest("/api/auth/pin", { ip: "1.2.3.4" }));
      // NextResponse.next() returns a response without redirect/rewrite
      expect(res.status).toBe(200);
    });

    it("rewrites to ?locked=1 when cookie is missing", async () => {
      const { proxy } = await import("./proxy");
      const res = await proxy(makeRequest("/", { ip: "1.2.3.4" }));
      // A rewrite returns 200 but the URL is changed
      const url = new URL(res.headers.get("x-middleware-rewrite") ?? "");
      expect(url.searchParams.get("locked")).toBe("1");
    });

    it("rewrites when cookie is invalid", async () => {
      const { proxy } = await import("./proxy");
      const res = await proxy(
        makeRequest("/", { ip: "1.2.3.4", cookie: "wrong-value" }),
      );
      const rewrite = res.headers.get("x-middleware-rewrite");
      expect(rewrite).toBeTruthy();
      expect(new URL(rewrite!).searchParams.get("locked")).toBe("1");
    });

    it("passes through when cookie is valid", async () => {
      // Compute SHA-256 of "1234" to get the expected cookie
      const crypto = await import("crypto");
      const pinHash = crypto.createHash("sha256").update("1234").digest("hex");

      const { proxy } = await import("./proxy");
      const res = await proxy(
        makeRequest("/", { ip: "1.2.3.4", cookie: pinHash }),
      );
      // No rewrite header means it passed through
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    });
  });

  describe("PIN disabled", () => {
    it("passes through all requests when GRID_PIN is not set", async () => {
      delete process.env.GRID_PIN;
      const { proxy } = await import("./proxy");
      const res = await proxy(makeRequest("/", { ip: "1.2.3.4" }));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe("rate limiting", () => {
    it("returns 429 after exceeding request limit from same IP", async () => {
      delete process.env.GRID_PIN; // disable PIN to isolate rate limit testing
      const { proxy } = await import("./proxy");

      const ip = "10.0.0.99";
      let lastRes;
      for (let i = 0; i < 61; i++) {
        lastRes = await proxy(makeRequest("/", { ip }));
      }

      expect(lastRes!.status).toBe(429);
    });

    it("does not rate limit different IPs", async () => {
      delete process.env.GRID_PIN;
      const { proxy } = await import("./proxy");

      // Exhaust limit for one IP
      for (let i = 0; i < 61; i++) {
        await proxy(makeRequest("/", { ip: "10.0.0.1" }));
      }

      // Different IP should still work
      const res = await proxy(makeRequest("/", { ip: "10.0.0.2" }));
      expect(res.status).not.toBe(429);
    });
  });

  // -------------------------------------------------------------------------
  // constantTimeEqual (tested indirectly via cookie validation)
  // -------------------------------------------------------------------------

  describe("constant-time comparison (via cookie check)", () => {
    it("rejects empty cookie", async () => {
      const { proxy } = await import("./proxy");
      const res = await proxy(makeRequest("/", { ip: "1.2.3.4", cookie: "" }));
      expect(res.headers.get("x-middleware-rewrite")).toBeTruthy();
    });

    it("rejects cookie with different length", async () => {
      const { proxy } = await import("./proxy");
      const res = await proxy(
        makeRequest("/", { ip: "1.2.3.4", cookie: "short" }),
      );
      expect(res.headers.get("x-middleware-rewrite")).toBeTruthy();
    });
  });
});
