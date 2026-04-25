-- Phase 03 Plan 01 — Consórcio Schema: consortium_groups, consortium_quotas
-- References: 03-RESEARCH.md Pattern 1, 03-CONTEXT.md D-04
-- D-04 additive: post_contemplation_stage enum para CON-04 (pipeline pós-contemplação)

CREATE TABLE public.consortium_groups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id),
  administrator      TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('auto','imovel','servico')),
  credit_value       NUMERIC(14,2) NOT NULL CHECK (credit_value > 0),
  term_months        INTEGER NOT NULL CHECK (term_months > 0),
  start_date         DATE NOT NULL,
  total_quotas       INTEGER NOT NULL CHECK (total_quotas > 0),
  next_assembly_date DATE,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consortium_groups_tenant_id           ON public.consortium_groups(tenant_id);
CREATE INDEX idx_consortium_groups_next_assembly_date  ON public.consortium_groups(next_assembly_date) WHERE next_assembly_date IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_consortium_groups_deleted_at          ON public.consortium_groups(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_consortium_groups_updated_at
  BEFORE UPDATE ON public.consortium_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_consortium_groups_no_hard_delete
  BEFORE DELETE ON public.consortium_groups
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TABLE public.consortium_quotas (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES public.tenants(id),
  group_id                  UUID NOT NULL REFERENCES public.consortium_groups(id),
  client_id                 UUID NOT NULL REFERENCES public.clients(id),
  quota_number              TEXT NOT NULL,
  monthly_payment           NUMERIC(12,2) NOT NULL CHECK (monthly_payment >= 0),
  status                    TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','contemplado','cancelado')),
  contemplation_date        DATE,
  contemplation_type        TEXT CHECK (contemplation_type IN ('sorteio','lance')),
  lance_value               NUMERIC(14,2),
  post_contemplation_stage  TEXT CHECK (post_contemplation_stage IN ('aguardando_docs','em_analise','credito_liberado')),
  post_contemplation_notes  TEXT,
  assigned_to               UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quotas_number_group_unique UNIQUE (group_id, quota_number)
);

CREATE INDEX idx_consortium_quotas_tenant_id   ON public.consortium_quotas(tenant_id);
CREATE INDEX idx_consortium_quotas_group_id    ON public.consortium_quotas(group_id);
CREATE INDEX idx_consortium_quotas_client_id   ON public.consortium_quotas(client_id);
CREATE INDEX idx_consortium_quotas_assigned_to ON public.consortium_quotas(assigned_to);
CREATE INDEX idx_consortium_quotas_status      ON public.consortium_quotas(status);
CREATE INDEX idx_consortium_quotas_deleted_at  ON public.consortium_quotas(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_consortium_quotas_updated_at
  BEFORE UPDATE ON public.consortium_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_consortium_quotas_no_hard_delete
  BEFORE DELETE ON public.consortium_quotas
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
