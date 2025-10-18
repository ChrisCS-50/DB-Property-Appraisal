// app/api/sql/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// -------- GET: read-only SQL queries --------
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get("q") || "";

        switch (q) {
            // 1) SELECT with JOIN
            case "properties_with_owner":
                return NextResponse.json(
                    await prisma.$queryRaw`
            SELECT p.id, p.folio, p.address, o.name AS owner_name
            FROM "Property" p
            JOIN "Owner" o ON o.id = p."ownerId"
            ORDER BY p.id DESC
            LIMIT 25
          `
                );

            // 2) SELECT AVG with GROUP BY (JOINs)
            case "avg_sale_price_by_neighborhood":
                return NextResponse.json(
                    await prisma.$queryRaw`
            SELECT n.code, n.name, AVG(s.price)::numeric(12,2) AS avg_price
            FROM "Sale" s
            JOIN "Property" p ON p.id = s."propertyId"
            JOIN "Neighborhood" n ON n.id = p."neighborhoodId"
            GROUP BY n.code, n.name
            ORDER BY avg_price DESC
          `
                );

            // 3) Parameterized filter
            case "property_by_folio": {
                const folio = searchParams.get("folio") || "";
                const rows = await prisma.$queryRaw`
          SELECT *
          FROM "Property"
          WHERE folio = ${folio}
        `;
                return NextResponse.json(rows);
            }

            // 4) Range by year
            case "sales_in_year": {
                const year = Number(searchParams.get("year") || "2024");
                const rows = await prisma.$queryRaw`
          SELECT s.id, s.price, s."saleDate", p.folio, o.name AS owner_name
          FROM "Sale" s
          JOIN "Property" p ON p.id = s."propertyId"
          LEFT JOIN "Owner" o ON o.id = p."ownerId"
          WHERE EXTRACT(YEAR FROM s."saleDate") = ${year}
          ORDER BY s."saleDate" DESC
        `;
                return NextResponse.json(rows);
            }

            default:
                return NextResponse.json({ error: "Unknown query key" }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// -------- POST: write queries & extras --------
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const action = String(body.action || "");

        switch (action) {
            // 5) INSERT owner
            case "insert_owner": {
                const name = String(body.name || "");
                const email = body.email ? String(body.email) : null;
                const rows = await prisma.$queryRaw`
          INSERT INTO "Owner"(name, email)
          VALUES(${name}, ${email})
          RETURNING id, name, email
        `;
                return NextResponse.json(rows[0]);
            }

            // 6) UPDATE property address
            case "update_property_address": {
                const id = Number(body.id);
                const newAddress = String(body.newAddress || "");
                const rows = await prisma.$queryRaw`
          UPDATE "Property" SET address = ${newAddress}
          WHERE id = ${id}
          RETURNING id, address
        `;
                return NextResponse.json(rows[0]);
            }

            // 7) DELETE improvement
            case "delete_improvement": {
                const id = Number(body.id);
                const rows = await prisma.$queryRaw`
          DELETE FROM "Improvement" WHERE id = ${id}
          RETURNING id
        `;
                return NextResponse.json(rows[0] ?? { deleted: 0 });
            }

            // 8) INSERT sale
            case "add_sale": {
                const propertyId = Number(body.propertyId);
                const price = Number(body.price);
                const saleDate = new Date(body.saleDate);
                const buyer = body.buyer ? String(body.buyer) : null;
                const seller = body.seller ? String(body.seller) : null;

                const rows = await prisma.$queryRaw`
          INSERT INTO "Sale"("propertyId", price, "saleDate", buyer, seller)
          VALUES(${propertyId}, ${price}, ${saleDate}, ${buyer}, ${seller})
          RETURNING id, "propertyId", price, "saleDate"
        `;
                return NextResponse.json(rows[0]);
            }

            // 9) SELECT date range
            case "sales_in_range": {
                const start = new Date(body.start);
                const end = new Date(body.end);
                const rows = await prisma.$queryRaw`
          SELECT s.id, s.price, s."saleDate", p.folio
          FROM "Sale" s
          JOIN "Property" p ON p.id = s."propertyId"
          WHERE s."saleDate" BETWEEN ${start} AND ${end}
          ORDER BY s."saleDate" DESC
        `;
                return NextResponse.json(rows);
            }

            // 10) HAVING with count
            case "owners_with_min_properties": {
                const minCount = Number(body.minCount ?? 1);
                const rows = await prisma.$queryRaw`
          SELECT o.id, o.name, COUNT(p.id) AS property_count
          FROM "Owner" o
          LEFT JOIN "Property" p ON p."ownerId" = o.id
          GROUP BY o.id, o.name
          HAVING COUNT(p.id) >= ${minCount}
          ORDER BY property_count DESC
        `;
                return NextResponse.json(rows);
            }

            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
