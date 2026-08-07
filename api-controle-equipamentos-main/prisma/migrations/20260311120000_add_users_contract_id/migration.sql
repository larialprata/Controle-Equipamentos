-- AlterTable: vincula usuário a um contrato (opcional). Se a coluna já existir, ignore este migration.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;

-- CreateIndex (optional - FK will be added by Prisma)
-- AddForeignKey if not exists: users.contract_id -> contracts.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_contract_id_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
