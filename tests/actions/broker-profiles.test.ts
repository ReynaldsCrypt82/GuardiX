import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockBrokerProfilesChain = {
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
  upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) })),
  select: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({ single: mockSingle })) })) })),
}
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => mockBrokerProfilesChain),
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
const PROFILE_UUID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

function adminUser() {
  return { id: ADMIN_UUID, app_metadata: { tenant_id: 'tenant-uuid-1', role: 'admin' } }
}
function corretorUser() {
  return { id: CORRETOR_UUID, app_metadata: { tenant_id: 'tenant-uuid-1', role: 'corretor' } }
}

describe('upsertBrokerProfileAction — placeholder (Task 4 preenche)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it.todo('Task 4: rejeita role !== admin (T-4-01)')
  it.todo('Task 4: rejeita commission_rate_default > 1 (T-4-05)')
  it.todo('Task 4: aceita admin com taxa 0..1')
})

// Suprime warning de imports nao utilizados nos stubs ate Task 4
export { makeFormData, adminUser, corretorUser, ADMIN_UUID, CORRETOR_UUID, PROFILE_UUID, mockSupabase, mockBrokerProfilesChain, mockSingle }
