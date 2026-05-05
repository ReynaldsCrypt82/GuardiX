'use server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  portalCadastroSchema,
  portalLoginSchema,
  type PortalFormError,
} from '@/lib/validations/portal-auth-schemas'

/**
 * registerPortalClient — auto-cadastro do portal por CPF.
 *
 * Flow (D-03, D-04, D-05, D-10):
 *   1. Parse + validate FormData
 *   2. Lookup tenant by slug (admin client, RLS bypass)
 *   3. Verify CPF in clients with explicit tenant_id + document column + type=pf
 *   4. Check existing portal_clients row by client_id
 *   5. Create auth user with app_metadata.role=portal_client + tenant_id + portal_slug
 *   6. INSERT portal_clients (rollback auth user on failure)
 *   7. Auto-login via SSR client
 *   8. redirect /{slug}/portal/home
 *
 * Security:
 *   - T-1-01: Generic CPF-not-found message (Pitfall 2 — security by obscurity)
 *   - T-1-04: UNIQUE(client_id) DB constraint blocks race-condition duplicates
 *   - T-1-08: role set in app_metadata ONLY — never user_metadata
 */
export async function registerPortalClient(
  formData: FormData,
): Promise<{ error?: PortalFormError } | void> {
  const parsed = portalCadastroSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as PortalFormError }
  }

  const { cpf, email, password, slug } = parsed.data
  const admin = createAdminClient()

  // 1. Lookup tenant by slug
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (!tenant) {
    return { error: { _form: ['Corretora não encontrada.'] } }
  }

  // 2. Verify CPF in clients with explicit tenant_id (D-05) — column is `document`
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('document', cpf)
    .eq('type', 'pf')
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) {
    // Generic message — never reveal if CPF exists in another tenant (T-1-01)
    return { error: { cpf: ['CPF não encontrado para esta corretora.'] } }
  }

  // 3. Check existing portal_client for this client
  const { data: existing } = await admin
    .from('portal_clients')
    .select('id')
    .eq('client_id', client.id)
    .maybeSingle()

  if (existing) {
    return { error: { cpf: ['Já existe uma conta para este CPF. Faça login.'] } }
  }

  // 4. Create auth user with app_metadata (D-01, never user_metadata for role/tenant)
  const { data: authRes, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: 'portal_client',
      tenant_id: tenant.id,
      portal_slug: tenant.slug,
    },
  })

  if (authErr || !authRes?.user) {
    const msg = authErr?.message?.toLowerCase() ?? ''
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return { error: { email: ['Este e-mail já está em uso no portal.'] } }
    }
    return { error: { _form: ['Erro ao criar conta. Tente novamente.'] } }
  }

  // 5. INSERT portal_clients
  const { error: pcErr } = await admin.from('portal_clients').insert({
    id: authRes.user.id,
    tenant_id: tenant.id,
    client_id: client.id,
  })

  if (pcErr) {
    // ROLLBACK auth user
    const { error: rollbackErr } = await admin.auth.admin.deleteUser(authRes.user.id)
    if (rollbackErr) {
      console.error('[registerPortalClient] rollback failed', authRes.user.id, rollbackErr)
    }
    // 23505 = UNIQUE violation on client_id (race-condition catch)
    const code = (pcErr as { code?: string }).code
    if (code === '23505') {
      return { error: { cpf: ['Já existe uma conta para este CPF. Faça login.'] } }
    }
    return { error: { _form: ['Erro ao finalizar cadastro. Tente novamente.'] } }
  }

  // 6. Auto-login (SSR client sets cookies)
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    redirect(`/${tenant.slug}/portal/login`)
  }

  redirect(`/${tenant.slug}/portal/home`)
}

/**
 * loginPortalClient — login para portal_clients.
 *
 * Security:
 *   - T-1-06: Signs out user if role != portal_client (blocks internal users via portal login)
 *   - T-1-07: Re-validates with Zod server-side regardless of client validation
 */
export async function loginPortalClient(
  formData: FormData,
): Promise<{ error?: PortalFormError } | void> {
  const parsed = portalLoginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as PortalFormError }
  }

  const { email, password, slug } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: { _form: ['E-mail ou senha incorretos.'] } }
  }

  const role = (data.user?.app_metadata as { role?: string } | undefined)?.role
  if (role !== 'portal_client') {
    // T-1-06: Internal user trying portal login — sign them out immediately
    await supabase.auth.signOut()
    return { error: { _form: ['Acesso não autorizado ao portal.'] } }
  }

  redirect(`/${slug}/portal/home`)
}
