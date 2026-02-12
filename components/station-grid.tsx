"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import type { ChargingStation, Connector } from "@/lib/reev";
import { useTranslations, type Translations } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationGroup {
  locationId: string;
  name: string;
  city: string;
  connectors: Connector[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByLocation(stations: ChargingStation[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();
  for (const station of stations) {
    const locId = station.location.id;
    if (!locId) continue;
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

/** Lightweight fingerprint: only compares what drives rendering (id + connector statuses). */
function fingerprint(stations: ChargingStation[]): string {
  let s = "";
  for (const st of stations) {
    s += st.id;
    for (const c of st.connectors) s += c.status;
    s += "|";
  }
  return s;
}

function getSpans(count: number): { colSpan: number; rowSpan: number } {
  if (count >= 10) return { colSpan: 2, rowSpan: 2 };
  if (count >= 7) return { colSpan: 2, rowSpan: 1 };
  if (count >= 4) return { colSpan: 1, rowSpan: 2 };
  return { colSpan: 1, rowSpan: 1 };
}

const STATUS_COLORS_DARK: Record<string, string> = {
  AVAILABLE: "bg-reev-green",
  OCCUPIED_CHARGING: "bg-reev-blue animate-cell-glow",
  OCCUPIED_IDLE: "bg-reev-yellow",
  FAULTED: "bg-reev-red",
  UNAVAILABLE: "bg-reev-muted-dark",
  RESERVED: "bg-reev-blue-dark",
  OFFLINE: "bg-reev-muted-dark",
};

const STATUS_COLORS_LIGHT: Record<string, string> = {
  AVAILABLE: "bg-reev-green shadow-reev-green/25 shadow-md",
  OCCUPIED_CHARGING: "bg-reev-blue shadow-reev-blue/25 shadow-md animate-cell-glow",
  OCCUPIED_IDLE: "bg-reev-yellow shadow-reev-yellow/25 shadow-md",
  FAULTED: "bg-reev-red shadow-reev-red/25 shadow-md",
  UNAVAILABLE: "bg-reev-muted shadow-sm",
  RESERVED: "bg-reev-blue-dark shadow-reev-blue-dark/25 shadow-md",
  OFFLINE: "bg-reev-muted shadow-sm",
};

function getStatusLabels(t: Translations): Record<string, string> {
  return {
    AVAILABLE: t.free,
    OCCUPIED_CHARGING: t.chargingSession,
    OCCUPIED_IDLE: t.occupied,
    FAULTED: t.faulted,
    UNAVAILABLE: t.notAvailable,
    RESERVED: t.reserved,
    OFFLINE: t.offline,
  };
}

function getLegend(t: Translations) {
  return [
    { label: t.free, color: "bg-reev-green", status: "AVAILABLE" },
    { label: t.faulted, color: "bg-reev-red", status: "FAULTED" },
    { label: t.offline, color: "bg-reev-muted-dark", status: "OFFLINE" },
    { label: t.chargingSession, color: "bg-reev-blue", status: "OCCUPIED_CHARGING" },
    { label: t.occupied, color: "bg-reev-yellow", status: "OCCUPIED_IDLE" },
    { label: t.notAvailable, color: "bg-reev-muted-dark", status: "UNAVAILABLE" },
  ];
}

// ---------------------------------------------------------------------------
// Dev widget — synthetic location data for testing grid layout
// ---------------------------------------------------------------------------

const STATUSES: Connector["status"][] = [
  "AVAILABLE",
  "OCCUPIED_CHARGING",
  "OCCUPIED_IDLE",
  "FAULTED",
  "OFFLINE",
  "UNAVAILABLE",
];

const CITY_NAMES = [
  "Munich", "Berlin", "Hamburg", "Frankfurt", "Stuttgart",
  "Cologne", "Dusseldorf", "Leipzig", "Dresden", "Hannover",
  "Nuremberg", "Bremen", "Essen", "Dortmund", "Mannheim",
  "Karlsruhe", "Augsburg", "Bonn", "Aachen", "Freiburg",
];

function generateMockLocations(
  connectorCounts: number[],
): LocationGroup[] {
  return connectorCounts.map((count, i) => ({
    locationId: `mock-loc-${i}`,
    name: `${CITY_NAMES[i % CITY_NAMES.length]} Station ${i + 1}`,
    city: CITY_NAMES[i % CITY_NAMES.length],
    connectors: Array.from({ length: count }, (_, c) => ({
      id: `mock-conn-${i}-${c}`,
      connectorIdentifier: c + 1,
      status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    })),
  }));
}

// ---------------------------------------------------------------------------
// Station card (memoized to skip re-renders when unchanged)
// ---------------------------------------------------------------------------

const LocationCard = memo(function LocationCard({
  loc,
  dark,
  statusColors,
  statusLabels,
  freeLabel,
}: {
  loc: LocationGroup;
  dark: boolean;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
  freeLabel: string;
}) {
  const { colSpan, rowSpan } = getSpans(loc.connectors.length);
  const locAvailable = loc.connectors.filter(
    (c) => c.status === "AVAILABLE",
  ).length;
  const cols = Math.ceil(Math.sqrt(loc.connectors.length));
  const rows = Math.ceil(loc.connectors.length / cols);

  return (
    <div
      className={`backdrop-blur-xl backdrop-saturate-150 rounded-2xl p-4 flex flex-col gap-3 overflow-hidden min-h-0 border transition-colors ${
        dark
          ? "bg-white/[0.06] border-white/[0.08]"
          : "bg-white/70 border-[rgba(181,193,201,0.5)] shadow-lg shadow-black/[0.03]"
      }`}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
    >
      <div>
        <h3
          className={`text-sm font-medium truncate ${dark ? "text-white" : "text-gray-900"}`}
        >
          {loc.name}
        </h3>
        <p
          className={`text-xs mt-0.5 ${dark ? "text-white/40" : "text-gray-400"}`}
        >
          {loc.city}
          {loc.city && " \u00b7 "}
          {locAvailable}/{loc.connectors.length} {freeLabel}
        </p>
      </div>

      <div
        className="grid gap-2 flex-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {loc.connectors.map((conn) => (
          <div
            key={conn.id}
            className={`rounded-xl flex items-center justify-center overflow-hidden ${statusColors[conn.status] ?? (dark ? "bg-gray-700" : "bg-gray-300")}`}
            title={`${(conn.evseId ?? conn.id).toUpperCase()} \u2014 ${statusLabels[conn.status] ?? conn.status}`}
          >
            <span
              className={`text-[10px] font-semibold leading-none select-none px-1 ${
                dark ? "text-white/80" : "text-white"
              }`}
            >
              {((conn.evseId ?? conn.id).split("*").find((s) => s.startsWith("E")) ?? conn.id).slice(0, 5).toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StationGrid({
  initialStations,
}: {
  initialStations: ChargingStation[];
}) {
  const t = useTranslations();
  const [stations, setStations] = useState(initialStations);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(true);

  // Dev widget state
  const [devOpen, setDevOpen] = useState(false);
  const [devEnabled, setDevEnabled] = useState(false);
  const [devCounts, setDevCounts] = useState<number[]>([6, 6]);
  const [devSeed, setDevSeed] = useState(0);
  const [hiddenLocations, setHiddenLocations] = useState<Set<string>>(
    new Set(),
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChargingStation[] = await res.json();
      setStations((prev) => {
        if (fingerprint(prev) === fingerprint(data)) return prev;
        return data;
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const realLocations = useMemo(() => groupByLocation(stations), [stations]);
  const mockLocations = useMemo(
    () => generateMockLocations(devCounts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devCounts, devSeed],
  );
  const allLocations = devEnabled ? mockLocations : realLocations;
  const locations = useMemo(
    () => allLocations.filter((l) => !hiddenLocations.has(l.locationId)),
    [allLocations, hiddenLocations],
  );

  // Cap grid columns to the number of locations so e.g. 2 locations → 50/50
  const colCount = Math.min(locations.length, 4);

  const statusColors = dark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const statusLabels = useMemo(() => getStatusLabels(t), [t]);
  const legend = useMemo(() => getLegend(t), [t]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const loc of locations) {
      for (const c of loc.connectors) {
        result[c.status] = (result[c.status] ?? 0) + 1;
      }
    }
    return result;
  }, [locations]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors"
      style={{
        height: "100dvh",
        background: dark
          ? "radial-gradient(ellipse at 50% 40%, rgba(30,40,60,1) 0%, rgb(3,7,18) 70%)"
          : "linear-gradient(180deg, #f5f5f7 0%, #e8e8ed 100%)",
      }}
    >
      {/* Status bar */}
      <div
        className={`flex items-center justify-between px-6 py-3 backdrop-blur-xl backdrop-saturate-150 border-b transition-colors ${
          dark
            ? "bg-white/[0.04] border-white/[0.06]"
            : "bg-white/60 border-black/[0.04]"
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
          {legend.map((item, i) => (
            <span key={item.status} className="flex items-center gap-1.5 shrink-0">
              {i > 0 && (
                <span className={`mr-1 hidden sm:inline ${dark ? "text-white/20" : "text-gray-300"}`}>
                  &middot;
                </span>
              )}
              <span className={`h-2 w-2 rounded-full ${item.color}`} />
              <span
                className={`text-xs sm:text-sm font-light ${dark ? "text-white/70" : "text-gray-500"}`}
              >
                {item.label}
              </span>
              <span
                className={`text-xs sm:text-sm font-medium tabular-nums ${dark ? "text-white/90" : "text-gray-900"}`}
              >
                {counts[item.status] ?? 0}
              </span>
            </span>
          ))}
          {error && (
            <>
              <span className={dark ? "text-white/30" : "text-gray-300"}>
                &middot;
              </span>
              <span className="text-sm font-light text-red-500">{error}</span>
            </>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <span
            className={`text-sm font-light tabular-nums ${dark ? "text-white/50" : "text-gray-400"}`}
          >
            {lastRefresh.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <button
            onClick={() => setDark((d) => !d)}
            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs transition-colors ${
              dark
                ? "bg-white/10 text-white/60 hover:bg-white/20"
                : "bg-black/[0.05] text-gray-500 hover:bg-black/[0.08]"
            }`}
            aria-label={t.toggleTheme}
          >
            {dark ? "\u2600" : "\u263E"}
          </button>
        </div>
      </div>

      {/* Station filter */}
      {allLocations.length > 1 && (
        <div className="flex items-center gap-2 px-6 py-2 overflow-x-auto">
          <button
            onClick={() =>
              setHiddenLocations((prev) =>
                prev.size === 0
                  ? new Set(allLocations.map((l) => l.locationId))
                  : new Set(),
              )
            }
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              hiddenLocations.size === 0
                ? dark
                  ? "bg-white/10 border-white/20 text-white/80"
                  : "bg-black/[0.06] border-black/[0.04] text-gray-700"
                : dark
                  ? "bg-transparent border-white/10 text-white/40"
                  : "bg-transparent border-black/[0.06] text-gray-400"
            }`}
          >
            {t.all}
          </button>
          {allLocations.map((loc) => {
            const visible = !hiddenLocations.has(loc.locationId);
            return (
              <button
                key={loc.locationId}
                onClick={() =>
                  setHiddenLocations((prev) => {
                    const next = new Set(prev);
                    if (visible) next.add(loc.locationId);
                    else next.delete(loc.locationId);
                    return next;
                  })
                }
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  visible
                    ? dark
                      ? "bg-reev-green/15 border-reev-green/25 text-reev-green-light"
                      : "bg-reev-green/10 border-reev-green/20 text-reev-green-dark"
                    : dark
                      ? "bg-transparent border-white/10 text-white/30"
                      : "bg-transparent border-black/[0.06] text-gray-400"
                }`}
              >
                {loc.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid area */}
      <div className="flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-6">
        <div
          className="grid gap-4 h-full"
          style={{
            gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
            gridAutoRows: "1fr",
            gridAutoFlow: "dense",
          }}
        >
          {locations.map((loc) => (
            <LocationCard
              key={loc.locationId}
              loc={loc}
              dark={dark}
              statusColors={statusColors}
              statusLabels={statusLabels}
              freeLabel={t.freeCount}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className={`flex items-center justify-center px-6 py-3 backdrop-blur-xl backdrop-saturate-150 border-t transition-colors ${
          dark
            ? "bg-white/[0.04] border-white/[0.06]"
            : "bg-white/60 border-black/[0.04]"
        }`}
      >
        <span className={`text-sm font-light ${dark ? "text-white/70" : "text-gray-500"}`}>
          {t.poweredBy}
        </span>
      </div>

      {/* Dev widget */}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-6 right-6 z-[70]">
          {devOpen ? (
            <div className="w-72 max-h-[70vh] flex flex-col rounded-2xl bg-gray-900/95 border border-white/10 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between p-4 pb-3">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Dev Controls
                </span>
                <button
                  onClick={() => setDevOpen(false)}
                  className="text-white/40 hover:text-white/70 text-xs"
                >
                  close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={devEnabled}
                    onChange={(e) => setDevEnabled(e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-reev-green focus:ring-reev-green/50"
                  />
                  <span className="text-sm text-white/70">Use mock data</span>
                </label>

                {/* Per-location connector counts */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">
                      Locations ({devCounts.length})
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setDevCounts((prev) =>
                            prev.length > 1 ? prev.slice(0, -1) : prev,
                          )
                        }
                        className="w-6 h-6 rounded-lg bg-white/10 text-white/50 hover:bg-white/20 text-xs flex items-center justify-center"
                      >
                        &minus;
                      </button>
                      <button
                        onClick={() =>
                          setDevCounts((prev) =>
                            prev.length < 20 ? [...prev, 4] : prev,
                          )
                        }
                        className="w-6 h-6 rounded-lg bg-white/10 text-white/50 hover:bg-white/20 text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {devCounts.map((count, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-14 truncate">
                        {CITY_NAMES[i % CITY_NAMES.length]}
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={count}
                        onChange={(e) =>
                          setDevCounts((prev) => {
                            const next = [...prev];
                            next[i] = Number(e.target.value);
                            return next;
                          })
                        }
                        className="flex-1 accent-reev-green"
                      />
                      <span className="text-xs font-medium text-white/80 tabular-nums w-5 text-right">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setDevSeed((s) => s + 1)}
                  className="w-full rounded-xl bg-white/10 py-2 text-xs text-white/60 hover:bg-white/15 transition-colors"
                >
                  Randomize statuses
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDevOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white/50 hover:bg-white/20 transition-colors backdrop-blur-xl text-sm"
              title="Dev controls"
            >
              &lt;/&gt;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
