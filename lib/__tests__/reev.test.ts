import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock env vars BEFORE importing the module, because reev.ts
// validates them at module load time.

const FAKE_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.fake-token";

/** Creates a fetch spy that responds to the token endpoint first, then API calls. */
function mockFetchWithToken(apiResponse: unknown) {
  let callCount = 0;
  return vi.fn().mockImplementation((url: string) => {
    callCount++;
    // First call is always the token request
    if (typeof url === "string" && url.includes("/auth")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: FAKE_TOKEN,
            token_type: "Bearer",
            expires_in: 300,
          }),
      });
    }
    // Subsequent calls are API requests
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    });
  });
}

describe("reev API client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      REEV_API_URL: "https://api.test.reev.com",
      REEV_CLIENT_ID: "test-client-id",
      REEV_CLIENT_SECRET: "test-client-secret",
      REEV_API_VERSION: "2024-08-01",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Environment validation
  // -------------------------------------------------------------------------

  describe("environment validation", () => {
    it("throws if REEV_API_URL is missing", async () => {
      delete process.env.REEV_API_URL;
      await expect(() => import("../reev")).rejects.toThrow(
        "Missing required REEV_API_URL",
      );
    });

    it("throws if REEV_CLIENT_ID is missing", async () => {
      delete process.env.REEV_CLIENT_ID;
      await expect(() => import("../reev")).rejects.toThrow(
        "Missing required REEV_CLIENT_ID",
      );
    });

    it("throws if REEV_CLIENT_SECRET is missing", async () => {
      delete process.env.REEV_CLIENT_SECRET;
      await expect(() => import("../reev")).rejects.toThrow(
        "Missing required REEV_CLIENT_SECRET",
      );
    });

    it("throws if REEV_API_URL is not a valid URL", async () => {
      process.env.REEV_API_URL = "not-a-url";
      await expect(() => import("../reev")).rejects.toThrow("not a valid URL");
    });
  });

  // -------------------------------------------------------------------------
  // API methods
  // -------------------------------------------------------------------------

  describe("getChargingStations", () => {
    it("calls the correct endpoint with default params", async () => {
      const mockResponse = {
        data: [],
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      };
      const fetchSpy = mockFetchWithToken(mockResponse);
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      const result = await getChargingStations();

      expect(result).toEqual(mockResponse);

      // Find the API call (not the token call)
      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      const calledUrl = new URL(apiCall[0]);
      expect(calledUrl.pathname).toBe("/charging-stations");
      expect(calledUrl.searchParams.get("page")).toBe("1");
      expect(calledUrl.searchParams.get("pageSize")).toBe("50");
    });

    it("passes customerId when provided", async () => {
      const fetchSpy = mockFetchWithToken({
        data: [],
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      await getChargingStations({ customerId: "cust-123" });

      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      const calledUrl = new URL(apiCall[0]);
      expect(calledUrl.searchParams.get("customerId")).toBe("cust-123");
    });

    it("clamps pageSize to max 100", async () => {
      const fetchSpy = mockFetchWithToken({
        data: [],
        page: 1,
        pageSize: 100,
        totalPages: 0,
        totalCount: 0,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      await getChargingStations({ pageSize: 500 });

      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      const calledUrl = new URL(apiCall[0]);
      expect(calledUrl.searchParams.get("pageSize")).toBe("100");
    });
  });

  describe("getChargingSessions", () => {
    it("passes date filters and useCase", async () => {
      const fetchSpy = mockFetchWithToken({
        data: [],
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingSessions } = await import("../reev");
      await getChargingSessions({
        dateFrom: "2024-01-01T00:00:00Z",
        dateTo: "2024-01-31T23:59:59Z",
        useCase: "ROAMING",
      });

      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      const calledUrl = new URL(apiCall[0]);
      expect(calledUrl.searchParams.get("dateFrom")).toBe(
        "2024-01-01T00:00:00Z",
      );
      expect(calledUrl.searchParams.get("dateTo")).toBe(
        "2024-01-31T23:59:59Z",
      );
      expect(calledUrl.searchParams.get("useCase")).toBe("ROAMING");
    });

    it("converts boolean onlyFinishedChargingSessions to string", async () => {
      const fetchSpy = mockFetchWithToken({
        data: [],
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingSessions } = await import("../reev");
      await getChargingSessions({ onlyFinishedChargingSessions: true });

      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      const calledUrl = new URL(apiCall[0]);
      expect(calledUrl.searchParams.get("onlyFinishedChargingSessions")).toBe(
        "true",
      );
    });
  });

  describe("error handling", () => {
    it("throws a generic user-facing message on API error (no internal paths)", async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: FAKE_TOKEN,
                expires_in: 300,
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        });
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      await expect(getChargingStations()).rejects.toThrow(
        "Unable to load data from the charging API.",
      );
    });

    it("retries on 500 errors", async () => {
      let apiCallCount = 0;
      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: FAKE_TOKEN,
                expires_in: 300,
              }),
          });
        }
        apiCallCount++;
        if (apiCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [],
              page: 1,
              pageSize: 50,
              totalPages: 0,
              totalCount: 0,
            }),
        });
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      const result = await getChargingStations();
      expect(result.data).toEqual([]);
      expect(apiCallCount).toBe(2);
    });

    it("sends Authorization header with Bearer token from OAuth2", async () => {
      const fetchSpy = mockFetchWithToken({
        data: [],
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      await getChargingStations();

      // Token request should use client credentials
      const tokenCall = fetchSpy.mock.calls.find((c: [string]) =>
        c[0].includes("/auth"),
      )!;
      expect(tokenCall[1].method).toBe("POST");
      expect(tokenCall[1].headers["Content-Type"]).toBe(
        "application/json",
      );

      // API request should use the returned Bearer token
      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      const headers = apiCall[1].headers;
      expect(headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
      expect(headers["Api-Version"]).toBe("2024-08-01");
    });

    it("throws when token request fails", async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/auth")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve("invalid_client"),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      await expect(getChargingStations()).rejects.toThrow(
        "Unable to authenticate with the charging API.",
      );
    });

    it("includes AbortSignal timeout in fetch options", async () => {
      const fetchSpy = mockFetchWithToken({
        data: [],
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { getChargingStations } = await import("../reev");
      await getChargingStations();

      const apiCall = fetchSpy.mock.calls.find(
        (c: [string]) => !c[0].includes("/auth"),
      )!;
      expect(apiCall[1].signal).toBeDefined();
    });
  });
});
