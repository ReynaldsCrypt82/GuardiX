import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase/server
// ---------------------------------------------------------------------------

// Chains for consortium_groups table
const mockGroupSingle = vi.fn()
const mockGroupInsertChain = {
  select: vi.fn(() => ({ single: mockGroupSingle })),
}
const mockGroupUpdateChain = {
  eq: vi.fn(() => Promise.resolve({ error: null })),
}
const mockGroupChain = {
  insert: vi.fn(() => mockGroupInsertChain),
  update: vi.fn(() => mockGroupUpdateChain),
}

// Chains for consortium_quotas table
const mockQuotaSingle = vi.fn()
const mockQuotaInsertChain = {
  select: vi.fn(() => ({ single: mockQuotaSingle })),
}
const mockQuotaUpdateChain = {
  eq: vi.fn(() => Promise.resolve({ error: null })),
}
const mockQuotaSelectChain = {
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}
const mockQuotaChain = {
  insert: vi.fn(() => mockQuotaInsertChain),
  update: vi.fn(() => mockQuotaUpdateChain),
  select: vi.fn(() => mockQuotaSelectChain),
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn((table: string) => {
    if (table === 'consortium_groups') return mockGroupChain
    if (table === 'consortium_quotas') return mockQuotaChain
    return mockGroupChain
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

// Use stable UUIDs so Zod schema validates correctly
const ADMIN_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const CORRETOR_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const CLIENT_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const QUOTA_UUID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

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

// Valid base fields for createGroupAction
function validGroupFormData(overrides?: Record<string, string | number>) {
  return makeFormData({
    administrator: 'Bradesco Consórcios',
    type: 'auto',
    credit_value: '50000',
    term_months: '60',
    start_date: '2026-01-01',
    total_quotas: '100',
    ...overrides,
  })
}

// Valid base fields for createQuotaAction
function validQuotaFormData(overrides?: Record<string, string | number>) {
  return makeFormData({
    client_id: CLIENT_UUID,
    assigned_to: ADMIN_UUID,
    quota_number: '001',
    monthly_payment: '500',
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// createGroupAction — validação de grupos de consórcio
// ---------------------------------------------------------------------------
describe('createGroupAction — validação de grupos de consórcio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockGroupSingle.mockResolvedValue({ data: { id: GROUP_UUID }, error: null })
    // Reset insert chain
    mockGroupInsertChain.select.mockReturnValue({ single: mockGroupSingle })
    mockGroupChain.insert.mockReturnValue(mockGroupInsertChain)
  })

  it('rejeita administrator vazio (min 2 chars) — retorna error.administrator', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData({ administrator: 'A' })
    const result = await createGroupAction('slug', fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, unknown> }).error).toHaveProperty('administrator')
  })

  it('rejeita type inválido (ex: barco) — retorna error.type', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData({ type: 'barco' })
    const result = await createGroupAction('slug', fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, unknown> }).error).toHaveProperty('type')
  })

  it('rejeita credit_value = 0 — retorna error.credit_value', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData({ credit_value: '0' })
    const result = await createGroupAction('slug', fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, unknown> }).error).toHaveProperty('credit_value')
  })

  it('rejeita term_months = 0 — retorna error.term_months', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData({ term_months: '0' })
    const result = await createGroupAction('slug', fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, unknown> }).error).toHaveProperty('term_months')
  })

  it('aceita next_assembly_date null/undefined (campo opcional)', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData() // sem next_assembly_date
    const result = await createGroupAction('slug', fd)
    expect(result).toEqual({ id: GROUP_UUID })
  })

  it('aceita next_assembly_date vazio como null (string vazia normalizada)', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData({ next_assembly_date: '' })
    const result = await createGroupAction('slug', fd)
    expect(result).toEqual({ id: GROUP_UUID })
  })

  it('insere com tenant_id do JWT (nunca do FormData)', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    const fd = validGroupFormData({ tenant_id: 'outro-tenant-malicioso' })
    const result = await createGroupAction('slug', fd)
    expect(result).toEqual({ id: GROUP_UUID })
    expect(mockGroupChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-uuid-1' })
    )
  })

  it('retorna erro se usuário não autenticado', async () => {
    const { createGroupAction } = await import('@/lib/actions/consortium-groups')
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const fd = validGroupFormData()
    const result = await createGroupAction('slug', fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, string[]> }).error._form).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// createQuotaAction — validação de cotas
