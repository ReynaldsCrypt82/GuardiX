// src/app/api/internal/send-automation-email/route.ts
// Phase 07 Plan 01 — Route Handler INTERNO para envio de email via React Email + Resend (D-07)
// Seguranca: x-internal-secret header validado contra INTERNAL_EMAIL_SECRET env var.
// NAO usar Edge runtime — React Email requer Node.js para render().

import { render } from '@react-email/render'
import { PolicyExpiringEmail } from '@/emails/policy-expiring'
import { FinancialOverdueEmail } from '@/emails/financial-overdue'
import { ConsortiumContemplatedEmail } from '@/emails/consortium-contemplated'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 1. Validar shared secret — T-07-INTERNAL-AUTH
  const secret = req.headers.get('x-internal-secret')
  if (!process.env.INTERNAL_EMAIL_SECRET || secret !== process.env.INTERNAL_EMAIL_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    event_type: string
    to: string[]
    subject: string
    vars: Record<string, string>
    custom_body_html: string | null
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event_type, to, subject, vars, custom_body_html } = body

  if (!Array.isArray(to) || to.length === 0) {
    return Response.json({ error: 'No recipients' }, { status: 400 })
  }

  // 2. Renderizar HTML — tenant custom ou React Email default (D-07)
  let html: string
  if (custom_body_html) {
    // Tenant tem template customizado — Edge Function ja aplicou substituicao de variaveis
    html = custom_body_html
  } else {
    // Template padrao fixo via React Email (D-07)
    if (event_type === 'policy_expiring') {
      html = await render(
        <PolicyExpiringEmail
          nome_cliente={vars.nome_cliente ?? ''}
          nome_apolice={vars.nome_apolice ?? ''}
          vencimento={vars.vencimento ?? ''}
          corretor={vars.corretor ?? ''}
          valor={vars.valor ?? ''}
        />,
      )
    } else if (event_type === 'financial_overdue') {
      html = await render(
        <FinancialOverdueEmail
          nome_cliente={vars.nome_cliente ?? ''}
          descricao={vars.nome_apolice ?? ''}
          valor={vars.valor ?? ''}
          vencimento={vars.vencimento ?? ''}
          corretor={vars.corretor ?? ''}
        />,
      )
    } else {
      html = await render(
        <ConsortiumContemplatedEmail
          nome_cliente={vars.nome_cliente ?? ''}
          nome_grupo={vars.nome_apolice ?? ''}
          valor={vars.valor ?? ''}
          corretor={vars.corretor ?? ''}
        />,
      )
    }
  }

  // 3. Enviar via Resend
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'noreply@guardix.app'
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.text()
    return Response.json({ error: err }, { status: resendRes.status })
  }

  return Response.json({ sent: true })
}
