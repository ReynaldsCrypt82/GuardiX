-- Phase 02 Plan 01 — Clients & Pipeline Stages Schema
-- References: 02-RESEARCH.md Pattern 2, 02-CONTEXT.md D-01..D-09

-- ========================================================================
-- Table: public.pipeline_stages (D-09 — configurável por tenant)
-- ========================================================================
CREATE TABLE public.pipeline_stages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  position   INTEGER NOT NULL,
  is_closed  BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stages_tenant_id ON public.pipeline_stages(tenant_id);
CREATE UNIQUE INDEX idx_pipeline_stages_tenant_position
  ON public.pipeline_stages(tenant_id, position)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================================================
-- Table: public.clients (D-01..D-04)
-- ========================================================================
CREATE TABLE public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  type        TEXT NOT NULL CHECK (type IN ('pf','pj')),
  document    VARCHAR(14) NOT NULL,
  name        TEXT NOT NULL,
  responsible TEXT,
  email       TEXT,
  phone       TEXT,
  address     JSONB,
  stage_id    UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clients_document_length CHECK (char_length(document) IN (11, 14)),
  CONSTRAINT clients_document_digits CHECK (document ~ '^[0-9]+$')
);

ALTER TABLE public.clients
  ADD CONSTRAINT clients_document_tenant_unique UNIQUE (tenant_id, document);

CREATE INDEX idx_clients_tenant_id   ON public.clients(tenant_id);
CREATE INDEX idx_clients_assigned_to ON public.clients(assigned_to);
CREATE INDEX idx_clients_stage_id    ON public.clients(stage_id);
CREATE INDEX idx_clients_document    ON public.clients(document);
CREATE INDEX idx_clients_name        ON public.clients(name);
CREATE INDEX idx_clients_deleted_at  ON public.clients(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
