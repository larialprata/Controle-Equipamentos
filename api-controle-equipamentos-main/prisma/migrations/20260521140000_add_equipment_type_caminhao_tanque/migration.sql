-- Tipo de equipamento: Caminhão Tanque
INSERT INTO "equipment_types" ("id", "name", "active", "created_at")
SELECT gen_random_uuid()::text, 'Caminhão Tanque', true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "equipment_types" WHERE "name" = 'Caminhão Tanque'
);
