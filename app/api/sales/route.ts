import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ok = <T>(data: T) => NextResponse.json(data, { status: 200 });
const bad = (message: string) =>
    NextResponse.json({ error: message } as const, { status: 400 });

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");
    const take = Math.min(Number(searchParams.get("take") ?? 25), 100);

    const where: Prisma.SaleWhereInput = propertyId
        ? { propertyId: Number(propertyId) }
        : {};

    const rows = await prisma.sale.findMany({
        where,
        orderBy: { saleDate: "desc" },
        take,
    });
    return ok({ sales: rows });
}

export async function POST(req: Request) {
    const b = await req.json();
    const action = String(b.action ?? "");

    switch (action) {
        case "recordSale": {
            const { propertyId, saleDate, price, docNumber, buyer, seller } = b;
            if (!propertyId || !saleDate || price === undefined) {
                return bad("propertyId, saleDate, price are required");
            }
            const rec = await prisma.sale.create({
                data: {
                    propertyId: Number(propertyId),
                    saleDate: new Date(saleDate),
                    price: Number(price),
                    docNumber,
                    buyer,
                    seller,
                },
            });
            return ok({ sale: rec });
        }
        default:
            return bad("Unknown action");
    }
}
