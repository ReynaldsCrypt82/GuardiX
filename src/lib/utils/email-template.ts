// src/lib/utils/email-template.ts
// Phase 07 Plan 01 — Renderer de template com escape HTML
// D-06: 6 variaveis fixas. D-07: DEFAULT_TEMPLATES usado quando tenant nao tem template customizado
// (o template padrao RENDERIZADO usa React Email — ver src/emails/*.tsx e Route Handler interno).
// Pitfall 4: escapar valores antes de inserir no body_html.

export const TEMPLATE_VARIABLES = [
  'nome_cliente',
  'cpf_cnpj',
  'vencimento',
  'valor',
  'nome_apolice',
  'corretor',
] as const
export type TemplateVar = (typeof TEMPLATE_VARIABLES)[number]
export type EventType = 'policy_expiring' | 'financial_overdue' | 'consortium_contemplated'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderEmailTemplate(
  template: { subject: string; body_html: string },
  vars: Partial<Record<TemplateVar, string>>,
): { subject: string; body_html: string } {
  const apply = (s: string) =>
    TEMPLATE_VARIABLES.reduce<string>(
      (acc, key) => acc.replaceAll(`{{${key}}}`, escapeHtml(vars[key] ?? '')),
      s,
    )
  return { subject: apply(template.subject), body_html: apply(template.body_html) }
}

// DEFAULT_TEMPLATES: usado pelo Route Handler como fallback de subject (D-06)
// quando tenant nao configurou template. O body_html final vem dos componentes React Email.
export const DEFAULT_TEMPLATES: Record<EventType, { subject: string; body_html: string }> = {
  policy_expiring: {
    subject: 'Apolice {{nome_apolice}} vence em {{vencimento}}',
    body_html:
      '<p>Ola {{nome_cliente}},</p><p>A apolice {{nome_apolice}} vence em {{vencimento}}. Valor: R$ {{valor}}. Corretor responsavel: {{corretor}}.</p>',
  },
  financial_overdue: {
    subject: 'Lancamento vencido — {{nome_cliente}}',
    body_html:
      '<p>Ola {{nome_cliente}},</p><p>Existe um lancamento financeiro vencido em {{vencimento}}, no valor de R$ {{valor}}. Procure o corretor {{corretor}} para regularizar.</p>',
  },
  consortium_contemplated: {
    subject: 'Parabens, {{nome_cliente}}! Voce foi contemplado',
    body_html:
      '<p>Ola {{nome_cliente}},</p><p>Sua cota foi contemplada. Entraremos em contato em breve para os proximos passos. Corretor: {{corretor}}.</p>',
  },
}
