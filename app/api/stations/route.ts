import { NextResponse } from "next/server";
import { getChargingStations } from "@/lib/reev";
import type { ChargingStation } from "@/lib/reev";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const first = await getChargingStations({ page: 1, pageSize: 100 });
    const allStations: ChargingStation[] = [...first.data];

    if (first.totalPages > 1) {
      const remaining = await Promise.all(
        Array.from({ length: first.totalPages - 1 }, (_, i) =>
          getChargingStations({ page: i + 2, pageSize: 100 }),
        ),
      );
      for (const page of remaining) allStations.push(...page.data);
    }

    return NextResponse.json(allStations);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch station data" },
      { status: 502 },
    );
  }
}
