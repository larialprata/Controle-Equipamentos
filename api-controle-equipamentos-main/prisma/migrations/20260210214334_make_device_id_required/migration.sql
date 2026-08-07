/*
  Warnings:

  - Made the column `device_id` on table `check_operations` required. This step will fail if there are existing NULL values in that column.

*/
-- Update existing rows
UPDATE "check_operations" SET "device_id" = 'legacy_device' WHERE "device_id" IS NULL;

-- AlterTable
ALTER TABLE "check_operations" ALTER COLUMN "device_id" SET NOT NULL;
