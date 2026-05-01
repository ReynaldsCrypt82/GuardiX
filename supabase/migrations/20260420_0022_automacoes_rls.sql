-- Phase 07 Plan 01 — RLS: webhook_configs, webhook_logs, email_templates
-- D-09: apenas role='admin' do tenant pode ler/escrever
-- T-07-01 mitigacao: tenant_id isolation via jwt_tenant_id()

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_configs_admin_manage" ON public.webhook_configs
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_logs_admin_select" ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );
-- SEM INSERT/UPDATE/DELETE: escrita apenas via service_role na Edge Function

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_templates_admin_manage" ON public.email_templates
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );
