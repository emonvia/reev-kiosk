import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/pin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, GRID_PIN: "1234" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isPinEnabled", () => {
    it("returns true when GRID_PIN is set", async () => {
      const { isPinEnabled } = await import("../pin");
      expect(isPinEnabled()).toBe(true);
    });

    it("returns false when GRID_PIN is not set", async () => {
      delete process.env.GRID_PIN;
      const { isPinEnabled } = await import("../pin");
      expect(isPinEnabled()).toBe(false);
    });
  });

  describe("getPinHash", () => {
    it("returns a 64-char hex string (SHA-256)", async () => {
      const { getPinHash } = await import("../pin");
      const hash = getPinHash();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns the same value on repeated calls (cached)", async () => {
      const { getPinHash } = await import("../pin");
      expect(getPinHash()).toBe(getPinHash());
    });
  });

  describe("verifyPin", () => {
    it("returns true for correct PIN", async () => {
      const { verifyPin } = await import("../pin");
      expect(verifyPin("1234")).toBe(true);
    });

    it("returns false for wrong PIN", async () => {
      const { verifyPin } = await import("../pin");
      expect(verifyPin("0000")).toBe(false);
    });

    it("returns false for empty string", async () => {
      const { verifyPin } = await import("../pin");
      expect(verifyPin("")).toBe(false);
    });

    it("returns false when PIN length differs", async () => {
      const { verifyPin } = await import("../pin");
      expect(verifyPin("12345")).toBe(false);
    });

    it("returns false when GRID_PIN is not set", async () => {
      delete process.env.GRID_PIN;
      const { verifyPin } = await import("../pin");
      expect(verifyPin("1234")).toBe(false);
    });
  });

  describe("verifySessionCookie", () => {
    it("returns true for valid cookie matching hash", async () => {
      const { verifySessionCookie, getPinHash } = await import("../pin");
      expect(verifySessionCookie(getPinHash())).toBe(true);
    });

    it("returns false for wrong cookie value", async () => {
      const { verifySessionCookie } = await import("../pin");
      expect(verifySessionCookie("wrong-hash")).toBe(false);
    });

    it("returns false for undefined cookie", async () => {
      const { verifySessionCookie } = await import("../pin");
      expect(verifySessionCookie(undefined)).toBe(false);
    });

    it("returns false for empty cookie", async () => {
      const { verifySessionCookie } = await import("../pin");
      expect(verifySessionCookie("")).toBe(false);
    });
  });
});
