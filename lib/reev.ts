/**
 * Server-side Reev Partner API client.
 *
 * All functions in this module run on the server only (used by Server Components
 * and Route Handlers). Credentials and tokens never reach the browser.
 *
 * Authentication uses the OAuth2 client credentials flow against Reev's
 * Keycloak instance. Tokens are cached in memory and refreshed automatically.
 */

// ---------------------------------------------------------------------------
// Environment validation (fail-fast on missing config)
// ---------------------------------------------------------------------------

const REEV_API_URL = process.env.REEV_API_URL;
const REEV_AUTH_URL = process.env.REEV_AUTH_URL;
const REEV_CLIENT_ID = process.env.REEV_CLIENT_ID;
const REEV_CLIENT_SECRET = process.env.REEV_CLIENT_SECRET;
const API_VERSION = process.env.REEV_API_VERSION ?? "2024-08-01";

if (!REEV_API_URL) {
  throw new Error(
    "Missing required REEV_API_URL environment variable. " +
      "Set it in .env.local (see .env.example).",
  );
}

if (!REEV_AUTH_URL) {
  throw new Error(
    "Missing required REEV_AUTH_URL environment variable. " +
      "Set it in .env.local (see .env.example).",
  );
}

if (!REEV_CLIENT_ID) {
  throw new Error(
    "Missing required REEV_CLIENT_ID environment variable. " +
      "Set it in .env.local (see .env.example).",
  );
}

if (!REEV_CLIENT_SECRET) {
  throw new Error(
    "Missing required REEV_CLIENT_SECRET environment variable. " +
      "Set it in .env.local (see .env.example).",
  );
}

