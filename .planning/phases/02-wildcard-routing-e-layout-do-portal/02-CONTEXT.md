# Phase 2: Wildcard Routing e Layout do Portal - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Adicionar wildcard subdomain routing ao portal do cliente (`acme.nexus.app/portal/**`) usando rewrite transparente no middleware Next.js, e dar ao portal um layout visual completo com identidade da corretora (header com logo/nome, top nav placeholder, perfil do usuário).

**Fora do escopo desta fase:**
- Views de apólices, consórcio e financeiro (Phase 3)
- Upload/download de PDFs (Phase 4)
- Domínios customizados por corretora (v1.2+)
- Ativação dos itens de nav (Phase 3/4 ativa conforme as páginas existem)

</domain>

<decisions>
## Implementation Decisions

### Wildcard Routing — Estratégia

- **D-01:** Rewrite de subdomínio acontece em `src/middleware.ts` **antes** de chamar `updateSession`. Separação clara de responsabilidades: middleware.ts lida com subdomain → updateSession lida com auth/routing.

- **D-02:** URL visível para o usuário: `acme.nexus.app/portal/home` — slug aparece **só no subdomínio**, nunca duplicado no path. Internamente o Next.js processa `/acme/portal/home` via `NextResponse.rewrite()` transparente.

- **D-03:** Ativação do wildcard via variável de ambiente `NEXT_PUBLIC_BASE_DOMAIN`:
  - Definido (ex: `nexus.app`): middleware detecta subdomínio, extrai slug do `host` header, faz rewrite para `/{slug}/portal/**`
  - Ausente/vazio: path-based funciona normalmente — modo desenvolvimento local sem configuração adicional

- **D-04:** Em produção com `BASE_DOMAIN` definido, path-based URLs (`nexus.app/acme/portal/home`) **funcionam ou redirecionam automaticamente** para o subdomínio — detecção via presença do segmento `/{slug}` no path antes de `/portal/`. Se o host não for subdomínio do `BASE_DOMAIN`, a request é tratada como path-based (fallback seguro).

### Segurança — CR-01 Fix (incluído no escopo)

- **D-05:** No branch `isPortalClient` do middleware (`src/lib/supabase/middleware.ts`), após confirmar que é rota `/portal/**`, validar que o slug extraído da URL (ou inferido do rewrite em `src/middleware.ts` via header `x-portal-slug`) coincide com `appMeta.portal_slug` do JWT. Se divergir → redirecionar para `/${appMeta.portal_slug}/portal/home`. Implementar junto com o wildcard routing pois os dois mexem no mesmo bloco do middleware.

- **D-06:** WR-01 (também do code review Phase 1) — `loginPortalClient` redireciona usando `slug` do formulário. Corrigir para usar `portal_slug` do JWT pós-autenticação. Incluir no escopo desta phase junto com D-05.

### Layout do Portal

- **D-07:** Adicionar coluna `logo_url TEXT` na tabela `tenants` via nova migration. Permite corretoras configurarem logo do portal. Valor `NULL` aceitável — header exibe só o nome nesse caso.

- **D-08:** Header do portal exibe:
  - Logo da corretora (`tenants.logo_url`) se existir, caso contrário só o nome
  - Nome da corretora (`tenants.name`) sempre visível
  - Layout: logo + nome à esquerda, perfil do usuário à direita

- **D-09:** Top nav com itens placeholder desabilitados em Phase 2. Itens:
  **Início · Minhas Apólices · Meu Consórcio · Financeiro · Documentos**
  - "Início" ativo (rota `/portal/home` existe)
  - Demais itens visualmente presentes mas disabled/cinza — Phase 3 e 4 ativam conforme as rotas existem

- **D-10:** Canto superior direito do header: avatar/nome do cliente (ler do perfil Supabase Auth ou `portal_clients`) + dropdown com opção "Sair". Usar `createClient().auth.getUser()` em Server Component para buscar dados do usuário logado.

### Ambiente e Configuração

- **D-11:** Configuração Vercel para wildcard domain: adicionar `*.nexus.app` como domínio no projeto Vercel (painel). O middleware faz o roteamento — sem necessidade de `vercel.json` rewrites. Documentar no SUMMARY como passo manual pós-deploy.

