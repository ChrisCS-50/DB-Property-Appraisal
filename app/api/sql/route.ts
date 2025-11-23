// app/api/sql/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ---------- helpers ----------
const ok = (data: any, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const bad = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status });

// ---------- GET query params schema ----------
const qSchema = z.object({
  q: z.string().optional().default(""),
  folio: z.string().optional(),
  year: z.coerce.number().int().optional(),
  minPrice: z.coerce.number().optional(), // for subquery endpoint
});

// ---------- POST body schemas ----------
const insertOwnerSchema = z.object({
  action: z.literal("insert_owner"),
  name: z.string().min(1, "name is required"),
  email: z.string().email().optional().nullable(),
});

const updatePropertyAddressSchema = z.object({
  action: z.literal("update_property_address"),
  id: z.coerce.number().int().positive(),
  newAddress: z.string().min(1, "newAddress is required"),
});

const deleteImprovementSchema = z.object({
  action: z.literal("delete_improvement"),
  id: z.coerce.number().int().positive(),
});

const addSaleSchema = z.object({
  action: z.literal("add_sale"),
  propertyId: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
  saleDate: z.coerce.date(),
  buyer: z.string().optional().nullable(),
  seller: z.string().optional().nullable(),
});

const salesInRangeSchema = z.object({
  action: z.literal("sales_in_range"),
  start: z.coerce.date(),
  end: z.coerce.date(),
});

const ownersWithMinPropertiesSchema = z.object({
  action: z.literal("owners_with_min_properties"),
  minCount: z.coerce.number().int().min(0).default(1),
});

// ---------- GET: read-only SQL queries ----------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = qSchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );
    if (!parsed.success) {
      return bad(
        parsed.error.errors.map((e) => e.message).join(", ")
      );
    }

    const { q, folio, year, minPrice } = parsed.data;

    switch (q) {
      // 1) SELECT with JOIN: properties + owner
      case "properties_with_owner": {
        const rows = await prisma.$queryRaw`
          SELECT p.id,
                 p.folio,
                 p.address,
                 p."zipCode" AS zip_code,
                 o.name AS owner_name
          FROM "Property" p
          LEFT JOIN "Owner" o ON o.id = p."ownerId"
          ORDER BY p.id DESC
          LIMIT 25
        `;
        return ok(rows);
      }

      // 2) SELECT AVG with GROUP BY: avg sale price by ZIP
      case "avg_sale_price_by_zip": {
        const rows = await prisma.$queryRaw`
            SELECT
                p."zipCode"::text AS zip_code,
                AVG(s.price)::numeric(12,2) AS avg_price
            FROM "Sale" s
            JOIN "Property" p ON p.id = s."propertyId"
            WHERE p."zipCode" IS NOT NULL
            GROUP BY p."zipCode"::text
            ORDER BY p."zipCode"::text ASC
        `;
        return ok(rows);
    }

      // 3) List all properties ordered by folio (no condition)
      case "property_by_folio": {
        const rows = await prisma.$queryRaw`
          SELECT *
          FROM "Property"
          ORDER BY folio ASC
        `;
        return ok(rows);
      }

      // 4) SELECT of all sales with JOINs
      case "sales_history": {
        const rows = await prisma.$queryRaw`
          SELECT 
                 s."saleDate",
                 s.id,
                 s.price,
                 p.folio,
                 p."zipCode" AS zip_code,
                 o.name AS owner_name
          FROM "Sale" s
          JOIN "Property" p ON p.id = s."propertyId"
          LEFT JOIN "Owner" o ON o.id = p."ownerId"
          ORDER BY s."saleDate" DESC
        `;
        return ok(rows);
      }

      // 5) Subquery: sales above global average (optionally minPrice)
      case "sales_above_avg": {
        const min = minPrice ?? 0;
        const rows = await prisma.$queryRaw`
          SELECT s.id,
                 s.price,
                 s."saleDate",
                 p.folio,
                 p."zipCode" AS zip_code
          FROM "Sale" s
          JOIN "Property" p ON p.id = s."propertyId"
          WHERE s.price > (SELECT AVG(price) FROM "Sale")
            AND s.price >= ${min}
          ORDER BY s.price DESC
          LIMIT 100
        `;
        return ok(rows);
      }

      default:
        return bad("Unknown query key");
    }
  } catch (e: any) {
    return bad(e.message ?? "Server error", 500);
  }
}

// ---------- POST: write queries + extra reports ----------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action || "");

    switch (action) {
      // 6) INSERT owner
      case "insert_owner": {
        const p = insertOwnerSchema.parse(body);
        const rows = await prisma.$queryRaw`
          INSERT INTO "Owner"(name, email)
          VALUES (${p.name}, ${p.email ?? null})
          RETURNING id, name, email
        `;
        return ok(rows[0]);
      }

      // 7) UPDATE property address
      case "update_property_address": {
        const p = updatePropertyAddressSchema.parse(body);
        const rows = await prisma.$queryRaw`
          UPDATE "Property"
          SET address = ${p.newAddress}
          WHERE id = ${p.id}
          RETURNING id, address
        `;
        if (!rows[0]) return bad("Property not found", 404);
        return ok(rows[0]);
      }

      // 8) DELETE improvement
      case "delete_improvement": {
        const p = deleteImprovementSchema.parse(body);
        const rows = await prisma.$queryRaw`
          DELETE FROM "Improvement"
          WHERE id = ${p.id}
          RETURNING id
        `;
        return ok(rows[0] ?? { deleted: 0 });
      }

      // 9) INSERT sale
      case "add_sale": {
        const p = addSaleSchema.parse(body);
        const rows = await prisma.$queryRaw`
          INSERT INTO "Sale"("propertyId", price, "saleDate", buyer, seller)
          VALUES (${p.propertyId}, ${p.price}, ${p.saleDate}, ${p.buyer ?? null}, ${p.seller ?? null})
          RETURNING id, "propertyId", price, "saleDate"
        `;
        return ok(rows[0]);
      }

      // 10) SELECT with date range (BETWEEN)
      case "sales_in_range": {
        const p = salesInRangeSchema.parse(body);
        if (p.end < p.start) return bad("end must be >= start");
        const rows = await prisma.$queryRaw`
          SELECT s.id,
                 s.price,
                 s."saleDate",
                 p.folio,
                 p."zipCode" AS zip_code
          FROM "Sale" s
          JOIN "Property" p ON p.id = s."propertyId"
          WHERE s."saleDate" BETWEEN ${p.start} AND ${p.end}
          ORDER BY s."saleDate" DESC
        `;
        return ok(rows);
      }

      // 11) GROUP BY + HAVING (aggregation)
      case "owners_with_min_properties": {
        const p = ownersWithMinPropertiesSchema.parse(body);
        const rows = await prisma.$queryRaw`
          SELECT o.id,
                 o.name,
                 COUNT(p.id) AS property_count
          FROM "Owner" o
          LEFT JOIN "Property" p ON p."ownerId" = o.id
          GROUP BY o.id, o.name
          HAVING COUNT(p.id) >= ${p.minCount}
          ORDER BY property_count DESC
        `;
        return ok(rows);
      }

      default:
        return bad("Unknown action");
    }
  } catch (e: any) {
    return bad(e.message ?? "Server error", 500);
  }
}