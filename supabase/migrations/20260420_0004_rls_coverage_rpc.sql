-- Phase 01 Plan 01 — RLS Coverage CI Gate RPC
-- Creates: public.check_rls_coverage() — returns tables in public schema without RLS enabled
-- Security: SECURITY DEFINER so service_role callers can read pg_tables
--           REVOKE from anon/authenticated — only service_role may call (T-01-01-07)
-- Usage: admin.rpc('check_rls_coverage') should return [] in CI; non-empty = migration error

CREATE OR REPLACE FUNCTION public.check_rls_coverage()
  RETURNS TABLE(tablename TEXT)
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
  SELECT t.tablename::TEXT
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND NOT t.rowsecurity
    AND t.tablename NOT LIKE 'schema_%'
$$;

-- Lock down: only service_role should call this CI gate (T-01-01-07)
REVOKE ALL ON FUNCTION public.check_rls_coverage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rls_coverage() TO service_role;
