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
    const year = searchParams.get("year");
    if (!propertyId) return bad("propertyId is required");

    const where: Prisma.AssessmentWhereInput = {
        propertyId: Number(propertyId),
        ...(year ? { year: Number(year) } : {}),
    };

    const rows = await prisma.assessment.findMany({
        where,
        orderBy: { year: "desc" },
        take: 10,
    });
    return ok({ assessments: rows });
}

export async function POST(req: Request) {
    const b = await req.json();
    const action = String(b.action ?? "");

    switch (action) {
        case "upsertAssessment": {
            const { propertyId, year, marketValue, assessedVal, landVal, bldgVal } = b;
            if (!propertyId || !year) return bad("propertyId and year are required");

            const rec = await prisma.assessment.upsert({
                where: { propertyId_year: { propertyId: Number(propertyId), year: Number(year) } },
                update: {
                    marketValue: num(marketValue) ?? undefined,
                    assessedVal: num(assessedVal) ?? undefined,
                    landVal: num(landVal) ?? undefined,
                    bldgVal: num(bldgVal) ?? undefined,
                },
                create: {
                    propertyId: Number(propertyId),
                    year: Number(year),
                    marketValue: num(marketValue) ?? 0,
                    assessedVal: num(assessedVal) ?? 0,
                    landVal: num(landVal) ?? 0,
                    bldgVal: num(bldgVal) ?? 0,
                },
            });
            return ok({ assessment: rec });
        }
        default:
            return bad("Unknown action");
    }
}
