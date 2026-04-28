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

describe('markCommissionPaidAction — placeholder (Task 4 preenche)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it.todo('Task 4: insere 1 entry sem partner_id')
  it.todo('Task 4: insere 2 entries com partner_id (D-06)')
  it.todo('Task 4: rejeita quando commission_paid_at ja preenchido (idempotencia)')
})

describe('registerEstornoAction — placeholder (Task 4 preenche)', () => {
  it.todo('Task 4: insere entry com amount negativo e entry_type=estorno')
})

export { makeFormData, adminUser, corretorUser, ADMIN_UUID, CORRETOR_UUID, mockSupabase, mockSourceSelectChain, mockCommissionEntriesChain, mockPoliciesChain, mockSingle, mockCommissionInsertResult }
