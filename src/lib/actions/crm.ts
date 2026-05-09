'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// ─── Interações / Comentários ────────────────────────────────────────────────

export async function addInteraction(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'Não autorizado' }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: 'Tenant não identificado.' }

  const clientId = formData.get('client_id') as string
  const slug = formData.get('slug') as string
  const type = formData.get('type') as string
  const description = (formData.get('description') as string)?.trim()
  const occurredAt = formData.get('occurred_at') as string

  if (!description) return { error: 'Descrição obrigatória' }

  const ALLOWED = ['comentario', 'ligacao', 'email', 'reuniao', 'whatsapp', 'visita']
  if (!ALLOWED.includes(type)) return { error: 'Tipo inválido' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('client_interactions') as any).insert({
    tenant_id: tenantId,
    client_id: clientId,
    type,
    description,
    occurred_at: occurredAt || new Date().toISOString(),
    created_by: user.id,
  })

  if (error) return { error: 'Erro ao salvar interação' }
  revalidatePath(`/${slug}/clientes/${clientId}`)
  return {}
}

// ─── Tarefas ─────────────────────────────────────────────────────────────────

export async function addTask(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'Não autorizado' }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: 'Tenant não identificado.' }

  const clientId = formData.get('client_id') as string
  const slug = formData.get('slug') as string
  const description = (formData.get('description') as string)?.trim()
  const dueDate = formData.get('due_date') as string

  if (!description) return { error: 'Descrição obrigatória' }
  if (!dueDate) return { error: 'Prazo obrigatório' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('client_tasks') as any).insert({
    tenant_id: tenantId,
    client_id: clientId,
    description,
    due_date: dueDate,
    assigned_to: user.id,
    created_by: user.id,
  })

  if (error) return { error: 'Erro ao criar tarefa' }
  revalidatePath(`/${slug}/clientes/${clientId}`)
  return {}
}

export async function completeTask(taskId: string, clientId: string, slug: string): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('client_tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .is('completed_at', null)

  if (error) return { error: 'Erro ao concluir tarefa' }
  revalidatePath(`/${slug}/clientes/${clientId}`)
  return {}
}

// ─── Categoria do cliente (novo / renovacao) ─────────────────────────────────

export async function updateClientCategory(
  clientId: string,
  category: 'novo' | 'renovacao' | null,
  slug: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('clients')
    .update({ category })
    .eq('id', clientId)
    .is('deleted_at', null)

  if (error) return { error: 'Erro ao atualizar categoria' }
  revalidatePath(`/${slug}/clientes`)
  return {}
}

// ─── Mover cliente no Kanban ──────────────────────────────────────────────────

export async function moveClientStage(
  clientId: string,
  stageId: string,
  slug: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('clients')
    .update({ stage_id: stageId })
    .eq('id', clientId)
    .is('deleted_at', null)

  if (error) return { error: 'Erro ao mover cliente' }
  revalidatePath(`/${slug}/pipeline`)
  revalidatePath(`/${slug}/clientes/${clientId}`)
  return {}
}
