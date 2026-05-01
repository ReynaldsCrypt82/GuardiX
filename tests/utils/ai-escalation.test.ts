import { describe, it, expect } from 'vitest'
import { isLowConfidenceResponse, ESCALATION_MESSAGE } from '@/lib/utils/ai-escalation'

describe('isLowConfidenceResponse', () => {
  it('retorna true quando finishReason=length (independente do texto)', () => {
    expect(
      isLowConfidenceResponse({ finishReason: 'length', text: 'long text long text long text' }),
    ).toBe(true)
  })

  it('retorna true quando texto tem menos de 20 caracteres', () => {
    expect(isLowConfidenceResponse({ finishReason: 'stop', text: 'curto' })).toBe(true)
  })

  it('retorna false para resposta normal (finishReason=stop e texto >= 20 chars)', () => {
    expect(
      isLowConfidenceResponse({
        finishReason: 'stop',
        text: 'A apolice X esta vigente ate 30/05/2026',
      }),
    ).toBe(false)
  })

  it('retorna true quando texto comeca com [INCERTO]', () => {
    expect(
      isLowConfidenceResponse({
        finishReason: 'stop',
        text: '[INCERTO] nao tenho dados suficientes',
      }),
    ).toBe(true)
  })

  it('ESCALATION_MESSAGE e string nao-vazia', () => {
    expect(typeof ESCALATION_MESSAGE).toBe('string')
    expect(ESCALATION_MESSAGE.length).toBeGreaterThan(0)
  })
})
