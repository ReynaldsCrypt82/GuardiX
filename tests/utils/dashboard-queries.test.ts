import { describe, it, expect } from 'vitest'
import {
  aggregateBrokerRanking,
  dedupeClientIds,
  parseSelectedMonth,
  isExecutiveRole,
  ALLOWED_EXPORT_TYPES,
  type ProfileRow,
  type CommissionRow,
  type ProductionRow,
} from '@/lib/utils/dashboard-queries'

describe('aggregateBrokerRanking (DASH-02)', () => {
  const profiles: ProfileRow[] = [
    { id: 'p1', full_name: 'Alice' },
    { id: 'p2', full_name: 'Bruno' },
    { id: 'p3', full_name: 'Carlos' },
  ]

  it('ordena DESC por comissao quando valores diferem', () => {
    const commissions: CommissionRow[] = [
      { broker_id: 'p1', amount: 100 },
      { broker_id: 'p2', amount: 500 },
      { broker_id: 'p3', amount: 250 },
    ]
    const rows = aggregateBrokerRanking(profiles, commissions, [])
    expect(rows.map((r) => r.brokerId)).toEqual(['p2', 'p3', 'p1'])
  })

  it('tiebreak por producao quando comissoes iguais', () => {
    const commissions: CommissionRow[] = [
      { broker_id: 'p1', amount: 100 },
      { broker_id: 'p2', amount: 100 },
    ]
    const productions: ProductionRow[] = [
      { assigned_to: 'p1' },
      { assigned_to: 'p1' },
      { assigned_to: 'p2' },
    ]
    const rows = aggregateBrokerRanking(profiles, commissions, productions)
    // p1 deve vir antes de p2 (mais producao com mesma comissao)
    const p1 = rows.findIndex((r) => r.brokerId === 'p1')
    const p2 = rows.findIndex((r) => r.brokerId === 'p2')
    expect(p1).toBeLessThan(p2)
  })

  it('tiebreak alfabetico quando comissao e producao iguais', () => {
    const rows = aggregateBrokerRanking(profiles, [], [])
    expect(rows.map((r) => r.fullName)).toEqual(['Alice', 'Bruno', 'Carlos'])
  })

  it('profile sem entries -> linha com 0/0', () => {
    const rows = aggregateBrokerRanking(profiles, [], [])
    for (const r of rows) {
      expect(r.commissionTotal).toBe(0)
      expect(r.productionCount).toBe(0)
    }
  })

  it('amount como string (Postgres NUMERIC) -> coerce para numero', () => {
    const commissions: CommissionRow[] = [
      { broker_id: 'p1', amount: '123.45' as unknown as number },
    ]
    const rows = aggregateBrokerRanking(profiles, commissions, [])
    expect(rows.find((r) => r.brokerId === 'p1')?.commissionTotal).toBeCloseTo(123.45)
  })

  it('multiplos commissions para mesmo broker -> soma', () => {
    const commissions: CommissionRow[] = [
      { broker_id: 'p1', amount: 100 },
      { broker_id: 'p1', amount: 50 },
      { broker_id: 'p1', amount: 25 },
    ]
    const rows = aggregateBrokerRanking(profiles, commissions, [])
    expect(rows.find((r) => r.brokerId === 'p1')?.commissionTotal).toBe(175)
  })

  it('broker_id em commissions sem profile correspondente -> ignorado', () => {
    const commissions: CommissionRow[] = [
      { broker_id: 'p1', amount: 100 },
      { broker_id: 'ghost', amount: 999 },
    ]
    const rows = aggregateBrokerRanking(profiles, commissions, [])
    expect(rows).toHaveLength(3)
    expect(rows.find((r) => r.brokerId === 'ghost')).toBeUndefined()
  })
})

describe('dedupeClientIds (DASH-03)', () => {
  it('arrays vazios -> Set vazio', () => {
    expect(dedupeClientIds([]).size).toBe(0)
    expect(dedupeClientIds([[], []]).size).toBe(0)
  })

  it('client_id null e ignorado', () => {
    const set = dedupeClientIds([[{ client_id: 'c1' }, { client_id: null }]])
    expect(set.size).toBe(1)
    expect(set.has('c1')).toBe(true)
  })

  it('mesmo client em 2 fontes (policies + quotas) -> 1 entrada', () => {
    const set = dedupeClientIds([
      [{ client_id: 'c1' }, { client_id: 'c2' }],
      [{ client_id: 'c1' }, { client_id: 'c3' }],
    ])
    expect(set.size).toBe(3)
    expect(Array.from(set).sort()).toEqual(['c1', 'c2', 'c3'])
  })
})

describe('parseSelectedMonth (DASH-01)', () => {
  const today = new Date('2026-04-15T12:00:00Z')

  it('monthParam undefined -> fallback para mes corrente', () => {
    const r = parseSelectedMonth(undefined, today)
    expect(r.monthStartStr).toBe('2026-04-01')
    expect(r.monthEndStr).toBe('2026-04-30')
    expect(r.monthValue).toBe('2026-04')
  })

  it('monthParam valido -> usa o mes informado', () => {
    const r = parseSelectedMonth('2026-02', today)
    expect(r.monthStartStr).toBe('2026-02-01')
    expect(r.monthEndStr).toBe('2026-02-28')
    expect(r.monthValue).toBe('2026-02')
  })

  it('monthParam invalido -> fallback graceful', () => {
    const r = parseSelectedMonth('garbage', today)
    expect(r.monthStartStr).toBe('2026-04-01')
    expect(r.monthValue).toBe('2026-04')
  })

  it('monthLabel em pt-BR', () => {
    const r = parseSelectedMonth('2026-04', today)
    expect(r.monthLabel.toLowerCase()).toContain('abril')
  })
})

describe('isExecutiveRole (DASH-09)', () => {
  it('admin -> true', () => expect(isExecutiveRole('admin')).toBe(true))
  it('financeiro -> true', () => expect(isExecutiveRole('financeiro')).toBe(true))
  it('corretor -> false', () => expect(isExecutiveRole('corretor')).toBe(false))
  it('visualizador -> false', () => expect(isExecutiveRole('visualizador')).toBe(false))
  it('null -> false', () => expect(isExecutiveRole(null)).toBe(false))
  it('undefined -> false', () => expect(isExecutiveRole(undefined)).toBe(false))
  it('string vazia -> false', () => expect(isExecutiveRole('')).toBe(false))
})

describe('ALLOWED_EXPORT_TYPES (whitelist)', () => {
  it('contem exatamente 3 tipos', () => {
    expect(ALLOWED_EXPORT_TYPES).toHaveLength(3)
  })
  it('inclui apolices, clientes, comissoes', () => {
    expect(ALLOWED_EXPORT_TYPES).toContain('apolices')
    expect(ALLOWED_EXPORT_TYPES).toContain('clientes')
    expect(ALLOWED_EXPORT_TYPES).toContain('comissoes')
  })
})
