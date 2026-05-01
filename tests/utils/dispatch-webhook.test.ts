import { describe, it, expect } from 'vitest'
import { buildWebhookPayload, classifyHttpResponse } from '@/lib/utils/dispatch-webhook'

// ---------------------------------------------------------------------------
// buildWebhookPayload
// ---------------------------------------------------------------------------
describe('buildWebhookPayload', () => {
  it('retorna estrutura {event, timestamp, data} com event_type correto', () => {
    const result = buildWebhookPayload('policy_expiring', { policy_number: 'AP-001' })
    expect(result.event).toBe('policy_expiring')
    expect(result.data).toEqual({ policy_number: 'AP-001' })
    expect(typeof result.timestamp).toBe('string')
  })

  it('timestamp e ISO-8601 valido', () => {
    const result = buildWebhookPayload('financial_overdue', { x: 1 })
    const parsed = new Date(result.timestamp)
    expect(parsed.toString()).not.toBe('Invalid Date')
    // timestamp deve ser recente (dentro de 5 segundos)
    expect(Date.now() - parsed.getTime()).toBeLessThan(5000)
  })

  it('aceita data null e data array como payload', () => {
    const nullPayload = buildWebhookPayload('consortium_contemplated', null)
    expect(nullPayload.data).toBeNull()

    const arrPayload = buildWebhookPayload('policy_expiring', [1, 2, 3])
    expect(Array.isArray(arrPayload.data)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// classifyHttpResponse
// ---------------------------------------------------------------------------
describe('classifyHttpResponse', () => {
  it('200 -> success', () => {
    expect(classifyHttpResponse(200, null)).toBe('success')
  })

  it('299 -> success (limite superior 2xx)', () => {
    expect(classifyHttpResponse(299, null)).toBe('success')
  })

  it('400 -> failure', () => {
    expect(classifyHttpResponse(400, null)).toBe('failure')
  })

  it('null status + error_message -> failure (network error / timeout)', () => {
    expect(classifyHttpResponse(null, 'AbortError: timeout')).toBe('failure')
  })

  it('null status + null error -> failure (sem informacao = falha)', () => {
    expect(classifyHttpResponse(null, null)).toBe('failure')
  })

  it('500 -> failure', () => {
    expect(classifyHttpResponse(500, null)).toBe('failure')
  })

  it('error_message presente ignora status 200 e retorna failure', () => {
    // Se houve erro de rede, status nao e confiavel
    expect(classifyHttpResponse(200, 'algum erro de parse')).toBe('failure')
  })
})
