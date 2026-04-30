'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createFinancialEntrySchema,
  markFinancialEntryPaidSchema,
  softDeleteFinancialEntrySchema,
} from '@/lib/validations/financial-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

const ALLOWED_ROLES = ['admin', 'financeiro'] as const

/**
 * createFinancialEntryAction — FIN-01, FIN-02 (D-04 criação manual)
 * Cria lançamento receivable ou payable no tenant do usuário autenticado.
 * RBAC: admin + financeiro (D-05).
 */
export async function createFinancialEntryAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Normalizar campos opcionais vazios → null (FormData manda string vazia)
  for (const k of ['policy_id', 'quota_id', 'client_id', 'notes']) {
    if (raw[k] === '' || raw[k] === undefined) raw[k] = null
  }

  const parsed = createFinancialEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])) {
    return { error: { _form: ['Sem permissao para criar lancamento.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { data: insertedRow, error } = await supabase
    .from('financial_entries')
    .insert({
      tenant_id: tenantId,
      entry_type: parsed.data.entry_type,
      description: parsed.data.description,
      amount: parsed.data.amount,
      due_date: parsed.data.due_date,
      status: 'pending',
      policy_id: parsed.data.policy_id ?? null,
      quota_id: parsed.data.quota_id ?? null,
      client_id: parsed.data.client_id ?? null,
      notes: parsed.data.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: ['Erro ao criar lancamento.'] } }

  revalidatePath(`/${slug}/financeiro`)
  if (parsed.data.client_id) revalidatePath(`/${slug}/clientes`)

  return { success: true, entry_id: (insertedRow as { id: string })?.id }
}

/**
 * markFinancialEntryPaidAction — FIN-05 (D-08)
 * Idempotente: rejeita se status já 'paid'.
 * Pitfall 7: revalida /financeiro E /clientes.
 */
export async function markFinancialEntryPaidAction(
  slug: string,
  entryId: string,
  paidAt?: string,
) {
  const parsed = markFinancialEntryPaidSchema.safeParse({ entry_id: entryId, paid_at: paidAt })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])) {
    return { error: { _form: ['Sem permissao para atualizar lancamento.'] } }
  }

  // Idempotência: verificar status atual antes de UPDATE (D-08)
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('id, status')
    .eq('id', entryId)
    .is('deleted_at', null)
    .single()

  if (!entry) return { error: { _form: ['Lancamento nao encontrado.'] } }
  if ((entry as { status: string }).status === 'paid') {
    return { error: { _form: ['Lancamento ja marcado como pago.'] } }
  }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      status: 'paid',
      paid_at: parsed.data.paid_at ?? new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) return { error: { _form: ['Erro ao atualizar lancamento.'] } }

  revalidatePath(`/${slug}/financeiro`)
  revalidatePath(`/${slug}/clientes`)
  return { success: true }
}

/**
 * softDeleteFinancialEntryAction — D-12 padrão Phase 1
 * Marca deleted_at; trigger prevent_hard_delete bloqueia DELETE direto.
 */
export async function softDeleteFinancialEntryAction(slug: string, entryId: string) {
  const parsed = softDeleteFinancialEntrySchema.safeParse({ entry_id: entryId })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!ALLOWED_ROLES.includes(role as typeof ALLOWED_ROLES[number])) {
    return { error: { _form: ['Sem permissao para excluir lancamento.'] } }
  }

  const { error } = await supabase
    .from('financial_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', entryId)
    .is('deleted_at', null)

  if (error) return { error: { _form: ['Erro ao excluir lancamento.'] } }

  revalidatePath(`/${slug}/financeiro`)
  revalidatePath(`/${slug}/clientes`)
  return { success: true }
}
