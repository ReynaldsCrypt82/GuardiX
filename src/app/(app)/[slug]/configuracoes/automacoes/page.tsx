import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WebhookConfigForm } from './webhook-config-form'
import { EmailTemplateForm } from './email-template-form'
import { WebhookLogsTable } from './webhook-logs-table'
import { EVENT_TYPE_VALUES } from '@/lib/validations/automation-schemas'

const EVENT_LABELS: Record<string, string> = {
  policy_expiring: 'Vencimento de apolice',
  financial_overdue: 'Inadimplencia financeira',
  consortium_contemplated: 'Contemplacao de consorcio',
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function AutomacoesPage({ params }: Props) {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // D-09: RBAC — apenas admin acessa esta pagina (T-07-RBAC)
  const role = (user?.app_metadata as { role?: string })?.role
  if (!user || role !== 'admin') {
    redirect(`/${slug}/dashboard`)
  }

  // Queries paralelas: configs, templates, logs (20 mais recentes)
  const [{ data: configs }, { data: templates }, { data: logs }] = await Promise.all([
    supabase
      .from('webhook_configs')
      .select('id, event_type, url, days_before, active')
      .is('deleted_at', null)
      .order('event_type'),
    supabase
      .from('email_templates')
      .select('id, event_type, subject, body_html, active')
      .is('deleted_at', null)
      .order('event_type'),
    supabase
      .from('webhook_logs')
      .select('id, event_type, url_destino, http_status, error_message, triggered_at')
      .order('triggered_at', { ascending: false })
      .limit(20),
  ])

  // Indexar por event_type para lookup O(1)
  const configsByEvent = new Map(
    ((configs ?? []) as Array<{ event_type: string }>).map((c) => [c.event_type, c]),
  )
  const templatesByEvent = new Map(
    ((templates ?? []) as Array<{ event_type: string }>).map((t) => [t.event_type, t]),
  )

  return (
    <div className="flex flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Automacoes</h1>
        <p className="text-sm text-muted-foreground">
          Configure webhooks n8n, templates de email e visualize logs de disparo.
        </p>
      </header>

      {/* Secao 1: Webhooks n8n — 3 cards em grid */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Webhooks n8n</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {EVENT_TYPE_VALUES.map((evt) => (
            <WebhookConfigForm
              key={evt}
              slug={slug}
              eventType={evt}
              eventLabel={EVENT_LABELS[evt] ?? evt}
              initial={
                configsByEvent.get(evt) as
                  | { id: string; url: string; days_before: number | null; active: boolean }
                  | undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Secao 2: Templates de email — lista vertical */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Templates de email</h2>
        <div className="flex flex-col gap-4">
          {EVENT_TYPE_VALUES.map((evt) => (
            <EmailTemplateForm
              key={evt}
              slug={slug}
              eventType={evt}
              eventLabel={EVENT_LABELS[evt] ?? evt}
              initial={
                templatesByEvent.get(evt) as
                  | { id: string; subject: string; body_html: string; active: boolean }
                  | undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Secao 3: Historico de disparos */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Historico de disparos (20 mais recentes)</h2>
        <WebhookLogsTable logs={logs ?? []} eventLabels={EVENT_LABELS} />
      </section>
    </div>
  )
}
