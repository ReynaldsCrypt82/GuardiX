// src/lib/validations/automation-schemas.ts
// Phase 07 Plan 01 — Zod schemas consumidos pelas Server Actions de Plan 02 e UI de Plan 03

import { z } from 'zod'
import { isUrlSafe } from '@/lib/utils/webhook-url'

export const EVENT_TYPE_VALUES = [
  'policy_expiring',
  'financial_overdue',
  'consortium_contemplated',
] as const
export const eventTypeSchema = z.enum(EVENT_TYPE_VALUES)

export const webhookConfigSchema = z.object({
  event_type: eventTypeSchema,
  url: z.string().url('URL invalida').refine(isUrlSafe, {
    message: 'URL aponta para IP privado, loopback ou protocolo nao permitido',
  }),
  days_before: z.coerce.number().int().min(1).max(365).optional(),
  active: z.coerce.boolean().default(true),
})
export type WebhookConfigInput = z.infer<typeof webhookConfigSchema>

export const emailTemplateSchema = z.object({
  event_type: eventTypeSchema,
  subject: z.string().min(3).max(200),
  body_html: z.string().min(10).max(10000),
  active: z.coerce.boolean().default(true),
})
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>

export const webhookTestSchema = z.object({
  url: z.string().url().refine(isUrlSafe, { message: 'URL nao permitida' }),
  event_type: eventTypeSchema,
})
