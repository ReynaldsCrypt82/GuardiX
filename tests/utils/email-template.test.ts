import { describe, it, expect } from 'vitest'
import { renderEmailTemplate, DEFAULT_TEMPLATES } from '@/lib/utils/email-template'

describe('renderEmailTemplate', () => {
  it('substitui {{nome_cliente}} pelo valor passado', () => {
    const result = renderEmailTemplate(
      { subject: 'Ola {{nome_cliente}}', body_html: '<p>{{nome_cliente}}</p>' },
      { nome_cliente: 'Joao Silva' },
    )
    expect(result.subject).toBe('Ola Joao Silva')
    expect(result.body_html).toBe('<p>Joao Silva</p>')
  })

  it('escapa HTML perigoso em valores de variaveis', () => {
    const result = renderEmailTemplate(
      { subject: 'S', body_html: '{{nome_cliente}}' },
      { nome_cliente: '<script>alert(1)</script>' },
    )
    expect(result.body_html).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('substitui as 6 variaveis previstas', () => {
    const vars = {
      nome_cliente: 'Ana',
      cpf_cnpj: '123.456.789-00',
      vencimento: '2026-06-30',
      valor: '500.00',
      nome_apolice: 'APL-001',
      corretor: 'Carlos',
    }
    const template = {
      subject: '{{nome_apolice}} vence em {{vencimento}}',
      body_html:
        '{{nome_cliente}} {{cpf_cnpj}} {{valor}} {{corretor}}',
    }
    const result = renderEmailTemplate(template, vars)
    expect(result.subject).toBe('APL-001 vence em 2026-06-30')
    expect(result.body_html).toBe('Ana 123.456.789-00 500.00 Carlos')
  })

  it('DEFAULT_TEMPLATES tem chaves policy_expiring, financial_overdue, consortium_contemplated', () => {
    expect(DEFAULT_TEMPLATES).toHaveProperty('policy_expiring')
    expect(DEFAULT_TEMPLATES).toHaveProperty('financial_overdue')
    expect(DEFAULT_TEMPLATES).toHaveProperty('consortium_contemplated')
    expect(DEFAULT_TEMPLATES.policy_expiring.subject.length).toBeGreaterThan(0)
  })
})
