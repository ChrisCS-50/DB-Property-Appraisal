import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------- helpers ----------
/** For CREATE: return number or undefined (omit field if empty/invalid). */
function toNumberOrUndef(v: unknown): number | undefined {
    if (v === "" || v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * For UPDATE: return { set: number | null } or undefined.
 * - undefined -> don't touch this column
 * - { set: null } -> set DB column to NULL
 * - { set: number } -> set DB column to that value
 */
function decimalUpdate(
    v: unknown
): { set: number | null } | undefined {
    if (v === undefined) return undefined;       // untouched
    if (v === "" || v === null) return { set: null }; // explicit NULL
    const n = Number(v);
    return Number.isFinite(n) ? { set: n } : undefined;
}

const ok = <T>(data: T) => NextResponse.json(data, { status: 200 });
const bad = (msg: string) =>
    NextResponse.json({ error: msg } as const, { status: 400 });

// ---------- routes ----------
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 50), 200));
    const properties = await prisma.property.findMany({
        orderBy: { updatedAt: "desc" },
        take: limit,
    });
    return ok({ properties });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const action = String(body.action ?? "");

        switch (action) {
            // 1) Upsert (insert or update by folio)
            case "upsert": {
                const { folio, address, landValue, buildingValue } = body;
                if (!folio) return bad("folio is required");

                const lvCreate = toNumberOrUndef(landValue);
                const bvCreate = toNumberOrUndef(buildingValue);
                const lvUpdate = decimalUpdate(landValue);
                const bvUpdate = decimalUpdate(buildingValue);

                const property = await prisma.property.upsert({
                    where: { folio },
                    create: {
                        folio,
                        address: address?.trim() || undefined,
                        ...(lvCreate !== undefined ? { landValue: lvCreate } : {}),
                        ...(bvCreate !== undefined ? { buildingValue: bvCreate } : {}),
                    },
                    update: {
                        address: address?.trim() || undefined,
                        ...(lvUpdate !== undefined ? { landValue: lvUpdate } : {}),
                        ...(bvUpdate !== undefined ? { buildingValue: bvUpdate } : {}),
                        updatedAt: new Date(),
                    },
                });
                return ok({ property });
            }

            // 2) Get one by folio
            case "getByFolio": {
                const { folio } = body;
                if (!folio) return bad("folio is required");
                const property = await prisma.property.findUnique({ where: { folio } });
                return ok({ property });
            }

            // 3) Range filter by landValue
            case "rangeByLandValue": {
                const { min, max } = body;
                const minNum = toNumberOrUndef(min);
                const maxNum = toNumberOrUndef(max);
                const properties = await prisma.property.findMany({
                    where: {
                        landValue: {
                            ...(minNum !== undefined ? { gte: minNum } : {}),
                            ...(maxNum !== undefined ? { lte: maxNum } : {}),
                        },
                    },
                    orderBy: { landValue: "asc" },
                    take: 100,
                });
                return ok({ properties });
            }

            // 4) Update address
            case "updateAddress": {
                const { folio, newAddress } = body;
                if (!folio) return bad("folio is required");
                const property = await prisma.property.update({
                    where: { folio },
                    data: { address: newAddress?.trim() || null, updatedAt: new Date() },
                });
                return ok({ property });
            }

            // 5) Adjust land value by % (e.g., 5 or -10)
            case "adjustLandPercent": {
                const { folio, percent } = body;
                if (!folio) return bad("folio is required");
                const current = await prisma.property.findUnique({ where: { folio } });
                if (!current || current.landValue === null) {
                    return bad("property not found or landValue is null");
                }
                const factor = 1 + Number(percent ?? 0) / 100;
                const property = await prisma.property.update({
                    where: { folio },
                    data: { landValue: { set: Number(current.landValue) * factor }, updatedAt: new Date() },
                });
                return ok({ property });
            }

            // 6) Delete by folio
            case "deleteByFolio": {
                const { folio } = body;
                if (!folio) return bad("folio is required");
                const deleted = await prisma.property.delete({ where: { folio } });
                return ok({ deleted });
            }

            // 7) Count where buildingValue > threshold
            case "countAboveBuilding": {
                const { threshold } = body;
                const t = toNumberOrUndef(threshold);
                const count = await prisma.property.count({
                    where: t !== undefined ? { buildingValue: { gt: t } } : {},
                });
                return ok({ count });
            }

            // 8) Reset both values to zero
            case "resetValues": {
                const { folio } = body;
                if (!folio) return bad("folio is required");
                const property = await prisma.property.update({
                    where: { folio },
                    data: { landValue: { set: 0 }, buildingValue: { set: 0 }, updatedAt: new Date() },
                });
                return ok({ property });
            }

            default:
                return bad("Unknown action");
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Server error";
        console.error(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
