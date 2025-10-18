-- AlterTable
ALTER TABLE "public"."Property" ADD COLUMN     "neighborhoodId" INTEGER,
ADD COLUMN     "ownerId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Owner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(120),

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Assessment" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "marketValue" DECIMAL(12,2) NOT NULL,
    "assessedVal" DECIMAL(12,2) NOT NULL,
    "landVal" DECIMAL(12,2) NOT NULL,
    "bldgVal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Improvement" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "yearBuilt" INTEGER,
    "value" DECIMAL(12,2),

    CONSTRAINT "Improvement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sale" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "docNumber" VARCHAR(40),
    "buyer" VARCHAR(120),
    "seller" VARCHAR(120),

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Neighborhood" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Neighborhood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Owner_name_idx" ON "public"."Owner"("name");

-- CreateIndex
CREATE INDEX "Assessment_year_idx" ON "public"."Assessment"("year");

-- CreateIndex
CREATE INDEX "Assessment_propertyId_idx" ON "public"."Assessment"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_propertyId_year_key" ON "public"."Assessment"("propertyId", "year");

-- CreateIndex
CREATE INDEX "Improvement_type_idx" ON "public"."Improvement"("type");

-- CreateIndex
CREATE INDEX "Improvement_propertyId_idx" ON "public"."Improvement"("propertyId");

-- CreateIndex
CREATE INDEX "Sale_saleDate_idx" ON "public"."Sale"("saleDate");

-- CreateIndex
CREATE INDEX "Sale_price_idx" ON "public"."Sale"("price");

-- CreateIndex
CREATE INDEX "Sale_propertyId_idx" ON "public"."Sale"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Neighborhood_code_key" ON "public"."Neighborhood"("code");

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "public"."Property"("ownerId");

-- CreateIndex
CREATE INDEX "Property_neighborhoodId_idx" ON "public"."Property"("neighborhoodId");

-- CreateIndex
CREATE INDEX "Property_landValue_idx" ON "public"."Property"("landValue");

-- CreateIndex
CREATE INDEX "Property_buildingValue_idx" ON "public"."Property"("buildingValue");

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Property" ADD CONSTRAINT "Property_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "public"."Neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assessment" ADD CONSTRAINT "Assessment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Improvement" ADD CONSTRAINT "Improvement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
