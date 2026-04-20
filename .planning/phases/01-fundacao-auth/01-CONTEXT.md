# Phase 1: Fundação & Auth — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregar a fundação multi-tenant completa: registro de corretoras (tenant onboarding), autenticação de usuários, controle de acesso por papel (RBAC) e isolamento total de dados via Supabase RLS. Esta fase não inclui nenhum módulo de negócio (clientes, apólices, consórcio) — apenas a estrutura que todos os outros módulos dependem.

</domain>

<decisions>
## Implementation Decisions

### URL & Tenant Routing

- **D-01:** Domínio único para todas as corretoras — `app.nexusagent.com.br`. Sem subdomínio por tenant.
- **D-02:** Tenant identificado por slug na URL: `app.nexusagent.com.br/[slug]/dashboard`. Slug definido no cadastro da corretora.
- **D-03:** Middleware Next.js detecta o slug da URL e injeta o tenant_id na sessão/contexto da requisição.

### Onboarding da Corretora (Tenant Registration)

- **D-04:** Registro em wizard de 3 steps:
  - Step 1: Dados da empresa — Nome da corretora, CNPJ, segmento (seguros / consórcio / ambos)
  - Step 2: Usuário Admin — Nome completo, email, senha
  - Step 3: Plano / trial — Seleção do plano com trial de 14 dias gratuito
- **D-05:** CNPJ validado por dígito verificador + enriquecido via API pública (ReceitaWS ou similar) — razão social preenchida automaticamente
- **D-06:** Trial de 14 dias com acesso completo após registro. Sem exigir cartão de crédito no início.
- **D-07:** Após trial expirar: bloqueio do acesso com tela de upgrade (não deletar dados).

### Convite de Usuários

- **D-08:** Admin convida corretores por email com magic link. Convidado clica no link, define sua senha e já entra no tenant correto automaticamente.
- **D-09:** Convite tem validade de 72 horas. Link de convite é de uso único.
- **D-10:** Admin pode reenviar convite expirado ou cancelar convite pendente.

### Papéis e Permissões (RBAC)

- **D-11:** Quatro papéis: `admin`, `corretor`, `financeiro`, `visualizador`

**Matriz de permissões:**

| Módulo / Ação | Admin | Corretor | Financeiro | Visualizador |
|---------------|-------|----------|------------|--------------|
| Clientes — criar/editar/ver | ✓ | próprios* | ✓ (ver) | ✓ (ver) |
| Apólices — criar/editar/ver | ✓ | próprias* | ✓ (ver) | ✓ (ver) |
| Consórcio — criar/editar/ver | ✓ | próprios* | ✓ (ver) | ✓ (ver) |
| Comissões — ver | ✓ | só as próprias | ✓ | ✗ |
| Financeiro — criar/editar/ver | ✓ | ✗ | ✓ | ✗ |
| Dashboards executivos | ✓ | só os próprios | ✓ | ✓ |
| Convidar usuários | ✓ | ✗ | ✗ | ✗ |
| Configurações do tenant | ✓ | ✗ | ✗ | ✗ |
| Excluir/arquivar registros | ✓ | ✗ | ✗ | ✗ |

*\*Corretor vê apenas clientes/apólices/cotas vinculados a ele, mas Admin pode configurar visibilidade compartilhada para toda a carteira da corretora (toggle nas configurações do tenant).*

- **D-12:** Registros NUNCA são excluídos fisicamente — soft delete com campo `deleted_at TIMESTAMPTZ`. Mantém histórico completo (LGPD-friendly). Apenas Admin pode arquivar.

### Visual das Telas de Auth

- **D-13:** Layout split-screen: lado esquerdo com visual/gradiente de marca, lado direito com o formulário.
- **D-14:** Tema base: shadcn/ui padrão. Personalização visual da marca adiada para fase de polish.
- **D-15:** Telas de auth a implementar: Login, Registro (wizard 3 steps), Recuperação de senha, Aceitar convite.

### Supabase Auth & RLS

- **D-16:** `@supabase/ssr` (não `@supabase/auth-helpers` — depreciado). `createServerClient` no middleware.ts para SSR.
- **D-17:** `tenant_id` armazenado em `app_metadata` do Supabase Auth (não `user_metadata` — editável pelo usuário). Injetado no JWT via Custom Access Token Hook (Edge Function).
- **D-18:** Helper PostgreSQL `auth.tenant_id()` extrai o tenant_id do JWT para uso em todas as RLS policies.
- **D-19:** Toda tabela de dados recebe `tenant_id UUID NOT NULL` + índice + RLS habilitado. CI check verifica cobertura de RLS a cada migration.
- **D-20:** `SUPABASE_SERVICE_ROLE_KEY` NUNCA em variável `NEXT_PUBLIC_*`. Uso exclusivo em Server Actions, API Routes e Edge Functions.

### Claude's Discretion

- Estrutura de pastas do projeto Next.js (App Router) — Claude decide seguindo convenções da comunidade
- Validação de formulários client-side — React Hook Form + Zod ou similar
- Animações/transições entre steps do wizard — Claude decide o que for mais suave

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth & Multi-tenancy
- `.planning/research/STACK.md` — Stack completa com padrão RLS, `@supabase/ssr`, Custom JWT Hook e anti-padrões de segurança
- `.planning/research/ARCHITECTURE.md` — Schema inicial (tabelas `tenants`, `profiles`), 8 domínios e ordem de build
- `.planning/research/PITFALLS.md` — 5 pitfalls críticos de RLS (data leak, service_role key, views sem security_invoker)

### Requirements
- `.planning/REQUIREMENTS.md` §Auth — AUTH-01 a AUTH-05

### Project Context
- `.planning/PROJECT.md` — Visão, core value, constraints (Next.js + Supabase + Vercel, mercado BR, LGPD)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum — projeto greenfield. Sem código existente.

### Established Patterns
- Nenhum estabelecido ainda. Esta fase define os padrões base que todas as outras seguirão.

### Integration Points
- Esta fase cria: `tenants` table, `profiles` table, middleware de roteamento, Supabase client factories (server/client/admin), RLS base policies
- Fases seguintes dependem de: tenant_id no JWT, helpers RLS, rotas autenticadas, sistema de papéis

</code_context>

<specifics>
## Specific Ideas

- URL pattern: `app.nexusagent.com.br/[slug]/dashboard` onde `[slug]` é o identificador único da corretora
- Wizard de registro com 3 steps bem definidos — não colapsar em formulário único mesmo que pareça mais simples
- ReceitaWS (ou BrasilAPI) para enriquecimento de CNPJ — gratuito, sem necessidade de conta
- Magic link de convite com 72h de validade e uso único
- Trial de 14 dias sem cartão — tela de upgrade após expirar, sem deletar dados

</specifics>

<deferred>
## Deferred Ideas

- White-label / domínio próprio por corretora — muito complexo para v1 (wildcard SSL, DNS automático)
- Customização de paleta de cores por corretora — fase de polish ou v2
- 2FA / autenticação com Google OAuth — v2 (Supabase suporta nativamente quando chegar a hora)
- Subdomínio por tenant (`corretora.nexus.com.br`) — adiado, domínio único é suficiente para v1

</deferred>

---

*Phase: 01-fundacao-auth*
*Context gathered: 2026-04-20*
