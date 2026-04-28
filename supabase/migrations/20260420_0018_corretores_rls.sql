-- Phase 04 Plan 01 — RLS: broker_profiles, partners, commission_entries
-- References: 04-RESEARCH.md Pattern 1 (Append-Only Ledger), Migration Strategy table
-- CRITICAL: commission_entries SEM UPDATE/DELETE policies — ausencia = bloqueio

ALTER TABLE public.broker_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- broker_profiles
-- D-03: apenas admin pode INSERT/UPDATE; todos os roles autenticados leem
-- corretor pode ler somente o proprio (id = auth.uid())
-- ========================================================================
CREATE POLICY "broker_profiles_select" ON public.broker_profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR id = (SELECT auth.uid())
    )
  );

CREATE POLICY "broker_profiles_insert" ON public.broker_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );

CREATE POLICY "broker_profiles_update" ON public.broker_profiles
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );

-- ========================================================================
-- partners
-- D-04 / D-03: apenas admin INSERT/UPDATE; todos roles leem (D-12 dashboards)
-- ========================================================================
CREATE POLICY "partners_select" ON public.partners
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "partners_insert" ON public.partners
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );

CREATE POLICY "partners_update" ON public.partners
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );

-- ========================================================================
-- commission_entries — APPEND-ONLY (D-10)
-- SELECT: admin/financeiro veem tudo; corretor ve as proprias (broker_id = auth.uid())
-- INSERT: admin e corretor podem inserir
-- UPDATE: SEM POLICY — proibido
-- DELETE: SEM POLICY — proibido
-- ========================================================================
CREATE POLICY "commission_entries_select" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR broker_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "commission_entries_insert" ON public.commission_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- CRITICAL: NUNCA adicionar policies de UPDATE ou DELETE em commission_entries
-- A ausencia destas policies = acesso negado por default (D-10 imutabilidade)
