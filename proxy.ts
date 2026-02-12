import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// PIN lock (set GRID_PIN in .env.local to enable)
// ---------------------------------------------------------------------------

const GRID_PIN = process.env.GRID_PIN;
const PIN_ENABLED = Boolean(GRID_PIN);

// Web Crypto API hash (Edge Runtime compatible)
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let pinHashCache: string | null = null;

async function getPinHash(): Promise<string> {
  if (!pinHashCache) {
    pinHashCache = await sha256(GRID_PIN!);
  }
  return pinHashCache;
}

// Edge-compatible constant-time comparison for hex strings
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter
// Limits each IP to MAX_REQUESTS per WINDOW_MS.
// ---------------------------------------------------------------------------

const MAX_REQUESTS = 60;
const WINDOW_MS = 60_000;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_REQUESTS;
}

// Periodic cleanup — guarded to run only once
let cleanupStarted = false;

function ensureCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requestCounts) {
      if (now > entry.resetAt) requestCounts.delete(ip);
    }
  }, WINDOW_MS);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  ensureCleanup();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limiting
  if (isRateLimited(ip)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  // PIN auth (skip if not configured)
  if (PIN_ENABLED) {
    // Always allow the PIN API route through
    if (request.nextUrl.pathname.startsWith("/api/auth/pin")) {
      return NextResponse.next();
    }

    const cookie = request.cookies.get("grid-session")?.value;
    const expected = await getPinHash();

    if (!cookie || !constantTimeEqual(cookie, expected)) {
      // Rewrite to show lock screen (handled by page.tsx)
      const url = request.nextUrl.clone();
      url.searchParams.set("locked", "1");
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals, static files
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
