import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase/server
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockClaimsInsertChain = {
  select: vi.fn(() => ({ single: mockSingle })),
}
const mockClaimsChain = {
  insert: vi.fn(() => mockClaimsInsertChain),
}
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockClaimsChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// ---------------------------------------------------------------------------
// Mock: next/cache
// ---------------------------------------------------------------------------
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    fd.append(k, v)
  }
  return fd
}

function adminUser(overrides?: Record<string, unknown>) {
  return {
    id: 'user-admin-1',
    app_metadata: {
      tenant_id: 'tenant-uuid-1',
      role: 'admin',
      ...overrides,
    },
  }
}

function validClaimFormData(overrides?: Record<string, string>) {
  return makeFormData({
    policy_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    claim_date: '2026-03-15',
    type: 'colisão',
    description: 'Colisão traseira em via pública',
    status: 'aberto',
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Import action (after mocks)
// ---------------------------------------------------------------------------
import { createClaimAction } from '@/lib/actions/claims'

// ---------------------------------------------------------------------------
// createClaimAction — validação de sinistros
// ---------------------------------------------------------------------------
describe('createClaimAction — validação de sinistros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockClaimsInsertChain.select.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'claim-1' }, error: null })
  })

  it('createClaimAction valida policy_id como UUID obrigatório', async () => {
    const fd = validClaimFormData({ policy_id: 'nao-e-um-uuid' })
    const result = await createClaimAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('policy_id')
  })

  it('createClaimAction valida claim_date como ISO date', async () => {
    const fd = validClaimFormData({ claim_date: 'data-invalida' })
    const result = await createClaimAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('claim_date')
  })

  it('createClaimAction valida description não-vazia', async () => {
    const fd = validClaimFormData({ description: '' })
    const result = await createClaimAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('description')
  })

  it('createClaimAction insere com tenant_id do JWT, não do FormData', async () => {
    const fd = validClaimFormData()
    // Não enviamos tenant_id no FormData — deve vir do JWT
    const result = await createClaimAction('slug-test', fd)
    expect(result).toEqual({ id: 'claim-1' })
    expect(mockClaimsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-uuid-1' })
    )
    // Confirma que o insert NÃO recebeu tenant_id do FormData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertArg = (mockClaimsChain.insert.mock.calls as any)[0][0] as Record<string, unknown>
    expect(insertArg.tenant_id).toBe('tenant-uuid-1')
  })

  it('createClaimAction rejeita status inválido (ex: xyz)', async () => {
    const fd = validClaimFormData({ status: 'xyz' })
    const result = await createClaimAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('status')
  })

  it('createClaimAction revalida path /{slug}/seguros/{policy_id} após sucesso', async () => {
    const { revalidatePath } = await import('next/cache')
    const policyId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const fd = validClaimFormData({ policy_id: policyId })
    await createClaimAction('slug-test', fd)
    expect(revalidatePath).toHaveBeenCalledWith(`/slug-test/seguros/${policyId}`)
  })
})
