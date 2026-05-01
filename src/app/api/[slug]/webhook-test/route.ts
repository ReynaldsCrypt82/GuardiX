// Phase 07 Plan 02 — Route Handler: POST /api/[slug]/webhook-test
// D-04: "Testar webhook" — envia payload de exemplo para a URL configurada e retorna http_status.
// T-07-SSRF: isUrlSafe() + webhookTestSchema.refine(). RBAC: apenas admin.
// T-07-WHATSAPP-TEST: AbortSignal.timeout(10000) — sem dados reais, apenas payload de exemplo.

import { createClient } from '@/lib/supabase/server'
import { isUrlSafe } from '@/lib/utils/webhook-url'
import { webhookTestSchema } from '@/lib/validations/automation-schemas'

/**
 * buildSamplePayload — monta payload de exemplo por event_type.
 * Nao contem dados reais de clientes — apenas estrutura de demonstracao (D-04).
 */
function buildSamplePayload(event_type: string): Record<string, unknown> {
  const base = { event: event_type, timestamp: new Date().toISOString() }

  if (event_type === 'policy_expiring') {
    return {
      ...base,
      data: {
        policy_number: 'AP-12345',
        vigencia_fim: '2026-06-30',
        insurer: 'Seguradora Exemplo',
        client: {
          name: 'Cliente Teste',
          email: 'cliente@example.com',
          document: '123.456.789-00',
        },
        corretor: 'Corretor Exemplo',
      },
    }
  }

  if (event_type === 'financial_overdue') {
    return {
      ...base,
      data: {
        entry_id: 'fe-001',
        description: 'Premio mensal',
        amount: 350.0,
        due_date: '2026-04-15',
        status: 'pending',
        client: {
          name: 'Cliente Teste',
          email: 'cliente@example.com',
        },
      },
    }
  }

  // consortium_contemplated
  return {
    ...base,
    data: {
      quota_number: 'COTA-001',
      group_administradora: 'Adm. Exemplo',
      contemplation_type: 'sorteio',
      client: {
        name: 'Cliente Teste',
        email: 'cliente@example.com',
      },
    },
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params

  // Auth: SSR client via cookies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const meta = (user.app_metadata as { slug?: string; role?: string }) ?? {}

  // Cross-tenant check — CR-01: meta.slug ausente tambem e negado
  if (!meta.slug || meta.slug !== slug) return new Response('Forbidden', { status: 403 })

  // RBAC: apenas admin pode testar webhooks (D-09)
  if (meta.role !== 'admin') return new Response('Forbidden', { status: 403 })

  // Parse body
  const body = await request.json().catch(() => null)
  const parsed = webhookTestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', http_status: 0 }, { status: 400 })
  }

  // T-07-SSRF: defesa em profundidade — schema ja valida, mas checar inline tambem
  if (!isUrlSafe(parsed.data.url)) {
    return Response.json({ error: 'URL nao permitida', http_status: 0 }, { status: 400 })
  }

  const samplePayload = buildSamplePayload(parsed.data.event_type)

  try {
    const res = await fetch(parsed.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload),
      signal: AbortSignal.timeout(10000),
    })
    return Response.json({ http_status: res.status, ok: res.ok, payload: samplePayload })
  } catch (err) {
    return Response.json({ http_status: 0, error: String(err), payload: samplePayload })
  }
}
