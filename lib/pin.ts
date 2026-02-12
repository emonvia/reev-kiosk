import { createHash, timingSafeEqual } from "crypto";

const GRID_PIN = process.env.GRID_PIN;

let cachedHash: string | null = null;

export function getPinHash(): string {
  if (!cachedHash && GRID_PIN) {
    cachedHash = createHash("sha256").update(GRID_PIN).digest("hex");
  }
  return cachedHash ?? "";
}

export function verifyPin(input: string): boolean {
  if (!GRID_PIN) return false;
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(GRID_PIN, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifySessionCookie(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const expected = getPinHash();
  if (!expected) return false;
  const a = Buffer.from(cookie, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isPinEnabled(): boolean {
  return Boolean(GRID_PIN);
}
