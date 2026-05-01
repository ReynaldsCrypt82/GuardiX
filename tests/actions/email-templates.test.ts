import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock chain for email_templates table
// ---------------------------------------------------------------------------
const mockMaybeSingle = vi.fn()
const mockSelectIs = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelectEqEventType = vi.fn(() => ({ is: mockSelectIs }))
const mockSelectEqTenant = vi.fn(() => ({ eq: mockSelectEqEventType }))
const mockSelectChain = { eq: mockSelectEqTenant }

const mockUpdateIs = vi.fn()
const mockUpdateEq = vi.fn(() => ({ is: mockUpdateIs }))
const mockUpdateChain = { eq: mockUpdateEq }

const mockInsertResult = vi.fn()

const mockEmailTemplatesTable = {
  select: vi.fn(() => mockSelectChain),
  insert: vi.fn(() => Promise.resolve(mockInsertResult())),
  update: vi.fn(() => mockUpdateChain),
}

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => mockEmailTemplatesTable),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  upsertEmailTemplateAction,
  softDeleteEmailTemplateAction,
} from '@/lib/actions/email-templates'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TENANT = 'tenant-uuid-email-1'
const TEMPLATE_ID = 'tpl-uuid-0001-0001-0001-000000000001'

const ADMIN_USER = {
  id: 'admin-uuid-0001',
  app_metadata: { tenant_id: TENANT, role: 'admin', slug: 'acme' },
}
const CORRETOR_USER = {
  id: 'corretor-uuid-0002',
  app_metadata: { tenant_id: TENANT, role: 'corretor', slug: 'acme' },
}
const VISUALIZADOR_USER = {
  id: 'vis-uuid-0003',
  app_metadata: { tenant_id: TENANT, role: 'visualizador', slug: 'acme' },
}

function makeFormData(data: Record<string, string | boolean>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.append(k, String(v))
  return fd
}

// Helper: extracts _form from error union without TypeScript union complaints
function getFormError(result: unknown): string[] | undefined {
  if (
    result !== null &&
    typeof result === 'object' &&
    'error' in result &&
    result.error !== null &&
    typeof result.error === 'object' &&
    '_form' in result.error &&
    Array.isArray((result.error as Record<string, unknown>)._form)
  ) {
    return (result.error as Record<string, string[]>)._form
  }
  return undefined
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMaybeSingle.mockReset()
  mockInsertResult.mockReset()
  mockUpdateIs.mockReset()

  // Reset chain mocks to defaults
  mockSelectIs.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelectEqEventType.mockReturnValue({ is: mockSelectIs })
  mockSelectEqTenant.mockReturnValue({ eq: mockSelectEqEventType })
  mockSelectChain.eq = mockSelectEqTenant
  mockEmailTemplatesTable.select.mockReturnValue(mockSelectChain)
  mockUpdateEq.mockReturnValue({ is: mockUpdateIs })
  mockEmailTemplatesTable.update.mockReturnValue(mockUpdateChain)
  mockSupabase.from.mockReturnValue(mockEmailTemplatesTable)
})

// ---------------------------------------------------------------------------
// upsertEmailTemplateAction
// ---------------------------------------------------------------------------
describe('upsertEmailTemplateAction', () => {
  it('insere template quando nao existe (maybeSingle retorna null)', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockInsertResult.mockReturnValue({ error: null })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      subject: 'Sua apolice vence em {{vencimento}}',
      body_html: '<p>Ola {{nome_cliente}}, sua apolice vence em {{vencimento}}.</p>',
      active: 'true',
    })

    const result = await upsertEmailTemplateAction('acme', fd)

    expect('success' in result && result.success).toBe(true)
    expect(mockEmailTemplatesTable.insert).toHaveBeenCalledOnce()
    expect(mockEmailTemplatesTable.update).not.toHaveBeenCalled()
  })

  it('atualiza template quando ja existe (maybeSingle retorna linha existente)', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockMaybeSingle.mockResolvedValue({ data: { id: TEMPLATE_ID }, error: null })
    mockUpdateIs.mockResolvedValue({ error: null })

    const fd = makeFormData({
      event_type: 'financial_overdue',
      subject: 'Lancamento vencido — {{nome_cliente}}',
      body_html: '<p>Ola {{nome_cliente}}, ha um lancamento vencido em {{vencimento}}.</p>',
      active: 'true',
    })

    const result = await upsertEmailTemplateAction('acme', fd)

    expect('success' in result && result.success).toBe(true)
    expect(mockEmailTemplatesTable.update).toHaveBeenCalledOnce()
    expect(mockEmailTemplatesTable.insert).not.toHaveBeenCalled()
  })

  it('rejeita role corretor com erro Apenas admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: CORRETOR_USER } })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      subject: 'Assunto valido aqui',
      body_html: '<p>Corpo valido com mais de dez caracteres.</p>',
      active: 'true',
    })

    const result = await upsertEmailTemplateAction('acme', fd)

    expect('error' in result).toBe(true)
    const formErr = getFormError(result)
    expect(formErr?.[0]).toContain('admin')
    expect(mockEmailTemplatesTable.insert).not.toHaveBeenCalled()
    expect(mockEmailTemplatesTable.update).not.toHaveBeenCalled()
  })

  it('rejeita subject com menos de 3 caracteres via Zod', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      subject: 'AB', // apenas 2 chars — minimo e 3
      body_html: '<p>Corpo com conteudo suficiente para passar no Zod.</p>',
      active: 'true',
    })

    const result = await upsertEmailTemplateAction('acme', fd)

    expect('error' in result).toBe(true)
    // Zod deve retornar erro de campo para subject
    expect(mockEmailTemplatesTable.insert).not.toHaveBeenCalled()
    expect(mockEmailTemplatesTable.update).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// softDeleteEmailTemplateAction
// ---------------------------------------------------------------------------
describe('softDeleteEmailTemplateAction', () => {
  it('rejeita role visualizador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: VISUALIZADOR_USER } })

    const result = await softDeleteEmailTemplateAction('acme', TEMPLATE_ID)

    expect('error' in result).toBe(true)
    const formErr = getFormError(result)
    expect(formErr?.[0]).toContain('admin')
    expect(mockEmailTemplatesTable.update).not.toHaveBeenCalled()
  })

  it('soft-deleta template com role admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockUpdateIs.mockResolvedValue({ error: null })

    const result = await softDeleteEmailTemplateAction('acme', TEMPLATE_ID)

    expect('success' in result && result.success).toBe(true)
    expect(mockEmailTemplatesTable.update).toHaveBeenCalledOnce()
  })
})
