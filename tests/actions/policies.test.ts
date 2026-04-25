import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase/server
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockPoliciesInsertChain = {
  select: vi.fn(() => ({ single: mockSingle })),
}
const mockPoliciesChain = {
  insert: vi.fn(() => mockPoliciesInsertChain),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
}
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn((table: string) => {
    if (table === 'policies') return mockPoliciesChain
    return mockPoliciesChain
  }),
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
function makeFormData(data: Record<string, string | number>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    fd.append(k, String(v))
  }
  return fd
}

// Use stable UUIDs for user IDs so Zod schema validates correctly
const ADMIN_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const CORRETOR_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const CLIENT_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function adminUser(overrides?: Record<string, unknown>) {
  return {
    id: ADMIN_UUID,
    app_metadata: {
      tenant_id: 'tenant-uuid-1',
      role: 'admin',
      ...overrides,
    },
  }
}

function corretorUser(overrides?: Record<string, unknown>) {
  return {
    id: CORRETOR_UUID,
    app_metadata: {
      tenant_id: 'tenant-uuid-1',
      role: 'corretor',
      ...overrides,
    },
  }
}

// Valid base policy fields for 'auto' type
function autoFormData(overrides?: Record<string, string | number>) {
  return makeFormData({
    type: 'auto',
    policy_number: 'POL-001',
    insurer: 'Porto Seguro',
    vigencia_inicio: '2026-01-01',
    vigencia_fim: '2027-01-01',
    premio_total: 1500,
    client_id: CLIENT_UUID,
    assigned_to: ADMIN_UUID,
    placa: 'ABC1D23',
    marca_modelo: 'Toyota Corolla',
    ano: 2022,
    valor_fipe: 90000,
    cobertura: 'compreensiva',
    ...overrides,
  })
}

// Valid base policy fields for 'outros' type
function outrosFormData(overrides?: Record<string, string | number>) {
  return makeFormData({
    type: 'outros',
    policy_number: 'POL-002',
    insurer: 'Itaú Seguros',
    vigencia_inicio: '2026-01-01',
    vigencia_fim: '2027-01-01',
    premio_total: 500,
    client_id: CLIENT_UUID,
    assigned_to: ADMIN_UUID,
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Import actions (after mocks are set up)
// ---------------------------------------------------------------------------
import { createPolicyAction, softDeletePolicyAction } from '@/lib/actions/policies'

// ---------------------------------------------------------------------------
// createPolicyAction — validação e campos core
// ---------------------------------------------------------------------------
describe('createPolicyAction — validação e campos core', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockPoliciesInsertChain.select.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'policy-1' }, error: null })
  })

  it('createPolicyAction rejeita type inválido (ex: xx) — retorna error.type', async () => {
    const fd = makeFormData({
      type: 'xx',
      policy_number: 'POL-001',
      insurer: 'Porto Seguro',
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2027-01-01',
      premio_total: 1500,
      client_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      assigned_to: 'user-admin-1',
    })
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toHaveProperty('error')
  })

  it('createPolicyAction rejeita tipo auto sem placa — retorna error.placa', async () => {
    const fd = makeFormData({
      type: 'auto',
      policy_number: 'POL-001',
      insurer: 'Porto Seguro',
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2027-01-01',
      premio_total: 1500,
      client_id: CLIENT_UUID,
      assigned_to: ADMIN_UUID,
      marca_modelo: 'Toyota Corolla',
      ano: 2022,
      valor_fipe: 90000,
      cobertura: 'compreensiva',
      // placa ausente
    })
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('placa')
  })

  it('createPolicyAction tipo outros aceita sem campos extras — insere com type_data: {}', async () => {
    const fd = outrosFormData()
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toEqual({ id: 'policy-1' })
    expect(mockPoliciesChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type_data: {} })
    )
  })

  it('createPolicyAction tipo auto insere type_data com campos auto — SEM campos core', async () => {
    const fd = autoFormData({ assigned_to: ADMIN_UUID })
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toEqual({ id: 'policy-1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertArg = (mockPoliciesChain.insert.mock.calls as any)[0][0] as Record<string, unknown>
    // type_data deve conter campos específicos do auto
    expect(insertArg.type_data).toEqual(
      expect.objectContaining({ placa: 'ABC1D23', marca_modelo: 'Toyota Corolla' })
    )
    // type_data NÃO deve conter campos core
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('policy_number')
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('insurer')
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('vigencia_inicio')
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('vigencia_fim')
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('premio_total')
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('client_id')
    expect((insertArg.type_data as Record<string, unknown>)).not.toHaveProperty('assigned_to')
  })

  it('createPolicyAction bloqueia corretor atribuindo apólice a outro — retorna error.assigned_to', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    // corretor user id = CORRETOR_UUID, tentando assigned_to diferente (outro UUID válido)
    const fd = autoFormData({ assigned_to: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    // Ou Zod rejeita UUID inválido, ou action bloqueia — ambos retornam error com propriedade assigned_to
    expect(result?.error).toHaveProperty('assigned_to')
  })

  it('createPolicyAction rejeita quando tenantId ausente — retorna error._form', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: adminUser({ tenant_id: undefined }) },
    })
    const fd = outrosFormData()
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toHaveProperty('error')
    expect(result?.error).toHaveProperty('_form')
  })

  it('createPolicyAction rejeita número de apólice duplicado (23505) — retorna error.policy_number', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const fd = outrosFormData()
    const result = await createPolicyAction('slug-test', fd)
    expect(result).toEqual({
      error: { policy_number: ['Número de apólice já cadastrado nesta corretora.'] },
    })
  })
})

// ---------------------------------------------------------------------------
// softDeletePolicyAction
// ---------------------------------------------------------------------------
describe('softDeletePolicyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: admin user
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    // Default: update chain that resolves OK
    const eqFn = vi.fn(() => Promise.resolve({ error: null }))
    mockPoliciesChain.update.mockReturnValue({ eq: eqFn })
  })

  it('softDeletePolicyAction faz UPDATE deleted_at = NOW() — não DELETE físico', async () => {
    const result = await softDeletePolicyAction('slug-test', 'policy-uuid-1')
    expect(result).toEqual({ success: true })
    // Must call .update() (not a hard delete)
    expect(mockPoliciesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
  })

  it('softDeletePolicyAction bloqueia não-admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    const result = await softDeletePolicyAction('slug-test', 'policy-uuid-1')
    expect(result).toHaveProperty('error')
  })
})
