-- Phase 03 Plan 01 — Seguros RLS: policies, claims, endorsements
-- References: 03-RESEARCH.md Pattern 4, 03-CONTEXT.md D-11 (RBAC herda Phase 1)
-- CRITICAL: todas as chamadas de função envolvidas em (SELECT ...) para caching do query plan

ALTER TABLE public.policies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

-- policies_select: admin/financeiro/visualizador veem tudo; corretor só as próprias
CREATE POLICY "policies_select" ON public.policies
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR assigned_to = (SELECT auth.uid())
    )
  );

-- policies_insert: apenas admin e corretor
CREATE POLICY "policies_insert" ON public.policies
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- policies_update: admin tudo; corretor apenas as próprias
CREATE POLICY "policies_update" ON public.policies
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  );

-- claims_select: tenant isolation + role check (admin/financeiro/visualizador veem tudo; corretor via apólice)
CREATE POLICY "claims_select" ON public.claims
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR EXISTS (
        SELECT 1 FROM public.policies p
        WHERE p.id = claims.policy_id
          AND p.assigned_to = (SELECT auth.uid())
          AND p.deleted_at IS NULL
      )
    )
  );

-- claims_insert: admin e corretor (tenant_id no claim previne cross-tenant — Pitfall 4)
CREATE POLICY "claims_insert" ON public.claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- claims_update: admin tudo; corretor apenas via apólice própria
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
        )
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
  );

-- endorsements: mesmo padrão dos claims
CREATE POLICY "endorsements_select" ON public.endorsements
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR EXISTS (
        SELECT 1 FROM public.policies p
        WHERE p.id = endorsements.policy_id
          AND p.assigned_to = (SELECT auth.uid())
          AND p.deleted_at IS NULL
      )
    )
  );

CREATE POLICY "endorsements_insert" ON public.endorsements
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

CREATE POLICY "endorsements_update" ON public.endorsements
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
  );
