import { describe, it, expect } from "vitest";
import type { ChargingStation } from "@/lib/reev";

// Import the pure helper functions by re-declaring them here.
// They are module-private in station-grid.tsx, so we test the logic directly.

function groupByLocation(stations: ChargingStation[]) {
  const map = new Map<
    string,
    { locationId: string; name: string; city: string; connectors: ChargingStation["connectors"] }
  >();

  for (const station of stations) {
    const locId = station.location.id ?? "unknown";
    let group = map.get(locId);
    if (!group) {
      group = {
        locationId: locId,
        name: station.location.name ?? station.displayName,
        city: station.location.city ?? "",
        connectors: [],
      };
      map.set(locId, group);
    }
    group.connectors.push(...station.connectors);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.connectors.length - a.connectors.length,
  );
}

function getSpans(count: number): { colSpan: number; rowSpan: number } {
  if (count >= 10) return { colSpan: 2, rowSpan: 2 };
  if (count >= 7) return { colSpan: 2, rowSpan: 1 };
  if (count >= 4) return { colSpan: 1, rowSpan: 2 };
  return { colSpan: 1, rowSpan: 1 };
}

function fingerprint(stations: ChargingStation[]): string {
  let s = "";
  for (const st of stations) {
    s += st.id;
    for (const c of st.connectors) s += c.status;
    s += "|";
  }
  return s;
}

function makeStation(
  overrides: Partial<ChargingStation> & { id: string },
): ChargingStation {
  return {
    customerId: "c1",
    customerName: "Customer",
    chargeBoxIdentifier: "cb1",
    displayName: overrides.displayName ?? `Station ${overrides.id}`,
    connectors: [],
    location: {},
    isOnline: true,
    isPublic: false,
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// groupByLocation
// ---------------------------------------------------------------------------

describe("groupByLocation", () => {
  it("groups stations by location.id", () => {
    const stations = [
      makeStation({ id: "s1", location: { id: "loc-a", name: "A", city: "Munich" }, connectors: [{ id: "c1", connectorIdentifier: 1, status: "AVAILABLE" }] }),
      makeStation({ id: "s2", location: { id: "loc-a", name: "A", city: "Munich" }, connectors: [{ id: "c2", connectorIdentifier: 1, status: "FAULTED" }] }),
      makeStation({ id: "s3", location: { id: "loc-b", name: "B", city: "Berlin" }, connectors: [{ id: "c3", connectorIdentifier: 1, status: "AVAILABLE" }] }),
    ];

    const groups = groupByLocation(stations);

    expect(groups).toHaveLength(2);
    const locA = groups.find((g) => g.locationId === "loc-a")!;
    expect(locA.connectors).toHaveLength(2);
    expect(locA.name).toBe("A");
  });

  it('uses "unknown" for missing location.id', () => {
    const stations = [
      makeStation({ id: "s1", location: {}, connectors: [{ id: "c1", connectorIdentifier: 1, status: "AVAILABLE" }] }),
    ];

    const groups = groupByLocation(stations);
    expect(groups[0].locationId).toBe("unknown");
  });

  it("sorts by connector count descending", () => {
    const stations = [
      makeStation({ id: "s1", location: { id: "small" }, connectors: [{ id: "c1", connectorIdentifier: 1, status: "AVAILABLE" }] }),
      makeStation({ id: "s2", location: { id: "big" }, connectors: [{ id: "c2", connectorIdentifier: 1, status: "AVAILABLE" }, { id: "c3", connectorIdentifier: 2, status: "FAULTED" }, { id: "c4", connectorIdentifier: 3, status: "OFFLINE" }] }),
    ];

    const groups = groupByLocation(stations);
    expect(groups[0].locationId).toBe("big");
    expect(groups[1].locationId).toBe("small");
  });

  it("uses displayName when location.name is missing", () => {
    const stations = [
      makeStation({ id: "s1", displayName: "My Station", location: { id: "loc" }, connectors: [] }),
    ];

    const groups = groupByLocation(stations);
    expect(groups[0].name).toBe("My Station");
  });
});

// ---------------------------------------------------------------------------
// getSpans
// ---------------------------------------------------------------------------

describe("getSpans", () => {
  it.each([
    [1, { colSpan: 1, rowSpan: 1 }],
    [3, { colSpan: 1, rowSpan: 1 }],
    [4, { colSpan: 1, rowSpan: 2 }],
    [6, { colSpan: 1, rowSpan: 2 }],
    [7, { colSpan: 2, rowSpan: 1 }],
    [9, { colSpan: 2, rowSpan: 1 }],
    [10, { colSpan: 2, rowSpan: 2 }],
    [20, { colSpan: 2, rowSpan: 2 }],
  ])("returns correct spans for count=%i", (count, expected) => {
    expect(getSpans(count)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// fingerprint
// ---------------------------------------------------------------------------

describe("fingerprint", () => {
  it("produces identical output for identical input", () => {
    const stations = [
      makeStation({ id: "s1", connectors: [{ id: "c1", connectorIdentifier: 1, status: "AVAILABLE" }] }),
    ];
    expect(fingerprint(stations)).toBe(fingerprint(stations));
  });

  it("produces different output when a status changes", () => {
    const a = [makeStation({ id: "s1", connectors: [{ id: "c1", connectorIdentifier: 1, status: "AVAILABLE" }] })];
    const b = [makeStation({ id: "s1", connectors: [{ id: "c1", connectorIdentifier: 1, status: "FAULTED" }] })];
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it("produces different output when station count changes", () => {
    const a = [makeStation({ id: "s1", connectors: [] })];
    const b = [makeStation({ id: "s1", connectors: [] }), makeStation({ id: "s2", connectors: [] })];
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });
});
