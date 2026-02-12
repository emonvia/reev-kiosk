import { cookies } from "next/headers";
import { getChargingStations } from "@/lib/reev";
import { StationGrid } from "@/components/station-grid";
import { PinLock } from "@/components/pin-lock";
import { verifySessionCookie, isPinEnabled } from "@/lib/pin";

async function isAuthenticated(): Promise<boolean> {
  if (!isPinEnabled()) return true; // no PIN configured → open access

  const cookieStore = await cookies();
  const session = cookieStore.get("grid-session")?.value;
  return verifySessionCookie(session);
}

export default async function LiveGridPage() {
  if (!(await isAuthenticated())) {
    return <PinLock />;
  }

  const first = await getChargingStations({ page: 1, pageSize: 100 });
  const allStations = [...first.data];

  if (first.totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, i) =>
        getChargingStations({ page: i + 2, pageSize: 100 }),
      ),
    );
    for (const page of remaining) allStations.push(...page.data);
  }

  return <StationGrid initialStations={allStations} />;
}
