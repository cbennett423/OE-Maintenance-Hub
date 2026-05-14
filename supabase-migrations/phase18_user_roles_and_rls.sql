-- Phase 18: user roles + real RLS policies.
--
-- Introduces a `profiles` table linked 1:1 to auth.users, an is_admin()
-- helper used by every RLS policy, and a trigger that auto-creates a
-- profile row whenever a Supabase auth user is created (e.g. via the
-- invite-user edge function).
--
-- Replaces the existing wide-open `USING (true)` policies on every table
-- with role-aware ones. Two roles only: 'admin' and 'member'.
--
-- Permission summary:
--   * Operational tables (equipment, work_orders, rentals, inventory,
--     mechanics, parts_inventory, equipment_aliases,
--     equipment_hours_history, inventories): fully read/write for any
--     authenticated user.
--   * jobs, settings: read for everyone, write admin-only.
--   * invoices: read/update for everyone, INSERT/DELETE admin-only.
--   * audit_log: SELECT admin-only, INSERT for any authenticated user
--     (so member edits still get audit entries).
--   * profiles: own row readable by self, all rows readable by admin,
--     UPDATE admin-only.
--
-- After running, manually promote the first admin in the SQL editor:
--   UPDATE profiles SET role = 'admin' WHERE email = 'cbennett@oeconstruct.com';

-- ───────────────────────────────────────────────────────────────────
-- profiles table
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────
-- is_admin() helper
-- ───────────────────────────────────────────────────────────────────

-- SECURITY DEFINER so RLS policies can call it without recursing into
-- the profiles policy. Marked STABLE so Postgres can memoize per-query.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ───────────────────────────────────────────────────────────────────
-- Backfill profiles for any existing auth.users rows
-- ───────────────────────────────────────────────────────────────────

INSERT INTO profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────
-- Trigger: auto-create profile when a new auth.users row appears
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ───────────────────────────────────────────────────────────────────
-- profiles RLS
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read own profile or admin" ON profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON profiles;

CREATE POLICY "Read own profile or admin" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "Admin update profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- INSERT happens via the trigger (SECURITY DEFINER, bypasses RLS).
-- DELETE happens via the ON DELETE CASCADE from auth.users.
-- No client-facing INSERT/DELETE policies on purpose.

-- ───────────────────────────────────────────────────────────────────
-- Helper: rewrite policies on a fully-open table to "auth full access"
-- ───────────────────────────────────────────────────────────────────
-- For tables members can do anything on. Drops every known prior
-- policy name and creates one combined ALL policy.

DO $$
DECLARE
  t TEXT;
  open_tables TEXT[] := ARRAY[
    'equipment', 'work_orders', 'rentals', 'mechanics',
    'equipment_aliases', 'parts_inventory',
    'equipment_hours_history', 'inventories'
  ];
BEGIN
  FOREACH t IN ARRAY open_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access %s" ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY "Authenticated full access %s" ON %I
        FOR ALL TO authenticated
        USING (true)
        WITH CHECK (true)
    $f$, t, t);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- jobs + settings: read anyone, write admin
-- ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  admin_write_tables TEXT[] := ARRAY['jobs', 'settings'];
BEGIN
  FOREACH t IN ARRAY admin_write_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin write %s" ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY "Authenticated read %s" ON %I
        FOR SELECT TO authenticated USING (true)
    $f$, t, t);
    EXECUTE format($f$
      CREATE POLICY "Admin write %s" ON %I
        FOR ALL TO authenticated
        USING (is_admin())
        WITH CHECK (is_admin())
    $f$, t, t);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- invoices: members can read + update; admin can also insert/delete
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated read invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated update invoices" ON invoices;
DROP POLICY IF EXISTS "Admin insert invoices" ON invoices;
DROP POLICY IF EXISTS "Admin delete invoices" ON invoices;

CREATE POLICY "Authenticated read invoices" ON invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update invoices" ON invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin insert invoices" ON invoices
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin delete invoices" ON invoices
  FOR DELETE TO authenticated USING (is_admin());

-- ───────────────────────────────────────────────────────────────────
-- audit_log: SELECT admin only; INSERT for any authenticated user
-- ───────────────────────────────────────────────────────────────────
-- INSERT must stay open so member actions still produce audit entries
-- via the existing writeAuditLogBatch() client-side path.

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to audit_log" ON audit_log;
DROP POLICY IF EXISTS "Admin read audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated insert audit_log" ON audit_log;

CREATE POLICY "Admin read audit_log" ON audit_log
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Authenticated insert audit_log" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
-- No UPDATE/DELETE policy → those operations are denied for everyone
-- (audit log is append-only).
