-- Phase 03 Plan 01 — Seguros Schema: policies, claims, endorsements
-- References: 03-RESEARCH.md Pattern 1, 03-CONTEXT.md D-01, D-05
-- D-12 (Phase 1): soft delete via deleted_at + prevent_hard_delete trigger

CREATE TABLE public.policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  policy_number   TEXT NOT NULL,
  insurer         TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('auto','vida','residencial','empresarial','saude','outros')),
  vigencia_inicio DATE NOT NULL,
  vigencia_fim    DATE NOT NULL,
  premio_total    NUMERIC(12,2) NOT NULL CHECK (premio_total >= 0),
  client_id       UUID NOT NULL REFERENCES public.clients(id),
  assigned_to     UUID NOT NULL REFERENCES public.profiles(id),
  type_data       JSONB NOT NULL DEFAULT '{}',
  observacoes     TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT policies_number_tenant_unique UNIQUE (tenant_id, policy_number)
);

CREATE INDEX idx_policies_tenant_id    ON public.policies(tenant_id);
CREATE INDEX idx_policies_client_id    ON public.policies(client_id);
CREATE INDEX idx_policies_assigned_to  ON public.policies(assigned_to);
CREATE INDEX idx_policies_vigencia_fim ON public.policies(vigencia_fim);
CREATE INDEX idx_policies_type         ON public.policies(type);
CREATE INDEX idx_policies_deleted_at   ON public.policies(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_policies_no_hard_delete
  BEFORE DELETE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TABLE public.claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  policy_id       UUID NOT NULL REFERENCES public.policies(id),
  claim_date      DATE NOT NULL,
  type            TEXT NOT NULL,
  protocol_number TEXT,
  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','encerrado')),
  description     TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_tenant_id  ON public.claims(tenant_id);
CREATE INDEX idx_claims_policy_id  ON public.claims(policy_id);
CREATE INDEX idx_claims_deleted_at ON public.claims(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_claims_no_hard_delete
  BEFORE DELETE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TABLE public.endorsements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id),
  policy_id        UUID NOT NULL REFERENCES public.policies(id),
  endorsement_date DATE NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('inclusao','exclusao','alteracao')),
  description      TEXT NOT NULL,
  premium_impact   NUMERIC(12,2),
  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_endorsements_tenant_id  ON public.endorsements(tenant_id);
CREATE INDEX idx_endorsements_policy_id  ON public.endorsements(policy_id);
CREATE INDEX idx_endorsements_deleted_at ON public.endorsements(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_endorsements_updated_at
  BEFORE UPDATE ON public.endorsements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_endorsements_no_hard_delete
  BEFORE DELETE ON public.endorsements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
