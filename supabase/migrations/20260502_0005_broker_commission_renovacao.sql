-- Taxa de comissão específica para apólices de renovação
-- Quando NULL, o sistema usa commission_rate_default como fallback
ALTER TABLE public.broker_profiles
  ADD COLUMN IF NOT EXISTS commission_rate_renovacao NUMERIC(6,4)
    CHECK (commission_rate_renovacao >= 0 AND commission_rate_renovacao <= 1);
