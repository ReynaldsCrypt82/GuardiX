import { describe, it } from 'vitest'

describe('policies RLS — tenant isolation', () => {
  it.todo('tenant A nunca vê apólices do Tenant B (SELECT)')
  it.todo('INSERT de apólice com tenant_id mismatch é bloqueado')
})

describe('policies RLS — RBAC corretor', () => {
  it.todo('corretor vê apenas apólices com assigned_to = auth.uid()')
})

describe('claims RLS — cross-tenant prevention (Pitfall 4)', () => {
  it.todo('claims INSERT sem tenant_id do JWT é bloqueado (Pitfall 4)')
})

describe('consortium_quotas RLS — RBAC corretor', () => {
  it.todo('consortium_quotas: corretor só vê as próprias (assigned_to = auth.uid())')
})
