-- Phase 02 Plan 01 — RLS Policies: clients + pipeline_stages
-- Reference: 02-RESEARCH.md Pattern 3, 01-CONTEXT.md D-11
-- CRITICAL: all function calls wrapped in (SELECT ...) for query plan caching

ALTER TABLE public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- clients_select: admin/financeiro/visualizador veem tudo; corretor só os próprios
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR assigned_to = (SELECT auth.uid())
    )
  );

-- clients_insert: apenas admin e corretor
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- clients_update: admin tudo; corretor apenas os próprios
CREATE POLICY "clients_update" ON public.clients
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

-- pipeline_stages: leitura livre dentro do tenant
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
  );

-- pipeline_stages: gestão apenas admin
CREATE POLICY "pipeline_stages_admin_manage" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );
