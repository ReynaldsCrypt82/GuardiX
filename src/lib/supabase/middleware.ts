import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database.types'

// Public routes — accessible without auth
const AUTH_ROUTES = [
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/redefinir-senha',
  '/convite',
]

// Trial-expired users can still reach these
const ALWAYS_ALLOWED_FOR_EXPIRED_TRIAL = [
  '/trial-expirado',
  '/login', // must be able to sign out + back in
]

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

function pathIsAllowedForExpiredTrial(pathname: string): boolean {
  return ALWAYS_ALLOWED_FOR_EXPIRED_TRIAL.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

type AppClaims = {
  sub: string
  app_metadata?: {
    tenant_id?: string
    role?: 'admin' | 'corretor' | 'financeiro' | 'visualizador' | 'portal_client'
    slug?: string
    portal_slug?: string
    trial_ends_at?: string
    plan?: string
  }
}

async function readClaims(
  supabase: ReturnType<typeof createServerClient<Database>>
): Promise<AppClaims | null> {
  // Prefer getClaims (local JWT validation, faster) — fall back to getUser if unavailable
  const anySupa = supabase.auth as unknown as {
    getClaims?: () => Promise<{ data: { claims: AppClaims | null } | null; error: unknown }>
  }
  if (typeof anySupa.getClaims === 'function') {
    const { data, error } = await anySupa.getClaims()
    if (error || !data?.claims) return null
    return data.claims
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return {
    sub: data.user.id,
    app_metadata: data.user.app_metadata as AppClaims['app_metadata'],
  }
}

function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value)
  })
  return redirectResponse
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const claims = await readClaims(supabase)
  const pathname = request.nextUrl.pathname

  // 1. Anonymous user hitting a protected route → /login?next=<path>
  if (!claims) {
    const isPortalAuthRoute = /^\/[^/]+\/portal\/(login|cadastro)(\/.*)?$/.test(pathname)
    if (isAuthRoute(pathname) || pathname === '/' || pathname === '/trial-expirado' || isPortalAuthRoute) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return redirectWithCookies(url, supabaseResponse)
  }

  // 2. Authenticated user but claims missing tenant_id (incomplete onboarding)
  const appMeta = claims.app_metadata ?? {}
  const userSlug = appMeta.slug
  const tenantId = appMeta.tenant_id
  const trialEndsAt = appMeta.trial_ends_at
  const plan = appMeta.plan ?? 'trial'

  // 2.5 Portal client branch — D-06, D-07, D-12
  // Portal clients have role='portal_client' + tenant_id + portal_slug in app_metadata,
  // but NO `slug` field. They must NOT fall into the incomplete-onboarding redirect below.
  const role = appMeta.role
  const isPortalClient = role === 'portal_client'

  if (isPortalClient) {
    const portalSlug = appMeta.portal_slug
    const isPortalRoute = /^\/[^/]+\/portal(\/.*)?$/.test(pathname)
    const isPortalAuthRoute = /^\/[^/]+\/portal\/(login|cadastro)(\/.*)?$/.test(pathname)

    if (isPortalAuthRoute) {
      // Already logged in — bounce to home
      const url = request.nextUrl.clone()
      url.pathname = portalSlug ? `/${portalSlug}/portal/home` : '/login'
      url.search = ''
      return redirectWithCookies(url, supabaseResponse)
    }

    if (!isPortalRoute) {
      // D-07: portal_client outside portal → /{portal_slug}/portal/home
      const url = request.nextUrl.clone()
      url.pathname = portalSlug ? `/${portalSlug}/portal/home` : '/login'
      url.search = ''
      return redirectWithCookies(url, supabaseResponse)
    }

    // Portal client on a portal route (non-auth) — let through; RLS does the rest
    return supabaseResponse
  }

  if (!tenantId || !userSlug) {
    // User exists but is not attached to a tenant — force re-onboarding
    if (pathname !== '/login' && pathname !== '/cadastro') {
      const url = request.nextUrl.clone()
      url.pathname = '/cadastro'
      return redirectWithCookies(url, supabaseResponse)
    }
    return supabaseResponse
  }

  // 3. Authenticated user on an auth route → /{slug}/dashboard
  if (isAuthRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${userSlug}/dashboard`
    url.search = ''
    return redirectWithCookies(url, supabaseResponse)
  }

  // 4. Trial expired — block everything except trial-expired page and /login
  if (plan === 'trial' && trialEndsAt) {
    const expired = new Date(trialEndsAt).getTime() < Date.now()
    if (expired && !pathIsAllowedForExpiredTrial(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/trial-expirado'
      url.search = ''
      return redirectWithCookies(url, supabaseResponse)
    }
  }

  // 4.5 D-08: Internal users blocked from /{slug}/portal/** routes
  const isPortalRoute = /^\/[^/]+\/portal(\/.*)?$/.test(pathname)
  if (isPortalRoute) {
    const url = request.nextUrl.clone()
    url.pathname = `/${userSlug}/dashboard`
    url.search = ''
    return redirectWithCookies(url, supabaseResponse)
  }

  // 5. Slug ownership — if URL has /{some-slug}/ prefix, it must match userSlug
  const slugMatch = pathname.match(/^\/([^/]+)(\/.*)?$/)
  if (slugMatch) {
    const urlSlug = slugMatch[1]
    const remainder = slugMatch[2] ?? ''
    // Exempt known non-slug prefixes
    const exempt = ['trial-expirado', 'login', 'cadastro', 'recuperar-senha', 'redefinir-senha', 'convite']
    if (!exempt.includes(urlSlug) && urlSlug !== userSlug) {
      const url = request.nextUrl.clone()
      url.pathname = `/${userSlug}${remainder}`
      return redirectWithCookies(url, supabaseResponse)
    }
  }

  return supabaseResponse
}
