-- Fix: RLS policies for client_interactions and client_tasks must allow
-- access to partner clients (assigned_to IS NULL, partner_id IS NOT NULL).
-- After migration 20260509_0025_clients_partner_id.sql, assigned_to can be
-- NULL for partner-sourced clients, making NULL = auth.uid() evaluate to NULL
-- (false) and blocking corretores from inserting/reading interactions and tasks.

-- ─── client_interactions ────────────────────────────────────────────────────

DROP POLICY IF EXISTS interactions_insert ON public.client_interactions;
DROP POLICY IF EXISTS interactions_select ON public.client_interactions;

CREATE POLICY interactions_select ON public.client_interactions
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_interactions.client_id
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
          OR c.assigned_to = (SELECT auth.uid())
          OR c.assigned_to IS NULL  -- clientes de parceiro: visíveis a todo o tenant
        )
    )
  );

CREATE POLICY interactions_insert ON public.client_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_interactions.client_id
        AND c.tenant_id = (SELECT public.jwt_tenant_id())
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) = 'admin'
          OR c.assigned_to = (SELECT auth.uid())
          OR c.assigned_to IS NULL  -- clientes de parceiro: visíveis a todo o tenant
        )
    )
  );

-- ─── client_tasks ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tasks_insert ON public.client_tasks;
DROP POLICY IF EXISTS tasks_select ON public.client_tasks;

CREATE POLICY tasks_select ON public.client_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tasks.client_id
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) IN ('admin','visualizador')
          OR c.assigned_to = (SELECT auth.uid())
          OR c.assigned_to IS NULL  -- clientes de parceiro: visíveis a todo o tenant
        )
    )
  );

CREATE POLICY tasks_insert ON public.client_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_tasks.client_id
        AND c.tenant_id = (SELECT public.jwt_tenant_id())
        AND c.deleted_at IS NULL
        AND (
          (SELECT public.jwt_tenant_role()) = 'admin'
          OR c.assigned_to = (SELECT auth.uid())
          OR c.assigned_to IS NULL  -- clientes de parceiro: visíveis a todo o tenant
        )
    )
  );
