'use client'
// Phase 07 Plan 03 — Client Component: form de template de email por event_type
// D-06: variaveis disponiveis listadas. D-07: botao "Restaurar padrao". AUTO-03 compliance.

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
import { upsertEmailTemplateAction } from '@/lib/actions/email-templates'
import { TEMPLATE_VARIABLES, DEFAULT_TEMPLATES } from '@/lib/utils/email-template'
import type { EventType } from '@/lib/utils/email-template'

interface EmailTemplateInitial {
  id: string
  subject: string
  body_html: string
  active: boolean
}

interface EmailTemplateFormProps {
  slug: string
  eventType: string
  eventLabel: string
  initial?: EmailTemplateInitial
}

export function EmailTemplateForm({ slug, eventType, eventLabel, initial }: EmailTemplateFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const defaultTemplate = DEFAULT_TEMPLATES[eventType as EventType]

  const [subject, setSubject] = useState(initial?.subject ?? defaultTemplate?.subject ?? '')
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html ?? defaultTemplate?.body_html ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  function handleRestoreDefault() {
    if (!defaultTemplate) return
    setSubject(defaultTemplate.subject)
    setBodyHtml(defaultTemplate.body_html)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})

    const fd = new FormData()
    fd.append('event_type', eventType)
    fd.append('subject', subject)
    fd.append('body_html', bodyHtml)
    fd.append('active', String(active))

    startTransition(async () => {
      const result = await upsertEmailTemplateAction(slug, fd)

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
        <form id={`email-form-${eventType}`} onSubmit={handleSubmit} className="space-y-3">
          {/* Subject */}
          <div className="space-y-1">
            <label htmlFor={`subject-${eventType}`} className="text-xs font-medium">
              Assunto
            </label>
            <Input
              id={`subject-${eventType}`}
              type="text"
              placeholder="Assunto do email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isPending}
            />
            {fieldErrors.subject && (
              <p className="text-xs text-destructive">{fieldErrors.subject[0]}</p>
            )}
          </div>

          {/* Variaveis disponiveis (D-06) */}
          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <span className="font-medium">Variaveis disponiveis: </span>
            {TEMPLATE_VARIABLES.map((v) => (
              <code key={v} className="mx-0.5 rounded bg-background px-1 font-mono">
                {`{{${v}}}`}
              </code>
            ))}
          </div>

          {/* body_html textarea */}
          <div className="space-y-1">
            <label htmlFor={`body-${eventType}`} className="text-xs font-medium">
              Corpo do email (HTML)
            </label>
            <textarea
              id={`body-${eventType}`}
              rows={10}
              placeholder="<p>Ola {{nome_cliente}},</p><p>...</p>"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            />
            {fieldErrors.body_html && (
              <p className="text-xs text-destructive">{fieldErrors.body_html[0]}</p>
            )}
          </div>

          {/* active checkbox */}
          <div className="flex items-center gap-2">
            <input
              id={`email-active-${eventType}`}
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={isPending}
              className="size-4 rounded"
            />
            <label htmlFor={`email-active-${eventType}`} className="text-xs">
              Template ativo
            </label>
          </div>

          {fieldErrors._form && (
            <p className="text-xs text-destructive">{fieldErrors._form[0]}</p>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          type="submit"
          form={`email-form-${eventType}`}
          size="sm"
          disabled={isPending}
        >
          {isPending ? 'Salvando...' : 'Salvar template'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRestoreDefault}
          disabled={isPending || !defaultTemplate}
        >
          Restaurar padrao
        </Button>
      </CardFooter>
    </Card>
  )
}
