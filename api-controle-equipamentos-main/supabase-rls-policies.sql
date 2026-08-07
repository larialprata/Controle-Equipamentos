-- ============================================================
-- RLS Policies para Supabase – AUTENTICADO + API (postgres)
-- Rode no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
--
-- authenticated = Supabase Auth (JWT) – app/Supabase client
-- postgres     = conexão direta (DATABASE_URL) – sua API Nest/Prisma
-- Anon continua sem acesso.
-- ============================================================

-- 1) EQUIPMENTS
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read equipments" ON public.equipments;
CREATE POLICY "Allow read equipments"
  ON public.equipments FOR SELECT
  TO authenticated, postgres
  USING (true);

DROP POLICY IF EXISTS "Allow insert equipments" ON public.equipments;
CREATE POLICY "Allow insert equipments"
  ON public.equipments FOR INSERT
  TO authenticated, postgres
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update equipments" ON public.equipments;
CREATE POLICY "Allow update equipments"
  ON public.equipments FOR UPDATE
  TO authenticated, postgres
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete equipments" ON public.equipments;
CREATE POLICY "Allow delete equipments"
  ON public.equipments FOR DELETE
  TO authenticated, postgres
  USING (true);

-- 2) CONTRACTS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read contracts" ON public.contracts;
CREATE POLICY "Allow read contracts"
  ON public.contracts FOR SELECT
  TO authenticated, postgres
  USING (true);

DROP POLICY IF EXISTS "Allow insert contracts" ON public.contracts;
CREATE POLICY "Allow insert contracts"
  ON public.contracts FOR INSERT
  TO authenticated, postgres
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update contracts" ON public.contracts;
CREATE POLICY "Allow update contracts"
  ON public.contracts FOR UPDATE
  TO authenticated, postgres
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete contracts" ON public.contracts;
CREATE POLICY "Allow delete contracts"
  ON public.contracts FOR DELETE
  TO authenticated, postgres
  USING (true);

-- 3) USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read users" ON public.users;
CREATE POLICY "Allow read users"
  ON public.users FOR SELECT
  TO authenticated, postgres
  USING (true);

DROP POLICY IF EXISTS "Allow insert users" ON public.users;
CREATE POLICY "Allow insert users"
  ON public.users FOR INSERT
  TO authenticated, postgres
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update users" ON public.users;
CREATE POLICY "Allow update users"
  ON public.users FOR UPDATE
  TO authenticated, postgres
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete users" ON public.users;
CREATE POLICY "Allow delete users"
  ON public.users FOR DELETE
  TO authenticated, postgres
  USING (true);

-- 4) OBRAS
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read obras" ON public.obras;
CREATE POLICY "Allow read obras"
  ON public.obras FOR SELECT
  TO authenticated, postgres
  USING (true);

DROP POLICY IF EXISTS "Allow insert obras" ON public.obras;
CREATE POLICY "Allow insert obras"
  ON public.obras FOR INSERT
  TO authenticated, postgres
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update obras" ON public.obras;
CREATE POLICY "Allow update obras"
  ON public.obras FOR UPDATE
  TO authenticated, postgres
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete obras" ON public.obras;
CREATE POLICY "Allow delete obras"
  ON public.obras FOR DELETE
  TO authenticated, postgres
  USING (true);

-- 5) CHECK_OPERATIONS
ALTER TABLE public.check_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read check_operations" ON public.check_operations;
CREATE POLICY "Allow read check_operations"
  ON public.check_operations FOR SELECT
  TO authenticated, postgres
  USING (true);

DROP POLICY IF EXISTS "Allow insert check_operations" ON public.check_operations;
CREATE POLICY "Allow insert check_operations"
  ON public.check_operations FOR INSERT
  TO authenticated, postgres
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update check_operations" ON public.check_operations;
CREATE POLICY "Allow update check_operations"
  ON public.check_operations FOR UPDATE
  TO authenticated, postgres
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete check_operations" ON public.check_operations;
CREATE POLICY "Allow delete check_operations"
  ON public.check_operations FOR DELETE
  TO authenticated, postgres
  USING (true);

-- Fim
-- authenticated = app com Supabase Auth (JWT). postgres = sua API Nest/Prisma (DATABASE_URL).
-- Anon continua sem acesso.
