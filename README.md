## Quick Start (Windows)

powershell

.\scripts\setup.ps1

npm run dev



-- =========================================================
-- 1) Enum for roles (used by "User")
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN','EDITOR','VIEWER');
  END IF;
END$$;

-- =========================================================
-- 2) Core dimension tables: Neighborhood, Owner
-- =========================================================
DROP TABLE IF EXISTS "Neighborhood" CASCADE;
CREATE TABLE "Neighborhood" (
  id   SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL
);

-- unique + composite index per screenshot
CREATE UNIQUE INDEX "Neighborhood_code_key" ON "Neighborhood"(code);
CREATE INDEX "Neighborhood_code_name_idx" ON "Neighborhood"(code, name);

DROP TABLE IF EXISTS "Owner" CASCADE;
CREATE TABLE "Owner" (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(120)
);

-- index on name per screenshot
CREATE INDEX "Owner_name_idx" ON "Owner"(name);

-- =========================================================
-- 3) Property
-- =========================================================
DROP TABLE IF EXISTS "Property" CASCADE;
CREATE TABLE "Property" (
  id             SERIAL PRIMARY KEY,
  folio          TEXT NOT NULL,
  address        TEXT,
  "landValue"    NUMERIC(12,2),
  "buildingValue" NUMERIC(12,2),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "neighborhoodId" INTEGER,
  "ownerId"        INTEGER,
  CONSTRAINT "Property_neighborhoodId_fkey"
    FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Property_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "Owner"(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

-- unique + supporting indexes per screenshot
CREATE UNIQUE INDEX "Property_folio_key" ON "Property"(folio);
CREATE INDEX "Property_neighborhoodId_idx" ON "Property"("neighborhoodId");
CREATE INDEX "Property_ownerId_idx"        ON "Property"("ownerId");
CREATE INDEX "Property_landValue_idx"      ON "Property"("landValue");
CREATE INDEX "Property_buildingValue_idx"  ON "Property"("buildingValue");

-- =========================================================
-- 4) Assessment
-- =========================================================
DROP TABLE IF EXISTS "Assessment" CASCADE;
CREATE TABLE "Assessment" (
  id           SERIAL PRIMARY KEY,
  "propertyId" INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  "marketValue" NUMERIC(12,2) NOT NULL,
  "assessedVal" NUMERIC(12,2) NOT NULL,
  "landVal"     NUMERIC(12,2) NOT NULL,
  "bldgVal"     NUMERIC(12,2) NOT NULL,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assessment_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Assessment_propertyId_year_key"
    UNIQUE ("propertyId", year)
);

-- indexes per screenshot
CREATE INDEX "Assessment_propertyId_idx" ON "Assessment"("propertyId");
CREATE INDEX "Assessment_year_idx"       ON "Assessment"(year);

-- =========================================================
-- 5) Improvement
-- =========================================================
DROP TABLE IF EXISTS "Improvement" CASCADE;
CREATE TABLE "Improvement" (
  id          SERIAL PRIMARY KEY,
  "propertyId" INTEGER NOT NULL,
  type        VARCHAR(60) NOT NULL,
  "yearBuilt" INTEGER,
  value       NUMERIC(12,2),
  CONSTRAINT "Improvement_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

-- indexes per screenshot
CREATE INDEX "Improvement_propertyId_idx" ON "Improvement"("propertyId");
CREATE INDEX "Improvement_type_idx"       ON "Improvement"(type);

-- =========================================================
-- 6) Sale
-- =========================================================
DROP TABLE IF EXISTS "Sale" CASCADE;
CREATE TABLE "Sale" (
  id          SERIAL PRIMARY KEY,
  "propertyId" INTEGER NOT NULL,
  "saleDate"  TIMESTAMP NOT NULL,
  price       NUMERIC(12,2) NOT NULL,
  "docNumber" VARCHAR(40),
  buyer       VARCHAR(120),
  seller      VARCHAR(120),
  CONSTRAINT sale_price_nonnegative CHECK (price >= 0),
  CONSTRAINT "Sale_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

-- indexes per screenshot
CREATE INDEX "Sale_propertyId_idx" ON "Sale"("propertyId");
CREATE INDEX "Sale_saleDate_idx"   ON "Sale"("saleDate");
CREATE INDEX "Sale_price_idx"      ON "Sale"(price);

-- =========================================================
-- 7) User (for auth)
-- =========================================================
DROP TABLE IF EXISTS "User" CASCADE;
CREATE TABLE "User" (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  password   TEXT NOT NULL,           -- bcrypt hash
  role       "Role" NOT NULL DEFAULT 'VIEWER'::"Role",
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL
);

