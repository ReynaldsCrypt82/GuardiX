import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockSourceSelectChain = {
  eq: vi.fn(() => ({ is: vi.fn(() => ({ single: mockSingle })) })),
}
const mockCommissionInsertResult = vi.fn()
const mockCommissionEntriesChain = {
  insert: vi.fn(() => Promise.resolve(mockCommissionInsertResult())),
  select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
}
const mockPoliciesChain = {
  select: vi.fn(() => mockSourceSelectChain),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
}
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn((table: string) => {
    if (table === 'commission_entries') return mockCommissionEntriesChain
    if (table === 'policies' || table === 'consortium_quotas') return mockPoliciesChain
    return mockPoliciesChain
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function makeFormData(data: Record<string, string | number>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.append(k, String(v))
  return fd
}

const ADMIN_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const CORRETOR_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

function adminUser() {
  return { id: ADMIN_UUID, app_metadata: { tenant_id: 'tenant-uuid-1', role: 'admin' } }
}
function corretorUser() {
  return { id: CORRETOR_UUID, app_metadata: { tenant_id: 'tenant-uuid-1', role: 'corretor' } }
}

import { markCommissionPaidAction, registerEstornoAction } from '@/lib/actions/commission-entries'

const POLICY_UUID = '11111111-1111-1111-1111-111111111111'
const QUOTA_UUID = '22222222-2222-2222-2222-222222222222'
const PARTNER_UUID = '33333333-3333-3333-3333-333333333333'
const BROKER_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

// Helper: mock supabase.from routing with custom table overrides
function makeMockFrom(overrides: Record<string, unknown> = {}) {
  return (table: string) => {
    if (table in overrides) return overrides[table]
    if (table === 'commission_entries') return mockCommissionEntriesChain
    if (table === 'policies' || table === 'consortium_quotas') return mockPoliciesChain
    return mockPoliciesChain
  }
}

// Default broker profile mock
function brokerProfileMock(rateOverrides: Record<string, number> = {}) {
  return {
    select: () => ({
      eq: () => ({
        is: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: BROKER_UUID,
              commission_rate_default: 0.05,
              commission_rate_overrides: rateOverrides,
            },
            error: null,
          }),
        }),
      }),
    }),
  }
}

// Default partner mock
function partnerMock(rate = 0.02) {
  return {
    select: () => ({
      eq: () => ({
        is: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: PARTNER_UUID,
              commission_rate_default: rate,
              commission_rate_overrides: {},
            },
            error: null,
          }),
        }),
      }),
    }),
  }
}

