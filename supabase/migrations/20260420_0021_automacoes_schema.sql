-- Phase 07 Plan 01 — Automacoes & IA Schema (D-01, D-02, D-03)
-- References: 07-CONTEXT.md D-02 (3 eventos core), D-03 (webhook_logs append-only), D-06 (templates por tenant)
-- 07-RESEARCH.md New Tables Required

-- ========================================================================
-- webhook_configs — config de webhook por tenant + evento (D-01, D-02)
-- ========================================================================
CREATE TABLE public.webhook_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  event_type    TEXT NOT NULL CHECK (event_type IN ('policy_expiring','financial_overdue','consortium_contemplated')),
  url           TEXT NOT NULL,
  days_before   INTEGER CHECK (days_before > 0),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX webhook_configs_tenant_event_unique ON public.webhook_configs (tenant_id, event_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_webhook_configs_tenant_id ON public.webhook_configs(tenant_id);
CREATE INDEX idx_webhook_configs_event_type ON public.webhook_configs(event_type);
CREATE INDEX idx_webhook_configs_active ON public.webhook_configs(active) WHERE active = true AND deleted_at IS NULL;

CREATE TRIGGER trg_webhook_configs_updated_at BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_webhook_configs_no_hard_delete BEFORE DELETE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

-- ========================================================================
-- webhook_logs — historico append-only de disparos (D-03 logar e seguir)
-- ========================================================================
CREATE TABLE public.webhook_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  event_type    TEXT NOT NULL,
  config_id     UUID REFERENCES public.webhook_configs(id),
  url_destino   TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  http_status   INTEGER,
  error_message TEXT,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_webhook_logs_tenant_created ON public.webhook_logs(tenant_id, triggered_at DESC);
CREATE INDEX idx_webhook_logs_config_id ON public.webhook_logs(config_id);

-- ========================================================================
-- email_templates — template por tenant + evento (D-06, D-07 fallback default)
-- ========================================================================
CREATE TABLE public.email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  event_type    TEXT NOT NULL CHECK (event_type IN ('policy_expiring','financial_overdue','consortium_contemplated')),
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX email_templates_tenant_event_unique ON public.email_templates (tenant_id, event_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_templates_tenant_id ON public.email_templates(tenant_id);
CREATE INDEX idx_email_templates_event_type ON public.email_templates(event_type);

CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_email_templates_no_hard_delete BEFORE DELETE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
