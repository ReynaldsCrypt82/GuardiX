-- Phase 01 Plan 01 — Foundation Schema
-- Creates: tenants, profiles, user_invitations tables with soft-delete, indexes, updated_at triggers
-- Reference: 01-RESEARCH.md Pattern 4 (lines 421-510)

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_bytes, gen_random_uuid

-- =============================================================================
-- Table: public.tenants (corretoras)
-- =============================================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cnpj CHAR(14) NOT NULL UNIQUE,
  segment TEXT NOT NULL CHECK (segment IN ('seguros','consorcio','ambos')),
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Table: public.profiles (extends auth.users per tenant)
-- =============================================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  full_name   TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin','corretor','financeiro','visualizador')),
  active      BOOLEAN NOT NULL DEFAULT true,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Table: public.user_invitations (invite links for onboarding)
-- =============================================================================
CREATE TABLE public.user_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','corretor','financeiro','visualizador')),
  invited_by    UUID NOT NULL REFERENCES public.profiles(id),
  token         TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at   TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indexes — MANDATORY for RLS performance (Pitfall 5: seq scans under RLS)
-- =============================================================================
CREATE INDEX idx_tenants_slug        ON public.tenants(slug);
CREATE INDEX idx_tenants_cnpj        ON public.tenants(cnpj);
CREATE INDEX idx_tenants_deleted_at  ON public.tenants(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_profiles_tenant_id  ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_invitations_tenant_id ON public.user_invitations(tenant_id);
CREATE INDEX idx_invitations_token     ON public.user_invitations(token);
CREATE INDEX idx_invitations_email     ON public.user_invitations(email)
  WHERE accepted_at IS NULL AND cancelled_at IS NULL;

-- =============================================================================
-- updated_at auto-maintenance trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
