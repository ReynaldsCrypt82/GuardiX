-- Adiciona campo de categoria ao cliente: novo ou renovacao
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IN ('novo', 'renovacao'));
