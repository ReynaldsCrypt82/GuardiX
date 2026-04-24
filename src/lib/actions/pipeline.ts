'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createStageSchema,
  updateClientStageSchema,
} from '@/lib/validations/pipeline-schemas'

async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, tenantId: null, role: null }
  const meta = user.app_metadata as { tenant_id?: string; role?: string }
  return {
    supabase,
    user,
    tenantId: meta.tenant_id ?? null,
    role: meta.role ?? null,
  }
}

/**
 * createStage — cria novo estágio de pipeline para o tenant.
 * Position calculada server-side como MAX(position)+1 para evitar race conditions
 * (UNIQUE index em (tenant_id, position) é a linha de defesa final — T-02-26 aceito).
 */
export async function createStage(
  slug: string,
  formData: FormData,
): Promise<{ error?: Record<string, string[]>; id?: string }> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  // Coerce is_closed — checkbox HTML envia 'on'; JSON pode enviar 'true' ou boolean
  raw.is_closed =
    raw.is_closed === 'true' ||
    raw.is_closed === 'on' ||
    raw.is_closed === true

  const parsed = createStageSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { supabase, tenantId, role } = await getAuthContext()
  if (!tenantId) return { error: { _form: ['Sessão inválida'] } }
  // T-02-21: guard ANTES de chamar DB — RLS é defense-in-depth
  if (role !== 'admin') {
    return { error: { _form: ['Apenas admin pode criar estágios'] } }
  }

  // Calcular próxima position — lê apenas não-deletados do tenant (RLS filtra)
  const { data: maxRow } = await supabase
    .from('pipeline_stages')
    .select('position')
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxRow?.position ?? 0) + 1

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      color: parsed.data.color,
      is_closed: parsed.data.is_closed,
      position: nextPosition,
    })
    .select('id')
    .single()

  if (error) {
    // Violação de UNIQUE (tenant_id, position) — race condition (T-02-26 aceito)
    if ((error as { code?: string }).code === '23505') {
      return { error: { _form: ['Conflito de posição — tente novamente'] } }
    }
    return { error: { _form: ['Erro ao criar estágio'] } }
  }

  revalidatePath(`/${slug}/configuracoes/pipeline`)
  return { id: data.id }
}

/**
 * deleteStage — soft-delete de estágio com realocação segura de clientes.
 * T-02-24: bloqueia exclusão do único estágio ativo.
 * Pitfall 3: realoca clientes ANTES de soft-deletar o estágio.
 */
export async function deleteStage(
  slug: string,
  stageId: string,
): Promise<{ error?: Record<string, string[]>; relocated?: number }> {
  const { supabase, role } = await getAuthContext()
  // T-02-21: guard admin antes de qualquer leitura
  if (role !== 'admin') {
    return { error: { _form: ['Apenas admin pode remover estágios'] } }
  }

  // Listar estágios não-deletados do tenant (RLS filtra por tenant_id)
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, position')
    .is('deleted_at', null)
    .order('position', { ascending: true })

  // T-02-24: deve haver pelo menos 2 estágios para poder remover um
  if (!stages || stages.length <= 1) {
    return {
      error: { _form: ['É necessário manter ao menos um estágio ativo'] },
    }
  }

  const target = stages.find((s) => s.id === stageId)
  if (!target) return { error: { _form: ['Estágio não encontrado'] } }

  // Estágio default = primeiro estágio restante (excluindo o alvo), ordenado por position
  const defaultStage = stages.find((s) => s.id !== stageId)
  if (!defaultStage) {
    return { error: { _form: ['Sem estágio default disponível'] } }
  }

  // Contar clientes neste estágio (apenas não-deletados)
  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', stageId)
    .is('deleted_at', null)

  // Realocar clientes para o estágio default antes de deletar (Pitfall 3)
  if ((count ?? 0) > 0) {
    const { error: relocErr } = await supabase
      .from('clients')
      .update({ stage_id: defaultStage.id })
      .eq('stage_id', stageId)
      .is('deleted_at', null)

    if (relocErr) {
      return { error: { _form: ['Erro ao realocar clientes'] } }
    }
  }

  // Soft-delete do estágio
  const { error: delErr } = await supabase
    .from('pipeline_stages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', stageId)

  if (delErr) {
    return { error: { _form: ['Erro ao remover estágio'] } }
  }

  revalidatePath(`/${slug}/configuracoes/pipeline`)
  revalidatePath(`/${slug}/clientes`)
  return { relocated: count ?? 0 }
}

/**
 * updateClientStage — atualiza o estágio de um cliente.
 * T-02-22: corretor só pode mudar stage dos próprios clientes.
 * T-02-23: stageId de outro tenant → RLS retorna null → erro genérico.
 */
export async function updateClientStage(
  slug: string,
  input: { clientId: string; stageId: string },
): Promise<{ error?: Record<string, string[]>; ok?: true }> {
  const parsed = updateClientStageSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { supabase, user, role } = await getAuthContext()
  if (!user) return { error: { _form: ['Sessão expirada'] } }

  // T-02-23: validar que stage pertence ao tenant via RLS (stage de outro tenant retorna null)
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('id', parsed.data.stageId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!stage) return { error: { _form: ['Estágio inválido'] } }

  // T-02-22: defesa em profundidade — corretor só muda stage dos próprios clientes
  // RLS clients_update já bloqueia no banco, mas adicionamos guard aqui também
  if (role === 'corretor') {
    const { data: own } = await supabase
      .from('clients')
      .select('id, assigned_to')
      .eq('id', parsed.data.clientId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!own || own.assigned_to !== user.id) {
      return { error: { _form: ['Cliente não encontrado'] } }
    }
  }

  const { error, data } = await supabase
    .from('clients')
    .update({ stage_id: parsed.data.stageId })
    .eq('id', parsed.data.clientId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { error: { _form: ['Cliente não encontrado'] } }
  }

  revalidatePath(`/${slug}/clientes`)
  revalidatePath(`/${slug}/clientes/${parsed.data.clientId}`)
  return { ok: true }
}
