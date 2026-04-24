-- Phase 02 Plan 01 — RLS Policies: client_interactions + client_tasks
-- Interactions: visible to anyone who can see the parent client
-- Tasks: admin vê todas; corretor/financeiro vê atribuídas a si mesmos

ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tasks        ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- client_interactions
-- SELECT: quem pode ver o cliente pode ver as interações
-- INSERT: admin, corretor (apenas para clientes visíveis)
-- UPDATE/DELETE: não permitido (audit trail imutável — apenas service_role)
-- ========================================================================
CREATE POLICY "interactions_select" ON public.client_interactions
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
          OR c.assigned_to = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "interactions_insert" ON public.client_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id
        AND c.tenant_id = (SELECT public.jwt_tenant_id())
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) = 'admin'
          OR c.assigned_to = (SELECT auth.uid())
        )
    )
  );

-- ========================================================================
-- client_tasks
-- SELECT: admin tudo; corretor/financeiro: atribuídas a si; visualizador: tudo (read)
-- INSERT: admin + corretor (para clientes visíveis)
-- UPDATE: admin tudo; corretor/financeiro: apenas as próprias (marcar concluída)
-- ========================================================================
CREATE POLICY "tasks_select" ON public.client_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','visualizador')
      OR assigned_to = (SELECT auth.uid())
    )
  );

CREATE POLICY "tasks_insert" ON public.client_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id
        AND c.tenant_id = (SELECT public.jwt_tenant_id())
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) = 'admin'
          OR c.assigned_to = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "tasks_update" ON public.client_tasks
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR assigned_to = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR assigned_to = (SELECT auth.uid())
    )
  );
