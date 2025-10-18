import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ok = <T>(data: T) => NextResponse.json(data, { status: 200 });
const bad = (message: string) =>
    NextResponse.json({ error: message } as const, { status: 400 });

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (code) {
        const n = await prisma.neighborhood.findUnique({
            where: { code },
            include: { properties: { take: 50, orderBy: { updatedAt: "desc" } } },
        });
        return ok({ neighborhood: n });
    }

    const list = await prisma.neighborhood.findMany({
        take: 50,
        orderBy: { id: "desc" },
    });
    return ok({ neighborhoods: list });
}

export async function POST(req: Request) {
    const b = await req.json();
    const action = String(b.action ?? "");

    switch (action) {
        case "createNeighborhood": {
            const { code, name } = b;
            if (!code || !name) return bad("code and name are required");
            const n = await prisma.neighborhood.create({ data: { code, name } });
            return ok({ neighborhood: n });
        }
        case "assignPropertyToNeighborhood": {
            const { propertyId, neighborhoodId } = b;
            if (!propertyId || !neighborhoodId) return bad("propertyId and neighborhoodId are required");
            const prop = await prisma.property.update({
                where: { id: Number(propertyId) },
                data: { neighborhoodId: Number(neighborhoodId), updatedAt: new Date() },
            });
            return ok({ property: prop });
        }
        default:
            return bad("Unknown action");
    }
}
