-- Phase 05 Plan 01 — Financeiro Schema (D-01, D-02, D-03)
-- References: 05-CONTEXT.md D-01 (entry_type discriminator), D-02 (campos obrigatórios), D-03 (FKs nullable)
-- financial_entries: status mutável (pending → paid/cancelled), soft delete via deleted_at
-- Diferente de commission_entries (append-only): tem updated_at, deleted_at e RLS UPDATE

-- ========================================================================
-- financial_entries — contas a receber e a pagar (D-01 entry_type discriminator)
-- ========================================================================
CREATE TABLE public.financial_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('receivable', 'payable')),
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at     TIMESTAMPTZ,
  policy_id   UUID REFERENCES public.policies(id),
  quota_id    UUID REFERENCES public.consortium_quotas(id),
  client_id   UUID REFERENCES public.clients(id),
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_tenant_id  ON public.financial_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_due_date   ON public.financial_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status     ON public.financial_entries(status);
CREATE INDEX IF NOT EXISTS idx_financial_entries_client_id  ON public.financial_entries(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_deleted_at ON public.financial_entries(deleted_at) WHERE deleted_at IS NULL;

-- updated_at trigger (padrão Phase 1)
CREATE TRIGGER trg_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- soft delete enforcement (padrão Phase 1 D-12)
CREATE TRIGGER trg_financial_entries_no_hard_delete
  BEFORE DELETE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
