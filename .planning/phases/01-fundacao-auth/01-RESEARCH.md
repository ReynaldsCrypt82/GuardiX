# Phase 1: Fundacao & Auth — Research

**Researched:** 2026-04-20
**Domain:** Multi-tenant SaaS auth, Supabase RLS, Next.js App Router, CNPJ onboarding
**Confidence:** HIGH (core stack), MEDIUM (CNPJ API production reliability), HIGH (security patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**URL & Tenant Routing**
- D-01: Dominio unico `app.nexusagent.com.br`. Sem subdominio por tenant.
- D-02: Tenant identificado por slug na URL: `app.nexusagent.com.br/[slug]/dashboard`
- D-03: Middleware Next.js detecta o slug da URL e injeta o tenant_id na sessao

**Onboarding da Corretora**
- D-04: Registro em wizard de 3 steps (empresa, admin user, plano/trial)
- D-05: CNPJ validado por digito verificador + enriquecido via API publica (ReceitaWS ou similar)
- D-06: Trial de 14 dias com acesso completo, sem cartao de credito
- D-07: Apos trial expirar: bloqueio com tela de upgrade (sem deletar dados)

**Convite de Usuarios**
- D-08: Admin convida por email com magic link
- D-09: Convite com validade de 72 horas, link de uso unico
- D-10: Admin pode reenviar convite expirado ou cancelar convite pendente

**Papeis e Permissoes (RBAC)**
- D-11: Quatro papeis: `admin`, `corretor`, `financeiro`, `visualizador`
- D-12: Soft delete com campo `deleted_at TIMESTAMPTZ` — nunca exclusao fisica

**Visual das Telas de Auth**
- D-13: Layout split-screen (esquerda: visual/gradiente de marca, direita: formulario)
- D-14: Tema base: shadcn/ui padrao. Personalizacao visual adiada.
- D-15: Telas: Login, Registro (wizard 3 steps), Recuperacao de senha, Aceitar convite

**Supabase Auth & RLS**
- D-16: `@supabase/ssr` (nao `@supabase/auth-helpers` — deprecado). `createServerClient` no middleware.ts
- D-17: `tenant_id` em `app_metadata` (nao `user_metadata`). Injetado no JWT via Custom Access Token Hook
- D-18: Helper PostgreSQL `auth.tenant_id()` extrai tenant_id do JWT
- D-19: Toda tabela de dados recebe `tenant_id UUID NOT NULL` + indice + RLS habilitado. CI check obrigatorio.
- D-20: `SUPABASE_SERVICE_ROLE_KEY` NUNCA em variavel `NEXT_PUBLIC_*`

### Claude's Discretion

- Estrutura de pastas do projeto Next.js (App Router) — Claude decide seguindo convencoes da comunidade
- Validacao de formularios client-side — React Hook Form + Zod ou similar
- Animacoes/transicoes entre steps do wizard — Claude decide o que for mais suave

### Deferred Ideas (OUT OF SCOPE)

- White-label / dominio proprio por corretora
- Customizacao de paleta de cores por corretora
- 2FA / autenticacao com Google OAuth
- Subdominio por tenant
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Corretora pode se registrar com nome, CNPJ e email — criando um tenant isolado | Wizard 3-step + Server Action cria `tenants` record + Supabase Auth user + sets `app_metadata.tenant_id` via service_role |
| AUTH-02 | Usuario pode fazer login com email e senha com sessao persistente entre refreshes | Supabase Auth email/password + `@supabase/ssr` cookie-based session + middleware token refresh |
| AUTH-03 | Admin pode convidar corretores por email com link de acesso | Supabase `admin.inviteUserByEmail()` via service_role + `user_invitations` table para tracking 72h / single-use |
| AUTH-04 | Sistema suporta papeis: Admin, Corretor, Financeiro, Visualizador com permissoes distintas | `role` em `app_metadata` + `profiles` table + RLS policies com `auth.tenant_role()` helper |
| AUTH-05 | Dados de cada corretora sao isolados por RLS — nenhum tenant acessa dados de outro | `auth.tenant_id()` helper + RLS policies em todas as tabelas + CI check obrigatorio + integration test |
</phase_requirements>

---

## Summary

Phase 1 establece a fundacao multi-tenant que todas as outras fases dependem. O trabalho central e criar o schema PostgreSQL (tabelas `tenants`, `profiles`, `user_invitations`), configurar o Custom Access Token Hook do Supabase para injetar `tenant_id` e `role` no JWT, implementar os tres clientes Supabase (`server`, `browser`, `middleware`), e construir as telas de auth (login, wizard de registro 3-step, recuperacao de senha, aceitar convite) conforme especificado na UI-SPEC.

A arquitetura de seguranca e o elemento mais critico desta fase. RLS sem os indices corretos degrada performance. `user_metadata` no lugar de `app_metadata` cria uma vulnerabilidade de impersonificacao de tenant. O `SUPABASE_SERVICE_ROLE_KEY` exposto no bundle cliente compromete todo o sistema. Estes tres erros sao irreversiveis sem reescrita total — devem ser bloqueados por convencao de codigo e CI desde o primeiro commit.

O wizard de registro tem uma complexidade tecnica especifica: CNPJ lookup via API publica (BrasilAPI recomendado sobre ReceitaWS pelo limit de 3 req/min), validacao de digito verificador client-side antes do lookup, e o onboarding do tenant deve rodar em uma transacao atomica (criar tenant + criar usuario auth + setar app_metadata) para evitar estados parciais.

**Primary recommendation:** Implementar na ordem: schema SQL + RLS policies + CI check RLS coverage → clientes Supabase + middleware → Custom Access Token Hook → Server Actions de onboarding → telas de auth (do mais simples ao mais complexo: login primeiro, wizard por ultimo).

---

## Standard Stack

### Core (Phase 1 subset)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.15 | App Router + Server Actions + middleware | Decisao travada CLAUDE.md. Latest stable 15.x em 2026-04-20. |
| TypeScript | 5.x | Type safety | Decisao travada CLAUDE.md. |
| React | 19.x | UI runtime (via Next.js 15) | Incluido com Next.js 15. |
| @supabase/supabase-js | 2.104.0 | Supabase JS client | SDK principal. [VERIFIED: npm registry] |
| @supabase/ssr | 0.10.2 | SSR client para Next.js App Router | Substituto oficial de auth-helpers (deprecado). [VERIFIED: npm registry] |
| Tailwind CSS | 4.2.2 | Utility-first CSS | Decisao travada CLAUDE.md. v4 com CSS-based config. [VERIFIED: npm registry] |
| shadcn/ui | latest CLI | Component library (copiado no repo) | Nao e dependencia npm. Inicializado com `npx shadcn@latest init`. [VERIFIED: ui.shadcn.com] |
| Lucide React | 1.8.0 | Icones | Padrao shadcn/ui. [VERIFIED: npm registry] |
| React Hook Form | 7.72.1 | Form state management | Decisao CLAUDE.md. Performance, integracao Zod. [VERIFIED: npm registry] |
| Zod | 3.25.32 (tag: 4.3.6) | Schema validation | Compartilhado client/server. [VERIFIED: npm registry] |
| @hookform/resolvers | 5.2.2 | Conecta React Hook Form + Zod | Bridge oficial. [VERIFIED: npm registry] |
| sonner | 2.0.7 | Toast notifications | Padrao shadcn/ui. [VERIFIED: npm registry] |

**Nota sobre Zod version:** `npm view zod version` retornou `4.3.6` em 2026-04-20. CLAUDE.md documenta Zod 3.x. Verificar compatibilidade com `@hookform/resolvers` antes de instalar — resolver suporta Zod 3 e 4. [ASSUMED: compatibilidade total entre Zod 4 e hookform/resolvers 5.x — verificar changelog de @hookform/resolvers antes da instalacao]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Manipulacao de datas pt-BR | Trial expiry calculations, display de datas em pt-BR |
| Zustand | 5.0.12 | Client UI state | Wizard step state, form navigation state |
| TanStack Query | 5.99.2 | Server state em Client Components | User management list (polling para convites pendentes) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BrasilAPI CNPJ | ReceitaWS | ReceitaWS: 3 req/min limit em producao. BrasilAPI: sem auth, open-source, melhor para producao. Fallback manual se ambas falharem. |
| BrasilAPI CNPJ | OpenCNPJ | OpenCNPJ: 50 req/s, resposta 50ms em cache — opcao para volume alto futuro. Para v1 BrasilAPI e suficiente. |
| Supabase invite flow | Custom invite table only | Supabase `inviteUserByEmail` cria o auth.user ja no momento do convite — mais simples. Requer `user_invitations` table separada apenas para metadados (status, expiry, role). |

**Installation para Phase 1:**
```bash
# Framework (greenfield — criar projeto)
npx create-next-app@15 nexus-agent --typescript --tailwind --app --src-dir --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI init (MUST run before adding components)
npx shadcn@latest init
# Escolher: New York style, neutral base color, CSS variables enabled, src/components/ui

# Componentes necessarios para Phase 1 (da UI-SPEC)
npx shadcn@latest add button input form label card badge separator progress select dialog alert avatar table dropdown-menu sonner

# Forms
npm install react-hook-form @hookform/resolvers zod

# State (apenas o que Phase 1 usa)
npm install zustand @tanstack/react-query

# Dates
npm install date-fns

# Dev tooling
npm install -D supabase prettier eslint-config-prettier
```

---

## Architecture Patterns

### Recommended Project Structure (App Router)

```
src/
├── app/
│   ├── (auth)/                    # Route group — auth screens (sem sidebar)
│   │   ├── layout.tsx             # Split-screen auth layout (brand + form panels)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── cadastro/
│   │   │   └── page.tsx           # Wizard 3-step (step state em Zustand)
│   │   ├── recuperar-senha/
│   │   │   ├── page.tsx           # Email input form
│   │   │   └── confirmado/
│   │   │       └── page.tsx       # "Verifique seu email"
│   │   ├── redefinir-senha/
│   │   │   └── page.tsx           # New password form
│   │   └── convite/
│   │       ├── [token]/
│   │       │   └── page.tsx       # Accept invite
│   │       └── expirado/
│   │           └── page.tsx
│   │
│   ├── (app)/                     # Route group — app autenticado
│   │   ├── layout.tsx             # App shell (sidebar, header, session guard)
│   │   └── [slug]/                # Dynamic tenant segment
│   │       ├── dashboard/
│   │       │   └── page.tsx       # Executive dashboard (Phase 6)
│   │       └── configuracoes/
│   │           └── usuarios/
│   │               └── page.tsx   # User management (Phase 1 scope)
│   │
│   ├── trial-expirado/
│   │   └── page.tsx
│   │
│   └── api/                       # Route Handlers (server-only)
│       └── cnpj/
│           └── [cnpj]/
│               └── route.ts       # Proxy para BrasilAPI (evita CORS, esconde URL de origem)
│
├── components/
│   ├── ui/                        # shadcn/ui components (copiados pelo CLI)
│   ├── auth/                      # Auth-specific components
│   │   ├── split-screen-layout.tsx
│   │   ├── brand-panel.tsx        # Lado esquerdo com gradiente
│   │   ├── register-wizard/
│   │   │   ├── wizard-container.tsx
│   │   │   ├── step-indicator.tsx
│   │   │   ├── step-empresa.tsx
│   │   │   ├── step-usuario.tsx
│   │   │   └── step-plano.tsx
│   │   └── user-table.tsx         # User management table
│   └── shared/                    # Shared across app
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts              # createServerClient (Server Components, Server Actions)
│   │   ├── client.ts              # createBrowserClient (Client Components)
│   │   └── admin.ts              # createAdminClient com service_role (NUNCA importar em 'use client')
│   ├── actions/
│   │   └── auth.ts               # Server Actions: registerTenant, inviteUser, updateRole
│   ├── validations/
│   │   ├── cnpj.ts               # CNPJ digito verificador algorithm
│   │   └── auth-schemas.ts       # Zod schemas compartilhados client/server
│   └── types/
│       └── database.types.ts     # Gerado por `supabase gen types typescript`
│
└── middleware.ts                  # JWT refresh + route protection + slug validation
```

### Pattern 1: Tres Clientes Supabase (Obrigatorio)

**O que:** Tres instancias distintas do cliente Supabase para contextos de execucao diferentes.
**Quando usar:** Sempre. Um cliente unico para tudo e um anti-padrao de seguranca.

```typescript
// lib/supabase/server.ts — Server Components e Server Actions
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component — middleware handles refresh */ }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/client.ts — Client Components APENAS
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/admin.ts — EXCLUSIVO para Server Actions e API Routes com service_role
// NUNCA importar em arquivos sem 'use server' ou fora de /app/api/
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // NUNCA NEXT_PUBLIC_
  )
}
```

### Pattern 2: Middleware com getClaims() (2025 — getUser() esta obsoleto para este uso)

**O que:** middleware.ts que refresha o token e protege rotas.
**Mudanca importante 2025-2026:** A documentacao Supabase agora recomenda `getClaims()` sobre `getUser()` para SSR porque `getClaims()` valida localmente a assinatura JWT sem roundtrip ao servidor Auth. `getUser()` ainda funciona mas e mais lento. [VERIFIED: github.com/supabase/supabase/issues/39947]

```typescript
// middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  // IMPORTANTE: usar getClaims() nao getSession() nem getUser() para SSR
  // getClaims() valida JWT localmente — nenhum roundtrip ao Auth server
  const { data: { claims }, error } = await supabase.auth.getClaims()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/cadastro') ||
    request.nextUrl.pathname.startsWith('/recuperar-senha') ||
    request.nextUrl.pathname.startsWith('/redefinir-senha') ||
    request.nextUrl.pathname.startsWith('/convite')

  // Rota de app autenticada — proteger
  if (!claims && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirecionar usuario ja autenticado fora das rotas de auth
  if (claims && isAuthRoute) {
    const tenantSlug = claims.app_metadata?.slug
    const url = request.nextUrl.clone()
    url.pathname = `/${tenantSlug}/dashboard`
    return NextResponse.redirect(url)
  }

  // Validar que o slug na URL pertence ao tenant do usuario autenticado
  const slugMatch = request.nextUrl.pathname.match(/^\/([^/]+)\//)
  if (claims && slugMatch) {
    const urlSlug = slugMatch[1]
    const userSlug = claims.app_metadata?.slug
    if (urlSlug !== userSlug) {
      // Redirecionar para o tenant correto do usuario
      const url = request.nextUrl.clone()
      url.pathname = url.pathname.replace(`/${urlSlug}/`, `/${userSlug}/`)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Nota sobre `getClaims()` vs `getUser()`:** [ASSUMED: getClaims() esta disponivel em @supabase/ssr 0.10.2 — verificar changelog antes de implementar. Se nao disponivel, usar getUser() como fallback documentado nos guias anteriores.]

### Pattern 3: Custom Access Token Hook (JWT com tenant_id + role)

**O que:** Edge Function Supabase que e invocada a cada emissao de token, injetando `tenant_id`, `role` e `slug` no JWT.
**Onde configurar:** Supabase Dashboard > Authentication > Hooks > Custom Access Token.

```typescript
// supabase/functions/custom-access-token/index.ts
// Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

Deno.serve(async (req) => {
  const payload = await req.text()
  const secret = Deno.env.get('CUSTOM_ACCESS_TOKEN_SECRET')!
    .replace('v1,whsec_', '')
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(secret)

  try {
    const { user_id, claims } = wh.verify(payload, headers) as {
      user_id: string
      claims: Record<string, unknown>
    }

    // Buscar app_metadata do usuario (nao editavel pelo usuario)
    // app_metadata ja esta disponivel no claims via raw_app_meta_data
    const appMeta = claims.raw_app_meta_data as {
      tenant_id?: string
      role?: string
      slug?: string
    }

    // Injetar claims customizados no JWT
    claims['app_metadata'] = {
      ...(claims['app_metadata'] as object || {}),
      tenant_id: appMeta?.tenant_id,
      role: appMeta?.role ?? 'visualizador',
      slug: appMeta?.slug,
    }

    return new Response(JSON.stringify({ claims }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
```

### Pattern 4: RLS Schema Foundation

**O que:** Schema SQL completo para Phase 1 — tabelas `tenants`, `profiles`, `user_invitations` + helpers + policies.

```sql
-- migration: 001_foundation.sql

-- Extensoes (ja disponiveis no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de tenants (corretoras)
CREATE TABLE public.tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,                    -- "Corretora Silva Ltda"
  slug        TEXT UNIQUE NOT NULL,             -- "silva"
  cnpj        CHAR(14) NOT NULL UNIQUE,         -- somente digitos, sem formatacao
  segment     TEXT NOT NULL CHECK (segment IN ('seguros', 'consorcio', 'ambos')),
  plan        TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  active      BOOLEAN DEFAULT true,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Profiles (extendem auth.users por tenant)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  full_name   TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin','corretor','financeiro','visualizador')),
  active      BOOLEAN DEFAULT true,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- Convites de usuarios
CREATE TABLE public.user_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','corretor','financeiro','visualizador')),
  invited_by  UUID NOT NULL REFERENCES public.profiles(id),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_invitations_tenant_id ON public.user_invitations(tenant_id);
CREATE INDEX idx_invitations_token ON public.user_invitations(token);

-- HELPERS — extraem claims do JWT para uso em RLS policies
-- Wrapping em (SELECT ...) e obrigatorio para cache do optimizer PostgreSQL
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    ((SELECT current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata' ->> 'tenant_id')::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.tenant_role() RETURNS TEXT AS $$
  SELECT ((SELECT current_setting('request.jwt.claims', true))::jsonb
    -> 'app_metadata' ->> 'role')
$$ LANGUAGE sql STABLE;

-- RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- tenants: usuario autenticado so ve seu proprio tenant
CREATE POLICY "tenant_self_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = auth.tenant_id());

-- profiles: isolamento por tenant
CREATE POLICY "profiles_tenant_isolation" ON public.profiles
  FOR ALL TO authenticated
  USING (tenant_id = auth.tenant_id())
  WITH CHECK (tenant_id = auth.tenant_id());

-- convites: apenas admin pode gerenciar
CREATE POLICY "invitations_tenant_isolation" ON public.user_invitations
  FOR ALL TO authenticated
  USING (tenant_id = auth.tenant_id())
  WITH CHECK (
    tenant_id = auth.tenant_id()
    AND (auth.tenant_role() = 'admin' OR current_setting('role') = 'service_role')
  );
```

### Pattern 5: Server Action de Onboarding (Transacao Atomica)

**O que:** Server Action que cria tenant + auth user + sets app_metadata em uma operacao atomica.
**Por que atomico:** Se a criacao do auth user falha apos criar o tenant, temos um tenant sem admin. Rollback manual e necessario.

```typescript
// lib/actions/auth.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { registerSchema } from '@/lib/validations/auth-schemas'
import { redirect } from 'next/navigation'

export async function registerTenant(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  const { cnpj, companyName, segment, adminName, email, password } = parsed.data
  const admin = createAdminClient()

  // 1. Criar tenant
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: companyName, slug: generateSlug(companyName), cnpj, segment })
    .select()
    .single()
  if (tenantError) return { error: { _form: ['Erro ao criar corretora'] } }

  // 2. Criar usuario admin via Auth (com service_role para setar app_metadata)
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    app_metadata: {
      tenant_id: tenant.id,
      role: 'admin',
      slug: tenant.slug,
    },
    user_metadata: { full_name: adminName },
  })
  if (authError) {
    // Rollback: deletar tenant criado
    await admin.from('tenants').delete().eq('id', tenant.id)
    return { error: { _form: ['Erro ao criar usuario admin'] } }
  }

  // 3. Criar profile
  await admin.from('profiles').insert({
    id: authUser.user.id,
    tenant_id: tenant.id,
    full_name: adminName,
    role: 'admin',
  })

  // 4. Logar o usuario automaticamente apos registro
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  redirect(`/${tenant.slug}/dashboard`)
}
```

### Pattern 6: Validacao de CNPJ + BrasilAPI Lookup

```typescript
// lib/validations/cnpj.ts
// CNPJ digito verificador algorithm
// Source: https://dev.to/leandrostl/demystifying-cpf-and-cnpj-check-digit-algorithms
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  // Rejeitar sequencias invalidas (todos os digitos iguais)
  if (/^(\d)\1+$/.test(digits)) return false

  const calcDigit = (d: string, len: number): number => {
    let sum = 0
    let pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(d[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }

  const d1 = calcDigit(digits, 12)
  const d2 = calcDigit(digits, 13)
  return parseInt(digits[12]) === d1 && parseInt(digits[13]) === d2
}

// API Route: app/api/cnpj/[cnpj]/route.ts
// Proxy para BrasilAPI — esconde origin URL, permite CORS correto
export async function GET(
  _req: Request,
  { params }: { params: { cnpj: string } }
) {
  const digits = params.cnpj.replace(/\D/g, '')
  const res = await fetch(
    `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
    { next: { revalidate: 3600 } } // cache 1h — dados cadastrais mudam pouco
  )
  if (!res.ok) return Response.json({ error: 'CNPJ nao encontrado' }, { status: res.status })
  const data = await res.json()
  return Response.json({
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia,
    situacao_cadastral: data.descricao_situacao_cadastral,
  })
}
```

### Anti-Patterns to Avoid

- **getSession() em middleware:** Nao valida assinatura JWT — usar `getClaims()`. [VERIFIED: Supabase docs 2025-2026]
- **service_role em NEXT_PUBLIC_:** Qualquer variavel `NEXT_PUBLIC_SUPABASE_SERVICE*` no codebase e uma vulnerabilidade critica.
- **user_metadata para tenant_id/role:** Usuario pode modificar user_metadata via SDK cliente — usar `app_metadata` exclusivamente.
- **CREATE TABLE sem ENABLE ROW LEVEL SECURITY:** Toda tabela em `public` schema deve ter RLS ativo antes de receber dados.
- **Views sem `security_invoker = true`:** Views criadas sem esse parametro rodam como postgres superuser, bypassando RLS.
- **tenant_id sem indice:** RLS sem indice causa full table scan em todas as queries — `CREATE INDEX` obrigatorio junto com `CREATE TABLE`.
- **Onboarding nao-atomico:** Criar tenant e auth user em operacoes separadas sem rollback pode gerar tenant sem admin.
- **CNPJ como VARCHAR com formatacao:** Armazenar como `CHAR(14)` somente digitos. Mascara e apenas UX.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autenticacao com cookies SSR | Cookie handling manual | `@supabase/ssr` createServerClient/createBrowserClient | Gerencia refresh de token, PKCE flow, cookie scoping — nao trivial implementar corretamente |
| CNPJ digito verificador | Algoritmo proprio | `lib/validations/cnpj.ts` (baseado em spec publica) | O algoritmo em si e simples — mas use a implementacao bem testada. Nao reinventar. |
| Toast notifications | State management proprio | shadcn/ui `sonner` | Acessibilidade, stacking, dismiss — muitos edge cases |
| Form validation | Logica if/else manual | Zod + React Hook Form | Schemas compartilhados client/server, TypeScript inference, performance |
| Modal confirmacao | Implementacao propria | shadcn/ui `Dialog` (via Radix) | Focus trap, aria-modal, keyboard navigation — requisito de acessibilidade |
| Invite token generation | UUID ou random string proprio | PostgreSQL `encode(gen_random_bytes(32), 'hex')` | 256 bits de entropia, URL-safe, gerado server-side |
| Role check na UI | Condicional if/else espalhados | RLS policy centralizada + hook `useRole()` | RLS e a fonte da verdade — UI esconde elementos, banco bloqueia acesso |

**Key insight:** Em auth multi-tenant, o banco de dados (RLS) e a ultima linha de defesa, nao o codigo de aplicacao. A UI pode esconder elementos por UX, mas a policy PostgreSQL garante que dados nao vazem mesmo se houver bug na aplicacao.

---

## Common Pitfalls

### Pitfall 1: service_role Key no Bundle do Cliente

**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` colocado como `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` ou importado em componente sem `'use server'`. Key aparece no bundle JS enviado ao browser.
**Why it happens:** Developer usa service_role localmente para contornar RLS em dev e esquece.
**How to avoid:** Manter dois arquivos separados (`lib/supabase/server.ts` com anon key, `lib/supabase/admin.ts` com service_role). Adicionar ESLint rule bloqueando import de `admin.ts` em arquivos sem `'use server'`.
**Warning signs:** Qualquer env var `NEXT_PUBLIC_SUPABASE_SERVICE*` existindo. Um unico `supabaseClient` para todo o app.

### Pitfall 2: Tabela sem RLS (CVE-2025-48757 — 170+ apps afetados)

**What goes wrong:** Nova tabela criada em migracao sem `ENABLE ROW LEVEL SECURITY`. API REST gerado automaticamente pelo Supabase expoe todos os registros de todos os tenants via anon key.
**Why it happens:** Migrations adicionadas rapido sem template.
**How to avoid:** Migration template obrigatorio inclui `ALTER TABLE x ENABLE ROW LEVEL SECURITY`. CI check: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity` — deve retornar zero linhas.
**Warning signs:** Supabase Studio mostra "RLS disabled" badge em qualquer tabela.

### Pitfall 3: user_metadata para tenant_id (Tenant Impersonation)

**What goes wrong:** `tenant_id` armazenado em `raw_user_meta_data`. Usuario chama `supabase.auth.updateUser({ data: { tenant_id: 'another-tenant-uuid' } })` e passa a ver dados de outro tenant.
**Why it happens:** `user_metadata` e mais visivel na resposta Auth. `app_metadata` e menos documentado.
**How to avoid:** `tenant_id` e `role` exclusivamente em `app_metadata` (server-controlled). Somente `supabase.auth.admin.updateUserById` (service_role) pode modificar `app_metadata`.
**Warning signs:** RLS policies referenciando `auth.jwt() -> 'user_metadata'`.

### Pitfall 4: Onboarding com Estado Parcial

**What goes wrong:** Tenant criado, mas criacao do auth user falha. Tenant fica registrado sem nenhum admin. Ao tentar re-registrar com mesmo CNPJ, erro de "CNPJ ja cadastrado" aparece — usuario fica bloqueado.
**Why it happens:** Duas operacoes separadas (INSERT tenant, createUser) sem tratamento de rollback.
**How to avoid:** Server Action deve deletar o tenant criado se `createUser` falhar. Testar o path de falha explicitamente.
**Warning signs:** Registros na tabela `tenants` sem nenhum `profile` correspondente.

### Pitfall 5: RLS sem Indice no tenant_id

**What goes wrong:** Performance colapsa com dados reais. Dashboard que carregava em 50ms torna-se 2000ms com 10+ tenants.
**Why it happens:** Developers focam em correctness das policies, nao em performance.
**How to avoid:** `CREATE INDEX idx_X_tenant_id ON X(tenant_id)` na mesma migracao que cria a tabela. Nunca separar.
**Warning signs:** `EXPLAIN ANALYZE` mostra `Seq Scan` em tabelas com `tenant_id` no WHERE.

### Pitfall 6: BrasilAPI Rate Limiting em Producao

**What goes wrong:** CNPJ lookup falha com 429 durante picos de registro de corretoras.
**Why it happens:** BrasilAPI e open-source sem SLA garantido. Em picos pode throttle requests.
**How to avoid:** Implementar retry com backoff exponencial (max 3 tentativas). Se BrasilAPI falhar, mostrar mensagem "CNPJ nao encontrado — preencha a razao social manualmente" e permitir preenchimento manual. Nunca bloquear registro por falha de API externa.
**Warning signs:** Registros falhando na step 1 do wizard sem motivo aparente.

### Pitfall 7: Convite com Token Previsivel ou Reutilizavel

**What goes wrong:** Token de convite gerado com `Math.random()` ou UUID v4 simples. Ou token nao marcado como usado apos aceite — mesmo link pode ser clicado multiplas vezes.
**Why it happens:** Invite flow parece simples, seguranca do token e esquecida.
**How to avoid:** Token gerado via `encode(gen_random_bytes(32), 'hex')` (256 bits, PostgreSQL server-side). `accepted_at` atualizado atomicamente ao aceitar — `UPDATE ... WHERE token = X AND accepted_at IS NULL AND expires_at > NOW()` deve afetar exatamente 1 row; se 0 rows, token invalido ou ja usado.
**Warning signs:** Mesma URL de convite funcionando duas vezes. Tokens com < 16 bytes de entropia.

---

## Code Examples

### Supabase SQL Helper Functions (padrao de performance)

```sql
-- Source: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
-- Wrapper SELECT obrigatorio — habilita cache por statement no PostgreSQL
-- Sem o SELECT wrapper, auth.jwt() e recalculado a cada row

-- CORRETO (com cache):
USING (tenant_id = (SELECT auth.tenant_id()))

-- ERRADO (recalcula em cada row — dezenas de ms de overhead):
USING (tenant_id = auth.tenant_id())
```

### View com security_invoker (obrigatorio para dashboards)

```sql
-- Source: https://supabase.com/docs/guides/database/database-advisors?lint=0010_security_definer_view
-- TODOS os views devem incluir security_invoker = true
-- Sem isso, view roda como postgres superuser e bypassa RLS

CREATE VIEW public.v_active_profiles
WITH (security_invoker = true) AS
  SELECT id, tenant_id, full_name, role
  FROM public.profiles
  WHERE active = true AND deleted_at IS NULL;
```

### CI Check: RLS Coverage

```sql
-- Rodar em CI (migration test) — deve retornar 0 linhas
-- Qualquer tabela em public sem RLS e um bug de seguranca critico
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT rowsecurity
  AND tablename NOT IN ('schema_migrations'); -- ignorar tabela de controle
-- FAIL build se COUNT > 0
```

### Wizard Step com Zustand

```typescript
// stores/register-wizard.store.ts
import { create } from 'zustand'

interface WizardState {
  step: 1 | 2 | 3
  empresaData: { cnpj: string; razaoSocial: string; segment: string } | null
  adminData: { fullName: string; email: string; password: string } | null
  setStep: (step: 1 | 2 | 3) => void
  setEmpresaData: (data: WizardState['empresaData']) => void
  setAdminData: (data: WizardState['adminData']) => void
  reset: () => void
}

export const useRegisterWizard = create<WizardState>((set) => ({
  step: 1,
  empresaData: null,
  adminData: null,
  setStep: (step) => set({ step }),
  setEmpresaData: (empresaData) => set({ empresaData }),
  setAdminData: (adminData) => set({ adminData }),
  reset: () => set({ step: 1, empresaData: null, adminData: null }),
}))
```

### Accept Invite Server Action

```typescript
// lib/actions/auth.ts (trecho)
'use server'
export async function acceptInvite(token: string, fullName: string, password: string) {
  const admin = createAdminClient()

  // Validar token — atomico, single-use
  const { data: invite, error } = await admin
    .from('user_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)
    .is('accepted_at', null)        // nao usado
    .is('cancelled_at', null)       // nao cancelado
    .gt('expires_at', new Date().toISOString())  // nao expirado
    .select('*, tenants(id, slug, name)')
    .single()

  if (error || !invite) return { error: 'Convite invalido ou expirado' }

  // Buscar auth user criado pelo inviteUserByEmail
  const { data: { users } } = await admin.auth.admin.listUsers()
  const authUser = users.find(u => u.email === invite.email)
  if (!authUser) return { error: 'Usuario nao encontrado' }

  // Atualizar senha e app_metadata
  await admin.auth.admin.updateUserById(authUser.id, {
    password,
    app_metadata: {
      tenant_id: invite.tenant_id,
      role: invite.role,
      slug: (invite.tenants as { slug: string }).slug,
    },
    user_metadata: { full_name: fullName },
  })

  // Criar profile
  await admin.from('profiles').insert({
    id: authUser.id,
    tenant_id: invite.tenant_id,
    full_name: fullName,
    role: invite.role,
  })

  // Login automatico
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email: invite.email, password })

  const tenant = invite.tenants as { slug: string }
  redirect(`/${tenant.slug}/dashboard`)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` | 2023-2024 | auth-helpers esta deprecado — nao instalar |
| `getSession()` em Server | `getClaims()` em Server | 2025-2026 | getClaims valida JWT localmente, mais seguro e rapido |
| `getUser()` em middleware | `getClaims()` em middleware | 2025-2026 | getUser faz roundtrip ao Auth server a cada request — overhead desnecessario |
| Tailwind config (`tailwind.config.js`) | CSS-based config (`globals.css`) | Tailwind v4 | v4 nao usa `tailwind.config.js` para tema — configuracao em CSS |
| shadcn/ui: `tailwind.config` path | `tailwind.config: ""` em components.json | shadcn CLI 2025 | Para Tailwind v4, deixar config path em branco |

**Deprecated/outdated:**
- `@supabase/auth-helpers`: Nao instalar. Substituido por `@supabase/ssr`.
- `supabase.auth.getSession()` em server-side: Nao usar para protecao de rotas — nao valida token.
- `tailwind.config.js` com `theme.extend.colors`: Tailwind v4 usa variaveis CSS diretamente.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getClaims()` esta disponivel em @supabase/ssr 0.10.2 | Pattern 2 (Middleware), Standard Stack | Se nao disponivel, usar `getUser()` — middleware ainda funciona, apenas com roundtrip extra ao Auth server |
| A2 | Zod 4.x (versao atual no npm) e compativel com @hookform/resolvers 5.x | Standard Stack | Se incompativel, pinnar Zod 3.x (`npm install zod@3`) — hookform/resolvers suporta ambas versoes |
| A3 | BrasilAPI retorna `razao_social` como campo no endpoint `/api/cnpj/v1/:cnpj` | Pattern 6 (CNPJ) | Verificar schema de resposta atual da BrasilAPI antes de implementar o proxy |
| A4 | shadcn/ui `sonner` esta disponivel como componente no CLI atual | Standard Stack | Verificar com `npx shadcn@latest add sonner` — se nao disponivel, instalar `sonner` direto e criar wrapper |
| A5 | `inviteUserByEmail` disponivel em `supabase.auth.admin` via service_role | Accept Invite pattern | Metodo documentado na API Supabase Admin — verificar se disponivel na versao 2.104.0 |

**Nota:** A1 e o risco mais relevante. Issue #39947 no GitHub Supabase mostra que a documentacao foi atualizada para recomendar `getClaims()` mas a implementacao nos guias SSR ainda usa `getUser()`. Na pratica, ambos funcionam — `getClaims()` e mais eficiente quando publishable key estiver configurada.

---

## Open Questions

1. **getClaims() vs getUser() em @supabase/ssr 0.10.2**
   - What we know: Documentacao Supabase recomenda `getClaims()` desde 2025. Issues no GitHub indicam que guias SSR ainda usam `getUser()`.
   - What's unclear: Se `getClaims()` ja esta disponivel na versao 0.10.2 instalavel via npm ou se requer versao mais recente.
   - Recommendation: Tentar `getClaims()` — se TypeScript reclamar que o metodo nao existe, usar `getUser()` como fallback. Ambos protegem corretamente.

2. **Trial expiry e acesso bloqueado — implementacao**
   - What we know: D-07 define bloqueio com tela de upgrade apos trial expirar.
   - What's unclear: Deve ser checado no middleware (redirectar para `/trial-expirado`) ou no layout do app (mostrar tela sobreposta)?
   - Recommendation: Checar no middleware usando `tenants.trial_ends_at` — mas isso requer um lookup ao banco em cada request. Alternativa mais eficiente: incluir `trial_ends_at` no JWT via Custom Access Token Hook, checar no middleware sem roundtrip. Planner deve decidir.

3. **Invite flow via Supabase inviteUserByEmail vs custom tokens**
   - What we know: Supabase tem `auth.admin.inviteUserByEmail()` que cria o usuario e envia email automaticamente. Mas a tabela `user_invitations` seria necessaria para tracking (status, expiry, role, cancel).
   - What's unclear: Se usar `inviteUserByEmail` do Supabase cria o usuario imediatamente (antes do aceite) ou apenas quando o convite e aceito.
   - Recommendation: `inviteUserByEmail` cria o auth user imediatamente em estado "invited". O planner deve decidir se usar o flow nativo do Supabase (mais simples mas menos controle) ou implementar invite flow customizado com `user_invitations` table como token store.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Execucao do projeto | Yes | v24.14.0 | — |
| npm | Package management | Yes | 11.9.0 | — |
| npx (create-next-app) | Project initialization | Yes | 11.9.0 | — |
| Supabase CLI | Migrations, type gen | Not checked | — | Instalar: `npm install -D supabase` |
| Supabase project (cloud) | Backend | Not verified | — | Criar em supabase.com — gratis para dev |

**Missing dependencies with no fallback:**
- Supabase project na cloud: necessario criar antes de qualquer implementacao. URL e anon key devem estar em `.env.local`.

**Missing dependencies with fallback:**
- Supabase CLI (local): pode ser instalado como dev dependency. Necessario para migrations e `supabase gen types`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via Next.js 15 com --vitest flag, ou instalar manualmente) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| E2E (opcional) | Playwright — para testes de auth flow end-to-end |

**Nota:** Next.js 15 nao inclui Vitest por padrao. O planner deve incluir instalacao de Vitest na Wave 0. [ASSUMED: Vitest e preferido sobre Jest para Next.js 15 em 2025-2026 — menor overhead de configuracao com TypeScript e ESM]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Registro cria tenant isolado com CNPJ valido | integration | `vitest run tests/auth/register.test.ts` | No — Wave 0 |
| AUTH-01 | CNPJ invalido e rejeitado (digito verificador) | unit | `vitest run tests/validations/cnpj.test.ts` | No — Wave 0 |
| AUTH-02 | Login retorna sessao persistente apos page refresh | integration | `vitest run tests/auth/session.test.ts` | No — Wave 0 |
| AUTH-03 | Convite com token valido permite aceite | integration | `vitest run tests/auth/invite.test.ts` | No — Wave 0 |
| AUTH-03 | Convite expirado (> 72h) e rejeitado | unit | `vitest run tests/auth/invite.test.ts` | No — Wave 0 |
| AUTH-04 | Visualizador nao consegue criar registro | integration | `vitest run tests/auth/rbac.test.ts` | No — Wave 0 |
| AUTH-05 | Tenant A nao visualiza dados do Tenant B | integration (RLS) | `vitest run tests/auth/rls-isolation.test.ts` | No — Wave 0 |
| AUTH-05 | CI check: todas as tabelas tem RLS habilitado | SQL/migration | Script SQL em `supabase/migrations/check_rls.sql` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/validations/ --reporter=verbose` (unit tests < 5s)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + RLS CI check green antes do `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — framework config
- [ ] `tests/setup.ts` — Supabase test client com service_role para integration tests
- [ ] `tests/validations/cnpj.test.ts` — cobre AUTH-01 (validacao CNPJ)
- [ ] `tests/auth/rls-isolation.test.ts` — cobre AUTH-05 (o mais critico — testa dois tenants simultaneamente)
- [ ] `tests/auth/rbac.test.ts` — cobre AUTH-04 (role enforcement)
- [ ] `tests/auth/invite.test.ts` — cobre AUTH-03 (invite flow)
- [ ] `tests/auth/register.test.ts` — cobre AUTH-01 (registro completo)
- [ ] `tests/auth/session.test.ts` — cobre AUTH-02 (sessao persistente)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react`

**Prioridade de teste:** `rls-isolation.test.ts` e o mais critico — deve ser implementado primeiro. Um bug aqui expoe dados de todos os tenants.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Supabase Auth (email+password, magic link) — min 8 chars, no credential stuffing via Supabase rate limiting |
| V3 Session Management | YES | `@supabase/ssr` cookie-based sessions — httpOnly, Secure, SameSite=Lax |
| V4 Access Control | YES | RLS policies com `auth.tenant_id()` + `auth.tenant_role()` — database-enforced |
| V5 Input Validation | YES | Zod schemas em Server Actions — CNPJ validado por digito verificador + formato |
| V6 Cryptography | LOW | Supabase gerencia criptografia de senhas (bcrypt) e tokens — nao hand-roll |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leak via RLS bypass | Information Disclosure | `auth.tenant_id()` com `(SELECT ...)` wrapper em todas policies + CI check |
| service_role key exposure | Elevation of Privilege | Separar `lib/supabase/admin.ts`, nunca NEXT_PUBLIC_, ESLint import rule |
| JWT user_metadata spoofing | Spoofing | tenant_id/role exclusivamente em `app_metadata` |
| Invite token brute-force | Spoofing | 256-bit token via `gen_random_bytes(32)` + single-use check atomico |
| CNPJ validation bypass | Tampering | Digito verificador no client + servidor (Zod schema) |
| Cross-site request forgery em Server Actions | Tampering | Next.js 15 protege Server Actions com origin check automaticamente |
| SQL injection em queries | Tampering | Supabase client usa parameterized queries — nunca string concatenation |
| Trial bypass (manipulacao de data) | Elevation of Privilege | `trial_ends_at` checado via JWT claim (server-controlled) ou query ao banco |

### LGPD Compliance para Phase 1

| Aspecto | Implementacao |
|---------|---------------|
| Soft delete obrigatorio | `deleted_at TIMESTAMPTZ` em `tenants`, `profiles` — nunca `DELETE` direto (D-12) |
| Consent no registro | Legal microcopy na Step 3 do wizard com link para Termos e Privacidade |
| Dados pessoais em `profiles` | Apenas nome completo e email — minimo necessario para fase 1 |
| Cookie consent | Vercel Analytics usa cookies — implementar banner de consentimento antes de ativar Analytics |
| Direito ao esquecimento | Mecanismo de exclusao de tenant (soft delete cascade) deve estar na arquitetura desde Phase 1 |

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Implication para Phase 1 |
|-----------|----------|--------------------------|
| Next.js + Supabase + Vercel — nao negociavel | Stack | Sem alternativas de framework/backend |
| Multi-tenancy via RLS do Supabase | Arquitetura | tenant_id em todas as tabelas, policies obrigatorias |
| `app_metadata` para tenant_id (nao `user_metadata`) | Seguranca | Custom Access Token Hook obrigatorio |
| `service_role` nunca em `NEXT_PUBLIC_*` | Seguranca | Dois clientes Supabase distintos (anon/admin) |
| `@supabase/ssr` (nao `@supabase/auth-helpers`) | Dependencia | Instalar `@supabase/ssr`, nao auth-helpers |
| Mercado Brasil — datas pt-BR, moeda BRL, LGPD | Localizacao | Textos em pt-BR, soft delete para LGPD, cookie consent |
| Escala v1: max 5.000 clientes e 10.000 apolices por tenant | Performance | Indices em tenant_id obrigatorios desde migration 001 |
| GSD workflow — nao editar diretamente fora do workflow | Processo | Usar /gsd-execute-phase para implementacao |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: npm registry] — @supabase/ssr@0.10.2, @supabase/supabase-js@2.104.0, next@15.5.15, zod@4.3.6, react-hook-form@7.72.1, tailwindcss@4.2.2
- [CITED: supabase.com/docs/guides/auth/server-side/nextjs] — Padrao createServerClient, createBrowserClient, middleware
- [CITED: supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook] — Custom Access Token Hook pattern
- [CITED: supabase.com/docs/guides/database/postgres/row-level-security] — RLS patterns, performance com (SELECT ...) wrapper
- [CITED: .planning/research/STACK.md] — Stack decisions (pesquisadas 2026-04-19)
- [CITED: .planning/research/ARCHITECTURE.md] — Schema design, bounded domains
- [CITED: .planning/research/PITFALLS.md] — 5 pitfalls criticos de RLS + 9 moderados
- [CITED: .planning/phases/01-fundacao-auth/01-CONTEXT.md] — D-01 a D-20 (decisoes travadas)
- [CITED: .planning/phases/01-fundacao-auth/01-UI-SPEC.md] — Screen inventory, components, copywriting

### Secondary (MEDIUM confidence)

- [CITED: github.com/supabase/supabase/issues/39947] — getClaims vs getUser em SSR guides — recomendacao atual
- [CITED: ui.shadcn.com/docs/tailwind-v4] — shadcn/ui com Tailwind v4, components.json sem config path
- [WebSearch verificado] — BrasilAPI vs ReceitaWS: ReceitaWS limit 3 req/min em producao; BrasilAPI sem auth, open-source
- [WebSearch verificado] — OpenCNPJ: 50 req/s, resposta < 50ms — alternativa para volume alto

### Tertiary (LOW confidence)

- [ASSUMED] — `getClaims()` disponivel em @supabase/ssr 0.10.2 — verificar ao instalar
- [ASSUMED] — Zod 4.x compativel com @hookform/resolvers 5.x — verificar changelog

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versoes verificadas via npm registry em 2026-04-20
- Architecture: HIGH — baseado em documentacao oficial Supabase + STACK.md/ARCHITECTURE.md do projeto (pesquisados 2026-04-19)
- Pitfalls: HIGH — baseado em PITFALLS.md do projeto + CVE-2025-48757 documentado
- CNPJ API: MEDIUM — BrasilAPI e recomendada mas sem SLA garantido; fallback manual necessario
- getClaims() API: MEDIUM — recomendada em docs 2025-2026 mas disponibilidade na versao instalada nao verificada

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 dias — stack estavel, mas verificar mudancas em @supabase/ssr)
