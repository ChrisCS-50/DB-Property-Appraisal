import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ok = <T>(data: T) => NextResponse.json(data, { status: 200 });
const bad = (message: string) =>
    NextResponse.json({ error: message } as const, { status: 400 });

const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");
    if (!propertyId) return bad("propertyId is required");

    const where: Prisma.ImprovementWhereInput = { propertyId: Number(propertyId) };

    const rows = await prisma.improvement.findMany({
        where,
        orderBy: [{ type: "asc" }, { id: "desc" }],
    });
    return ok({ improvements: rows });
}

export async function POST(req: Request) {
    const b = await req.json();
    const action = String(b.action ?? "");

    switch (action) {
        case "addImprovement": {
            const { propertyId, type, yearBuilt, value } = b;
            if (!propertyId || !type) return bad("propertyId and type are required");
            const rec = await prisma.improvement.create({
                data: {
                    propertyId: Number(propertyId),
                    type,
                    yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
                    value: num(value),
                },
            });
            return ok({ improvement: rec });
        }
        default:
            return bad("Unknown action");
    }
}
