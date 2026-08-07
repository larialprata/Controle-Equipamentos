-- Nome da empresa como texto livre no equipamento (sem tabela companies)
ALTER TABLE "equipments" ADD COLUMN "company_name" TEXT;

UPDATE "equipments" e
SET "company_name" = c."name"
FROM "companies" c
WHERE e."company_id" = c."id";

ALTER TABLE "equipments" DROP CONSTRAINT IF EXISTS "equipments_company_id_fkey";
ALTER TABLE "equipments" DROP COLUMN "company_id";

DROP TABLE IF EXISTS "companies";
