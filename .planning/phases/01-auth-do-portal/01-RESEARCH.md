# Phase 1: Auth do Portal - Research

**Researched:** 2026-05-04
**Domain:** Supabase Auth (multi-role) + Next.js App Router middleware + RLS para portal_client
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Mesmo projeto Supabase — `app_metadata.role = 'portal_client'` no JWT.
- **D-02:** URL com path prefix: `/{slug}/portal/...` em Phase 1. Phase 2 adiciona subdomínio.
- **D-03:** Auto-cadastro direto por CPF — `createAdminClient()` verifica existência em `clients`.
- **D-04:** Formulário de cadastro: CPF (verificado), email (login Supabase), senha.
- **D-05:** Verificação de CPF via `createAdminClient()` com `.eq('tenant_id', tenantId).eq('document', cpf)` — apenas em Server Action.
- **D-06:** Middleware identifica portal_client por `app_metadata.role === 'portal_client'`. Rotas em `/{slug}/portal/**`.
- **D-07:** `portal_client` fora do portal → redirect para `/{slug}/portal/home`.
- **D-08:** Usuário interno em `/{slug}/portal/**` → redirect para `/{slug}/dashboard`.
- **D-09:** Sessão padrão Supabase (1h access token + auto-refresh). Sem configuração extra.
- **D-10:** Nova tabela `portal_clients (id FK auth.users, tenant_id, client_id FK clients.id)`. RLS usa `(SELECT pc.tenant_id FROM portal_clients pc WHERE pc.id = auth.uid())`.
- **D-11:** Usuários internos não têm linha em `portal_clients`. Isolamento garantido: portal_clients não têm `tenant_id` no JWT `app_metadata`, as policies internas nunca os autorizarão.
- **D-12:** Rotas Phase 1: `/{slug}/portal/login`, `/{slug}/portal/cadastro`, `/{slug}/portal/home` (placeholder). Layout próprio do portal.

### Claude's Discretion

- Formato de validação CPF no formulário: reutilizar `validateCPF` / `stripCPF` de `src/lib/validations/cpf.ts`.
- Mensagem de erro quando CPF não encontrado: genérica ("CPF não encontrado para esta corretora") sem revelar se cliente existe.
- Estrutura de diretório: `src/app/(portal)/[slug]/portal/` isolando visualmente de `(app)` e `(auth)`.

### Deferred Ideas (OUT OF SCOPE)

- Convite do corretor para o portal (auto-cadastro somente em v1.1).
- Email de confirmação pós-cadastro via Resend.
- Recuperação de senha no portal (pode ser adicionado sem planning separado na execução — Supabase Auth tem suporte nativo).
</user_constraints>

---

## Summary

Esta fase implementa um segundo tipo de usuário (`portal_client`) no mesmo projeto Supabase, com rotas, layout e RLS completamente separados dos usuários internos (corretores, admin). A complexidade central está em três pontos: (1) estender o middleware existente sem quebrar o fluxo de auth dos usuários internos, (2) criar a tabela `portal_clients` com RLS corretamente isolada, e (3) implementar o fluxo de cadastro por CPF de forma segura (sem expor dados de clientes).

O padrão de `app_metadata.role` já existe no codebase — o v1.0 usa `role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'`. A Phase 1 adiciona `role: 'portal_client'` ao mesmo sistema. A separação de sessão no middleware é a peça mais delicada: o `updateSession` atual em `src/lib/supabase/middleware.ts` assume que todos os usuários autenticados têm `app_metadata.tenant_id` e `app_metadata.slug` — portal_clients NÃO terão essas claims, o que acionaria o branch de "incomplete onboarding" e faria um redirect para `/cadastro`. Esse branch precisa ser ajustado.

**Primary recommendation:** Estender `updateSession` com detecção de `portal_client` antes dos checks de `tenant_id`/`slug` ausentes. Criar route group `(portal)` paralelo a `(app)` e `(auth)`. Criar migration com tabela `portal_clients` + helper SQL `jwt_portal_tenant_id()` + RLS policies seguindo o padrão `(SELECT ...)` do v1.0.

---

## Standard Stack

### Core (todos já instalados — verificados em package.json)

| Library | Version | Purpose | Why |
|---------|---------|---------|------|
| @supabase/ssr | ^0.10.2 | SSR auth client | Padrão oficial; gerencia cookies no App Router |
| @supabase/supabase-js | ^2.104.0 | SDK Supabase | Necessário para `createAdminClient()` |
| next | ^15.3.9 | App Router + middleware | Route groups `(portal)` + `[slug]/portal/` |
| zod | ^3.25.76 | Schema validation | Valida CPF + email + senha no Server Action |
| react-hook-form | ^7.73.1 | Form state | Formulários de login e cadastro do portal |
| @hookform/resolvers | ^5.2.2 | Zod + RHF bridge | Integração zodResolver |
| lucide-react | ^1.8.0 | Ícones | Consistência com design system |

