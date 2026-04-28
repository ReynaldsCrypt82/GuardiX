-- Phase 04 Plan 01 — Corretores & Comissoes Schema
-- References: 04-CONTEXT.md D-02, D-04, D-10
-- broker_profiles: 1:1 com profiles.id, soft delete
-- partners: standalone (sem login), soft delete
-- commission_entries: append-only, SEM updated_at, SEM deleted_at (imutável por design)

-- ========================================================================
-- broker_profiles — atributos de negocio do corretor (D-02)
-- id e FK 1:1 para profiles(id) — corretor existe como profile + broker_profile
-- ========================================================================
CREATE TABLE public.broker_profiles (
  id                        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id                 UUID NOT NULL REFERENCES public.tenants(id),
  susep_number              TEXT,
  monthly_goal              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_goal >= 0),
  commission_rate_default   NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (commission_rate_default >= 0 AND commission_rate_default <= 1),
  commission_rate_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_broker_profiles_tenant_id  ON public.broker_profiles(tenant_id);
CREATE INDEX idx_broker_profiles_deleted_at ON public.broker_profiles(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_broker_profiles_updated_at
  BEFORE UPDATE ON public.broker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_broker_profiles_no_hard_delete
  BEFORE DELETE ON public.broker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

-- ========================================================================
-- partners — parceiros externos (D-04) sem login (entidade independente)
-- ========================================================================
CREATE TABLE public.partners (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES public.tenants(id),
  name                      TEXT NOT NULL,
  cnpj                      TEXT,
  contact_email             TEXT,
  contact_phone             TEXT,
  commission_rate_default   NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (commission_rate_default >= 0 AND commission_rate_default <= 1),
  commission_rate_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partners_tenant_id  ON public.partners(tenant_id);
CREATE INDEX idx_partners_deleted_at ON public.partners(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_partners_no_hard_delete
  BEFORE DELETE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

-- ========================================================================
-- commission_entries — ledger append-only (D-10)
-- CRITICAL: SEM updated_at, SEM deleted_at, SEM trigger prevent_hard_delete
-- (RLS bloqueia UPDATE e DELETE pela AUSENCIA de policies)
-- ========================================================================
CREATE TABLE public.commission_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('comissao','estorno','correcao')),
  broker_id       UUID REFERENCES public.profiles(id),
  partner_id      UUID REFERENCES public.partners(id),
  policy_id       UUID REFERENCES public.policies(id),
  quota_id        UUID REFERENCES public.consortium_quotas(id),
  amount          NUMERIC(12,2) NOT NULL,
  rate_used       NUMERIC(5,4),
  reference_month DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Garante que cada entry tem broker_id OU partner_id (xor logico)
  CONSTRAINT commission_entries_recipient_check CHECK (
    (broker_id IS NOT NULL AND partner_id IS NULL)
    OR (broker_id IS NULL AND partner_id IS NOT NULL)
  ),
  -- Garante que cada entry tem policy_id OU quota_id
  CONSTRAINT commission_entries_source_check CHECK (
    (policy_id IS NOT NULL AND quota_id IS NULL)
    OR (policy_id IS NULL AND quota_id IS NOT NULL)
  )
);

CREATE INDEX idx_commission_entries_tenant_id        ON public.commission_entries(tenant_id);
CREATE INDEX idx_commission_entries_broker_id        ON public.commission_entries(broker_id) WHERE broker_id IS NOT NULL;
CREATE INDEX idx_commission_entries_partner_id       ON public.commission_entries(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_commission_entries_policy_id        ON public.commission_entries(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX idx_commission_entries_quota_id         ON public.commission_entries(quota_id) WHERE quota_id IS NOT NULL;
CREATE INDEX idx_commission_entries_reference_month  ON public.commission_entries(reference_month);

-- Sem trigger set_updated_at (nao ha updated_at)
-- Sem trigger prevent_hard_delete (nao ha deleted_at; RLS barra tudo via ausencia de policy)
