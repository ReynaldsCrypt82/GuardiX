import { differenceInDays, parseISO, startOfToday } from 'date-fns'

export type VigenciaStatus = 'verde' | 'amarelo' | 'vermelho'

/**
 * Calcula o status de vigência de uma apólice em runtime.
 * D-03: verde >60d, amarelo ≤60d e >30d, vermelho ≤30d ou vencida.
 * Nunca armazenar — calcular sempre em runtime para evitar dessincronização.
 */
export function getVigenciaStatus(vigencia_fim: string): VigenciaStatus {
  const today = startOfToday()
  const end = parseISO(vigencia_fim)
  const daysLeft = differenceInDays(end, today)
  if (daysLeft > 60) return 'verde'
  if (daysLeft > 30) return 'amarelo'
  return 'vermelho' // inclui vencidas (daysLeft <= 0)
}
