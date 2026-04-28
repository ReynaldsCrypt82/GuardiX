// src/lib/utils/commission-rate.ts
// Phase 04 — D-07: rate resolution unificado para broker_profiles e partners
// Logica: override por productType -> fallback para defaultRate
// Chaves consorcio_* sao usadas para distinguir cotas dos seguros (consorcio_auto vs auto)

export type CommissionRateOverrides = {
  auto?: number
  vida?: number
  residencial?: number
  empresarial?: number
  saude?: number
  outros?: number
  consorcio_auto?: number
  consorcio_imovel?: number
  consorcio_servico?: number
}

/**
 * Resolve a taxa de comissao para um tipo de produto.
 * - Se overrides eh null/undefined: retorna defaultRate.
 * - Se overrides[productType] eh undefined: retorna defaultRate.
 * - Se overrides[productType] eh um numero (incluindo 0): retorna esse valor.
 *
 * IMPORTANTE: 0 e' um override valido — nao cai no fallback.
 * Casa de uso: parceiro com taxa 0% para um tipo especifico.
 */
export function resolveCommissionRate(
  overrides: CommissionRateOverrides | null | undefined,
  defaultRate: number,
  productType: string,
): number {
  if (overrides === null || overrides === undefined) return defaultRate
  const value = (overrides as Record<string, number | undefined>)[productType]
  return value !== undefined ? value : defaultRate
}