**Nenhuma instalação necessária.** Todas as dependências já estão no projeto.

### Utilitários já no codebase

| Asset | Path | Uso |
|-------|------|-----|
| `validateCPF` / `stripCPF` | `src/lib/validations/cpf.ts` | Validação dígito verificador CPF no schema Zod |
| `createAdminClient()` | `src/lib/supabase/admin.ts` | Verificação de CPF e criação de usuário portal |
| `createClient()` | `src/lib/supabase/server.ts` | signInWithPassword no portal |
| shadcn/ui (Input, Button, Form, Card, Alert) | `src/components/ui/` | UI dos formulários do portal |
| `SplitScreenLayout` | `src/components/auth/split-screen-layout.tsx` | Possível reuso no layout do portal |

---

## Architecture Patterns

### Estrutura de Diretórios Proposta

```
src/
├── app/
│   ├── (auth)/                          # existente — login/cadastro interno
│   ├── (app)/[slug]/                    # existente — sistema interno
│   └── (portal)/                        # NOVO — portal do cliente
│       └── [slug]/
│           └── portal/
│               ├── layout.tsx           # Layout próprio do portal
│               ├── login/
│               │   ├── page.tsx
│               │   └── portal-login-form.tsx
│               ├── cadastro/
│               │   ├── page.tsx
│               │   └── portal-cadastro-form.tsx
│               └── home/
│                   └── page.tsx         # Placeholder (Phase 1)
├── lib/
│   ├── actions/
│   │   └── portal-auth.ts              # NOVO — Server Actions do portal
│   └── validations/
│       └── portal-auth-schemas.ts      # NOVO — Zod schemas CPF+email+senha
supabase/
└── migrations/
    └── 20260504_0001_portal_clients.sql # NOVO — tabela + RLS + helper SQL
```

### Pattern 1: Extensão do Middleware para portal_client

**O problema crítico:** O middleware atual em `updateSession` (linha 113) verifica:
```typescript
if (!tenantId || !userSlug) {
  // force re-onboarding → redirect /cadastro
}
```

Portal clients têm `app_metadata.role = 'portal_client'` mas NÃO têm `tenant_id` ou `slug` no JWT `app_metadata`. Eles teriam `tenant_id` inferido via `portal_clients` table, mas isso não está no JWT. Sem ajuste, todo portal_client seria redirecionado para `/cadastro`.

**Solução:** Detectar `portal_client` ANTES dos checks de tenant/slug ausentes.

```typescript
// [VERIFIED: codebase — src/lib/supabase/middleware.ts]
// Adicionar ANTES do check "!tenantId || !userSlug" (atualmente linha 113):

const role = appMeta.role
const isPortalClient = role === 'portal_client'

// Portal client branch — rotas e redirects próprios
if (isPortalClient) {
  const isPortalRoute = pathname.match(/^\/([^/]+)\/portal(\/.*)?$/)
  if (!isPortalRoute) {
    // portal_client fora do portal → redirecionar para /{slug}/portal/home
    // O slug do portal_client NÃO vem do JWT — precisa ser extraído do pathname
    // ou guardado em app_metadata.portal_slug
    const url = request.nextUrl.clone()
    // Ver Pattern 2 sobre como obter o slug para portal_clients
    url.pathname = '/portal-redirect' // handled separately
    return redirectWithCookies(url, supabaseResponse)
  }
  return supabaseResponse
}

// A partir daqui: fluxo normal de usuários internos
```

**Nota crítica sobre slug para portal_client:** O JWT de portal_client não tem `app_metadata.slug` como os usuários internos. Duas opções:
- **Opção A (recomendada):** Adicionar `portal_slug` a `app_metadata` no momento do `admin.auth.admin.createUser` do cadastro. Assim `app_metadata = { role: 'portal_client', tenant_id: <uuid>, portal_slug: 'acme' }`.
- **Opção B:** Não colocar slug no JWT e sempre extraí-lo do pathname — mas isso falha no caso de D-07 (portal_client fora do portal, não há slug na URL).

**Opção A é superior** — coloca `tenant_id` e `portal_slug` no JWT de portal_clients para que o middleware possa funcionar sem queries extras.

### Pattern 2: AppClaims Type Extension

O type atual em `src/lib/supabase/middleware.ts`:
```typescript
// [VERIFIED: codebase — src/lib/supabase/middleware.ts linha 30]
type AppClaims = {
  sub: string
  app_metadata?: {
    tenant_id?: string
    role?: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
    slug?: string
    trial_ends_at?: string
    plan?: string
  }
}
```

Precisa ser estendido para aceitar `portal_client` no role e `portal_slug`:
```typescript
type AppClaims = {
  sub: string
  app_metadata?: {
    tenant_id?: string
    role?: 'admin' | 'corretor' | 'financeiro' | 'visualizador' | 'portal_client'
    slug?: string
    portal_slug?: string   // usado por portal_clients
    trial_ends_at?: string
    plan?: string
  }
}
```

### Pattern 3: Server Action de Cadastro do Portal

```typescript
// [VERIFIED: padrão estabelecido em src/lib/actions/auth.ts]
'use server'
// src/lib/actions/portal-auth.ts

export async function registerPortalClient(
  formData: FormData,
): Promise<{ error?: PortalFormError } | void> {
  const parsed = portalCadastroSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as PortalFormError }
  }

  const { cpf, email, password, slug } = parsed.data
  const admin = createAdminClient()

  // 1. Lookup tenant by slug (admin bypasses RLS)
  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (!tenant) {
    return { error: { _form: ['Corretora não encontrada.'] } }
  }

  // 2. Verify CPF exists in clients (com tenant_id explícito — NUNCA só RLS no admin)
  const cleanCpf = stripCPF(cpf)
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('document', cleanCpf)
    .eq('type', 'pf')
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) {
    // Mensagem genérica — não revela se CPF existe ou não (security by obscurity)
    return { error: { cpf: ['CPF não encontrado para esta corretora.'] } }
  }

  // 3. Check if portal_client already exists for this client
  const { data: existingPortalClient } = await admin
    .from('portal_clients')
    .select('id')
    .eq('client_id', client.id)
    .maybeSingle()

  if (existingPortalClient) {
    return { error: { cpf: ['Já existe uma conta para este CPF. Faça login.'] } }
  }

  // 4. Create Supabase Auth user (email_confirm: true — sem email de confirmação por ora)
  const { data: authRes, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: 'portal_client',
      tenant_id: tenant.id,
      portal_slug: slug,
    },
  })

  if (authErr || !authRes?.user) {
    const msg = authErr?.message?.toLowerCase() ?? ''
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return { error: { email: ['Este e-mail já está em uso no portal.'] } }
    }
    return { error: { _form: ['Erro ao criar conta. Tente novamente.'] } }
  }

  // 5. INSERT portal_clients row
  const { error: pcErr } = await admin.from('portal_clients').insert({
    id: authRes.user.id,
    tenant_id: tenant.id,
    client_id: client.id,
  })

  if (pcErr) {
    // Rollback auth user
    await admin.auth.admin.deleteUser(authRes.user.id)
    return { error: { _form: ['Erro ao finalizar cadastro. Tente novamente.'] } }
  }

  // 6. Auto-login
  const supabase = await createClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signInErr) {
    redirect(`/${slug}/portal/login`)
  }

  redirect(`/${slug}/portal/home`)
}
```

### Pattern 4: Migration SQL — portal_clients

```sql
-- [VERIFIED: padrão de migration do v1.0]
-- supabase/migrations/20260504_0001_portal_clients.sql

-- Tabela portal_clients
CREATE TABLE public.portal_clients (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  client_id   UUID NOT NULL REFERENCES public.clients(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_clients_client_unique UNIQUE (client_id)
);

CREATE INDEX idx_portal_clients_tenant_id ON public.portal_clients(tenant_id);
CREATE INDEX idx_portal_clients_client_id ON public.portal_clients(client_id);

-- Helper SQL para RLS do portal (equivalente a jwt_tenant_id() para portal_clients)
CREATE OR REPLACE FUNCTION public.portal_jwt_tenant_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
AS $$
  SELECT NULLIF(
    ((SELECT current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata' ->> 'tenant_id'),
    ''
  )::UUID
$$;

CREATE OR REPLACE FUNCTION public.portal_jwt_client_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
AS $$
  SELECT pc.client_id
  FROM public.portal_clients pc
  WHERE pc.id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.portal_jwt_tenant_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.portal_jwt_client_id() TO authenticated, anon, service_role;

-- RLS
ALTER TABLE public.portal_clients ENABLE ROW LEVEL SECURITY;

-- Portal client só lê sua própria linha
CREATE POLICY "portal_clients_self_select" ON public.portal_clients
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Apenas service_role pode inserir (via createAdminClient no Server Action)
-- Nenhuma policy INSERT para authenticated — admin client bypassa RLS
```

**Nota:** A constraint `UNIQUE (client_id)` na tabela `portal_clients` garante que um cliente PF só pode ter uma conta no portal por tenant. Isso previne cadastros duplicados a nível de DB mesmo se houver race conditions no Server Action.

### Pattern 5: RLS para tabelas futuras do portal (Phases 3 e 4)

As policies das tabelas `policies`, `consortium_quotas`, `financial_entries` etc. que o portal precisa ler em Phases 3/4 usarão o padrão:

```sql
-- [VERIFIED: padrão estabelecido em migrations v1.0]
CREATE POLICY "policies_portal_client_select" ON public.policies
  FOR SELECT TO authenticated
  USING (
    -- Portal client: vê apenas suas próprias apólices
    client_id = (SELECT public.portal_jwt_client_id())
    AND tenant_id = (SELECT public.portal_jwt_tenant_id())
  );
```

Isso é preparatório — Phase 1 não cria essas policies, mas o padrão precisa estar documentado.

### Pattern 6: Zod Schema para cadastro do portal

```typescript
// [VERIFIED: padrão de src/lib/validations/cpf.ts + client-schemas.ts]
// src/lib/validations/portal-auth-schemas.ts

import { z } from 'zod'
import { validateCPF, stripCPF } from './cpf'

export const portalCadastroSchema = z.object({
  cpf: z
    .string()
    .transform(stripCPF)
    .refine((v) => validateCPF(v), 'CPF inválido'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres'),
  slug: z.string().min(1),
})

export const portalLoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  slug: z.string().min(1),
})

export type PortalFormError = Record<string, string[]>
```

### Anti-Patterns to Avoid

- **Não verificar CPF apenas com RLS no admin client.** O `createAdminClient()` bypassa RLS — sempre usar `.eq('tenant_id', tenantId)` explícito antes de qualquer query de verificação.
- **Não colocar `tenant_id` no `user_metadata`.** Apenas `app_metadata` — conforme D-11 e padrão do v1.0. `user_metadata` pode ser modificado pelo próprio usuário.
- **Não reutilizar `loginWithPassword` do sistema interno.** Criar `loginPortalClient` separado, pois o redirect pós-login é diferente (`/{slug}/portal/home` vs `/{slug}/dashboard`).
- **Não deixar a slug exclusivamente na URL para detecção de tenant no middleware.** Portal_clients precisam do `portal_slug` no JWT para o middleware poder redirecionar D-07 corretamente quando a URL não tem slug.
- **Não fazer o middleware ler `portal_clients` table para verificar o tenant.** Queries de banco no middleware de Next.js são perigosas para performance e latência em cold starts. O `portal_slug` no JWT elimina essa necessidade.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validação CPF | Implementar módulo-11 do zero | `validateCPF` em `src/lib/validations/cpf.ts` | Já implementado, testado, com rejeição de sequências iguais |
| Gestão de sessão do portal | Cookie manual ou localStorage | `@supabase/ssr` + `createClient()` | Mesma infra do sistema interno; tokens auto-refreshed via middleware |
| Criação de usuário portal | INSERT direto em `auth.users` | `admin.auth.admin.createUser()` | Único método seguro; garante hash de senha e estrutura JWT |
| Formatação de CPF no input | Implementação própria de mask | Input controlado com `formatCPF` de `src/lib/validations/cpf.ts` | Já disponível no codebase |
| Rate limiting de CPF | Middleware custom com Redis | Vercel Edge Rate Limiting (nativo no Vercel) ou simplesmente timeout de Server Action | Complexidade desnecessária em v1.1 |

---

## Common Pitfalls

### Pitfall 1: portal_client cai no branch "incomplete onboarding"
**What goes wrong:** `updateSession` verifica `!tenantId || !userSlug` e redireciona para `/cadastro`. Portal_clients têm `tenant_id` e `portal_slug` no JWT mas não `slug` (campo do sistema interno).
**Why it happens:** O type `AppClaims` não inclui `portal_client` como role possível e o branch assume que todo usuário sem `slug` está em onboarding incompleto.
**How to avoid:** (1) Adicionar `'portal_client'` ao union type de `role` em `AppClaims`. (2) Detectar `isPortalClient` antes dos checks de `tenantId`/`userSlug`. (3) Colocar `portal_slug` em `app_metadata` ao criar o usuário.
**Warning signs:** Redirect loop de portal_client para `/cadastro` ao tentar acessar `/{slug}/portal/login`.

