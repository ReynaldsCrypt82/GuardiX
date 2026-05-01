// tests/actions/chat-isolation.test.ts
// Phase 07 Plan 04 — Testa logica de isolamento cross-tenant do chat interno (AUTO-06)
// Extrai a guard function como logica pura para testar sem Route Handler completo.

import { describe, it, expect } from 'vitest'

// Guard puro extraido da logica do Route Handler /api/[slug]/ai/chat
// meta.slug vem de user.app_metadata.slug (JWT claim do Supabase)
function isCrossTenantViolation(meta: { slug?: string }, routeSlug: string): boolean {
  return !meta.slug || meta.slug !== routeSlug
}

// Role guard: visualizador nao pode usar chat interno
const ALLOWED_CHAT_ROLES = ['admin', 'corretor', 'financeiro']
function isChatAllowed(role?: string): boolean {
  return ALLOWED_CHAT_ROLES.includes(role ?? '')
}

describe('Chat interno — isolamento cross-tenant (AUTO-06)', () => {
  it('bloqueia quando meta.slug esta ausente', () => {
    expect(isCrossTenantViolation({}, 'minha-corretora')).toBe(true)
  })

  it('bloqueia quando meta.slug e de outro tenant', () => {
    expect(isCrossTenantViolation({ slug: 'outra-corretora' }, 'minha-corretora')).toBe(true)
  })

  it('permite quando meta.slug corresponde ao slug da rota', () => {
    expect(isCrossTenantViolation({ slug: 'minha-corretora' }, 'minha-corretora')).toBe(false)
  })
})

describe('Chat interno — RBAC por role (AUTO-06)', () => {
  it('permite admin', () => { expect(isChatAllowed('admin')).toBe(true) })
  it('permite corretor', () => { expect(isChatAllowed('corretor')).toBe(true) })
  it('permite financeiro', () => { expect(isChatAllowed('financeiro')).toBe(true) })
  it('bloqueia visualizador', () => { expect(isChatAllowed('visualizador')).toBe(false) })
  it('bloqueia role undefined', () => { expect(isChatAllowed(undefined)).toBe(false) })
})
