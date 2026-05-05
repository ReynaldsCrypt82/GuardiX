-- Phase 01 Plan 01 — Portal do Cliente: portal_clients table + helpers + RLS
-- Implements D-10, D-11 from CONTEXT.md
-- Pattern: SECURITY INVOKER + STABLE + (SELECT current_setting...) for plan caching
-- CRITICAL: portal_clients.id references auth.users(id) ON DELETE CASCADE — orphan prevention

CREATE TABLE public.portal_clients (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  client_id   UUID NOT NULL REFERENCES public.clients(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_clients_client_unique UNIQUE (client_id)
);

CREATE INDEX idx_portal_clients_tenant_id ON public.portal_clients(tenant_id);
CREATE INDEX idx_portal_clients_client_id ON public.portal_clients(client_id);

-- Helper: portal_jwt_tenant_id — reads tenant_id from JWT app_metadata for portal_client
CREATE OR REPLACE FUNCTION public.portal_jwt_tenant_id()
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

-- Helper: portal_jwt_client_id — looks up client_id for the authenticated portal_client
-- Uses SELECT subquery from portal_clients (NOT JWT) — client_id is not in JWT
CREATE OR REPLACE FUNCTION public.portal_jwt_client_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
AS $$
  SELECT pc.client_id
  FROM public.portal_clients pc
  WHERE pc.id = (SELECT auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.portal_jwt_tenant_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.portal_jwt_client_id() TO authenticated, anon, service_role;

-- RLS: portal_clients
ALTER TABLE public.portal_clients ENABLE ROW LEVEL SECURITY;

-- Portal client only sees their own row (no INSERT/UPDATE/DELETE policies — only service_role writes)
CREATE POLICY "portal_clients_self_select" ON public.portal_clients
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
