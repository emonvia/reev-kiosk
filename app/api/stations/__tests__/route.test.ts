import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetChargingStations = vi.fn();

vi.mock("@/lib/reev", () => ({
  getChargingStations: mockGetChargingStations,
}));

describe("GET /api/stations", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetChargingStations.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns station data on success (single page)", async () => {
    const fakeStations = [
      { id: "s1", displayName: "Station 1", connectors: [], location: {} },
    ];
    mockGetChargingStations.mockResolvedValue({
      data: fakeStations,
      page: 1,
      pageSize: 100,
      totalPages: 1,
      totalCount: 1,
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(fakeStations);
    expect(mockGetChargingStations).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
    });
  });

  it("fetches all pages when totalPages > 1", async () => {
    const page1 = [{ id: "s1" }, { id: "s2" }];
    const page2 = [{ id: "s3" }];

    mockGetChargingStations
      .mockResolvedValueOnce({
        data: page1,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        totalCount: 3,
      })
      .mockResolvedValueOnce({
        data: page2,
        page: 2,
        pageSize: 2,
        totalPages: 2,
        totalCount: 3,
      });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([...page1, ...page2]);
    expect(mockGetChargingStations).toHaveBeenCalledTimes(2);
    expect(mockGetChargingStations).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    expect(mockGetChargingStations).toHaveBeenCalledWith({ page: 2, pageSize: 100 });
  });

  it("returns 502 when upstream API fails", async () => {
    mockGetChargingStations.mockRejectedValue(new Error("API down"));

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch station data");
  });
});