- **D-12:** Em desenvolvimento local: usar path-based (`localhost:3000/acme/portal/home`) — zero config. Para quem quiser testar wildcard local, pode editar `/etc/hosts` e adicionar `127.0.0.1 acme.localhost` + definir `NEXT_PUBLIC_BASE_DOMAIN=localhost` (Claude's Discretion na documentação).

### Claude's Discretion

- Como o middleware passa o slug extraído do subdomínio para `updateSession`: injetar header `x-portal-slug` via `NextResponse.next({ headers: { 'x-portal-slug': slug } })` ou via `request.nextUrl.pathname` reescrito. Escolher a abordagem mais limpa após ler o código existente.
- Posicionamento exato do header no layout: sticky ou fixed-top conforme melhor UX.
- Upload de logo na corretora (interface de configurações): Claude's Discretion na Phase 2 — se não houver tela de config ainda, o campo existe no banco mas só é populável via admin/SQL no v1.1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth e Middleware Existentes (Phase 1)
- `src/middleware.ts` — entry point atual; Phase 2 adiciona lógica de subdomínio ANTES de `updateSession`
- `src/lib/supabase/middleware.ts` — `updateSession` com branches portal_client (D-05 aplica aqui o slug validation fix)
- `src/lib/actions/portal-auth.ts` — `loginPortalClient` a ser corrigido (D-06: redirecionar via JWT portal_slug)

### Rotas e Layout do Portal (Phase 1)
- `src/app/(portal)/[slug]/portal/layout.tsx` — layout base a ser expandido com header, nav, perfil
- `src/app/(portal)/[slug]/portal/home/page.tsx` — página de destino pós-login (nav "Início" aponta aqui)

### Schema do Banco
- `supabase/migrations/20260420_0001_foundation_schema.sql` — tabela `tenants` (adicionar `logo_url` via nova migration)
- `supabase/migrations/20260504_1635_001_portal_clients.sql` — tabela `portal_clients` (referência para buscar dados do cliente logado)

### Decisões de Phase 1
- `.planning/phases/01-auth-do-portal/01-CONTEXT.md` — D-02 (path prefix, Phase 2 adiciona subdomínio por cima), D-12 (rotas existentes)
- `.planning/phases/01-auth-do-portal/01-REVIEW.md` — CR-01 e WR-01 a corrigir nesta phase

### Projeto e Requisitos
- `.planning/PROJECT.md` §Active (v1.1) — "URL por subdomínio da corretora (wildcard routing no Vercel + middleware)"
- `.planning/STATE.md` — estado atual do projeto

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/middleware.ts` — entry point simples (5 linhas); adicionar lógica de subdomínio antes da chamada `updateSession`
- `src/lib/supabase/middleware.ts` — `updateSession` existente com branch `isPortalClient`; adicionar slug validation (D-05)
- `src/lib/supabase/admin.ts` — `createAdminClient()` para buscar `tenants.name` e `logo_url` server-side
- `src/lib/supabase/server.ts` — `createClient()` para `auth.getUser()` no Server Component de layout
- Componentes shadcn/ui disponíveis: `DropdownMenu`, `Avatar`, `NavigationMenu` — reutilizáveis no header/nav

### Established Patterns
- `app_metadata.portal_slug` no JWT — disponível em `updateSession` via `appMeta.portal_slug`
- Server Components para data fetching no layout — sem TanStack Query para SSR layouts
- `(portal)/[slug]/portal/` route group — slug vem de `params.slug` nas páginas (o rewrite transparente mantém isso)

### Integration Points
- `src/middleware.ts`: adicionar bloco de detecção de subdomínio no topo da função `middleware`
- `src/lib/supabase/middleware.ts`: adicionar slug validation no branch `isPortalClient` (D-05)
- `src/app/(portal)/[slug]/portal/layout.tsx`: expandir para incluir header completo com dados do tenant
- `supabase/migrations/`: nova migration adicionando `logo_url TEXT` em `public.tenants`

</code_context>

<specifics>
## Specific Ideas

- Subdomain extraction: `request.headers.get('host')?.split('.')[0]` — se o resultado for diferente de `www` e do domínio base, é um slug válido
- O header `x-portal-slug` injetado em `src/middleware.ts` pode ser lido em `updateSession` para evitar re-parsing do host — evita duplicação de lógica
- Configuração Vercel: `*.nexus.app` via painel Vercel (não via código) — documentar como passo de deploy obrigatório no SUMMARY

</specifics>

<deferred>
## Deferred Ideas

- Domínios customizados por corretora (ex: `portal.acme.com.br`) — v1.2+; requer mapeamento DNS + tabela `tenant_domains`
- Interface de upload de logo no painel de configurações da corretora — coluna existe mas UI de admin fica para v1.2
- Wildcard local com `acme.localhost` — documentado como opção avançada, não obrigatório

</deferred>

---

*Phase: 02-wildcard-routing-e-layout-do-portal*
*Context gathered: 2026-05-05*
