'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Role = 'admin' | 'corretor' | 'financeiro' | 'visualizador'
const VALID_ROLES: Role[] = ['admin', 'corretor', 'financeiro', 'visualizador']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado', caller: null }
  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') return { error: 'Apenas administradores podem gerenciar usuários', caller: null }
  return { error: null, caller: user }
}

function callerTenantId(caller: { app_metadata: object }) {
  return (caller.app_metadata as { tenant_id?: string })?.tenant_id ?? null
}

export async function updateUserProfile(
  slug: string,
  userId: string,
  data: { full_name: string; role: Role; email: string },
): Promise<{ error?: string }> {
  const { error: authErr, caller } = await requireAdmin()
  if (authErr || !caller) return { error: authErr ?? 'Não autorizado' }

  if (!VALID_ROLES.includes(data.role)) return { error: 'Perfil de acesso inválido' }
  if (!data.full_name?.trim()) return { error: 'Nome é obrigatório' }
  if (!data.email?.trim()) return { error: 'E-mail é obrigatório' }

  const admin = createAdminClient()
  const tenantId = callerTenantId(caller)

  // Garante que o target pertence ao mesmo tenant
  const { data: profile } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()
  if (!profile || profile.tenant_id !== tenantId) return { error: 'Usuário não encontrado' }

  // Atualiza email + app_metadata no auth.users
  const { error: authUpdateErr } = await admin.auth.admin.updateUserById(userId, {
    email: data.email.trim(),
    app_metadata: { role: data.role },
  })
  if (authUpdateErr) return { error: 'Erro ao atualizar acesso: ' + authUpdateErr.message }

  // Atualiza profiles
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ full_name: data.full_name.trim(), role: data.role })
    .eq('id', userId)
  if (profileErr) return { error: 'Erro ao salvar perfil' }

  revalidatePath(`/${slug}/configuracoes/usuarios`)
  return {}
}

export async function deactivateUser(slug: string, userId: string): Promise<{ error?: string }> {
  const { error: authErr, caller } = await requireAdmin()
  if (authErr || !caller) return { error: authErr ?? 'Não autorizado' }
  if (caller.id === userId) return { error: 'Você não pode desativar sua própria conta' }

  const admin = createAdminClient()
  const tenantId = callerTenantId(caller)

  const { data: profile } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()
  if (!profile || profile.tenant_id !== tenantId) return { error: 'Usuário não encontrado' }

  const { error } = await admin
    .from('profiles')
    .update({ active: false })
    .eq('id', userId)
  if (error) return { error: 'Erro ao desativar usuário' }

  // Encerra todas as sessões ativas
  await admin.auth.admin.signOut(userId, 'global')

  revalidatePath(`/${slug}/configuracoes/usuarios`)
  return {}
}

export async function reactivateUser(slug: string, userId: string): Promise<{ error?: string }> {
  const { error: authErr, caller } = await requireAdmin()
  if (authErr || !caller) return { error: authErr ?? 'Não autorizado' }

  const admin = createAdminClient()
  const tenantId = callerTenantId(caller)

  const { data: profile } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()
  if (!profile || profile.tenant_id !== tenantId) return { error: 'Usuário não encontrado' }

  const { error } = await admin
    .from('profiles')
    .update({ active: true })
    .eq('id', userId)
  if (error) return { error: 'Erro ao reativar usuário' }

  revalidatePath(`/${slug}/configuracoes/usuarios`)
  return {}
}

export async function generatePasswordLink(userId: string): Promise<{ link?: string; error?: string }> {
  const { error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { data: { user }, error: getUserErr } = await admin.auth.admin.getUserById(userId)
  if (getUserErr || !user?.email) return { error: 'E-mail do usuário não encontrado' }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: user.email,
  })
  if (error || !data) return { error: 'Erro ao gerar link: ' + (error?.message ?? '') }

  return { link: data.properties.action_link }
}
