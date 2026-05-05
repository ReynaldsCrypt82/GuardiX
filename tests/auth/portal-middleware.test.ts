import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 01 Plan 02 — Middleware extension for portal_client routing.
 *
 * Threats covered:
 *   T-1-02 — portal_client accessing internal routes (D-07)
 *   T-1-03 — internal user accessing portal routes (D-08)
 *
 * Mock strategy:
 *   readClaims() in middleware.ts calls auth.getClaims() when available.
 *   We mock @supabase/ssr so createServerClient returns an auth stub.
 *   We mock next/server's NextResponse to avoid the jsdom vs native-Headers
 *   instanceof mismatch that NextResponse.next({ request }) enforces.
 *   Both mocks use vi.hoisted() so the values are available when vi.mock
 *   factories are hoisted to the top of the compiled module.
 */

// ─── Hoisted values (available when vi.mock factories run) ───────────────────
const { mockGetClaims, mockGetUser, MockNextResponse } = vi.hoisted(() => {
  const mockGetClaims = vi.fn()
  const mockGetUser = vi.fn()

  // Thin NextResponse shim: tracks status + headers without the
  // "request.headers instanceof Headers" check from the real NextResponse.next.
  class MockNextResponse {
    status: number
    headers: { get: (k: string) => string | null; set: (k: string, v: string) => void }
    cookies: { getAll: () => { name: string; value: string }[]; set: (k: string, v: string) => void }

    constructor(status: number, location?: string) {
      this.status = status
      const store: Record<string, string> = {}
      if (location) store['location'] = location
      this.headers = {
        get: (k: string) => store[k.toLowerCase()] ?? null,
        set: (k: string, v: string) => { store[k.toLowerCase()] = v },
      }
      this.cookies = {
        getAll: () => [],
        set: vi.fn(),
      }
    }

    static next(_init?: unknown) {
      return new MockNextResponse(200)
    }

    static redirect(url: URL | string) {
      const location = url instanceof URL ? url.toString() : String(url)
      return new MockNextResponse(307, location)
    }
  }

  return { mockGetClaims, mockGetUser, MockNextResponse }
})

// ─── Module mocks (hoisted automatically by Vitest) ─────────────────────────
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getClaims: mockGetClaims,
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return {
    ...actual,
    NextResponse: MockNextResponse,
  }
})

// ─── Imports after mocks ─────────────────────────────────────────────────────
import { updateSession } from '@/lib/supabase/middleware'
import { NextRequest } from 'next/server'

function makeRequest(pathname: string): NextRequest {
  // Use a native Request so NextRequest receives a proper Headers instance
  const req = new Request(`http://localhost:3000${pathname}`, {
    headers: { host: 'localhost:3000' },
  })
  return new NextRequest(req)
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('updateSession portal_client routing', () => {
  beforeEach(() => {
    mockGetClaims.mockReset()
    mockGetUser.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('redirects portal_client outside /portal/** to /{portal_slug}/portal/home', async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'u1',
          app_metadata: { role: 'portal_client', tenant_id: 't1', portal_slug: 'acme' },
        },
      },
      error: null,
    })
    const res = await updateSession(makeRequest('/acme/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/acme/portal/home')
  })

  it('redirects internal user from /{slug}/portal/** to /{slug}/dashboard', async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'u2',
          app_metadata: { role: 'admin', tenant_id: 't1', slug: 'acme', plan: 'paid' },
        },
      },
      error: null,
    })
    const res = await updateSession(makeRequest('/acme/portal/home'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/acme/dashboard')
  })

  it('allows anon on /{slug}/portal/login (no redirect)', async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: null }, error: null })
    const res = await updateSession(makeRequest('/acme/portal/login'))
    expect(res.status).toBe(200)
  })

  it('allows anon on /{slug}/portal/cadastro (no redirect)', async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: null }, error: null })
    const res = await updateSession(makeRequest('/acme/portal/cadastro'))
    expect(res.status).toBe(200)
  })

  it('redirects portal_client from /portal/login to /portal/home (already logged in)', async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'u1',
          app_metadata: { role: 'portal_client', tenant_id: 't1', portal_slug: 'acme' },
        },
      },
      error: null,
    })
    const res = await updateSession(makeRequest('/acme/portal/login'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/acme/portal/home')
  })

  it('does NOT redirect portal_client to /cadastro (incomplete-onboarding bypass)', async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'u1',
          app_metadata: { role: 'portal_client', tenant_id: 't1', portal_slug: 'acme' },
        },
      },
      error: null,
    })
    const res = await updateSession(makeRequest('/acme/portal/home'))
    // Must NOT redirect to /cadastro — portal_client exits early in branch 2.5
    if (res.status === 307) {
      expect(res.headers.get('location') ?? '').not.toContain('/cadastro')
    } else {
      expect(res.status).toBe(200)
    }
  })

  it('falls back to /login when portal_client has no portal_slug in JWT', async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: 'u1',
          app_metadata: { role: 'portal_client', tenant_id: 't1' },
        },
      },
      error: null,
    })
    const res = await updateSession(makeRequest('/acme/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