### Pitfall 2: Verificação de CPF vaza informação sobre existência de cliente
**What goes wrong:** Retornar mensagens diferentes para "CPF não existe no sistema" vs "CPF desta corretora não encontrado" permite enumeração de CPFs.
**Why it happens:** Lógica de erro natural divide os casos.
**How to avoid:** Sempre retornar a mesma mensagem genérica: "CPF não encontrado para esta corretora." independente se o CPF existe em outro tenant ou não existe em lugar nenhum.
**Warning signs:** Código com dois `return error` diferentes para falha de CPF.

### Pitfall 3: RLS das tabelas internas não bloqueia portal_clients
**What goes wrong:** Portal_clients poderiam acessar dados de outros clientes do tenant via a API do Supabase.
**Why it happens:** As policies internas usam `jwt_tenant_id()` que retorna `tenant_id` do JWT. Portal_clients TÊM `tenant_id` no JWT — então `jwt_tenant_id()` retorna um valor válido!
**How to avoid:** Adicionar verificação de role nas policies existentes:
```sql
-- Adicionar a policies existentes que não devem ser acessíveis por portal_clients:
AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor','financeiro','visualizador')
```
**Avaliação:** Verificar nas migrations existentes se alguma policy `FOR SELECT` não faz check de role. `clients_select` já verifica role — mas policies mais permissivas (ex: `pipeline_stages_select`) podem não fazer.
**Warning signs:** Portal_client conseguindo acessar `/api/[slug]/export` ou dados de clientes de outros clientes do portal.

### Pitfall 4: Race condition no cadastro de portal_client
**What goes wrong:** Dois cadastros simultâneos com o mesmo CPF criam dois usuários Supabase Auth, mas o segundo `INSERT portal_clients` falha pelo `UNIQUE(client_id)`.
**Why it happens:** O check de existência em step 3 (`SELECT portal_clients WHERE client_id = ?`) e o INSERT posterior não são atômicos.
**How to avoid:** A constraint `UNIQUE(client_id)` captura a race condition. O Server Action deve fazer rollback do auth user se o INSERT em `portal_clients` falhar com `23505` (unique violation) — tratando como "já existe conta".
**Warning signs:** Usuários orfãos em `auth.users` sem linha correspondente em `portal_clients`.

### Pitfall 5: Middleware de portal NÃO está no matcher
**What goes wrong:** Rotas `/{slug}/portal/**` não passam pelo middleware e ficam desprotegidas.
**Why it happens:** O matcher atual em `src/middleware.ts` exclui apenas `/api`, `/_next/static`, etc. — tecnicamente as rotas do portal já são cobertas. Mas é preciso validar.
**How to avoid:** Verificar que o matcher em `src/middleware.ts` cobre `/{slug}/portal/**`. O matcher atual:
```typescript
'/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
```
Cobre rotas do portal — mas confirmar que o middleware lida corretamente com usuários anônimos tentando acessar `/{slug}/portal/home`.
**Warning signs:** `/{slug}/portal/home` acessível sem autenticação.

### Pitfall 6: slug do portal_client no middleware quando usuário está fora do portal
**What goes wrong:** Um portal_client logado navega para `/{slug}/dashboard` (rota interna). O middleware precisa redirecionar para `/{slug}/portal/home` (D-07). Para construir o redirect URL, precisa do slug.
**Why it happens:** O slug vem de `app_metadata.slug` para usuários internos. Portal_clients não têm `slug` no JWT — precisam de `portal_slug`.
**How to avoid:** Ao criar o portal_client (step 4 do Server Action), incluir `portal_slug: slug` no `app_metadata`. No middleware, quando `isPortalClient`, usar `appMeta.portal_slug` para construir o redirect URL.
**Warning signs:** Redirect para `undefined/portal/home` ou erro 404 quando portal_client tenta acessar rota interna.

### Pitfall 7: Middleware slug mismatch quebra portal_client
**What goes wrong:** O bloco atual "slug ownership" (linha 144 do middleware) compara `urlSlug !== userSlug`. Para portal_clients, `userSlug` é `undefined` (não está no JWT), então qualquer slug de URL vai fazer mismatch e redirecionar para `/{undefined}/...`.
**Why it happens:** O branch "slug ownership" não exclui portal_clients.
**How to avoid:** O check de `isPortalClient` deve fazer `return supabaseResponse` antes de chegar no bloco de slug ownership. Isso já fica garantido se o branch de portal_client no início do middleware retornar cedo.

### Pitfall 8: `as any` para `portal_clients` no Supabase client
**What goes wrong:** `database.types.ts` é hand-authored e não inclui `portal_clients`. Queries TypeScript falham na compilação.
**Why it happens:** `supabase gen types typescript` não foi executado (aguardando credenciais de prod).
**How to avoid:** Padrão já estabelecido no v1.0 (STATE.md): usar `supabase as any` para tabelas não em `database.types.ts`, e adicionar o tipo hand-authored ao arquivo. Adicionar `portal_clients` ao `database.types.ts` na migration task.

