-- Phase 03 Plan 01 — Consórcio RLS: consortium_groups, consortium_quotas
-- References: 03-RESEARCH.md Pattern 4, 03-CONTEXT.md D-11 (RBAC herda Phase 1)
-- CRITICAL: (SELECT ...) wrapping em todas as chamadas de função nas policies

ALTER TABLE public.consortium_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consortium_quotas ENABLE ROW LEVEL SECURITY;

-- consortium_groups_select: tenant isolation + roles
CREATE POLICY "consortium_groups_select" ON public.consortium_groups
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
  );

-- consortium_groups_insert: admin e corretor
CREATE POLICY "consortium_groups_insert" ON public.consortium_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- consortium_groups_update: admin tudo; corretor só os próprios (via quotas assigned_to)
CREATE POLICY "consortium_groups_update" ON public.consortium_groups
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
  );

-- consortium_quotas_select: admin/financeiro/visualizador veem tudo; corretor só as próprias
CREATE POLICY "consortium_quotas_select" ON public.consortium_quotas
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR assigned_to = (SELECT auth.uid())
    )
  );

-- consortium_quotas_insert: admin e corretor
CREATE POLICY "consortium_quotas_insert" ON public.consortium_quotas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- consortium_quotas_update: admin tudo; corretor apenas as próprias
CREATE POLICY "consortium_quotas_update" ON public.consortium_quotas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  );
