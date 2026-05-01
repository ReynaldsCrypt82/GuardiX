// src/lib/utils/ai-escalation.ts
// Phase 07 Plan 01 — Heuristicas de escalacao para AUTO-05
// Pitfall 7: AI SDK nao expoe confianca nativa — usar finishReason + heuristicas.

export const ESCALATION_MESSAGE =
  'Nao consegui responder com seguranca. Um corretor ira te atender em breve.'

export const MIN_RESPONSE_LENGTH = 20

export function isLowConfidenceResponse(input: {
  finishReason: string | null | undefined
  text: string
}): boolean {
  const { finishReason, text } = input
  if (!text) return true
  if (finishReason === 'length' || finishReason === 'max-steps') return true
  if (text.length < MIN_RESPONSE_LENGTH) return true
  if (text.trim().toUpperCase().startsWith('[INCERTO]')) return true
  return false
}