// ---------------------------------------------------------------------------
describe('createQuotaAction — validação de cotas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockQuotaSingle.mockResolvedValue({ data: { id: QUOTA_UUID }, error: null })
    mockQuotaInsertChain.select.mockReturnValue({ single: mockQuotaSingle })
    mockQuotaChain.insert.mockReturnValue(mockQuotaInsertChain)
  })

  it('rejeita group_id inválido (não UUID) — retorna error.group_id', async () => {
    const { createQuotaAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validQuotaFormData()
    const result = await createQuotaAction('slug', 'nao-e-uuid', fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, unknown> }).error).toHaveProperty('group_id')
  })

  it('rejeita client_id inválido (não UUID) — retorna error.client_id', async () => {
    const { createQuotaAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validQuotaFormData({ client_id: 'nao-e-uuid' })
    const result = await createQuotaAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, unknown> }).error).toHaveProperty('client_id')
  })

  it('bloqueia corretor atribuindo cota a outro corretor', async () => {
    const { createQuotaAction } = await import('@/lib/actions/consortium-quotas')
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    const outroCorretorUUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    const fd = validQuotaFormData({ assigned_to: outroCorretorUUID })
    const result = await createQuotaAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, string[]> }).error.assigned_to).toBeDefined()
  })

  it('insere com tenant_id do JWT, status default ativo', async () => {
    const { createQuotaAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validQuotaFormData()
    const result = await createQuotaAction('slug', GROUP_UUID, fd)
    expect(result).toEqual({ id: QUOTA_UUID })
    expect(mockQuotaChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-uuid-1',
        status: 'ativo',
        group_id: GROUP_UUID,
      })
    )
  })

  it('trata quota_number duplicada (constraint 23505)', async () => {
    const { createQuotaAction } = await import('@/lib/actions/consortium-quotas')
    mockQuotaSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })
    const fd = validQuotaFormData()
    const result = await createQuotaAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
    expect((result as { error: Record<string, string[]> }).error.quota_number).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// updateQuotaContemplationAction — registro de contemplação