// Validate that the URL is well-formed and HTTPS in production
for (const [name, value] of [
  ["REEV_API_URL", REEV_API_URL],
  ["REEV_AUTH_URL", REEV_AUTH_URL],
] as const) {
  try {
    const parsed = new URL(value);
    if (
      process.env.NODE_ENV === "production" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error(
        `${name} must use HTTPS in production (got ${parsed.protocol})`,
      );
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`${name} is not a valid URL: "${value}"`);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGE_SIZE = 100;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1_000;

// Refresh the token 30s before it expires to avoid race conditions
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

// ---------------------------------------------------------------------------
// OAuth2 client credentials token management
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(REEV_AUTH_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: REEV_CLIENT_ID!,
      client_secret: REEV_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[reev] Token request failed: ${res.status} — ${body}`);
    throw new Error("Unable to authenticate with the charging API.");
  }

  const data: { access_token: string; expires_in: number } = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS;

  return cachedToken;
}

// ---------------------------------------------------------------------------
// Generic fetcher
// ---------------------------------------------------------------------------

async function reevFetch<T>(
  path: string,
  params?: Record<string, string | undefined>,
  options?: { revalidate?: number },
): Promise<T> {
  const token = await getAccessToken();

  // Ensure base URL ends with "/" so relative paths resolve correctly
  // (e.g., "http://host/api/mock" + "partner/x" → "http://host/api/mock/partner/x")
  const base = REEV_API_URL!.endsWith("/") ? REEV_API_URL! : REEV_API_URL! + "/";
  const url = new URL(path.replace(/^\//, ""), base);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }

  const revalidate = options?.revalidate ?? 60;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Api-Version": API_VERSION,
          "Content-Type": "application/json",
        },
        next: { revalidate },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        // If we get a 401, the token may have expired — clear cache and retry
        if (res.status === 401 && attempt < MAX_RETRIES) {
          cachedToken = null;
          tokenExpiresAt = 0;
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        const shouldRetry =
          attempt < MAX_RETRIES && res.status >= 500;

        console.error(
          `[reev] API error: ${res.status} ${res.statusText} — ${path}` +
            (shouldRetry ? ` (will retry)` : ""),
        );

        if (shouldRetry) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        throw new Error("Unable to load data from the charging API.");
      }

      return res.json();
    } catch (e) {
      // Re-throw our own intentional errors (non-retryable API errors)
      if (e instanceof Error && e.message.startsWith("Unable to load")) {
        throw e;
      }

      lastError = e instanceof Error ? e : new Error(String(e));

      // Don't retry on abort/timeout
      if (
        lastError.name === "AbortError" ||
        lastError.name === "TimeoutError"
      ) {
        console.error(`[reev] Request timed out after ${FETCH_TIMEOUT_MS}ms — ${path}`);
        throw new Error("The charging API is taking too long to respond. Please try again.");
      }

      if (attempt < MAX_RETRIES) {
        console.error(`[reev] Network error on ${path}, retrying...`, lastError.message);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
    }
  }

  console.error("[reev] All retries exhausted", lastError?.message);
  throw new Error("Unable to connect to the charging API. Please try again later.");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampPageSize(pageSize: number | undefined, defaultSize: number): string {
  return String(Math.min(Math.max(1, pageSize ?? defaultSize), MAX_PAGE_SIZE));
}

function clampPage(page: number | undefined): string {
  return String(Math.max(1, page ?? 1));
}

// ---------------------------------------------------------------------------
// Shared types (derived from the OpenAPI spec)
// ---------------------------------------------------------------------------

export interface PageResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

export interface Customer {
  id: string;
  name: string;
}

export interface Connector {
  id: string;
  connectorIdentifier: number;
  evseId?: string;
  status:
    | "AVAILABLE"
    | "OCCUPIED_CHARGING"
    | "OCCUPIED_IDLE"
    | "FAULTED"
    | "UNAVAILABLE"
    | "RESERVED"
    | "OFFLINE";
}

export interface Location {
  id?: string;
  name?: string;
  street?: string;
  city?: string;
  country?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
}

export interface ChargingStation {
  id: string;
  customerId: string;
  customerName: string;
  chargeBoxIdentifier: string;
  displayName: string;
  serialNumber?: string;
  model?: string;
  chargeBoxSerialNumber?: string;
  vendor?: string;
  firmwareVersion?: string;
  iccid?: string;
  connectors: Connector[];
  location: Location;
  isOnline: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ChargingCardRef {
  id: string;
  name?: string;
  label?: string;
  tagUid?: string;
  type?: "BUSINESS" | "PRIVATE";
}

export interface ChargingSession {
  id: string;
  customerId: string;
  customerName: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  startValue: number;
  endValue?: number;
  totalKwh?: number;
  pricePerKwh?: number;
  totalPrice?: number;
  totalKwhPrice?: number;
  totalParkingFeePrice?: number;
  chargingDurationInSeconds: number;
  parkingDurationInSeconds: number;
  pluggedDurationInSeconds: number;
  useCase?: "CHARGE_AT_WORK" | "INTERNAL_BILLING" | "ROAMING" | "AD_HOC";
  connectorId: string;
  evseId?: string;
  chargingCard: ChargingCardRef;
  user?: string;
  userType?: "USER" | "USER_WITHOUT_EMAIL";
  consumerType?: string;
  isStartedRemoteFree: boolean;
  signedMeterValues: boolean;
  currentLoad?: number;
  currentConsumption?: number;
}

export interface UserGroupRef {
  id: string;
  name: string;
  useCase: "CHARGE_AT_WORK" | "INTERNAL_BILLING" | "ROAMING" | "AD_HOC";
}

export interface ChargingCard {
  id: string;
  customerId: string;
  customerName: string;
  tagUid: string;
  active: boolean;
  label?: string;
  lastUsedAt?: string;
  source?: "USER_INSERTED" | "DRIVER_INSERTED" | "SCANNED";
  userGroups: UserGroupRef[];
  userInfo: {
    id?: string;
    costCentre?: string;
    type?: "USER" | "USER_WITHOUT_EMAIL";
  };
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

export async function getCustomers(page = 1, pageSize = 100) {
  return reevFetch<PageResponse<Customer>>("/partner/customers", {
    page: clampPage(page),
    pageSize: clampPageSize(pageSize, 100),
  });
}

export async function getChargingStations(
  params: {
    page?: number;
    pageSize?: number;
    customerId?: string;
    locationId?: string;
  } = {},
) {
  return reevFetch<PageResponse<ChargingStation>>(
    "/partner/charging-stations",
    {
      page: clampPage(params.page),
      pageSize: clampPageSize(params.pageSize, 50),
      customerId: params.customerId,
      locationId: params.locationId,
    },
    { revalidate: 15 }, // Station status needs fresher data
  );
}

export async function getChargingSessions(
  params: {
    page?: number;
    pageSize?: number;
    dateFrom?: string;
    dateTo?: string;
    useCase?: string;
    chargingStationId?: string;
    chargingCardId?: string;
    customerId?: string;
    onlyFinishedChargingSessions?: boolean;
  } = {},
) {
  return reevFetch<PageResponse<ChargingSession>>(
    "/partner/charging-sessions",
    {
      page: clampPage(params.page),
      pageSize: clampPageSize(params.pageSize, 50),
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      useCase: params.useCase,
      chargingStationId: params.chargingStationId,
      chargingCardId: params.chargingCardId,
      customerId: params.customerId,
      onlyFinishedChargingSessions:
        params.onlyFinishedChargingSessions !== undefined
          ? String(params.onlyFinishedChargingSessions)
          : undefined,
    },
    { revalidate: 60 },
  );
}

export async function getChargingCards(
  params: {
    page?: number;
    pageSize?: number;
    customerId?: string;
  } = {},
) {
  return reevFetch<PageResponse<ChargingCard>>("/partner/charging-cards", {
    page: clampPage(params.page),
    pageSize: clampPageSize(params.pageSize, 50),
    customerId: params.customerId,
  });
}