---

## Code Examples

### Middleware estendido (trecho crítico)

```typescript
// [VERIFIED: codebase — src/lib/supabase/middleware.ts]
// Inserir ANTES do check "!tenantId || !userSlug":

const role = appMeta.role
const isPortalClient = role === 'portal_client'

if (isPortalClient) {
  const portalSlug = appMeta.portal_slug
  const isPortalRoute = /^\/[^/]+\/portal(\/.*)?$/.test(pathname)
  const isPortalAuthRoute = /^\/[^/]+\/portal\/(login|cadastro)/.test(pathname)

  if (!isPortalRoute) {
    // D-07: portal_client fora do portal → /{portal_slug}/portal/home
    const url = request.nextUrl.clone()
    url.pathname = portalSlug ? `/${portalSlug}/portal/home` : '/login'
    url.search = ''
    return redirectWithCookies(url, supabaseResponse)
  }

  if (isPortalAuthRoute) {
    // Já logado e tentando acessar login/cadastro → home
    const url = request.nextUrl.clone()
    url.pathname = portalSlug ? `/${portalSlug}/portal/home` : '/login'
    url.search = ''
    return redirectWithCookies(url, supabaseResponse)
  }

  return supabaseResponse
}

// Bloco adicional: bloquear usuários internos no portal (D-08)
// Inserir ANTES do return final:
const isPortalRoute = /^\/[^/]+\/portal(\/.*)?$/.test(pathname)
if (isPortalRoute && !isPortalClient) {
  const url = request.nextUrl.clone()
  url.pathname = userSlug ? `/${userSlug}/dashboard` : '/login'
  url.search = ''
  return redirectWithCookies(url, supabaseResponse)
}
```

### Anon user em rota de portal (login/cadastro são públicas)

```typescript
// Portal login e cadastro são rotas públicas — anon pode acessar para fazer login/cadastro
// O check de anon user (step 1 do middleware) precisa excluir /{slug}/portal/login e /{slug}/portal/cadastro

const isPortalAuthRoute = /^\/[^/]+\/portal\/(login|cadastro)$/.test(pathname)

// No branch de anon (!claims):
if (!claims) {
  if (isAuthRoute(pathname) || pathname === '/' || pathname === '/trial-expirado' || isPortalAuthRoute) {
    return supabaseResponse  // deixar passar
  }
  // ... redirect para /login
}
```

### Login do portal (Server Action)

```typescript
// [VERIFIED: padrão de src/lib/actions/auth.ts loginWithPassword]
export async function loginPortalClient(
  formData: FormData,
): Promise<{ error?: PortalFormError } | void> {
  const parsed = portalLoginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as PortalFormError }
  }

  const { email, password, slug } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: { _form: ['E-mail ou senha incorretos.'] } }
  }

  // Verificar que é um portal_client (não um usuário interno tentando o portal)
  const role = data.user?.app_metadata?.role
  if (role !== 'portal_client') {
    await supabase.auth.signOut()
    return { error: { _form: ['Acesso não autorizado ao portal.'] } }
  }

  redirect(`/${slug}/portal/home`)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` | 2024 | Pacote auth-helpers deprecado — projeto já usa `@supabase/ssr` |
| `supabase.auth.getClaims` como experimental | Padrão com fallback para `getUser()` | v1.0 | Codebase já tem o fallback implementado em `readClaims()` |
| Múltiplos projetos Supabase por tipo de usuário | Mesmo projeto + role no JWT | Decisão de design D-01 | Zero custo adicional, auth compartilhada |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Portal_clients não precisam de `tenant_id` em `app_metadata` além de `portal_slug` para o middleware funcionar | Architecture Patterns / Pattern 1 | Se errado: helper SQL `portal_jwt_tenant_id()` pode ler errado; ajustar para usar `tenant_id` no JWT diretamente (mais eficiente) |
| A2 | `admin.auth.admin.createUser` com `email_confirm: true` não dispara email de confirmação | Pattern 3 (Server Action) | Se errado: o usuário não consegue logar imediatamente pós-cadastro; verificar flag `email_confirm` vs custom SMTP |
| A3 | `portal_slug` em `app_metadata` não conflita com o campo `slug` já usado por usuários internos | Pattern 1 / Pattern 2 | Nomes distintos (`slug` vs `portal_slug`) — sem conflito esperado |