// ---------------------------------------------------------------------------
describe('updateQuotaContemplationAction — registro de contemplação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    // update chain: update().eq()
    const eqFn = vi.fn(() => Promise.resolve({ error: null }))
    mockQuotaChain.update.mockReturnValue({ eq: eqFn })
  })

  function validContemplationFormData(overrides?: Record<string, string | number>) {
    return makeFormData({
      quota_id: QUOTA_UUID,
      contemplation_date: '2026-04-01',
      contemplation_type: 'sorteio',
      ...overrides,
    })
  }

  it('rejeita contemplation_type inválido (ex: ganhou)', async () => {
    const { updateQuotaContemplationAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validContemplationFormData({ contemplation_type: 'ganhou' })
    const result = await updateQuotaContemplationAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
  })

  it('para tipo lance: rejeita lance_value = 0', async () => {
    const { updateQuotaContemplationAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validContemplationFormData({
      contemplation_type: 'lance',
      lance_value: '0',
    })
    const result = await updateQuotaContemplationAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
  })

  it('para tipo lance: rejeita lance_value ausente', async () => {
    const { updateQuotaContemplationAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validContemplationFormData({ contemplation_type: 'lance' })
    // lance_value not included
    const result = await updateQuotaContemplationAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
  })

  it('para tipo sorteio: aceita sem lance_value', async () => {
    const { updateQuotaContemplationAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validContemplationFormData({ contemplation_type: 'sorteio' })
    const result = await updateQuotaContemplationAction('slug', GROUP_UUID, fd)
    expect(result).toEqual({ success: true })
  })

  it('para tipo lance: aceita com lance_value > 0', async () => {
    const { updateQuotaContemplationAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validContemplationFormData({
      contemplation_type: 'lance',
      lance_value: '15000',
    })
    const result = await updateQuotaContemplationAction('slug', GROUP_UUID, fd)
    expect(result).toEqual({ success: true })
  })

  it('após sucesso: atualiza status=contemplado + post_contemplation_stage=aguardando_docs', async () => {
    const { updateQuotaContemplationAction } = await import('@/lib/actions/consortium-quotas')
    const fd = validContemplationFormData({ contemplation_type: 'sorteio' })
    await updateQuotaContemplationAction('slug', GROUP_UUID, fd)
    expect(mockQuotaChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'contemplado',
        post_contemplation_stage: 'aguardando_docs',
      })
    )
  })
})

// ---------------------------------------------------------------------------
// updateQuotaStageAction — pipeline pós-contemplação
// ---------------------------------------------------------------------------
describe('updateQuotaStageAction — pipeline pós-contemplação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    const eqFn = vi.fn(() => Promise.resolve({ error: null }))
    mockQuotaChain.update.mockReturnValue({ eq: eqFn })
  })

  it('rejeita stage inválido (ex: assinado)', async () => {
    const { updateQuotaStageAction } = await import('@/lib/actions/consortium-quotas')
    const fd = makeFormData({ quota_id: QUOTA_UUID, stage: 'assinado' })
    const result = await updateQuotaStageAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
  })

  it('aceita transição aguardando_docs', async () => {
    const { updateQuotaStageAction } = await import('@/lib/actions/consortium-quotas')
    const fd = makeFormData({ quota_id: QUOTA_UUID, stage: 'aguardando_docs' })
    const result = await updateQuotaStageAction('slug', GROUP_UUID, fd)
    expect(result).toEqual({ success: true })
  })

  it('aceita transição em_analise', async () => {
    const { updateQuotaStageAction } = await import('@/lib/actions/consortium-quotas')
    const fd = makeFormData({ quota_id: QUOTA_UUID, stage: 'em_analise' })
    const result = await updateQuotaStageAction('slug', GROUP_UUID, fd)
    expect(result).toEqual({ success: true })
  })

  it('aceita transição credito_liberado', async () => {
    const { updateQuotaStageAction } = await import('@/lib/actions/consortium-quotas')
    const fd = makeFormData({ quota_id: QUOTA_UUID, stage: 'credito_liberado' })
    const result = await updateQuotaStageAction('slug', GROUP_UUID, fd)
    expect(result).toEqual({ success: true })
  })

  it('rejeita corretor atualizando cota de outro corretor', async () => {
    const { updateQuotaStageAction } = await import('@/lib/actions/consortium-quotas')
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    // Mock the select().eq().maybeSingle() chain for assigned_to ownership check
    const maybeSingleFn = vi.fn().mockResolvedValue({
      data: { assigned_to: ADMIN_UUID }, // different from CORRETOR_UUID
      error: null,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockQuotaSelectChain.eq.mockReturnValue({ maybeSingle: maybeSingleFn } as any)

    const fd = makeFormData({ quota_id: QUOTA_UUID, stage: 'em_analise' })
    const result = await updateQuotaStageAction('slug', GROUP_UUID, fd)
    expect(result).toHaveProperty('error')
  })
})

// ---------------------------------------------------------------------------
// assembleias — alertas in-app (stub mantido para Plan 03-04)
// ---------------------------------------------------------------------------
describe('assembleias — alertas in-app', () => {
  it.todo('assembly alert query filtra next_assembly_date IS NOT NULL + ≤ 3 dias')
})
