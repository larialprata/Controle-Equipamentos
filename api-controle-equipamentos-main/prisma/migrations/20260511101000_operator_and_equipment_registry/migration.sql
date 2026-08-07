ALTER TABLE "users"
  ALTER COLUMN "phone" DROP NOT NULL,
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "address" DROP NOT NULL,
  ALTER COLUMN "cnh_photo" DROP NOT NULL;

ALTER TABLE "equipments"
  ADD COLUMN IF NOT EXISTS "obra_id" TEXT,
  ADD COLUMN IF NOT EXISTS "equipment_type_id" TEXT,
  ADD COLUMN IF NOT EXISTS "ativo_placa" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "equipments_ativo_placa_key" ON "equipments"("ativo_placa");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipments_obra_id_fkey'
  ) THEN
    ALTER TABLE "equipments"
      ADD CONSTRAINT "equipments_obra_id_fkey"
      FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipments_equipment_type_id_fkey'
  ) THEN
    ALTER TABLE "equipments"
      ADD CONSTRAINT "equipments_equipment_type_id_fkey"
      FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
