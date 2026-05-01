// Phase 07 Plan 02 — Edge Function automation-cron
// Disparada por pg_cron (migration 0023) diariamente as 11:00 UTC = 08:00 BRT.
// D-01: 3 eventos. D-03: log e seguir (sem retry). D-05: destinatarios duplos.
// D-07: email delegado a POST /api/internal/send-automation-email (Node.js + React Email).
// T-07-SSRF: defesa em profundidade — isUrlSafe inline antes de fetch de webhook.
// T-07-05: x-cron-secret valida origem do cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0'

type EventType = 'policy_expiring' | 'financial_overdue' | 'consortium_contemplated'

// SSRF guard — inlined para nao depender de imports Node.js em Deno
const PRIVATE_PATTERNS: RegExp[] = [
  /^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^::1$/, /^fc00:/i, /^fe80:/i,
]
function isUrlSafe(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    const h = u.hostname.toLowerCase()
    return Boolean(h) && !PRIVATE_PATTERNS.some((p) => p.test(h))
  } catch { return false }
}

// Template subjects padrao — usado quando tenant nao tem template customizado.
// O body HTML padrao e responsabilidade do Route Handler (React Email).
const DEFAULT_SUBJECTS: Record<EventType, string> = {
  policy_expiring: 'Apolice {{nome_apolice}} vence em {{vencimento}}',
  financial_overdue: 'Lancamento vencido — {{nome_cliente}}',
  consortium_contemplated: 'Parabens, {{nome_cliente}}! Voce foi contemplado',
}

function substituteVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
    template,
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

