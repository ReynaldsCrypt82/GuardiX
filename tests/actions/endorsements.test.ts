import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase/server
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockEndorsementsInsertChain = {
  select: vi.fn(() => ({ single: mockSingle })),
}
const mockEndorsementsChain = {
  insert: vi.fn(() => mockEndorsementsInsertChain),
}
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockEndorsementsChain),
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

function validEndorsementFormData(overrides?: Record<string, string>) {
  return makeFormData({
    policy_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    endorsement_date: '2026-03-15',
    type: 'alteracao',
    description: 'Alteração de endereço do segurado',
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Import action (after mocks)
// ---------------------------------------------------------------------------
import { createEndorsementAction } from '@/lib/actions/endorsements'

// ---------------------------------------------------------------------------
// createEndorsementAction — validação de endossos
// ---------------------------------------------------------------------------
describe('createEndorsementAction — validação de endossos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockEndorsementsInsertChain.select.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'endorsement-1' }, error: null })
  })

  it('createEndorsementAction rejeita type inválido (ex: mudança)', async () => {
    const fd = validEndorsementFormData({ type: 'mudança' })
    const result = await createEndorsementAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('type')
  })

  it('createEndorsementAction aceita premium_impact nulo/undefined', async () => {
    const fd = validEndorsementFormData()
    // sem premium_impact no FormData — deve aceitar
    const result = await createEndorsementAction('slug-test', fd)
    expect(result).toEqual({ id: 'endorsement-1' })
    expect(mockEndorsementsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ premium_impact: null })
    )
  })

  it('createEndorsementAction insere com tenant_id do JWT', async () => {
    const fd = validEndorsementFormData()
    const result = await createEndorsementAction('slug-test', fd)
    expect(result).toEqual({ id: 'endorsement-1' })
    expect(mockEndorsementsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-uuid-1' })
    )
  })
})
