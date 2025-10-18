import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ok = <T>(data: T) => NextResponse.json(data, { status: 200 });
const bad = (message: string) =>
    NextResponse.json({ error: message } as const, { status: 400 });

// POST { action: "createOwner" | "assignOwner", ... }
// GET  /api/owners?name=Jane  -> search by name (contains)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") ?? "";
    const owners = await prisma.owner.findMany({
        where: name ? { name: { contains: name, mode: "insensitive" } } : {},
        take: 50,
        orderBy: { id: "desc" },
    });
    return ok({ owners });
}

export async function POST(req: Request) {
    const body = await req.json();
    const action = String(body.action ?? "");

    switch (action) {
        case "createOwner": {
            const { name, phone, email } = body;
            if (!name) return bad("name is required");
            const owner = await prisma.owner.create({ data: { name, phone, email } });
            return ok({ owner });
        }
        case "assignOwner": {
            const { propertyId, ownerId } = body;
            if (!propertyId || !ownerId) return bad("propertyId and ownerId are required");
            const prop = await prisma.property.update({
                where: { id: Number(propertyId) },
                data: { ownerId: Number(ownerId), updatedAt: new Date() },
            });
            return ok({ property: prop });
        }
        default:
            return bad("Unknown action");
    }
}
