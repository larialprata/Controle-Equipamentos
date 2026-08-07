-- ============================================================
-- RLS (Row Level Security) e Policies para o Supabase
-- ============================================================
-- Empresas (equipment_owners) e instâncias foram removidos.
-- Fluxo atual: usuário seleciona tipo de equipamento e digita
-- o ativo/placa em campo livre. Não há mais vínculo com empresas.
-- ============================================================

-- Habilitar RLS nas tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_operations ENABLE ROW LEVEL SECURITY;

-- Policies: acesso total para a conexão da API
DROP POLICY IF EXISTS "API full access users" ON users;
CREATE POLICY "API full access users" ON users
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API full access contracts" ON contracts;
CREATE POLICY "API full access contracts" ON contracts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API full access obras" ON obras;
CREATE POLICY "API full access obras" ON obras
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API full access equipment_types" ON equipment_types;
CREATE POLICY "API full access equipment_types" ON equipment_types
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API full access municipalities" ON municipalities;
CREATE POLICY "API full access municipalities" ON municipalities
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API full access equipments" ON equipments;
CREATE POLICY "API full access equipments" ON equipments
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "API full access check_operations" ON check_operations;
CREATE POLICY "API full access check_operations" ON check_operations
  FOR ALL USING (true) WITH CHECK (true);
