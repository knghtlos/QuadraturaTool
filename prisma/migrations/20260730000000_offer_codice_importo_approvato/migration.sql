-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "codice" TEXT;
ALTER TABLE "Offer" ADD COLUMN "importoApprovato" DECIMAL(14,2);

-- Backfill
UPDATE "Offer"
SET "codice" = "nome"
WHERE "codice" IS NULL
  AND "nome" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Offer_codice_idx" ON "Offer"("codice");
