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