**Clarificação sobre A1:** A recomendação é colocar AMBOS `tenant_id` E `portal_slug` no `app_metadata` do portal_client. O `tenant_id` é necessário para a função helper `portal_jwt_tenant_id()` (idêntica a `jwt_tenant_id()` — lê do JWT). Isso evita queries de banco no middleware.

---

## Open Questions (RESOLVED)

1. **Policies internas precisam de check de role adicional?**
   - O que sabemos: `clients_select` verifica role (`IN ('admin','financeiro','visualizador')` ou `assigned_to = auth.uid()`). Portal_clients têm `role = 'portal_client'` — não passam em nenhum dos dois checks. Seguro.
   - O que é incerto: Outras policies mais permissivas (ex: `pipeline_stages_select` que só verifica `tenant_id`) — portal_clients terão `tenant_id` no JWT e PASSARIAM. É intencional? Para Phase 1, pipeline_stages não são usados pelo portal, mas tecnicamente acessíveis via API.
   - Recommendation: Auditar policies sem check de role. Adicionar `AND (SELECT public.jwt_tenant_role()) != 'portal_client'` onde necessário. Ou usar `IN ('admin','corretor','financeiro','visualizador')` como allowlist.

2. **Constraint `UNIQUE(client_id)` em `portal_clients` — PJ também pode ter conta?**
   - O que sabemos: CPF é exclusivo de PF. D-04 especifica CPF como campo de verificação.
   - O que é incerto: Um cliente PJ pode querer acessar o portal no futuro? A constraint deve ser `UNIQUE(client_id)` ou `UNIQUE(tenant_id, client_id)`?
   - Recommendation: `UNIQUE(client_id)` — um cliente só tem um registro, independente do tenant (mas client_id já é único no sistema). Se multi-tenant for relevante: `UNIQUE(tenant_id, client_id)`.

3. **`portal_clients.id = auth.users.id` — usar CASCADE DELETE?**
   - O que sabemos: `profiles` usa `ON DELETE CASCADE` referenciando `auth.users`.
   - O que é incerto: Se o admin deletar um portal_client do Supabase Auth, o CASCADE limpa `portal_clients`. Isso é desejável?
   - Recommendation: Sim, CASCADE é correto — evita linhas orfãs. Incluir na migration.

---

## Environment Availability

Step 2.6: SKIPPED (fase é puramente code/config + migration SQL sem ferramentas externas além de Supabase já configurado no projeto)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Nenhum detectado no projeto (sem jest.config, vitest.config, pytest.ini) |
| Config file | Nenhum |
| Quick run command | `npx tsc --noEmit` (type check) |
| Full suite command | `npx tsc --noEmit && npx next build` |