-- unique + index per screenshot
CREATE UNIQUE INDEX "User_email_key" ON "User"(email);
CREATE INDEX        "User_email_idx" ON "User"(email);

-- =========================================================
-- 8) Prisma migrations table (as shown)
--    (Only include if you really need to recreate it manually.
--     Normally Prisma manages this itself.)
-- =========================================================
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
CREATE TABLE "_prisma_migrations" (
  id                   VARCHAR(36) PRIMARY KEY,
  checksum             VARCHAR(64) NOT NULL,
  finished_at          TIMESTAMPTZ,
  migration_name       VARCHAR(255) NOT NULL,
  logs                 TEXT,
  rolled_back_at       TIMESTAMPTZ,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count  INTEGER NOT NULL DEFAULT 0
);

-- PK already unique; Prisma usually creates this automatically.

-- =========================================================
-- 9) View: v_property_summary (your existing one)
-- =========================================================
DROP VIEW IF EXISTS "v_property_summary";
CREATE OR REPLACE VIEW "v_property_summary" AS
SELECT
  p.id,
  p.folio,
  p.address,
  p."landValue"     AS land_value,
  p."buildingValue" AS building_value,
  p."updatedAt"     AS updated_at,
  o.name            AS owner_name,
  o.email           AS owner_email,
  n.code            AS neighborhood_code,
  n.name            AS neighborhood_name,
  a.year            AS latest_year,
  a."marketValue"   AS latest_market_value,
  a."assessedVal"   AS latest_assessed_value,
  a."landVal"       AS latest_land_value,
  a."bldgVal"       AS latest_building_value
FROM "Property" p
LEFT JOIN "Owner"        o ON o.id = p."ownerId"
LEFT JOIN "Neighborhood" n ON n.id = p."neighborhoodId"
LEFT JOIN LATERAL (
  SELECT a1.year, a1."marketValue", a1."assessedVal", a1."landVal", a1."bldgVal"
  FROM "Assessment" a1
  WHERE a1."propertyId" = p.id
  ORDER BY a1.year DESC
  LIMIT 1
) a ON TRUE;



Sample Neighborhoods
-- Neighborhoods
INSERT INTO "Neighborhood" (code, name) VALUES
('NBH-001', 'Downtown'),
('NBH-002', 'Riverside'),
('NBH-003', 'Lakeside');

Sample Owners
-- Owners
INSERT INTO "Owner" (name, phone, email) VALUES
('John Doe', '555-1001', 'john@example.com'),
('Mary Johnson', '555-1002', 'mary@example.com'),
('Alex Chen', '555-1003', 'alex@example.com');

Sample Properties
INSERT INTO "Property" (folio, address, "landValue", "buildingValue", "neighborhoodId", "ownerId")
VALUES
('FOL-1001', '123 Main St', 150000, 350000, 1, 1),
('FOL-1002', '456 Oak Ave', 120000, 280000, 1, 2),
('FOL-1003', '789 Pine Rd', 200000, 400000, 2, 3),
('FOL-1004', '321 Maple Ln', 90000, 250000, 3, 1),
('FOL-1005', '654 Birch Dr', 110000, 310000, 2, 2),
('FOL-1006', '987 Cedar Ct', 175000, 390000, 1, 3),
('FOL-1007', '222 Elm St', 95000, 220000, 3, 1),
('FOL-1008', '333 Spruce Blvd', 130000, 345000, 2, 2),
('FOL-1009', '444 Walnut Way', 160000, 410000, 3, 3),
('FOL-1010', '555 Chestnut Cir', 140000, 360000, 1, 1),
('FOL-1011', '666 Cypress Ct', 185000, 420000, 2, 2),
('FOL-1012', '777 Magnolia Ave', 155000, 370000, 3, 3),
('FOL-1013', '888 Palm Blvd', 100000, 290000, 1, 1),
('FOL-1014', '999 Dogwood Ln', 125000, 310000, 2, 2),
('FOL-1015', '1010 Redwood Dr', 210000, 480000, 3, 3),
('FOL-1016', '1111 Willow Way', 95000, 220000, 1, 1),
('FOL-1017', '1212 Aspen Cir', 135000, 315000, 2, 2),
('FOL-1018', '1313 Poplar Rd', 145000, 335000, 3, 3),
('FOL-1019', '1414 Beech Ct', 160000, 355000, 1, 2),
('FOL-1020', '1515 Sycamore St', 170000, 390000, 2, 3);