import { describe, it, expect } from 'vitest'
import { portalCadastroSchema, portalLoginSchema } from '@/lib/validations/portal-auth-schemas'

/**
 * Phase 01 Plan 02 — Portal auth schema tests.
 *
 * Threats covered:
 *   T-1-01 — CPF enumeration (input validation rejects invalid CPF before any DB query)
 *   T-1-04 — Mass account creation via brute-force (input shape strict)
 *   T-1-07 — Manipulated FormData bypassing client validation (server re-validates with Zod)
 *
 * These are pure unit tests — no Supabase connection required.
 * Valid test CPF: 529.982.247-25 (passes módulo-11)
 * Invalid test CPF: 12345678900 (fails módulo-11)
 */

describe('portalCadastroSchema', () => {
  it('rejects invalid CPF (módulo-11 verifier)', () => {
    const result = portalCadastroSchema.safeParse({
      cpf: '12345678900',
      email: 'a@b.com',
      password: 'password123',
      slug: 'acme',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid CPF and strips formatting', () => {
    const result = portalCadastroSchema.safeParse({
      cpf: '529.982.247-25',
      email: 'a@b.com',
      password: 'password123',
      slug: 'acme',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cpf).toBe('52998224725')
    }
  })

  it('rejects password shorter than 8 chars', () => {
    const result = portalCadastroSchema.safeParse({
      cpf: '52998224725',
      email: 'a@b.com',
      password: 'short',
      slug: 'acme',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = portalCadastroSchema.safeParse({
      cpf: '52998224725',
      email: 'not-an-email',
      password: 'password123',
      slug: 'acme',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty slug', () => {
    const result = portalCadastroSchema.safeParse({
      cpf: '52998224725',
      email: 'a@b.com',
      password: 'password123',
      slug: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects all-same-digit CPF (e.g. 111.111.111-11)', () => {
    const result = portalCadastroSchema.safeParse({
      cpf: '11111111111',
      email: 'a@b.com',
      password: 'password123',
      slug: 'acme',
    })
    expect(result.success).toBe(false)
  })
})

describe('portalLoginSchema', () => {
  it('rejects invalid email', () => {
    const result = portalLoginSchema.safeParse({ email: 'foo', password: 'x', slug: 'acme' })
    expect(result.success).toBe(false)
  })

  it('accepts valid login payload', () => {
    const result = portalLoginSchema.safeParse({
      email: 'a@b.com',
      password: 'anything',
      slug: 'acme',
    })
    expect(result.success).toBe(true)
  })
})
