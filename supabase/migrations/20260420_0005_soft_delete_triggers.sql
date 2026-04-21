-- Phase 01 Plan 01 — Soft Delete Enforcement (LGPD / D-12)
-- Prevents hard DELETE by non-service_role callers on tenant data tables
-- Downstream plans must use: UPDATE SET deleted_at = NOW() instead of DELETE
-- LGPD compliance: preserves audit trail for data subjects (T-01-01-05)

CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION
      'Hard DELETE forbidden on % — use soft delete (deleted_at = NOW())',
      TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_tenants_no_hard_delete
  BEFORE DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

CREATE TRIGGER trg_profiles_no_hard_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
