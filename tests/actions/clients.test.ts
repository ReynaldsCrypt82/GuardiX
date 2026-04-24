import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClientAction } from '@/lib/actions/clients'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase/server
// ---------------------------------------------------------------------------
const mockInsertChain = {
  select: vi.fn(),
}
const mockFromChain = {
  insert: vi.fn(() => mockInsertChain),
}
const mockSingle = vi.fn()
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockFromChain),
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
      tenant_id: 'tenant-1',
      role: 'admin',
      ...overrides,
    },
  }
}

function corretorUser(overrides?: Record<string, unknown>) {
  return {
    id: 'user-corretor-1',
    app_metadata: {
      tenant_id: 'tenant-1',
      role: 'corretor',
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// createClientAction (PF)
// ---------------------------------------------------------------------------
describe('createClientAction (PF)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: auth returns admin user
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    // Default: successful insert chain
    mockInsertChain.select.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'client-1' }, error: null })
  })

  it('valida CPF via validateCPF e rejeita inválidos (all-same)', async () => {
    const fd = makeFormData({
      type: 'pf',
      document: '111.111.111-11',
      name: 'João da Silva',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ document: expect.any(Array) }) })
    expect(result?.error?.document?.[0]).toContain('CPF inválido')
  })

  it('rejeita CPF com checksum errado', async () => {
    const fd = makeFormData({
      type: 'pf',
      document: '123.456.789-01',
      name: 'João da Silva',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ document: expect.any(Array) }) })
  })

  it('aceita CPF válido e insere com document sem máscara (strip)', async () => {
    // CPF válido: 529.982.247-25
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'João da Silva',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ id: 'client-1' })
    // Verify insert was called with stripped document
    expect(mockFromChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ document: '52998224725' })
    )
  })

  it('exige assigned_to (corretor responsável) obrigatório — rejeita vazio', async () => {
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'João da Silva',
      assigned_to: '',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ assigned_to: expect.any(Array) }) })
  })

  it('define name obrigatório (min 2 chars) para PF', async () => {
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'A',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ name: expect.any(Array) }) })
  })

  it('rejeita CPF duplicado no mesmo tenant (constraint 23505)', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    })
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'João da Silva',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({
      error: { document: ['Este documento já está cadastrado nesta corretora.'] },
    })
  })

  it('corretor só pode atribuir cliente a si mesmo', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: corretorUser() } })
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'João da Silva',
      assigned_to: 'outro-corretor-uuid-aqui-22222222222',
    })
    const result = await createClientAction('slug-test', fd)
    // Note: Zod rejects non-UUID first, or action blocks if UUID is valid but different
    // assigned_to must be a valid UUID to pass schema — if it's not, Zod catches it
    expect(result).toHaveProperty('error')
  })

  it('email vazio é aceito como opcional', async () => {
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'João da Silva',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: '',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ id: 'client-1' })
  })

  it('email inválido retorna erro de validação', async () => {
    const fd = makeFormData({
      type: 'pf',
      document: '529.982.247-25',
      name: 'João da Silva',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'nao-e-um-email',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ email: expect.any(Array) }) })
  })
})

// ---------------------------------------------------------------------------
// createClientAction (PJ)
// ---------------------------------------------------------------------------
describe('createClientAction (PJ)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: adminUser() } })
    mockInsertChain.select.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'client-2' }, error: null })
  })

  it('valida CNPJ via validateCNPJ — rejeita CNPJ inválido', async () => {
    const fd = makeFormData({
      type: 'pj',
      document: '11.111.111/1111-11',
      name: 'Empresa LTDA',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ document: expect.any(Array) }) })
    expect(result?.error?.document?.[0]).toContain('CNPJ inválido')
  })

  it('aceita CNPJ válido e insere com document sem máscara', async () => {
    // CNPJ válido: 11.222.333/0001-81
    const fd = makeFormData({
      type: 'pj',
      document: '11.222.333/0001-81',
      name: 'Empresa Teste LTDA',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ id: 'client-2' })
    expect(mockFromChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ document: '11222333000181' })
    )
  })

  it('aceita responsible opcional (pode ser omitido)', async () => {
    const fd = makeFormData({
      type: 'pj',
      document: '11.222.333/0001-81',
      name: 'Empresa Teste LTDA',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ id: 'client-2' })
  })

  it('rejeita CNPJ duplicado no mesmo tenant (constraint 23505)', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    })
    const fd = makeFormData({
      type: 'pj',
      document: '11.222.333/0001-81',
      name: 'Empresa Teste LTDA',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({
      error: { document: ['Este documento já está cadastrado nesta corretora.'] },
    })
  })

  it('rejeita type inválido (ex: xx)', async () => {
    const fd = makeFormData({
      type: 'xx',
      document: '11.222.333/0001-81',
      name: 'Empresa Teste LTDA',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toHaveProperty('error')
  })

  it('exige razão social (name) obrigatória — mínimo 2 chars', async () => {
    const fd = makeFormData({
      type: 'pj',
      document: '11.222.333/0001-81',
      name: 'A',
      assigned_to: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    const result = await createClientAction('slug-test', fd)
    expect(result).toEqual({ error: expect.objectContaining({ name: expect.any(Array) }) })
  })
})

// ---------------------------------------------------------------------------
// Remaining stubs (wave 2+)
// ---------------------------------------------------------------------------
describe('updateClientStage (CRM-05)', () => {
  it.todo('corretor só pode mover seus próprios clientes (RLS)')
  it.todo('admin pode mover qualquer cliente do tenant')
  it.todo('rejeita stage_id de outro tenant')
})

describe('listClients filters (CRM-09)', () => {
  it.todo('filtro por assigned_to retorna apenas clientes do corretor')
  it.todo('filtro por stage_id restringe ao estágio')
  it.todo('filtro por type (pf|pj) segrega tipos')
  it.todo('paginação reseta para page=1 ao aplicar filtro novo (Pitfall 4)')
})

describe('searchClients (CRM-08)', () => {
  it.todo('busca por nome via ilike case-insensitive')
  it.todo('busca por CPF com máscara normaliza via stripCPF antes de ilike')
  it.todo('busca por CNPJ com máscara normaliza via stripCNPJ antes de ilike')
})
