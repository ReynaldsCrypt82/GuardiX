-- Phase 05 Plan 01 — RLS: financial_entries
-- References: 05-CONTEXT.md D-05 (RBAC admin/financeiro), D-10 (corretor responsável vê seus próprios)
-- 05-RESEARCH.md Pattern 2 + Pitfall 1 (RLS UPDATE obrigatória — diferente de commission_entries)
-- 05-RESEARCH.md Threats T-5-01 (cross-tenant), T-5-02 (UPDATE wrong tenant), T-5-04 (badge role filter)

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- financial_entries SELECT
-- D-05: admin/financeiro veem tudo do tenant
-- D-10: corretor vê apenas lançamentos de clientes onde assigned_to = auth.uid()
-- ========================================================================
CREATE POLICY "financial_entries_select" ON public.financial_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND client_id IN (
          SELECT id FROM public.clients
          WHERE assigned_to = (SELECT auth.uid())
          AND deleted_at IS NULL
        )
      )
    )
  );

-- ========================================================================
-- financial_entries INSERT
-- D-05: apenas admin e financeiro podem criar lançamentos
-- ========================================================================
CREATE POLICY "financial_entries_insert" ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
  );

-- ========================================================================
-- financial_entries UPDATE
-- D-05 + D-08: admin e financeiro atualizam status/paid_at/deleted_at
-- Pitfall 1 do RESEARCH: ausência desta policy bloqueia markFinancialEntryPaidAction
-- ========================================================================
CREATE POLICY "financial_entries_update" ON public.financial_entries
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
  );

-- CRITICAL: SEM policy DELETE — soft delete via UPDATE deleted_at
-- Trigger prevent_hard_delete (em 0019) bloqueia DELETE direto
