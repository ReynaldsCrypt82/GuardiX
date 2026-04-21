-- Phase 01 Plan 01 — RLS JWT Claim Helpers
-- Creates: auth.tenant_id(), auth.tenant_role(), auth.tenant_slug()
-- Security: SECURITY INVOKER (not DEFINER) + STABLE for query plan caching
-- CRITICAL: reads EXCLUSIVELY from app_metadata (not user_metadata — see Pitfall 3 / D-17)

CREATE OR REPLACE FUNCTION auth.tenant_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
AS $$
  SELECT NULLIF(
    ((SELECT current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata' ->> 'tenant_id'),
    ''
  )::UUID
$$;

CREATE OR REPLACE FUNCTION auth.tenant_role()
  RETURNS TEXT
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
AS $$
  SELECT ((SELECT current_setting('request.jwt.claims', true))::jsonb
    -> 'app_metadata' ->> 'role')
$$;

CREATE OR REPLACE FUNCTION auth.tenant_slug()
  RETURNS TEXT
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
AS $$
  SELECT ((SELECT current_setting('request.jwt.claims', true))::jsonb
    -> 'app_metadata' ->> 'slug')
$$;

-- Grant execute to all roles that make API requests
GRANT EXECUTE ON FUNCTION auth.tenant_id()   TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.tenant_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.tenant_slug() TO authenticated, anon, service_role;
