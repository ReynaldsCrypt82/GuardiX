'use server'
import { revalidatePath } from 'next/cache'
import { startOfMonth, startOfToday, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { resolveCommissionRate } from '@/lib/utils/commission-rate'
import {
  markCommissionPaidSchema,
  registerEstornoSchema,
  registerCorrecaoSchema,
} from '@/lib/validations/commission-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

/**
 * markCommissionPaidAction — D-09 trigger + D-06 split + D-10 ledger imutavel.
 *
 * Fluxo:
 * 1. Valida input com Zod safeParse
 * 2. Auth + role guard (admin ou corretor)
 * 3. Busca a apolice ou cota — verifica que commission_paid_at IS NULL (idempotencia)
 * 4. Busca o broker_profile do assigned_to
 * 5. Se ha partner_id, busca o partner
 * 6. Calcula amount via resolveCommissionRate (D-08 base x rate)
 * 7. INSERE 1 ou 2 commission_entries (broker + partner se aplicavel) — D-06
 * 8. UPDATE commission_paid_at na apolice/cota
 * 9. revalidatePath
 *
 * Pitfall 1: idempotencia via verificacao de commission_paid_at antes de inserir.
 * Pitfall 4: createClient (anon + RLS), NUNCA createAdminClient.
 * Pitfall 7: reference_month via startOfMonth(startOfToday()) (DST-safe).
 */
export async function markCommissionPaidAction(
  slug: string,
  sourceType: 'policy' | 'quota',
  sourceId: string,
  notes?: string,
) {
  // Valida os parametros tipados via Zod (mesmo schema, agora alimentado por args nao por FormData).
  // O dialog que chama esta action ja coleta props tipadas (sourceType, sourceId, notes),
  // entao FormData nao agrega valor — passamos os valores diretamente.
  const parsed = markCommissionPaidSchema.safeParse({
    source_type: sourceType,
    source_id: sourceId,
    notes,
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissao para registrar comissao.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { source_type, source_id, notes: parsedNotes } = parsed.data

  // 1. Buscar a fonte (policy ou quota) com dados necessarios para calcular
  let baseAmount: number
  let productType: string
  let assignedTo: string
  let partnerId: string | null
  let policyIdField: string | null = null
  let quotaIdField: string | null = null

  if (source_type === 'policy') {
    const { data: policy, error: policyErr } = await supabase
      .from('policies')
      .select('id, type, premio_total, assigned_to, partner_id, commission_paid_at')
      .eq('id', source_id)
      .is('deleted_at', null)
      .single()

    if (policyErr || !policy) return { error: { _form: ['Apolice nao encontrada.'] } }
    if (policy.commission_paid_at) {
      return { error: { _form: ['Comissao ja registrada para este item. Use estorno ou correcao para ajustes.'] } }
    }

    baseAmount = Number(policy.premio_total)
    productType = policy.type as string
    assignedTo = policy.assigned_to as string
    partnerId = (policy.partner_id as string | null) ?? null
    policyIdField = source_id
  } else {
    // source_type === 'quota'
    const { data: quota, error: quotaErr } = await supabase
      .from('consortium_quotas')
      .select('id, assigned_to, partner_id, commission_paid_at, group:consortium_groups!group_id(type, credit_value)')
      .eq('id', source_id)
      .is('deleted_at', null)
      .single()

    if (quotaErr || !quota) return { error: { _form: ['Cota nao encontrada.'] } }
    if (quota.commission_paid_at) {
      return { error: { _form: ['Comissao ja registrada para este item. Use estorno ou correcao para ajustes.'] } }
    }

    const group = quota.group as { type: string; credit_value: number } | null
    if (!group) return { error: { _form: ['Grupo de consorcio nao encontrado.'] } }

    baseAmount = Number(group.credit_value)
    productType = `consorcio_${group.type}` // D-07: prefixo consorcio_
    assignedTo = quota.assigned_to as string
    partnerId = (quota.partner_id as string | null) ?? null
    quotaIdField = source_id
  }

  // 2. Buscar broker_profile do assigned_to (rate do corretor)
  const { data: brokerProfile } = await supabase
    .from('broker_profiles')
    .select('id, commission_rate_default, commission_rate_overrides')
    .eq('id', assignedTo)
    .is('deleted_at', null)
    .single()

  if (!brokerProfile) {
    return { error: { _form: ['Perfil de corretor nao cadastrado para este corretor. Cadastre antes de registrar a comissao.'] } }
  }

  const brokerRate = resolveCommissionRate(
    brokerProfile.commission_rate_overrides as Record<string, number | undefined> | null,
    Number(brokerProfile.commission_rate_default),
    productType,
  )
  const brokerAmount = Number((baseAmount * brokerRate).toFixed(2))

  // 3. Se ha partner_id, buscar partner e calcular rate (D-06 split)
  let partnerEntry: {
    rate: number
    amount: number
  } | null = null

  if (partnerId) {
    const { data: partner } = await supabase
      .from('partners')
      .select('id, commission_rate_default, commission_rate_overrides')
      .eq('id', partnerId)
      .is('deleted_at', null)
      .single()

    if (partner) {
      const partnerRate = resolveCommissionRate(
        partner.commission_rate_overrides as Record<string, number | undefined> | null,
        Number(partner.commission_rate_default),
        productType,
      )
      partnerEntry = {
        rate: partnerRate,
        amount: Number((baseAmount * partnerRate).toFixed(2)),
      }
    }
  }

  // 4. reference_month (DST-safe) — Pitfall 7
  const referenceMonth = format(startOfMonth(startOfToday()), 'yyyy-MM-dd')

  // 5. Construir entries (1 ou 2)
  const entries: Array<Record<string, unknown>> = [
    {
      tenant_id: tenantId,
      entry_type: 'comissao',
      broker_id: assignedTo,
      partner_id: null,
      policy_id: policyIdField,
      quota_id: quotaIdField,
      amount: brokerAmount,
      rate_used: brokerRate,
      reference_month: referenceMonth,
      notes: parsedNotes || null,
    },
  ]

  if (partnerEntry && partnerId) {
    entries.push({
      tenant_id: tenantId,
      entry_type: 'comissao',
      broker_id: null,
      partner_id: partnerId,
      policy_id: policyIdField,
      quota_id: quotaIdField,
      amount: partnerEntry.amount,
      rate_used: partnerEntry.rate,
      reference_month: referenceMonth,
      notes: parsedNotes || null,
    })
  }

  // 6. INSERT entries
  const { error: insertErr } = await supabase
    .from('commission_entries')
    .insert(entries)

  if (insertErr) {
    return { error: { _form: ['Erro ao registrar comissao no ledger.'] } }
  }

  // 7. UPDATE commission_paid_at na fonte
  const sourceTable = source_type === 'policy' ? 'policies' : 'consortium_quotas'
  const { error: updateErr } = await supabase
    .from(sourceTable)
    .update({ commission_paid_at: new Date().toISOString() })
    .eq('id', source_id)

  if (updateErr) {
    // Entries ja inseridas. Re-tentativa pelo admin sera bloqueada pela verificacao
    // idempotente — Pitfall 1 (conforme RESEARCH.md Pattern 3 Opcao A).
    return { error: { _form: ['Comissao registrada, mas falha ao atualizar status. Recarregue a tela.'] } }
  }

  revalidatePath(`/${slug}/seguros/${source_id}`)
  revalidatePath(`/${slug}/consorcio/${source_id}`)
  revalidatePath(`/${slug}/corretores/${assignedTo}`)
  return { success: true, entries_count: entries.length }
}

/**
 * registerEstornoAction — D-10: estorno eh NOVO lancamento com amount NEGATIVO.
 * NUNCA edita ou deleta a entry original.
 */
export async function registerEstornoAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  if (raw.amount !== undefined) raw.amount = Number(raw.amount)

  const parsed = registerEstornoSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissao para registrar estorno.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { source_type, source_id, recipient_type, recipient_id, amount, reference_month, notes } = parsed.data

  const { error } = await supabase
    .from('commission_entries')
    .insert({
      tenant_id: tenantId,
      entry_type: 'estorno',
      broker_id: recipient_type === 'broker' ? recipient_id : null,
      partner_id: recipient_type === 'partner' ? recipient_id : null,
      policy_id: source_type === 'policy' ? source_id : null,
      quota_id: source_type === 'quota' ? source_id : null,
      amount, // NEGATIVO (validado pelo schema)
      rate_used: null,
      reference_month,
      notes,
    })

  if (error) return { error: { _form: ['Erro ao registrar estorno.'] } }

  revalidatePath(`/${slug}/corretores/${recipient_id}`)
  return { success: true }
}

/**
 * registerCorrecaoAction — D-10: correcao eh NOVO lancamento complementar.
 */
export async function registerCorrecaoAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  if (raw.amount !== undefined) raw.amount = Number(raw.amount)

  const parsed = registerCorrecaoSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissao para registrar correcao.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { source_type, source_id, recipient_type, recipient_id, amount, reference_month, notes } = parsed.data

  const { error } = await supabase
    .from('commission_entries')
    .insert({
      tenant_id: tenantId,
      entry_type: 'correcao',
      broker_id: recipient_type === 'broker' ? recipient_id : null,
      partner_id: recipient_type === 'partner' ? recipient_id : null,
      policy_id: source_type === 'policy' ? source_id : null,
      quota_id: source_type === 'quota' ? source_id : null,
      amount,
      rate_used: null,
      reference_month,
      notes,
    })

  if (error) return { error: { _form: ['Erro ao registrar correcao.'] } }

  revalidatePath(`/${slug}/corretores/${recipient_id}`)
  return { success: true }
}
