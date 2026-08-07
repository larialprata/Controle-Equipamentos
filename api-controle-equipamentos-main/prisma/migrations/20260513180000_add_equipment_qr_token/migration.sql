-- AlterTable
ALTER TABLE "equipments" ADD COLUMN "qr_token" TEXT;

-- Backfill existing rows so QR links keep working
UPDATE "equipments" SET "qr_token" = "id" WHERE "qr_token" IS NULL;

ALTER TABLE "equipments" ALTER COLUMN "qr_token" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "equipments_qr_token_key" ON "equipments"("qr_token");
