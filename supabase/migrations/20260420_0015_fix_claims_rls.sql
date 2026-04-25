-- Phase 03 Gap Closure (Plan 05) — CR-02 fix
-- Corrige assimetria de segurança em claims_update: WITH CHECK era mais fraco que USING
-- USING checava: tenant_id + deleted_at IS NULL + (admin OR (corretor AND EXISTS policy assigned_to AND p.deleted_at IS NULL))
-- WITH CHECK antigo só checava: tenant_id (permitia UPDATEs em claims soft-deleted ou em policies não-próprias)
-- Reference: .planning/phases/03-seguros-consorcio/03-VERIFICATION.md Gap 2

DROP POLICY IF EXISTS "claims_update" ON public.claims;

CREATE POLICY "claims_update" ON public.claims
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND EXISTS (
          SELECT 1 FROM public.policies p
          WHERE p.id = claims.policy_id
            AND p.assigned_to = (SELECT auth.uid())
            AND p.deleted_at IS NULL
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND EXISTS (
          SELECT 1 FROM public.policies p
          WHERE p.id = claims.policy_id
            AND p.assigned_to = (SELECT auth.uid())
            AND p.deleted_at IS NULL
        )
      )
    )
  );
