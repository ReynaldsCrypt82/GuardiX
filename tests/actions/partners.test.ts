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

import { createPartnerAction } from '@/lib/actions/partners'

describe('createPartnerAction — RBAC (T-4-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockPartnersChain.insert.mockReturnValue({
      select: vi.fn(() => ({ single: mockSingle })),
    })
    mockSingle.mockResolvedValue({ data: { id: 'partner-1' }, error: null })
  })

  it('rejeita corretor (role !== admin) — T-4-01', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    const fd = makeFormData({
      name: 'Parceiro Teste',
      commission_rate_default: 0.03,
    })
    const result = await createPartnerAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(mockPartnersChain.insert).not.toHaveBeenCalled()
  })

  it('rejeita name vazio via Zod', async () => {
    const fd = makeFormData({
      name: '',
      commission_rate_default: 0.03,
    })
    const result = await createPartnerAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(mockPartnersChain.insert).not.toHaveBeenCalled()
  })

  it('aceita admin com dados validos e usa tenant_id do JWT', async () => {
    const fd = makeFormData({
      name: 'Parceiro Teste',
      cnpj: '12345678000199',
      commission_rate_default: 0.03,
    })
    const result = await createPartnerAction('slug-test', fd)
    expect(result).toHaveProperty('id', 'partner-1')
    expect(mockPartnersChain.insert).toHaveBeenCalledTimes(1)
    const callArgs = mockPartnersChain.insert.mock.calls[0][0]
    expect(callArgs.tenant_id).toBe('tenant-uuid-1') // T-04-03
    expect(callArgs.name).toBe('Parceiro Teste')
  })
})

export { makeFormData, adminUser, corretorUser, ADMIN_UUID, CORRETOR_UUID, mockSupabase, mockPartnersChain, mockSingle }
