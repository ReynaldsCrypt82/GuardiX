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

// Importar action APOS os mocks
import { upsertBrokerProfileAction } from '@/lib/actions/broker-profiles'

describe('upsertBrokerProfileAction — RBAC e validacao (T-4-01, T-4-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockBrokerProfilesChain.upsert.mockReturnValue(Promise.resolve({ error: null }))
    mockSingle.mockResolvedValue({ data: { id: PROFILE_UUID }, error: null })
  })

  it('rejeita corretor (role !== admin) — T-4-01', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    const fd = makeFormData({
      profile_id: PROFILE_UUID,
      monthly_goal: 10000,
      commission_rate_default: 0.05,
    })
    const result = await upsertBrokerProfileAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    // Garante que NAO tocou DB
    expect(mockBrokerProfilesChain.upsert).not.toHaveBeenCalled()
  })

  it('rejeita commission_rate_default > 1 via Zod (T-4-05)', async () => {
    const fd = makeFormData({
      profile_id: PROFILE_UUID,
      monthly_goal: 10000,
      commission_rate_default: 1.5,
    })
    const result = await upsertBrokerProfileAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(mockBrokerProfilesChain.upsert).not.toHaveBeenCalled()
  })

  it('rejeita commission_rate_default negativo via Zod', async () => {
    const fd = makeFormData({
      profile_id: PROFILE_UUID,
      monthly_goal: 10000,
      commission_rate_default: -0.1,
    })
    const result = await upsertBrokerProfileAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(mockBrokerProfilesChain.upsert).not.toHaveBeenCalled()
  })

  it('aceita admin com dados validos e chama upsert com tenant_id do JWT', async () => {
    const fd = makeFormData({
      profile_id: PROFILE_UUID,
      susep_number: '100001234',
      monthly_goal: 10000,
      commission_rate_default: 0.05,
    })
    const result = await upsertBrokerProfileAction('slug-test', fd)
    expect(result).toHaveProperty('success', true)
    expect(mockBrokerProfilesChain.upsert).toHaveBeenCalledTimes(1)
    const callArgs = mockBrokerProfilesChain.upsert.mock.calls[0][0]
    expect(callArgs.tenant_id).toBe('tenant-uuid-1') // do JWT, nao do FormData
    expect(callArgs.id).toBe(PROFILE_UUID)
    expect(callArgs.commission_rate_default).toBe(0.05)
  })

  it('reconstroi commission_rate_overrides a partir de campos override_<key>', async () => {
    const fd = makeFormData({
      profile_id: PROFILE_UUID,
      monthly_goal: 10000,
      commission_rate_default: 0.05,
      override_auto: 0.06,
      override_consorcio_imovel: 0.025,
    })
    await upsertBrokerProfileAction('slug-test', fd)
    const callArgs = mockBrokerProfilesChain.upsert.mock.calls[0][0]
    expect(callArgs.commission_rate_overrides).toEqual({
      auto: 0.06,
      consorcio_imovel: 0.025,
    })
  })
})

// Suprime warning de imports nao utilizados
export { makeFormData, adminUser, corretorUser, ADMIN_UUID, CORRETOR_UUID, PROFILE_UUID, mockSupabase, mockBrokerProfilesChain, mockSingle }
