'use client'
// Phase 07 Plan 03 — Client Component: form de configuracao de webhook por event_type
// D-04: botao Testar webhook. AUTO-01 compliance.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { createWebhookConfigAction, updateWebhookConfigAction } from '@/lib/actions/webhook-configs'
import { TestWebhookButton } from './test-webhook-button'

interface WebhookConfigInitial {
  id: string
  url: string
  days_before: number | null
  active: boolean
}

interface WebhookConfigFormProps {
  slug: string
  eventType: string
  eventLabel: string
  initial?: WebhookConfigInitial
}

export function WebhookConfigForm({ slug, eventType, eventLabel, initial }: WebhookConfigFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [url, setUrl] = useState(initial?.url ?? '')
  const [daysBefore, setDaysBefore] = useState<string>(
    initial?.days_before != null ? String(initial.days_before) : '',
  )
  const [active, setActive] = useState(initial?.active ?? true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const showDaysBefore = eventType === 'policy_expiring'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})

    const fd = new FormData()
    fd.append('event_type', eventType)
    fd.append('url', url)
    if (showDaysBefore && daysBefore !== '') fd.append('days_before', daysBefore)
    fd.append('active', String(active))

    startTransition(async () => {
      const result = initial
        ? await updateWebhookConfigAction(slug, initial.id, fd)
        : await createWebhookConfigAction(slug, fd)

      if (result?.error) {
        setFieldErrors(result.error as Record<string, string[]>)
        return
      }

      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{eventLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={`webhook-form-${eventType}`} onSubmit={handleSubmit} className="space-y-3">
          {/* URL */}
          <div className="space-y-1">
            <label htmlFor={`url-${eventType}`} className="text-xs font-medium">
              URL do webhook
            </label>
            <Input
              id={`url-${eventType}`}
              type="url"
              placeholder="https://n8n.exemplo.com/webhook/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
            />
            {fieldErrors.url && (
              <p className="text-xs text-destructive">{fieldErrors.url[0]}</p>
            )}
          </div>

          {/* days_before — apenas policy_expiring */}
          {showDaysBefore && (
            <div className="space-y-1">
              <label htmlFor={`days-${eventType}`} className="text-xs font-medium">
                Dias de antecedencia
              </label>
              <Input
                id={`days-${eventType}`}
                type="number"
                min={1}
                max={365}
                placeholder="Ex: 30"
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
                disabled={isPending}
              />
              {fieldErrors.days_before && (
                <p className="text-xs text-destructive">{fieldErrors.days_before[0]}</p>
              )}
            </div>
          )}

          {/* active checkbox */}
          <div className="flex items-center gap-2">
            <input
              id={`active-${eventType}`}
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={isPending}
              className="size-4 rounded"
            />
            <label htmlFor={`active-${eventType}`} className="text-xs">
              Webhook ativo
            </label>
          </div>

          {fieldErrors._form && (
            <p className="text-xs text-destructive">{fieldErrors._form[0]}</p>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2">
        <div className="flex gap-2">
          <Button
            type="submit"
            form={`webhook-form-${eventType}`}
            size="sm"
            disabled={isPending}
          >
            {isPending ? 'Salvando...' : initial ? 'Atualizar' : 'Salvar'}
          </Button>
          <TestWebhookButton slug={slug} url={url} eventType={eventType} />
        </div>
      </CardFooter>
    </Card>
  )
}
