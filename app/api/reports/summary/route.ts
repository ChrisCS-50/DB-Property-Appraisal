import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const folio        = searchParams.get("folio") ?? "";
  const owner        = searchParams.get("owner") ?? "";
  const neighborhood = searchParams.get("neighborhood") ?? "";
  const limit        = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 50), 200));

  const rows = await prisma.$queryRaw<
    Array<{
      id: number; folio: string; address: string | null;
      land_value: number | null; building_value: number | null;
      updated_at: Date;
      owner_name: string | null; owner_email: string | null;
      neighborhood_code: string | null; neighborhood_name: string | null;
      latest_year: number | null; latest_market_value: number | null;
      latest_assessed_value: number | null; latest_land_value: number | null;
      latest_building_value: number | null;
    }>
  >`
    SELECT *
    FROM "v_property_summary"
    WHERE
      (${folio} = '' OR folio = ${folio})
      AND (${owner} = '' OR owner_name ILIKE '%' || ${owner} || '%')
      AND (${neighborhood} = '' OR neighborhood_code = ${neighborhood})
    ORDER BY updated_at DESC
    LIMIT ${limit};
  `;

  return NextResponse.json({ results: rows }, { status: 200 });
}