describe('markCommissionPaidAction — D-09 + D-06 + D-10', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockCommissionInsertResult.mockReturnValue({ error: null })
    mockCommissionEntriesChain.insert.mockResolvedValue({ error: null })
    mockSupabase.from.mockImplementation(makeMockFrom({
      broker_profiles: brokerProfileMock(),
      partners: partnerMock(),
    }))
  })

  it('rejeita role !== admin/corretor', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'fff', app_metadata: { tenant_id: 'tenant-uuid-1', role: 'visualizador' } } },
    })
    const result = await markCommissionPaidAction('slug-test', 'policy', POLICY_UUID)
    expect(result).toHaveProperty('error')
    expect(mockCommissionEntriesChain.insert).not.toHaveBeenCalled()
  })

  it('rejeita quando commission_paid_at ja esta preenchido (Pitfall 1 idempotencia)', async () => {
    mockPoliciesChain.select.mockReturnValueOnce({
      eq: () => ({
        is: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: POLICY_UUID,
              type: 'auto',
              premio_total: 1000,
              assigned_to: BROKER_UUID,
              partner_id: null,
              commission_paid_at: '2026-04-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
    })

    const result = await markCommissionPaidAction('slug-test', 'policy', POLICY_UUID)
    expect(result).toHaveProperty('error')
    const errMsg = (result as { error: { _form?: string[] } }).error._form?.[0] ?? ''
    expect(errMsg).toContain('Comiss')
    expect(mockCommissionEntriesChain.insert).not.toHaveBeenCalled()
  })

  it('insere 1 entry quando NAO ha partner_id (D-06 caso simples)', async () => {
    mockPoliciesChain.select.mockReturnValueOnce({
      eq: () => ({
        is: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: POLICY_UUID,
              type: 'auto',
              premio_total: 1000,
              assigned_to: BROKER_UUID,
              partner_id: null,
              commission_paid_at: null,
            },
            error: null,
          }),
        }),
      }),
    })

    const result = await markCommissionPaidAction('slug-test', 'policy', POLICY_UUID)
    expect(result).toHaveProperty('success', true)
    expect((result as { entries_count: number }).entries_count).toBe(1)
    expect(mockCommissionEntriesChain.insert).toHaveBeenCalledTimes(1)
    const inserted = mockCommissionEntriesChain.insert.mock.calls[0][0]
    expect(Array.isArray(inserted)).toBe(true)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].entry_type).toBe('comissao')
    expect(inserted[0].broker_id).toBe(BROKER_UUID)
    expect(inserted[0].partner_id).toBeNull()
    expect(inserted[0].amount).toBe(50) // 1000 * 0.05
  })

  it('insere 2 entries quando HA partner_id (D-06 split)', async () => {
    mockPoliciesChain.select.mockReturnValueOnce({
      eq: () => ({
        is: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: POLICY_UUID,
              type: 'auto',
              premio_total: 1000,
              assigned_to: BROKER_UUID,
              partner_id: PARTNER_UUID,
              commission_paid_at: null,
            },
            error: null,
          }),
        }),
      }),
    })

    const result = await markCommissionPaidAction('slug-test', 'policy', POLICY_UUID)
    expect(result).toHaveProperty('success', true)
    expect((result as { entries_count: number }).entries_count).toBe(2)
    const inserted = mockCommissionEntriesChain.insert.mock.calls[0][0]
    expect(inserted).toHaveLength(2)
    expect(inserted[0].broker_id).toBe(BROKER_UUID)
    expect(inserted[0].partner_id).toBeNull()
    expect(inserted[1].broker_id).toBeNull()
    expect(inserted[1].partner_id).toBe(PARTNER_UUID)
    expect(inserted[0].amount).toBe(50) // broker: 1000 * 0.05
    expect(inserted[1].amount).toBe(20) // partner: 1000 * 0.02
  })

  it('source_type=quota usa group.credit_value e prefixa productType com consorcio_', async () => {
    mockPoliciesChain.select.mockReturnValueOnce({
      eq: () => ({
        is: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: QUOTA_UUID,
              assigned_to: BROKER_UUID,
              partner_id: null,
              commission_paid_at: null,
              group: { type: 'imovel', credit_value: 200000 },
            },
            error: null,
          }),
        }),
      }),
    })

    // Override broker_profiles to return override for consorcio_imovel
    mockSupabase.from.mockImplementation(makeMockFrom({
      broker_profiles: brokerProfileMock({ consorcio_imovel: 0.025 }),
    }))

    const result = await markCommissionPaidAction('slug-test', 'quota', QUOTA_UUID)
    expect(result).toHaveProperty('success', true)
    const inserted = mockCommissionEntriesChain.insert.mock.calls[0][0]
    expect(inserted[0].quota_id).toBe(QUOTA_UUID)
    expect(inserted[0].policy_id).toBeNull()
    expect(inserted[0].rate_used).toBe(0.025) // override consorcio_imovel
    expect(inserted[0].amount).toBe(5000) // 200000 * 0.025
  })
})

describe('registerEstornoAction — D-10 imutabilidade via novo lancamento', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockCommissionEntriesChain.insert.mockResolvedValue({ error: null })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'commission_entries') return mockCommissionEntriesChain
      return mockPoliciesChain
    })
  })

  it('rejeita amount positivo (estorno deve ser negativo)', async () => {
    const fd = makeFormData({
      source_type: 'policy',
      source_id: POLICY_UUID,
      recipient_type: 'broker',
      recipient_id: BROKER_UUID,
      amount: 100, // POSITIVO — deveria falhar
      reference_month: '2026-04-01',
      notes: 'Cliente cancelou apolice',
    })
    const result = await registerEstornoAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(mockCommissionEntriesChain.insert).not.toHaveBeenCalled()
  })

  it('aceita amount negativo + notes valido — insere entry_type=estorno', async () => {
    const fd = makeFormData({
      source_type: 'policy',
      source_id: POLICY_UUID,
      recipient_type: 'broker',
      recipient_id: BROKER_UUID,
      amount: -50,
      reference_month: '2026-04-01',
      notes: 'Cliente cancelou apolice apos 7 dias',
    })
    const result = await registerEstornoAction('slug-test', fd)
    expect(result).toHaveProperty('success', true)
    expect(mockCommissionEntriesChain.insert).toHaveBeenCalledTimes(1)
    const inserted = mockCommissionEntriesChain.insert.mock.calls[0][0]
    expect(inserted.entry_type).toBe('estorno')
    expect(inserted.amount).toBe(-50)
    expect(inserted.broker_id).toBe(BROKER_UUID)
    expect(inserted.partner_id).toBeNull()
  })
})

export { makeFormData, adminUser, corretorUser, ADMIN_UUID, CORRETOR_UUID, mockSupabase, mockSourceSelectChain, mockCommissionEntriesChain, mockPoliciesChain, mockSingle, mockCommissionInsertResult }