**Nota:** O projeto v1.0 não tem testes automatizados. A estratégia de validação é type-check + smoke test manual. O planner deve incluir Wave 0 de configuração de teste mínima (type check) se quiser validação automatizada.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-01 | Cadastro portal_client por CPF cria usuário Supabase Auth | manual-smoke | — | ❌ |
| REQ-02 | CPF inválido (módulo-11) rejeitado no formulário | unit (Zod) | `npx tsc --noEmit` | ❌ |
| REQ-03 | CPF não cadastrado na corretora retorna erro genérico | manual-smoke | — | ❌ |
| REQ-04 | Login portal_client redireciona para /{slug}/portal/home | manual-smoke | — | ❌ |
| REQ-05 | Usuário interno bloqueado em /{slug}/portal/** | manual-smoke | — | ❌ |
| REQ-06 | portal_client bloqueado em /{slug}/dashboard | manual-smoke | — | ❌ |
| REQ-07 | TypeScript compila sem erros após extensão do middleware | type-check | `npx tsc --noEmit` | ❌ |
| REQ-08 | Duplo cadastro com mesmo CPF bloqueado (DB constraint) | manual-smoke | — | ❌ |

### Sampling Rate

- **Por task commit:** `npx tsc --noEmit`
- **Por wave merge:** `npx tsc --noEmit && npx next build`
- **Phase gate:** Build verde + smoke test manual dos 4 fluxos (cadastro, login, redirect D-07, redirect D-08)

### Wave 0 Gaps

- [ ] Nenhuma infra de test existe — apenas TypeScript check. Aceitável para este projeto.
- [ ] Type-check deve passar após cada task: `npx tsc --noEmit`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email+senha), `admin.auth.admin.createUser` |
| V3 Session Management | yes | `@supabase/ssr` cookie-based, 1h access token + auto-refresh |
| V4 Access Control | yes | Middleware role check + RLS policies |
| V5 Input Validation | yes | Zod schema no Server Action (CPF módulo-11, email, senha) |
| V6 Cryptography | no (delegado) | Supabase Auth gerencia hash de senha (bcrypt) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CPF enumeration via cadastro | Information Disclosure | Mensagem de erro genérica — D-05 / D-11 |
| Usuário interno acessando portal_client data | Elevation of Privilege | Middleware D-08 + RLS `portal_clients_self_select` |
| portal_client acessando dados de outros clientes | Elevation of Privilege | RLS `portal_clients_self_select` + `jwt_portal_client_id()` |
| portal_client acessando sistema interno | Elevation of Privilege | Middleware D-07 + role check em `loginPortalClient` |
| Open redirect no login do portal | Spoofing | Não implementar `?next=` no portal em Phase 1 (sem redirects externos) |
| Força bruta em login do portal | DoS / Account Enumeration | Supabase Auth tem rate limiting nativo por IP (sem config adicional necessária) |
| Bypass de verificação CPF via manipulação de formData | Tampering | Verificação acontece no Server Action (server-side), nunca no cliente |
| Race condition no cadastro (duplo CPF) | Tampering | `UNIQUE(client_id)` constraint na tabela `portal_clients` |

### Supabase Auth Rate Limiting

[ASSUMED] Supabase Auth tem proteção nativa contra força bruta em `signInWithPassword` (429 após N tentativas). Verificar nas configurações do projeto Supabase Dashboard (Authentication > Rate Limits) se os limites padrão são adequados para o portal.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/supabase/middleware.ts` — lógica atual de `updateSession`, `AppClaims` type, `readClaims()` function [VERIFIED: codebase]
- Codebase: `src/lib/actions/auth.ts` — padrão de Server Action com `createAdminClient()`, rollback, redirect [VERIFIED: codebase]
- Codebase: `src/lib/validations/cpf.ts` — `validateCPF`, `stripCPF`, `formatCPF` [VERIFIED: codebase]
- Codebase: `supabase/migrations/20260420_0002_rls_helpers.sql` — padrão de helper SQL `(SELECT ...)` [VERIFIED: codebase]
- Codebase: `supabase/migrations/20260420_0003_rls_policies.sql` — padrão RLS com `(SELECT public.jwt_...)` [VERIFIED: codebase]
- Codebase: `supabase/migrations/20260420_0006_clients_schema.sql` — schema de `clients` (coluna `document`, não `cpf_cnpj`) [VERIFIED: codebase]
- Codebase: `package.json` — versões instaladas: @supabase/ssr ^0.10.2, next ^15.3.9, zod ^3.25.76 [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- CLAUDE.md: padrão `app_metadata` exclusivamente para tenant/role, `service_role` nunca no cliente [VERIFIED: CLAUDE.md]
- CONTEXT.md: decisions D-01 a D-12 [VERIFIED: CONTEXT.md]
- STATE.md: workaround `supabase db query --linked -f` para migrations [VERIFIED: STATE.md]

### Tertiary (LOW confidence)
- [ASSUMED] Supabase Auth rate limiting nativo — não verificado em dashboard/docs nesta sessão
- [ASSUMED] `email_confirm: true` em `admin.auth.admin.createUser` suprime email de confirmação completamente

---

## Project Constraints (from CLAUDE.md)

Directives extraídas do CLAUDE.md que o planner DEVE verificar:

1. **Stack imutável:** Next.js + Supabase + Vercel. Sem outros providers de auth.
2. **Multi-tenancy:** Exclusivamente via RLS. Sem infra separada por tenant.
3. **`app_metadata` exclusivo** para `tenant_id`, `role`, `slug` — nunca `user_metadata` para dados de tenant/role.
4. **`service_role` nunca exposto ao cliente** — apenas em Server Actions e Edge Functions. `createAdminClient()` não pode ser importado em Client Components (ESLint rule + `server-only`).
5. **`@supabase/ssr`** (não `@supabase/auth-helpers` — deprecado).
6. **Migrations via `supabase db query --linked -f`** (não `supabase db push`) — workaround para date key collision.
7. **RLS com `(SELECT ...)` wrapper** em todas as USING clauses — previne plan invalidation.
8. **LGPD:** Sem URLs públicas permanentes para documentos. Dados no Brasil (sa-east-1 se disponível).
9. **Escala v1:** Suporte a até 5.000 clientes e 10.000 apólices por tenant — indexes em `portal_clients` necessários.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos os pacotes verificados em package.json do codebase
- Architecture: HIGH — baseado em leitura direta do middleware, actions e migrations existentes
- Pitfalls: HIGH — derivados da análise do código real, não de conhecimento genérico
- Security: MEDIUM — controles Supabase Auth (rate limiting) marcados como ASSUMED

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stack estável — Next.js 15 + Supabase não mudam breaking changes em 30 dias)
