// app/api/properties/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------- helpers ----------
function toNumberOrUndef(v: any): number | undefined {
  if (v === "" || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * For UPDATE of Decimal-like fields using Prisma's { set: value } syntax.
 * - undefined  -> don't change column
 * - { set:null } -> set column to NULL
 * - { set:n }    -> set column to n
 */
function decimalUpdate(
  v: any
): { set: number | null } | undefined {
  if (v === undefined) return undefined;
  if (v === "" || v === null) return { set: null };
  const n = Number(v);
  return Number.isFinite(n) ? { set: n } : undefined;
}

// NEW: helper for integer values like ownerId, year
function toIntOrUndef(v: any): number | undefined {
  if (v === "" || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

const ok = (data: any, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });
const bad = (msg: string, status = 400) =>
  NextResponse.json({ ok: false, error: msg }, { status });

// ---------- GET: list properties ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(Number(searchParams.get("limit") ?? 50), 200)
  );

  const properties = await prisma.property.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return ok({ properties });
}

// ---------- POST: upsert + other property actions ----------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    switch (action) {
      // 1) Upsert (insert or update) a property by folio
      //    Also:
      //      - optionally create/attach Owner (name/phone/email)
      //      - optionally create a Sale row (saleDate/price)
      //      - optionally upsert an Assessment row (assessmentYear)
      case "upsert": {
        const {
          folio,
          address,
          landValue,
          buildingValue,
          zipCode,
          ownerId,       // existing owner id (optional)

          // NEW owner fields
          ownerName,
          ownerPhone,
          ownerEmail,

          // NEW sale fields
          saleDate,
          salePrice,

          // NEW assessment field
          assessmentYear,
        } = body;

        if (!folio) return bad("folio is required");

        const lvCreate = toNumberOrUndef(landValue);
        const bvCreate = toNumberOrUndef(buildingValue);
        const lvUpdate = decimalUpdate(landValue);
        const bvUpdate = decimalUpdate(buildingValue);

        // 1) Determine ownerId to use (existing or newly created)
        let ownerIdNum = toIntOrUndef(ownerId);

        if (!ownerIdNum && (ownerName || ownerPhone || ownerEmail)) {
          // Create a new Owner if we don't have an ID but we do have owner info
          const newOwner = await prisma.owner.create({
            data: {
              name: (ownerName && String(ownerName).trim()) || "Unknown Owner",
              phone: ownerPhone ? String(ownerPhone).trim() : undefined,
              email: ownerEmail ? String(ownerEmail).trim() : undefined,
            },
          });
          ownerIdNum = newOwner.id;
        }

        // 2) Upsert the Property
        const property = await prisma.property.upsert({
          where: { folio },
          create: {
            folio,
            ...(address ? { address: address.trim() } : {}),
            ...(zipCode ? { zipCode: zipCode.trim() } : {}),
            ...(ownerIdNum !== undefined ? { ownerId: ownerIdNum } : {}),
            ...(lvCreate !== undefined ? { landValue: lvCreate } : {}),
            ...(bvCreate !== undefined ? { buildingValue: bvCreate } : {}),
          },
          update: {
            ...(address !== undefined
              ? { address: address?.trim() || null }
              : {}),
            ...(zipCode !== undefined
              ? { zipCode: zipCode?.trim() || null }
              : {}),
            ...(ownerIdNum !== undefined ? { ownerId: ownerIdNum } : {}),
            ...(lvUpdate !== undefined ? { landValue: lvUpdate } : {}),
            ...(bvUpdate !== undefined ? { buildingValue: bvUpdate } : {}),
            updatedAt: new Date(),
          },
        });

        // 3) Optionally create a Sale row
        if (saleDate && salePrice !== undefined && salePrice !== "") {
          const priceNum = toNumberOrUndef(salePrice);
          if (priceNum !== undefined) {
            await prisma.sale.create({
              data: {
                propertyId: property.id,
                saleDate: new Date(String(saleDate)),
                price: priceNum,
                // docNumber, buyer, seller can be added later if desired
              },
            });
          }
        }

        // 4) Optionally upsert an Assessment row
        if (assessmentYear) {
          const yearNum = toIntOrUndef(assessmentYear);
          if (yearNum !== undefined) {
            // Use provided land/building values or fallback to DB/current values
            const land = lvCreate ?? Number(property.landValue ?? 0);
            const bldg = bvCreate ?? Number(property.buildingValue ?? 0);
            const market = land + bldg;
            const assessed = market; // simple assumption for project

            await prisma.assessment.upsert({
              where: {
                propertyId_year: {
                  propertyId: property.id,
                  year: yearNum,
                },
              },
              update: {
                marketValue: market,
                assessedVal: assessed,
                landVal: land,
                bldgVal: bldg,
              },
              create: {
                propertyId: property.id,
                year: yearNum,
                marketValue: market,
                assessedVal: assessed,
                landVal: land,
                bldgVal: bldg,
              },
            });
          }
        }

        return ok({ property });
      }

      // 2) Get one property by folio
      case "getByFolio": {
        const { folio } = body;
        if (!folio) return bad("folio is required");
        const property = await prisma.property.findUnique({
          where: { folio },
        });
        return ok({ property });
      }

      // 3) Range filter by land value
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

      // 4) Update address only
      case "updateAddress": {
        const { folio, newAddress } = body;
        if (!folio) return bad("folio is required");
        const property = await prisma.property.update({
          where: { folio },
          data: {
            address: newAddress?.trim() || null,
            updatedAt: new Date(),
          },
        });
        return ok({ property });
      }

      // 5) Adjust land value by % (e.g., 5 or -10)
      case "adjustLandPercent": {
        const { folio, percent } = body;
        if (!folio) return bad("folio is required");

        const current = await prisma.property.findUnique({
          where: { folio },
        });
        if (!current || current.landValue === null) {
          return bad("property not found or landValue is null");
        }

        const factor = 1 + Number(percent ?? 0) / 100;
        const property = await prisma.property.update({
          where: { folio },
          data: {
            landValue: {
              set: Number(current.landValue) * factor,
            },
            updatedAt: new Date(),
          },
        });
        return ok({ property });
      }

      // 6) Delete by folio
      case "deleteByFolio": {
        const { folio } = body;
        if (!folio) return bad("folio is required");
        const deleted = await prisma.property.delete({
          where: { folio },
        });
        return ok({ deleted });
      }

      // 7) Count where buildingValue > threshold
      case "countAboveBuilding": {
        const { threshold } = body;
        const t = toNumberOrUndef(threshold);
        const count = await prisma.property.count({
          where:
            t !== undefined
              ? { buildingValue: { gt: t } }
              : {},
        });
        return ok({ count });
      }

      // 8) Reset land & building values to zero
      case "resetValues": {
        const { folio } = body;
        if (!folio) return bad("folio is required");
        const property = await prisma.property.update({
          where: { folio },
          data: {
            landValue: { set: 0 },
            buildingValue: { set: 0 },
            updatedAt: new Date(),
          },
        });
        return ok({ property });
      }

      // 9) Bulk adjust land values by ZIP code using stored procedure
      case "adjustLandByZip": {
        const { zipCode, percent } = body;

        if (!zipCode || String(zipCode).trim() === "") {
          return bad("zipCode is required");
        }

        const pct = toNumberOrUndef(percent);
        if (pct === undefined) {
          return bad("percent is required and must be numeric");
        }

        // Call the stored procedure in Postgres via Prisma
        const result = await prisma.$executeRawUnsafe(
          'CALL sp_adjust_land_values_by_zip($1, $2)',
          String(zipCode).trim(),
          pct
        );

        // result is usually number of rows affected (depends on driver)
        return ok({
          message: "Land values adjusted successfully",
          zipCode: String(zipCode).trim(),
          percent: pct,
          rowsAffected: Number(result ?? 0),
        });
      }

      default:
        return bad("Unknown action");
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: e.message ?? "Server error" },
      { status: 500 }
    );
  }
}
