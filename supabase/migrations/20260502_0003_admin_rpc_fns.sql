-- Funções RPC para operações administrativas em auth.users
-- Usadas por server actions (service_role) para contornar limitações
-- da auth.admin API com usuários criados via SQL direto.

-- ── Atualiza role + tenant_id no app_metadata ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_app_metadata(
  p_user_id   UUID,
  p_role      TEXT,
  p_tenant_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET
    raw_app_meta_data = raw_app_meta_data
      || jsonb_build_object('role', p_role, 'tenant_id', p_tenant_id::text),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ── Atualiza e-mail diretamente ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_email(
  p_user_id UUID,
  p_email   TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET
    email      = p_email,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Atualiza também no identity record (email provider)
  UPDATE auth.identities
  SET
    provider_id     = p_email,
    identity_data   = identity_data || jsonb_build_object('email', p_email),
    updated_at      = NOW()
  WHERE user_id = p_user_id
    AND provider  = 'email';
END;
$$;

-- Restringe execução ao service_role (server actions)
REVOKE ALL ON FUNCTION public.admin_set_user_app_metadata FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_user_email         FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_set_user_app_metadata TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_set_user_email         TO service_role;
