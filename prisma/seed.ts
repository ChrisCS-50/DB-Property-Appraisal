// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // 1) Neighborhood (code is unique)
    const n = await prisma.neighborhood.upsert({
        where: { code: '1130' },
        update: { name: 'Downtown' },
        create: { code: '1130', name: 'Downtown' },
    });

    // 2) Owner (id is unique; use id=1 to make it stable)
    // If you’d rather use email as the unique selector, switch to where: { email: 'jane@example.com' }
    const owner = await prisma.owner.upsert({
        where: { id: 1 },
        update: { name: 'Jane Doe', email: 'jane@example.com' },
        create: { name: 'Jane Doe', email: 'jane@example.com' },
    });

    // 3) Property (folio is unique)
    const p = await prisma.property.upsert({
        where: { folio: 'F1001' },
        update: {
            address: '123 Main St',
            landValue: 80000,
            buildingValue: 220000,
            ownerId: owner.id,
            neighborhoodId: n.id,
            updatedAt: new Date(),
        },
        create: {
            folio: 'F1001',
            address: '123 Main St',
            landValue: 80000,
            buildingValue: 220000,
            ownerId: owner.id,
            neighborhoodId: n.id,
        },
    });

    // 4) Assessment (composite unique on [propertyId, year])
    await prisma.assessment.upsert({
        where: { propertyId_year: { propertyId: p.id, year: 2025 } },
        update: {
            marketValue: 360000,
            assessedVal: 320000,
            landVal: 90000,
            bldgVal: 270000,
        },
        create: {
            propertyId: p.id,
            year: 2025,
            marketValue: 360000,
            assessedVal: 320000,
            landVal: 90000,
            bldgVal: 270000,
        },
    });

    // 5) Improvements — your schema has no unique constraint for (propertyId, type, yearBuilt),
    // so createMany with skipDuplicates won't de-dupe across reruns.
    // We'll emulate idempotency by checking first and creating only if missing.
    const improvementsToEnsure = [
        { propertyId: p.id, type: 'Pool', value: 15000, yearBuilt: 2019 },
        { propertyId: p.id, type: 'Roof', value: 12000, yearBuilt: 2021 },
    ];

    for (const imp of improvementsToEnsure) {
        const exists = await prisma.improvement.findFirst({
            where: {
                propertyId: imp.propertyId,
                type: imp.type,
                yearBuilt: imp.yearBuilt ?? undefined,
            },
            select: { id: true },
        });
        if (!exists) {
            await prisma.improvement.create({ data: imp });
        }
    }

    // 6) Sale — no unique constraint in schema, so we guard by a natural key we define:
    // (propertyId, saleDate, price, buyer, seller). Adjust if you later add a real unique.
    const existingSale = await prisma.sale.findFirst({
        where: {
            propertyId: p.id,
            saleDate: new Date('2024-11-15'),
            price: 415000,
            buyer: 'Acme LLC',
            seller: 'Jane Doe',
        },
        select: { id: true },
    });

    if (!existingSale) {
        await prisma.sale.create({
            data: {
                propertyId: p.id,
                saleDate: new Date('2024-11-15'),
                price: 415000,
                docNumber: 'OR 12345-6789',
                buyer: 'Acme LLC',
                seller: 'Jane Doe',
            },
        });
    }

    console.log('Seed complete');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
