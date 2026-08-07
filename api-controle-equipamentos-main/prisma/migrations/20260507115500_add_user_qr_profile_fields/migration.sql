ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "equipment_type_id" TEXT,
ADD COLUMN IF NOT EXISTS "ativo_placa" TEXT,
ADD COLUMN IF NOT EXISTS "qr_payload" TEXT,
ADD COLUMN IF NOT EXISTS "qr_generated_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_equipment_type_id_fkey'
  ) THEN
    ALTER TABLE "users"
    ADD CONSTRAINT "users_equipment_type_id_fkey"
    FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
