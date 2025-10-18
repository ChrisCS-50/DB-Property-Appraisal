-- CreateTable
CREATE TABLE "public"."Property" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "address" TEXT,
    "landValue" DECIMAL(12,2),
    "buildingValue" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_folio_key" ON "public"."Property"("folio");