Deno.serve(async (req) => {
  try {
    // T-07-05: cron auth via shared secret
    const cronSecret = Deno.env.get('CRON_SHARED_SECRET')
    const headerSecret = req.headers.get('x-cron-secret')
    if (!cronSecret || headerSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const stats = {
      policy_expiring: 0,
      financial_overdue: 0,
      consortium_contemplated: 0,
      webhooks_fired: 0,
      emails_sent: 0,
    }

    // ---------- policy_expiring ----------
    const { data: policyConfigs } = await supabase
      .from('webhook_configs')
      .select('id, tenant_id, url, days_before')
      .eq('event_type', 'policy_expiring')
      .eq('active', true)
      .is('deleted_at', null)

    for (const config of policyConfigs ?? []) {
      const daysAhead = config.days_before ?? 30
      const future = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10)
      const { data: policies } = await supabase
        .from('policies')
        .select('id, policy_number, vigencia_fim, premio_total, insurer, client:clients(name, email, document), profile:profiles!policies_assigned_to_fkey(id, full_name)')
        .eq('tenant_id', config.tenant_id)
        .gte('vigencia_fim', today)
        .lte('vigencia_fim', future)
        .is('deleted_at', null)

      for (const p of policies ?? []) {
        stats.policy_expiring += 1
        const webhookData = {
          policy_number: p.policy_number,
          vigencia_fim: p.vigencia_fim,
          insurer: p.insurer,
          client: p.client,
          corretor: p.profile?.full_name,
        }
        if (await dispatchWebhook(supabase, config, 'policy_expiring', webhookData)) stats.webhooks_fired += 1
        const vars: Record<string, string> = {
          nome_cliente: p.client?.name ?? '',
          cpf_cnpj: p.client?.document ?? '',
          vencimento: p.vigencia_fim ?? '',
          valor: String(p.premio_total ?? ''),
          nome_apolice: p.policy_number ?? '',
          corretor: p.profile?.full_name ?? '',
        }
        if (await callEmailRoute(supabase, config.tenant_id, 'policy_expiring', vars, p.client?.email, p.profile?.id)) stats.emails_sent += 1
      }
    }

    // ---------- financial_overdue ----------
    const { data: finConfigs } = await supabase
      .from('webhook_configs')
      .select('id, tenant_id, url')
      .eq('event_type', 'financial_overdue')
      .eq('active', true)
      .is('deleted_at', null)

    for (const config of finConfigs ?? []) {
      const { data: entries } = await supabase
        .from('financial_entries')
        .select('id, description, amount, due_date, client:clients(name, email, document, assigned_profile:profiles!clients_assigned_to_fkey(id, full_name))')
        .eq('tenant_id', config.tenant_id)
        .eq('status', 'pending')
        .lt('due_date', today)
        .is('deleted_at', null)

      for (const e of entries ?? []) {
        stats.financial_overdue += 1
        const webhookData = {
          entry_id: e.id,
          description: e.description,
          amount: e.amount,
          due_date: e.due_date,
          client: e.client,
        }
        if (await dispatchWebhook(supabase, config, 'financial_overdue', webhookData)) stats.webhooks_fired += 1
        const vars: Record<string, string> = {
          nome_cliente: e.client?.name ?? '',
          cpf_cnpj: e.client?.document ?? '',
          vencimento: e.due_date ?? '',
          valor: String(e.amount ?? ''),
          nome_apolice: e.description ?? '',
          corretor: e.client?.assigned_profile?.full_name ?? '',
        }
        if (await callEmailRoute(supabase, config.tenant_id, 'financial_overdue', vars, e.client?.email, e.client?.assigned_profile?.id)) stats.emails_sent += 1
      }
    }

    // ---------- consortium_contemplated ----------
    const { data: conConfigs } = await supabase
      .from('webhook_configs')
      .select('id, tenant_id, url')
      .eq('event_type', 'consortium_contemplated')
      .eq('active', true)
      .is('deleted_at', null)

    for (const config of conConfigs ?? []) {
      const { data: quotas } = await supabase
        .from('consortium_quotas')
        .select('id, quota_number, contemplated_at, contemplation_type, client:clients(name, email, document, assigned_profile:profiles!clients_assigned_to_fkey(id, full_name))')
        .eq('tenant_id', config.tenant_id)
        .gte('contemplated_at', yesterday)
        .lte('contemplated_at', today)
        .is('deleted_at', null)

      for (const q of quotas ?? []) {
        stats.consortium_contemplated += 1
        const webhookData = {
          quota_number: q.quota_number,
          contemplated_at: q.contemplated_at,
          contemplation_type: q.contemplation_type,
          client: q.client,
        }
        if (await dispatchWebhook(supabase, config, 'consortium_contemplated', webhookData)) stats.webhooks_fired += 1
        const vars: Record<string, string> = {
          nome_cliente: q.client?.name ?? '',
          cpf_cnpj: q.client?.document ?? '',
          vencimento: q.contemplated_at ?? '',
          valor: '',
          nome_apolice: q.quota_number ?? '',
          corretor: q.client?.assigned_profile?.full_name ?? '',
        }
        if (await callEmailRoute(supabase, config.tenant_id, 'consortium_contemplated', vars, q.client?.email, q.client?.assigned_profile?.id)) stats.emails_sent += 1
      }
    }

    return new Response(
      JSON.stringify({ processed: stats, triggered_at: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('automation-cron error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

async function dispatchWebhook(
  supabase: SupabaseClient,
  config: { id: string; tenant_id: string; url: string },
  event_type: EventType,
  data: unknown,
): Promise<boolean> {
  const payload = { event: event_type, timestamp: new Date().toISOString(), data }
  let http_status: number | null = null
  let error_message: string | null = null

  if (!isUrlSafe(config.url)) {
    error_message = 'URL bloqueada por SSRF guard (RFC1918/loopback/link-local)'
  } else {
    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })
      http_status = res.status
    } catch (err) {
      error_message = String(err)
    }
  }

  await supabase.from('webhook_logs').insert({
    tenant_id: config.tenant_id,
    event_type,
    config_id: config.id,
    url_destino: config.url,
    payload,
    http_status,
    error_message,
  })

  return http_status !== null && http_status >= 200 && http_status < 300
}

// D-07: delega renderizacao HTML ao Route Handler Node.js (react-email/render nao disponivel em Deno)
async function callEmailRoute(
  supabase: SupabaseClient,
  tenant_id: string,
  event_type: EventType,
  vars: Record<string, string>,
  clientEmail?: string | null,
  corretorProfileId?: string | null,
): Promise<boolean> {
  const appUrl = Deno.env.get('NEXTJS_APP_URL')
  const secret = Deno.env.get('INTERNAL_EMAIL_SECRET')
  if (!appUrl || !secret) return false

  // Buscar email do corretor via auth.admin
  let corretorEmail: string | null = null
  if (corretorProfileId) {
    const { data } = await supabase.auth.admin.getUserById(corretorProfileId)
    corretorEmail = data?.user?.email ?? null
  }

  const to = [corretorEmail, clientEmail].filter((e): e is string => Boolean(e))
  if (to.length === 0) return false

  // Verificar se tenant tem template customizado
  const { data: tplRow } = await supabase
    .from('email_templates')
    .select('subject, body_html')
    .eq('tenant_id', tenant_id)
    .eq('event_type', event_type)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  let subject: string
  let custom_body_html: string | null

  if (tplRow) {
    // Tenant tem template — substituir variaveis no subject e body_html
    subject = substituteVars(tplRow.subject, vars)
    custom_body_html = substituteVars(tplRow.body_html, vars)
  } else {
    // Sem template customizado — subject padrao; body_html gerado pelo React Email no Route Handler
    subject = substituteVars(DEFAULT_SUBJECTS[event_type], vars)
    custom_body_html = null
  }

  // Fire and forget — Route Handler e Node.js, nao bloqueia o cron
  try {
    await fetch(`${appUrl}/api/internal/send-automation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({ event_type, to, subject, vars, custom_body_html }),
    })
    return true
  } catch (err) {
    console.error('callEmailRoute error:', err)
    return false
  }
}
