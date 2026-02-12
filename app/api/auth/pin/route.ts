import { NextRequest, NextResponse } from "next/server";
import { verifyPin, getPinHash, isPinEnabled } from "@/lib/pin";

// ---------------------------------------------------------------------------
// Brute-force protection (in-memory, per Node.js process)
// ---------------------------------------------------------------------------

const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60_000; // 5 minutes
const failures = new Map<string, { count: number; resetAt: number }>();

function isLocked(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now > entry.resetAt) {
    failures.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
  } else {
    entry.count++;
  }
}

function clearFailures(ip: string): void {
  failures.delete(ip);
}

// Cleanup expired entries periodically
let cleanupStarted = false;
function ensureCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of failures) {
      if (now > entry.resetAt) failures.delete(ip);
    }
  }, LOCKOUT_MS);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const PIN_REGEX = /^\d{4,8}$/;

export async function POST(request: NextRequest) {
  ensureCleanup();

  if (!isPinEnabled()) {
    return NextResponse.json(
      { error: "Authentication unavailable" },
      { status: 403 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isLocked(ip)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!PIN_REGEX.test(pin) || !verifyPin(pin)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  clearFailures(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("grid-session", getPinHash(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
