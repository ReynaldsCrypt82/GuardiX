-- Phase 02 Plan 01 — Client Interactions & Tasks Schema
-- References: 02-RESEARCH.md Pattern 2, 02-CONTEXT.md D-11..D-15

-- Table: public.client_interactions (timeline — imutável após registro)
CREATE TABLE public.client_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  client_id   UUID NOT NULL REFERENCES public.clients(id),
  type        TEXT NOT NULL CHECK (type IN ('ligacao','email','reuniao','whatsapp','visita')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_client_id   ON public.client_interactions(client_id);
CREATE INDEX idx_interactions_tenant_id   ON public.client_interactions(tenant_id);
CREATE INDEX idx_interactions_occurred_at ON public.client_interactions(occurred_at DESC);

-- Table: public.client_tasks (follow-up)
CREATE TABLE public.client_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id),
  client_id    UUID NOT NULL REFERENCES public.clients(id),
  description  TEXT NOT NULL,
  due_date     DATE NOT NULL,
  assigned_to  UUID NOT NULL REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_tenant_id   ON public.client_tasks(tenant_id);
CREATE INDEX idx_tasks_client_id   ON public.client_tasks(client_id);
CREATE INDEX idx_tasks_assigned_to ON public.client_tasks(assigned_to);
CREATE INDEX idx_tasks_due_date    ON public.client_tasks(due_date)
  WHERE completed_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_tasks_deleted_at  ON public.client_tasks(deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.client_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
