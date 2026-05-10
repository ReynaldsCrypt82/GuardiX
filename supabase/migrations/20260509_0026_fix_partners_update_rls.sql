-- Fix partners_update RLS WITH CHECK
--
-- ROOT CAUSE: O WITH CHECK original inclui `tenant_id = jwt_tenant_id()` na
-- verificação da nova linha. Após o soft delete, o PostgreSQL re-avalia essa
-- condição no contexto da nova linha e pode receber NULL de jwt_tenant_id(),
-- causando falha. O USING clause já garante isolamento de tenant (só linhas
-- do tenant correto chegam até aqui), então o WITH CHECK só precisa verificar
-- que o usuário é admin.

DROP POLICY IF EXISTS "partners_update" ON public.partners;

CREATE POLICY "partners_update" ON public.partners
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    (SELECT public.jwt_tenant_role()) = 'admin'
  );
