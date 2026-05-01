// tests/actions/whatsapp-endpoint.test.ts
// Phase 07 Plan 04 — Testa logica de escalacao de IA (AUTO-05)
// Nao testa o Route Handler completo (requer OpenAI API key real).
// Testa isLowConfidenceResponse que o Route Handler usa.

import { describe, it, expect } from 'vitest'
import {
  isLowConfidenceResponse,
  ESCALATION_MESSAGE,
} from '@/lib/utils/ai-escalation'

describe('WhatsApp endpoint — logica de escalacao (AUTO-05)', () => {
  it('escala quando finishReason e max-steps', () => {
    expect(
      isLowConfidenceResponse({ finishReason: 'max-steps', text: 'qualquer texto aqui suficientemente longo' }),
    ).toBe(true)
  })

  it('nao escala quando resposta e valida (stop + texto suficiente)', () => {
    expect(
      isLowConfidenceResponse({
        finishReason: 'stop',
        text: 'A apolice numero X esta vigente ate 30/05/2026.',
      }),
    ).toBe(false)
  })

  it('escala quando texto e muito curto (< 20 chars)', () => {
    expect(
      isLowConfidenceResponse({ finishReason: 'stop', text: 'sim' }),
    ).toBe(true)
  })

  it('escala quando finishReason e length (truncado)', () => {
    expect(
      isLowConfidenceResponse({ finishReason: 'length', text: 'resposta truncada pelo modelo antes de terminar' }),
    ).toBe(true)
  })

  it('ESCALATION_MESSAGE e string nao vazia', () => {
    expect(typeof ESCALATION_MESSAGE).toBe('string')
    expect(ESCALATION_MESSAGE.length).toBeGreaterThan(10)
  })
})
