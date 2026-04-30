import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEntrySingle = vi.fn()
const mockEntrySelectChain = {
  eq: vi.fn(() => ({ is: vi.fn(() => ({ single: mockEntrySingle })) })),
}
const mockEntryUpdateResult = vi.fn()
const mockEntryUpdateChain = {
  eq: vi.fn(() => ({ is: vi.fn(() => Promise.resolve(mockEntryUpdateResult())) })),
}
const mockEntryInsertResult = vi.fn()
const mockFinancialEntriesChain = {
  insert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve(mockEntryInsertResult())),
    })),
  })),
  select: vi.fn(() => mockEntrySelectChain),
  update: vi.fn(() => mockEntryUpdateChain),
}

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => mockFinancialEntriesChain),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createFinancialEntryAction,
  markFinancialEntryPaidAction,
  softDeleteFinancialEntryAction,
} from '@/lib/actions/financial-entries'

const TENANT = 'tenant-uuid-1'
const ADMIN = { id: 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', app_metadata: { tenant_id: TENANT, role: 'admin' } }
const FIN = { id: 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', app_metadata: { tenant_id: TENANT, role: 'financeiro' } }
const VIS = { id: 'cccc3333-cccc-cccc-cccc-cccccccccccc', app_metadata: { tenant_id: TENANT, role: 'visualizador' } }
const ENTRY_ID = '11111111-1111-1111-1111-111111111111'

function makeFormData(data: Record<string, string | number>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.append(k, String(v))
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEntryInsertResult.mockReset()
  mockEntryUpdateResult.mockReset()
  mockEntrySingle.mockReset()
})

describe('createFinancialEntryAction', () => {
  it('rejeita amount = 0 via Zod', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN } })
    const fd = makeFormData({
      entry_type: 'receivable',
      description: 'Premio',
      amount: 0,
      due_date: '2026-05-15',
    })
    const r = await createFinancialEntryAction('acme', fd)
    expect('error' in r).toBe(true)
  })

  it('rejeita role visualizador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: VIS } })
    const fd = makeFormData({
      entry_type: 'receivable',
      description: 'Premio Auto',
      amount: 100,
      due_date: '2026-05-15',
    })
    const r = await createFinancialEntryAction('acme', fd)
    expect('error' in r).toBe(true)
    if ('error' in r) {
      expect(r.error._form?.[0]).toContain('Sem permissao')
    }
  })

  it.todo('insere lançamento com role admin e retorna entry_id')
  it.todo('insere lançamento com role financeiro')
  it.todo('rejeita description vazia')
  it.todo('rejeita due_date em formato dd/mm/yyyy')
  it.todo('aceita policy_id null e client_id null (lancamento avulso)')
})

describe('markFinancialEntryPaidAction', () => {
  it('é idempotente — rejeita se status já paid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN } })
    mockEntrySingle.mockResolvedValue({ data: { id: ENTRY_ID, status: 'paid' }, error: null })
    const r = await markFinancialEntryPaidAction('acme', ENTRY_ID)
    expect('error' in r).toBe(true)
    if ('error' in r) {
      expect(r.error._form?.[0]).toContain('ja marcado')
    }
  })

  it('rejeita entry inexistente (single retorna null)', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN } })
    mockEntrySingle.mockResolvedValue({ data: null, error: null })
    const r = await markFinancialEntryPaidAction('acme', ENTRY_ID)
    expect('error' in r).toBe(true)
  })

  it('rejeita role visualizador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: VIS } })
    const r = await markFinancialEntryPaidAction('acme', ENTRY_ID)
    expect('error' in r).toBe(true)
  })

  it.todo('atualiza status=paid e paid_at default = agora se nao fornecido')
  it.todo('aceita paid_at custom (ISO datetime)')
  it.todo('rejeita entry_id nao-UUID')
  it.todo('rejeita paid_at em formato YYYY-MM-DD (Zod requer ISO datetime)')
})

describe('softDeleteFinancialEntryAction', () => {
  it('rejeita role visualizador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: VIS } })
    const r = await softDeleteFinancialEntryAction('acme', ENTRY_ID)
    expect('error' in r).toBe(true)
  })

  it.todo('marca deleted_at em entry pending')
  it.todo('e idempotente — segunda chamada nao falha mas apenas atualiza WHERE deleted_at IS NULL')
  it.todo('rejeita entry_id nao-UUID')
})
