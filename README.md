📘 Property Appraisal Database Application

Final Project – COP4710: Database Management

This application is a full-stack property appraisal tool designed for storing, updating, querying, and reporting property-related data. It uses:

Next.js 14 (App Router)

Prisma ORM

PostgreSQL (NeonDB)

TailwindCSS + ShadCN UI

A complete relational database with:

Property

Owner

Assessment

Sale

Improvement

User (auth-ready)

A reporting API powered by SQL queries & materialized view

A stored procedure for bulk land-value adjustments

🚀 Features
✔ Full CRUD for Properties

Insert, update, delete, or query properties using a friendly UI.

✔ Owner Linking or Auto-Creation

User can:

Provide an existing owner ID, or

Enter name/phone/email to auto-create a new owner

✔ Sales & Assessment Recording

The upsert action can create:

Optional sale record

Optional assessment record

✔ Advanced SQL Reporting

UI buttons run:

Properties with owners

Avg sale price by ZIP

Property list by folio

Sales history

All results show directly in the Results output panel.

✔ Stored Procedure Integration

Bulk land-value adjustments by ZIP code are executed from the UI using:

CALL sp_adjust_land_values_by_zip(zip, percent)

🏗 Project Structure
app/
  api/
    properties/route.ts     # Main CRUD + SP execution
    sql/route.ts            # SQL reporting queries
  page.tsx                  # UI
prisma/
  schema.prisma             # Prisma schema
.env.local                  # Database connection URL
README.md                   # This file

⚙️ Installation & Setup
1️⃣ Clone the Repo
git clone https://github.com/ChrisCS-50/DB-Property-Appraisal/tree/main-v2

2️⃣ Install Dependencies
npm install

3️⃣ Create .env.local
DATABASE_URL="postgres://<user>:<password>@<host>/<dbname>?sslmode=require"

4️⃣ Sync Prisma
npx prisma db pull
npx prisma generate

5️⃣ Start Application
npm run dev

🗄️ Database Schema (FULL SQL)

This section provides ALL SQL needed to completely rebuild the database as required by this version of the application.

Run these SQL blocks in order on your NeonDB console.

🔷 1. ENUM: User Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
  END IF;
END$$;

🔷 2. OWNER TABLE
DROP TABLE IF EXISTS "Owner" CASCADE;
CREATE TABLE "Owner" (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(120)
);

CREATE INDEX "Owner_name_idx" ON "Owner"(name);

🔷 3. PROPERTY TABLE

Includes zipCode and no longer references Neighborhood.

DROP TABLE IF EXISTS "Property" CASCADE;
CREATE TABLE "Property" (
  id             SERIAL PRIMARY KEY,
  folio          TEXT NOT NULL,
  address        TEXT,
  "zipCode"      TEXT,
  "landValue"    NUMERIC(12,2),
  "buildingValue" NUMERIC(12,2),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerId"      INTEGER,
  CONSTRAINT "Property_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "Owner"(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX "Property_folio_key" ON "Property"(folio);
CREATE INDEX "Property_ownerId_idx"       ON "Property"("ownerId");
CREATE INDEX "Property_landValue_idx"     ON "Property"("landValue");
CREATE INDEX "Property_buildingValue_idx" ON "Property"("buildingValue");

🔷 4. ASSESSMENT TABLE
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

CREATE INDEX "Assessment_propertyId_idx" ON "Assessment"("propertyId");
CREATE INDEX "Assessment_year_idx"       ON "Assessment"(year);

🔷 5. IMPROVEMENT TABLE
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

CREATE INDEX "Improvement_propertyId_idx" ON "Improvement"("propertyId");
CREATE INDEX "Improvement_type_idx"       ON "Improvement"(type);

🔷 6. SALE TABLE
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

CREATE INDEX "Sale_propertyId_idx" ON "Sale"("propertyId");
CREATE INDEX "Sale_saleDate_idx"   ON "Sale"("saleDate");
CREATE INDEX "Sale_price_idx"      ON "Sale"(price);

🔷 7. USER TABLE
DROP TABLE IF EXISTS "User" CASCADE;
CREATE TABLE "User" (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  password   TEXT NOT NULL,           -- hashed password
  role       "Role" NOT NULL DEFAULT 'VIEWER'::"Role",
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX "User_email_key" ON "User"(email);
CREATE INDEX        "User_email_idx" ON "User"(email);

🔷 8. SUMMARY VIEW (UPDATED)

We removed all Neighborhood fields and added zipCode.

DROP VIEW IF EXISTS "v_property_summary";

CREATE VIEW "v_property_summary" AS
SELECT
  p.id,
  p.folio,
  p.address,
  p."zipCode"       AS zip_code,
  p."landValue"     AS land_value,
  p."buildingValue" AS building_value,
  p."updatedAt"     AS updated_at,
  o.name            AS owner_name,
  o.email           AS owner_email,
  a."marketValue"   AS latest_market_value,
  a."assessedVal"   AS latest_assessed_value,
  a."landVal"       AS latest_land_value,
  a."bldgVal"       AS latest_building_value
FROM "Property" p
LEFT JOIN "Owner" o
  ON o.id = p."ownerId"
LEFT JOIN LATERAL (
  SELECT
    "marketValue",
    "assessedVal",
    "landVal",
    "bldgVal"
  FROM "Assessment" a
  WHERE a."propertyId" = p.id
  ORDER BY "year" DESC
  LIMIT 1
) a ON TRUE;

🔷 9. STORED PROCEDURE

Bulk Land Value Adjustment by ZIP Code

CREATE OR REPLACE PROCEDURE sp_adjust_land_values_by_zip(
    p_zip_code   TEXT,
    p_percent    NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Property"
  SET "landValue" = "landValue" * (1 + p_percent / 100.0),
      "updatedAt" = NOW()
  WHERE "zipCode" = p_zip_code
    AND "landValue" IS NOT NULL;
END;
$$;

🧪 Sample Data (Optional)

You may insert your own or use generated seed data.
The app does not require seed data, but empty tables will mean empty query results until users begin inserting.

🔌 API Endpoints
Endpoint	Purpose
/api/properties	CRUD, owner linking, sale creation, assessment creation, stored procedure execution
/api/sql	Raw SQL reporting queries
/api/reports/summary	Returns v_property_summary view
🖥 UI Actions Supported
CRUD

Insert / Upsert property (+ owner / assessment / sale)

Get property by folio

Range search by landValue

Update address

Adjust land value %

Delete by folio

Count above buildingValue threshold

SQL Reports

Rendered inside the UI Result panel:

Properties with owner

Avg sale price by zip

Property list (all folios)

Sales history

Stored Procedure

Executed through UI input:

Bulk land value adjust by ZIP and percent

📝 Developer Notes
If the DB Schema Changes

Run:

npx prisma db pull
npx prisma generate