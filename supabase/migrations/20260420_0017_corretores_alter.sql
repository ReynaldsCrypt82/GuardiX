-- Phase 04 Plan 01 — ALTER TABLE policies + consortium_quotas
-- References: 04-CONTEXT.md D-05, D-09
-- Adiciona partner_id (FK nullable) e commission_paid_at (TIMESTAMPTZ nullable)

-- policies
ALTER TABLE public.policies
  ADD COLUMN partner_id UUID REFERENCES public.partners(id),
  ADD COLUMN commission_paid_at TIMESTAMPTZ;

CREATE INDEX idx_policies_partner_id
  ON public.policies(partner_id)
  WHERE partner_id IS NOT NULL;

CREATE INDEX idx_policies_commission_paid_at
  ON public.policies(commission_paid_at)
  WHERE commission_paid_at IS NOT NULL;

-- consortium_quotas
ALTER TABLE public.consortium_quotas
  ADD COLUMN partner_id UUID REFERENCES public.partners(id),
  ADD COLUMN commission_paid_at TIMESTAMPTZ;

CREATE INDEX idx_consortium_quotas_partner_id
  ON public.consortium_quotas(partner_id)
  WHERE partner_id IS NOT NULL;

CREATE INDEX idx_consortium_quotas_commission_paid_at
  ON public.consortium_quotas(commission_paid_at)
  WHERE commission_paid_at IS NOT NULL;
