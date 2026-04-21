'use server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils/slug'
import {
  registerFullSchema,
  loginSchema,
  type FormError,
} from '@/lib/validations/auth-schemas'

/**
 * registerTenant — atomic tenant onboarding.
 *
 * Steps:
 *   1. Validate FormData via registerFullSchema (Zod)
 *   2. Pre-check CNPJ uniqueness (friendlier error than DB FK violation)
 *   3. Generate unique slug from company name
 *   4. INSERT tenants row
 *   5. auth.admin.createUser with app_metadata (tenant_id, role, slug) — NEVER user_metadata
 *   6. INSERT profiles row
 *   7. signInWithPassword (SSR client sets cookies)
 *   8. redirect(/{slug}/dashboard)
 *
 * Rollback rules (Pitfall 4 — partial onboarding):
 *   - createUser fails → DELETE tenant
 *   - profile INSERT fails → DELETE auth user + tenant
 */
export async function registerTenant(
  formData: FormData,
): Promise<{ error?: FormError } | void> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Coerce acceptTerms — HTML checkbox sends "on"; JSON may send "true" or true
  const acceptTermsRaw = raw.acceptTerms
  if (acceptTermsRaw === 'on' || acceptTermsRaw === 'true' || acceptTermsRaw === true) {
    raw.acceptTerms = true
  } else {
    raw.acceptTerms = false
  }

  const parsed = registerFullSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as FormError }
  }

  const { companyName, cnpj, segment, adminName, email, password } = parsed.data
  const admin = createAdminClient()

  // 1. Pre-check CNPJ uniqueness
  const { data: existing } = await admin
    .from('tenants')
    .select('id')
    .eq('cnpj', cnpj)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return {
      error: {
        cnpj: [
          'Este CNPJ já possui uma conta no NEXUS. Faça login ou recupere o acesso.',
        ],
      },
    }
  }

  // 2. Generate unique slug
  const { data: slugRows } = await admin.from('tenants').select('slug')
  const existingSlugs = (slugRows ?? []).map((r) => r.slug)
  const slug = generateSlug(companyName, existingSlugs)

  // 3. INSERT tenant
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({ name: companyName, slug, cnpj, segment })
    .select()
    .single()

  if (tenantErr || !tenant) {
    // PostgreSQL unique-constraint violation — race condition on CNPJ
    const isUniqueViolation =
      (tenantErr as { code?: string } | null)?.code === '23505'
    if (isUniqueViolation) {
      return {
        error: {
          cnpj: ['Este CNPJ já possui uma conta no NEXUS. Faça login ou recupere o acesso.'],
        },
      }
    }
    return {
      error: {
        _form: ['Ocorreu um erro ao criar sua corretora. Tente novamente.'],
      },
    }
  }

  // 4. Create auth user — app_metadata only (never user_metadata for tenant_id/role)
  const { data: authRes, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      tenant_id: tenant.id,
      role: 'admin',
      slug: tenant.slug,
    },
    user_metadata: { full_name: adminName },
  })

  if (authErr || !authRes?.user) {
    // ROLLBACK — delete the tenant we just created
    const { error: rollbackTenantErr } = await admin
      .from('tenants')
      .delete()
      .eq('id', tenant.id)
    if (rollbackTenantErr) {
      console.error('[registerTenant] rollback: failed to delete tenant', tenant.id, rollbackTenantErr)
    }

    const msg = authErr?.message?.toLowerCase() ?? ''
    const isDupe =
      msg.includes('already registered') ||
      msg.includes('duplicate') ||
      msg.includes('already exists')

    if (isDupe) {
      return {
        error: {
          email: [
            'Este e-mail já está em uso. Tente fazer login ou use outro e-mail.',
          ],
        },
      }
    }
    return {
      error: { _form: ['Ocorreu um erro ao criar o usuário admin. Tente novamente.'] },
    }
  }

  // 5. INSERT profile
  const { error: profileErr } = await admin.from('profiles').insert({
    id: authRes.user.id,
    tenant_id: tenant.id,
    full_name: adminName,
    role: 'admin',
  })

  if (profileErr) {
    // ROLLBACK cascade: delete auth user + tenant
    const { error: rollbackUserErr } = await admin.auth.admin.deleteUser(authRes.user.id)
    if (rollbackUserErr) {
      console.error('[registerTenant] rollback: failed to delete auth user', authRes.user.id, rollbackUserErr)
    }
    const { error: rollbackTenantErr2 } = await admin
      .from('tenants')
      .delete()
      .eq('id', tenant.id)
    if (rollbackTenantErr2) {
      console.error('[registerTenant] rollback: failed to delete tenant', tenant.id, rollbackTenantErr2)
    }
    return {
      error: {
        _form: ['Ocorreu um erro ao finalizar o cadastro. Tente novamente.'],
      },
    }
  }

  // 6. Auto-login via SSR client (sets session cookies)
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInErr) {
    // User created successfully but auto-login failed — direct to manual login
    redirect(`/login?next=/${slug}/dashboard`)
  }

  redirect(`/${slug}/dashboard`)
}

/**
 * loginWithPassword — signs in and redirects to /{slug}/dashboard.
 * Generic error message to prevent account enumeration (T-01-03-01).
 */
export async function loginWithPassword(
  formData: FormData,
): Promise<{ error?: FormError } | void> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as FormError }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return {
      error: {
        _form: [
          'E-mail ou senha incorretos. Verifique seus dados e tente novamente.',
        ],
      },
    }
  }

  // Read slug from JWT claims to build redirect URL
  const anySupa = supabase.auth as unknown as {
    getClaims?: () => Promise<{
      data: {
        claims: { sub?: string; app_metadata?: { slug?: string } } | null
      } | null
    }>
  }

  let slug: string | undefined

  if (typeof anySupa.getClaims === 'function') {
    const { data } = await anySupa.getClaims()
    slug = data?.claims?.app_metadata?.slug
  }

  if (!slug) {
    const { data } = await supabase.auth.getUser()
    slug = (data.user?.app_metadata as { slug?: string } | undefined)?.slug
  }

  // Honour ?next= param from protected-route redirect
  // Guard against open-redirect: reject protocol-relative URLs (//evil.com) and any
  // string containing a colon (https: or javascript:)
  function isSafeInternalPath(path: string): boolean {
    return path.startsWith('/') && !path.startsWith('//') && !path.includes(':')
  }

  const next = formData.get('next')?.toString()
  if (next && isSafeInternalPath(next)) {
    redirect(next)
  }

  redirect(slug ? `/${slug}/dashboard` : '/login')
}

/**
 * signOut — clears session cookies and redirects to /login.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
