'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { stripCPF } from '@/lib/validations/cpf'
import { stripCNPJ } from '@/lib/validations/cnpj'
import { createClientSchema, type ClientFormError } from '@/lib/validations/client-schemas'

export async function createClientAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: ClientFormError; id?: string } | void> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as ClientFormError }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: { _form: ['Sessão expirada. Faça login novamente.'] } }
  }

  // Enforce: corretor só pode atribuir cliente a si mesmo
  // (defesa em profundidade; RLS clients_insert também bloqueia no banco)
  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor' && parsed.data.assigned_to !== user.id) {
    return { error: { assigned_to: ['Corretor só pode atribuir cliente a si mesmo.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) {
    return { error: { _form: ['Tenant não identificado na sessão.'] } }
  }

  const strip = parsed.data.type === 'pf' ? stripCPF : stripCNPJ
  const base = {
    tenant_id: tenantId,
    type: parsed.data.type,
    document: strip(parsed.data.document),
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    assigned_to: parsed.data.assigned_to,
  }
  const insertRow =
    parsed.data.type === 'pj'
      ? { ...base, responsible: parsed.data.responsible || null }
      : base

  const { data, error } = await supabase
    .from('clients')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') {
      return {
        error: { document: ['Este documento já está cadastrado nesta corretora.'] },
      }
    }
    return { error: { _form: ['Erro ao salvar cliente. Tente novamente.'] } }
  }

  revalidatePath(`/${slug}/clientes`)
  return { id: data.id }
}
