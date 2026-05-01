// src/app/api/[slug]/ai/chat/route.ts
// Phase 07 Plan 04 — Chat interno assistido por IA (AUTO-06)
// Pitfall 5: toUIMessageStreamResponse() — renomeado no AI SDK v6 (nao toDataStreamResponse)
// Pitfall 5: convertToModelMessages() — converter UIMessage[] para formato do modelo (async)
// T-07-03: service_role com tenant_id explicito nas tools (nao depende apenas de RLS)
// Cross-tenant guard: meta.slug !== slug -> 403 (igual ao export/route.ts)
// AI SDK v6: stopWhen: stepCountIs(N) em vez de maxSteps

import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// AI SDK v6 tool() has strict overload resolution — cast via helper to avoid TS2769
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTool(def: { description: string; parameters: unknown; execute: (...args: any[]) => unknown }): any {
  return def
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params

  // Auth: validar sessao de usuario (padrao do projeto — export/route.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const meta = (user.app_metadata as { slug?: string; role?: string; tenant_id?: string }) ?? {}

  // Cross-tenant guard: usuario do tenant A nao pode usar chat do tenant B
  if (!meta.slug || meta.slug !== slug) {
    return new Response('Forbidden', { status: 403 })
  }

  // RBAC: visualizador nao tem acesso ao chat interno
  if (meta.role === 'visualizador') {
    return new Response('Forbidden', { status: 403 })
  }

  const tenantId = meta.tenant_id as string
  if (!tenantId) {
    return new Response('No tenant context', { status: 403 })
  }

  // Parse messages do body (UIMessage[] enviado pelo useChat)
  let messages: unknown[]
  try {
    const body = await req.json()
    messages = body.messages ?? []
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  // Service role para tools — bypassa RLS mas filtra por tenantId explicitamente (T-07-03)
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // T-07-03: TODAS as queries filtram por tenantId explicitamente
  const tools = {
    searchClients: makeTool({
      description: 'Busca clientes da corretora por nome, CPF ou CNPJ',
      parameters: z.object({ query: z.string().max(100) }),
      execute: async ({ query }: { query: string }) => {
        const safeQ = query.replace(/[%_]/g, '').slice(0, 80)
        const { data } = await serviceSupabase
          .from('clients')
          .select('id, name, type, document, email, phone')
          .eq('tenant_id', tenantId)
          .or(`name.ilike.%${safeQ}%,document.ilike.%${safeQ}%`)
          .is('deleted_at', null)
          .limit(5)
        return data ?? []
      },
    }),
    getClientPolicies: makeTool({
      description: 'Lista apolices de um cliente pelo ID',
      parameters: z.object({ clientId: z.string().uuid() }),
      execute: async ({ clientId }: { clientId: string }) => {
        const { data } = await serviceSupabase
          .from('policies')
          .select('policy_number, insurer, type, vigencia_fim, premio_total, status')
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .is('deleted_at', null)
          .limit(10)
        return data ?? []
      },
    }),
    getOverduePayments: makeTool({
      description: 'Lista lancamentos financeiros vencidos e pendentes da corretora',
      parameters: z.object({}),
      execute: async () => {
        const today = new Date().toISOString().split('T')[0]
        const { data } = await serviceSupabase
          .from('financial_entries')
          .select('id, description, amount, due_date, client_id, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .lt('due_date', today)
          .limit(10)
        return data ?? []
      },
    }),
  }

  // streamText — retorna stream para useChat no frontend (AI SDK v6)
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `Voce e um assistente interno de uma corretora de seguros e consorcio.
Use as ferramentas disponíveis para consultar dados reais do sistema.
Cite os dados encontrados com precisao. Se nao encontrar dados, informe claramente.
Responda em portugues. Seja objetivo e profissional.`,
    // Pitfall 5: convertToModelMessages converte UIMessage[] -> ModelMessage[] (async em v6)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: await convertToModelMessages(messages as any),
    tools,
    // AI SDK v6: stopWhen: stepCountIs(N) em vez de maxSteps
    stopWhen: stepCountIs(5),
  })

  // Pitfall 5: toUIMessageStreamResponse() — API v6 (nao toDataStreamResponse)
  return result.toUIMessageStreamResponse()
}
