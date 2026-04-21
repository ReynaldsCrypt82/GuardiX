-- Phase 01 Plan 01 — RLS Policies
-- Enables RLS on all 3 tables and creates tenant-isolation policies
-- CRITICAL: All USING clauses wrap helpers in (SELECT ...) for PostgreSQL query-plan caching (Pitfall 4 / T-01-01-04)
-- CRITICAL: Only app_metadata is referenced — never user_metadata (Pitfall 3 / T-01-01-02)

-- =============================================================================
-- Enable RLS
-- =============================================================================
ALTER TABLE public.tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- tenants policies
-- User may only read their own tenant row; admin may update it
-- =============================================================================
CREATE POLICY "tenant_self_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.tenant_id()) AND deleted_at IS NULL);

CREATE POLICY "tenant_self_update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.tenant_id()) AND (SELECT auth.tenant_role()) = 'admin')
  WITH CHECK (id = (SELECT auth.tenant_id()));

-- =============================================================================
-- profiles policies
-- All users in a tenant may read profiles; only admin may insert/update
-- =============================================================================
CREATE POLICY "profiles_select_own_tenant" ON public.profiles
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT auth.tenant_id()));

CREATE POLICY "profiles_insert_admin_only" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT auth.tenant_id())
    AND (SELECT auth.tenant_role()) = 'admin'
  );

CREATE POLICY "profiles_update_admin_or_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT auth.tenant_id())
    AND (id = (SELECT auth.uid()) OR (SELECT auth.tenant_role()) = 'admin')
  )
  WITH CHECK (tenant_id = (SELECT auth.tenant_id()));

-- =============================================================================
-- user_invitations policies
-- Only tenant admin can manage invitations (T-01-01-03)
-- =============================================================================
CREATE POLICY "invitations_admin_manage" ON public.user_invitations
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT auth.tenant_id())
    AND (SELECT auth.tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT auth.tenant_id())
    AND (SELECT auth.tenant_role()) = 'admin'
  );
