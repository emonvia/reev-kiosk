import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/auth/pin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, GRID_PIN: "1234" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function makeRequest(body: unknown, ip = "127.0.0.1"): NextRequest {
    return new NextRequest("http://localhost:3000/api/auth/pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: body !== null ? JSON.stringify(body) : null,
    });
  }

  it("returns 200 and sets cookie for correct PIN", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ pin: "1234" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });

    const cookie = res.cookies.get("grid-session");
    expect(cookie).toBeDefined();
    expect(cookie!.value).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns 401 for wrong PIN", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ pin: "0000" }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid PIN");
  });

  it("returns 401 for non-numeric PIN", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ pin: "abcd" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 for too-long PIN", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ pin: "123456789" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed JSON body", async () => {
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 401 for missing pin field", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ notPin: "1234" }));

    expect(res.status).toBe(401);
  });

  it("returns 403 when GRID_PIN is not configured", async () => {
    delete process.env.GRID_PIN;
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ pin: "1234" }));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Authentication unavailable");
  });

  it("returns 429 after 5 failed attempts from same IP", async () => {
    const { POST } = await import("../route");
    const ip = "10.0.0.1";

    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ pin: "0000" }, ip));
      expect(res.status).toBe(401);
    }

    const lockedRes = await POST(makeRequest({ pin: "1234" }, ip));
    expect(lockedRes.status).toBe(429);
    const json = await lockedRes.json();
    expect(json.error).toContain("Too many failed attempts");
  });

  it("does not lock out a different IP", async () => {
    const { POST } = await import("../route");

    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ pin: "0000" }, "10.0.0.1"));
    }

    const res = await POST(makeRequest({ pin: "1234" }, "10.0.0.2"));
    expect(res.status).toBe(200);
  });
});
