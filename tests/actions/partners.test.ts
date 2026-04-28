import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockPartnersChain = {
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
  select: vi.fn(),
}
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => mockPartnersChain),
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

describe('createPartnerAction — placeholder (Task 4 preenche)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it.todo('Task 4: rejeita role !== admin (T-4-01)')
  it.todo('Task 4: aceita admin com nome valido')
})

export { makeFormData, adminUser, corretorUser, ADMIN_UUID, CORRETOR_UUID, mockSupabase, mockPartnersChain, mockSingle }
