import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock chain for webhook_configs table
// ---------------------------------------------------------------------------
const mockInsertSingle = vi.fn()
const mockInsertChain = {
  select: vi.fn(() => ({ single: mockInsertSingle })),
}
const mockUpdateIs = vi.fn()
const mockUpdateChain = {
  eq: vi.fn(() => ({ is: mockUpdateIs })),
}

const mockWebhookConfigsTable = {
  insert: vi.fn(() => mockInsertChain),
  update: vi.fn(() => mockUpdateChain),
}

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => mockWebhookConfigsTable),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createWebhookConfigAction,
  updateWebhookConfigAction,
  softDeleteWebhookConfigAction,
} from '@/lib/actions/webhook-configs'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TENANT = 'tenant-uuid-webhook-1'
const CONFIG_ID = 'cfg-uuid-0001-0001-0001-000000000001'

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

function makeFormData(data: Record<string, string | number | boolean>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.append(k, String(v))
  return fd
}

// Helper: extracts _form from error union without TypeScript complaints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  mockInsertSingle.mockReset()
  mockUpdateIs.mockReset()
  // Reset chain mocks
  mockInsertChain.select.mockReturnValue({ single: mockInsertSingle })
  mockUpdateChain.eq.mockReturnValue({ is: mockUpdateIs })
  mockWebhookConfigsTable.insert.mockReturnValue(mockInsertChain)
  mockWebhookConfigsTable.update.mockReturnValue(mockUpdateChain)
  mockSupabase.from.mockReturnValue(mockWebhookConfigsTable)
})

// ---------------------------------------------------------------------------
// createWebhookConfigAction
// ---------------------------------------------------------------------------
describe('createWebhookConfigAction', () => {
  it('cria webhook com role admin + URL publica valida + policy_expiring', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockInsertSingle.mockResolvedValue({ data: { id: CONFIG_ID }, error: null })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      url: 'https://webhook.site/test-hook-123',
      days_before: '30',
      active: 'true',
    })

    const result = await createWebhookConfigAction('acme', fd)

    expect('success' in result && result.success).toBe(true)
    expect('config_id' in result && result.config_id).toBe(CONFIG_ID)
    expect(mockWebhookConfigsTable.insert).toHaveBeenCalledOnce()
  })

  it('rejeita role corretor com erro Apenas admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: CORRETOR_USER } })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      url: 'https://webhook.site/test',
      active: 'true',
    })

    const result = await createWebhookConfigAction('acme', fd)

    expect('error' in result).toBe(true)
    const formErr = getFormError(result)
    expect(formErr?.[0]).toContain('admin')
    expect(mockWebhookConfigsTable.insert).not.toHaveBeenCalled()
  })

  it('rejeita URL localhost (IP privado) via Zod webhookConfigSchema.refine', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      url: 'http://localhost/internal',
      active: 'true',
    })

    const result = await createWebhookConfigAction('acme', fd)

    expect('error' in result).toBe(true)
    // Zod deve falhar antes de chamar o banco
    expect(mockWebhookConfigsTable.insert).not.toHaveBeenCalled()
  })

  it('rejeita event_type invalido foo via Zod', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })

    const fd = makeFormData({
      event_type: 'foo',
      url: 'https://webhook.site/test',
      active: 'true',
    })

    const result = await createWebhookConfigAction('acme', fd)

    expect('error' in result).toBe(true)
    expect(mockWebhookConfigsTable.insert).not.toHaveBeenCalled()
  })

  it('retorna erro 23505 como mensagem amigavel quando evento ja existe', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockInsertSingle.mockResolvedValue({ data: null, error: { code: '23505', message: 'unique' } })

    const fd = makeFormData({
      event_type: 'financial_overdue',
      url: 'https://n8n.example.com/webhook/fin',
      active: 'true',
    })

    const result = await createWebhookConfigAction('acme', fd)

    expect('error' in result).toBe(true)
    const formErr = getFormError(result)
    expect(formErr?.[0]).toContain('Ja existe')
  })
})

// ---------------------------------------------------------------------------
// softDeleteWebhookConfigAction
// ---------------------------------------------------------------------------
describe('softDeleteWebhookConfigAction', () => {
  it('rejeita role visualizador', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: VISUALIZADOR_USER } })

    const result = await softDeleteWebhookConfigAction('acme', CONFIG_ID)

    expect('error' in result).toBe(true)
    const formErr = getFormError(result)
    expect(formErr?.[0]).toContain('admin')
    expect(mockWebhookConfigsTable.update).not.toHaveBeenCalled()
  })

  it('soft-deleta com role admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockUpdateIs.mockResolvedValue({ error: null })

    const result = await softDeleteWebhookConfigAction('acme', CONFIG_ID)

    expect('success' in result && result.success).toBe(true)
    expect(mockWebhookConfigsTable.update).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// updateWebhookConfigAction
// ---------------------------------------------------------------------------
describe('updateWebhookConfigAction', () => {
  it('atualiza webhook com role admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: ADMIN_USER } })
    mockUpdateIs.mockResolvedValue({ error: null })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      url: 'https://webhook.site/updated',
      days_before: '15',
      active: 'true',
    })

    const result = await updateWebhookConfigAction('acme', CONFIG_ID, fd)

    expect('success' in result && result.success).toBe(true)
  })

  it('rejeita role corretor na atualizacao', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: CORRETOR_USER } })

    const fd = makeFormData({
      event_type: 'policy_expiring',
      url: 'https://webhook.site/updated',
      active: 'true',
    })

    const result = await updateWebhookConfigAction('acme', CONFIG_ID, fd)

    expect('error' in result).toBe(true)
    const formErr = getFormError(result)
    expect(formErr?.[0]).toContain('admin')
  })
})
