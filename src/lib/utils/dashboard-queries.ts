// src/lib/utils/dashboard-queries.ts
// Phase 06 — Wave 1: helpers puros para o dashboard executivo
// Funcoes sem dependencia de Supabase — testavel em isolamento via Vitest
// Consumido por Plan 02 (dashboard page) e Plan 03 (export Route Handler)

import { startOfMonth, endOfMonth, format, parse, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types publicos
// ---------------------------------------------------------------------------

export type BrokerRankingRow = {
  brokerId: string
  fullName: string
  productionCount: number
  commissionTotal: number
}

export type ProfileRow = { id: string; full_name: string }
export type CommissionRow = { broker_id: string; amount: number | string }
export type ProductionRow = { assigned_to: string }

// ---------------------------------------------------------------------------
// ALLOWED_EXPORT_TYPES — whitelist usada pelo Route Handler de export (Plan 03)
// T-06-01b: `as const` readonly tuple — nao pode ser estendida em runtime
// ---------------------------------------------------------------------------

export const ALLOWED_EXPORT_TYPES = ['apolices', 'clientes', 'comissoes'] as const
export type AllowedExportType = (typeof ALLOWED_EXPORT_TYPES)[number]

// ---------------------------------------------------------------------------
// isExecutiveRole — RBAC helper (DASH-09)
// T-06-01a: whitelist explicita — qualquer outro valor retorna false
// ---------------------------------------------------------------------------

export function isExecutiveRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'financeiro'
}

// ---------------------------------------------------------------------------
// aggregateBrokerRanking — agrega comissoes e producao por corretor (DASH-02)
//
// Regras:
// - 1 linha por profile (profiles sem entradas aparecem com 0/0)
// - broker_id em commissions/productions sem profile correspondente e ignorado
// - amount coercido para Number (Postgres NUMERIC pode vir como string)
// - Ordenacao: commissionTotal DESC, productionCount DESC, fullName ASC (pt-BR)
// ---------------------------------------------------------------------------

export function aggregateBrokerRanking(
  profiles: ProfileRow[],
  commissions: CommissionRow[],
  productions: ProductionRow[],
): BrokerRankingRow[] {
  // Soma de comissoes por broker_id
  const commissionMap = new Map<string, number>()
  for (const c of commissions) {
    const v = Number(c.amount) || 0
    commissionMap.set(c.broker_id, (commissionMap.get(c.broker_id) ?? 0) + v)
  }

  // Contagem de producao por assigned_to
  const productionMap = new Map<string, number>()
  for (const p of productions) {
    productionMap.set(p.assigned_to, (productionMap.get(p.assigned_to) ?? 0) + 1)
  }

  // Uma linha por profile (brokers sem profile sao ignorados)
  const rows: BrokerRankingRow[] = profiles.map((p) => ({
    brokerId: p.id,
    fullName: p.full_name,
    productionCount: productionMap.get(p.id) ?? 0,
    commissionTotal: commissionMap.get(p.id) ?? 0,
  }))

  // Ordenacao: commission DESC, production DESC, nome ASC (pt-BR)
  rows.sort((a, b) => {
    if (b.commissionTotal !== a.commissionTotal) return b.commissionTotal - a.commissionTotal
    if (b.productionCount !== a.productionCount) return b.productionCount - a.productionCount
    return a.fullName.localeCompare(b.fullName, 'pt-BR')
  })

  return rows
}

// ---------------------------------------------------------------------------
// dedupeClientIds — dedup de IDs de cliente de multiplas fontes (DASH-03)
//
// Recebe array de arrays de objetos com client_id. Retorna Set<string> com
// IDs unicos nao nulos. Garante dedup quando mesmo client aparece em
// policies E quotas (fontes diferentes da carteira ativa).
// ---------------------------------------------------------------------------

export function dedupeClientIds(
  arrays: Array<Array<{ client_id: string | null }>>,
): Set<string> {
  const set = new Set<string>()
  for (const arr of arrays) {
    for (const r of arr) {
      if (r.client_id) set.add(r.client_id)
    }
  }
  return set
}

// ---------------------------------------------------------------------------
// parseSelectedMonth — parse do MonthSelector URL-driven (DASH-01)
//
// Entrada: monthParam = 'YYYY-MM' (ex: '2026-04') ou undefined
// Saida: { monthStartStr, monthEndStr, monthValue, monthLabel }
//
// T-06-01c: input invalido cai em isValid check e fallback para mes corrente
// sem throw e sem injecao (helper puro, nao toca banco)
// ---------------------------------------------------------------------------

export function parseSelectedMonth(
  monthParam: string | undefined,
  today: Date = new Date(),
): { monthStartStr: string; monthEndStr: string; monthValue: string; monthLabel: string } {
  let baseDate = startOfMonth(today)

  if (monthParam) {
    // Aceita 'YYYY-MM' — concatena '-01' para parse como data completa
    const parsed = parse(monthParam + '-01', 'yyyy-MM-dd', today)
    if (isValid(parsed)) {
      baseDate = startOfMonth(parsed)
    }
    // Se invalido: fallback silencioso para mes corrente (sem throw)
  }

  return {
    monthStartStr: format(baseDate, 'yyyy-MM-dd'),
    monthEndStr: format(endOfMonth(baseDate), 'yyyy-MM-dd'),
    monthValue: format(baseDate, 'yyyy-MM'),
    monthLabel: format(baseDate, 'MMMM yyyy', { locale: ptBR }),
  }
}
