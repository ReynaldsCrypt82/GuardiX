-- Phase 02 Plan 01 — Pipeline Defaults + Soft-Delete Triggers
-- References: 02-RESEARCH.md Pattern 6 + Pitfall 3; 02-CONTEXT.md D-09

-- ========================================================================
-- Trigger: popular 4 estágios default ao criar tenant
--   Defaults (02-CONTEXT.md <specifics>):
--     Prospecção (azul #3b82f6, position 1)
--     Proposta   (amarelo #eab308, position 2)
--     Aguardando (laranja #f97316, position 3)
--     Fechado    (verde #22c55e, position 4, is_closed=true)
-- ========================================================================
CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.pipeline_stages (tenant_id, name, color, position, is_closed)
  VALUES
    (NEW.id, 'Prospecção', '#3b82f6', 1, false),
    (NEW.id, 'Proposta',   '#eab308', 2, false),
    (NEW.id, 'Aguardando', '#f97316', 3, false),
    (NEW.id, 'Fechado',    '#22c55e', 4, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenant_default_pipeline
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_pipeline_stages();

-- ========================================================================
-- Backfill: inserir defaults para tenants EXISTENTES que não têm estágios
--   (tenants criados antes desta migration — Phase 1 deixou tenants sem stages)
-- ========================================================================
INSERT INTO public.pipeline_stages (tenant_id, name, color, position, is_closed)
SELECT t.id, v.name, v.color, v.position, v.is_closed
FROM public.tenants t
CROSS JOIN (VALUES
  ('Prospecção', '#3b82f6', 1, false),
  ('Proposta',   '#eab308', 2, false),
  ('Aguardando', '#f97316', 3, false),
  ('Fechado',    '#22c55e', 4, true)
) AS v(name, color, position, is_closed)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages ps
  WHERE ps.tenant_id = t.id AND ps.deleted_at IS NULL
)
AND t.deleted_at IS NULL;

-- ========================================================================
-- Soft-delete enforcement — bloqueia DELETE físico das 4 novas tabelas
-- Reutiliza public.prevent_hard_delete() já criada na migration 0005
-- ========================================================================
CREATE TRIGGER trg_clients_no_hard_delete
  BEFORE DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TRIGGER trg_pipeline_stages_no_hard_delete
  BEFORE DELETE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TRIGGER trg_client_interactions_no_hard_delete
  BEFORE DELETE ON public.client_interactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TRIGGER trg_client_tasks_no_hard_delete
  BEFORE DELETE ON public.client_tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
