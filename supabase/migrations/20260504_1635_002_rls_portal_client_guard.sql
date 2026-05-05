-- Phase 01 Plan 01 — RLS Portal Client Guard
-- Patches internal table SELECT policies that lack a role guard.
--
-- ROOT CAUSE (Pitfall 3 in RESEARCH.md):
-- portal_clients have tenant_id in their JWT app_metadata (required for portal RLS).
-- Any SELECT policy that only checks jwt_tenant_id() without a role check will
-- ALSO authorize portal_clients — leaking internal data (pipeline_stages, profiles, etc.)
--
-- FIX: Add jwt_tenant_role() != 'portal_client' to every USING clause that lacks a role guard.
-- Existing function public.jwt_tenant_role() (from 0002_rls_helpers.sql) is used directly.
-- No new jwt_role() function needed — jwt_tenant_role() is the established codebase pattern.

-- ============================================================================
-- 1. tenants — tenant_self_select
-- BEFORE: id = jwt_tenant_id() AND deleted_at IS NULL
-- AFTER:  adds role guard (portal_client must NOT read internal tenant row)
-- ============================================================================
DROP POLICY IF EXISTS "tenant_self_select" ON public.tenants;
CREATE POLICY "tenant_self_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) != 'portal_client'
  );

-- ============================================================================
-- 2. profiles — profiles_select_own_tenant
-- BEFORE: tenant_id = jwt_tenant_id() (no role guard)
-- AFTER:  blocks portal_client from reading staff profiles
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_own_tenant" ON public.profiles;
CREATE POLICY "profiles_select_own_tenant" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) != 'portal_client'
  );

-- ============================================================================
-- 3. pipeline_stages — pipeline_stages_select
-- BEFORE: tenant_id = jwt_tenant_id() AND deleted_at IS NULL (no role guard)
-- AFTER:  blocks portal_client from reading CRM pipeline stages
-- ============================================================================
DROP POLICY IF EXISTS "pipeline_stages_select" ON public.pipeline_stages;
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) != 'portal_client'
  );

-- ============================================================================
-- 4. consortium_groups — consortium_groups_select
-- BEFORE: tenant_id = jwt_tenant_id() AND deleted_at IS NULL (no role guard)
-- AFTER:  blocks portal_client from reading internal consortium group details
-- NOTE:   Phases 3/4 will add a separate portal-scoped SELECT policy for consortium_groups
-- ============================================================================
DROP POLICY IF EXISTS "consortium_groups_select" ON public.consortium_groups;
CREATE POLICY "consortium_groups_select" ON public.consortium_groups
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) != 'portal_client'
  );

-- ============================================================================
-- 5. partners — partners_select
-- BEFORE: tenant_id = jwt_tenant_id() AND deleted_at IS NULL (no role guard)
-- AFTER:  blocks portal_client from reading broker partner data
-- ============================================================================
DROP POLICY IF EXISTS "partners_select" ON public.partners;
CREATE POLICY "partners_select" ON public.partners
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) != 'portal_client'
  );
