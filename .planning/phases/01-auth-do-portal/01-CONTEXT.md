# Phase 1: Auth do Portal - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Implementar o sistema de autenticação exclusivo para clientes finais das corretoras no Portal do Cliente. Isso inclui: tabela `portal_clients` no banco, auto-cadastro por CPF com verificação na base da corretora, login email/senha isolado do sistema interno, e separação de sessão via middleware.

**Fora do escopo desta fase:**
- Wildcard subdomain routing (Phase 2)
- Views de apólices, consórcio e financeiro (Phases 3 e 4)
- Upload/download de PDFs (Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Modelo de Auth
- **D-01:** Mesmo projeto Supabase — `app_metadata.role = 'portal_client'` no JWT. Zero custo adicional, toda a infra existente reutilizada. Clientes do portal são usuários normais do Supabase Auth, diferenciados pelo role.

### Identificação de Tenant (Phase 1)
- **D-02:** URL com path prefix: `/{slug}/portal/...` (ex: `nexus.app/acme/portal/login`). O slug está no path — extrai-se na Server Action de cadastro/login para associar ao tenant correto. Phase 2 adicionará subdomínio por cima sem quebrar este modelo.

### Fluxo de Cadastro
- **D-03:** Auto-cadastro direto por CPF — cliente acessa `/{slug}/portal/cadastro`, informa CPF, sistema verifica existência na tabela `clients` do tenant via `createAdminClient()`, cria conta Supabase Auth.
- **D-04:** Dados do formulário de cadastro: CPF (verificado), email (será o login Supabase), senha. O email não precisa estar na base da corretora — o que valida é o CPF.
- **D-05:** Verificação de CPF usa `createAdminClient()` (service_role) com `.eq('tenant_id', tenantId).eq('cpf_cnpj', cpf)` na tabela `clients`. Esta operação só ocorre em Server Action (nunca exposto ao cliente).

### Separação de Sessão
- **D-06:** Middleware identifica clientes do portal pelo `app_metadata.role === 'portal_client'`. Rotas do portal vivem em `/{slug}/portal/**`. Usuários internos nunca chegam a essas rotas; clientes do portal são barrados fora delas.
- **D-07:** Se um `portal_client` tentar acessar uma rota interna (`/{slug}/dashboard`, `/seguros`, etc.), o middleware redireciona para `/{slug}/portal/home`.
- **D-08:** Se um usuário interno (qualquer role ≠ `portal_client`) tentar acessar `/{slug}/portal/**`, middleware redireciona para `/{slug}/dashboard`.
- **D-09:** Duração de sessão: padrão Supabase (access token 1h + refresh automático). Sem configuração extra.

### RLS — Isolamento de Clientes do Portal
- **D-10:** Nova tabela `portal_clients` com colunas: `id` (FK auth.users), `tenant_id`, `client_id` (FK clients.id). RLS policies do portal usam `(SELECT pc.tenant_id FROM portal_clients pc WHERE pc.id = auth.uid())` como tenant_id — seguindo o padrão `(SELECT ...)` do v1.0 para prevenir plan invalidation.
- **D-11:** Usuários internos não têm linha em `portal_clients`. Clientes do portal não têm linha em `tenant_users`. As RLS das tabelas existentes do sistema interno NÃO precisam ser alteradas — o isolamento é garantido pelo fato de que portal_clients não têm tenant_id no JWT `app_metadata` das policies internas (eles têm role = portal_client, que as policies internas nunca autorizarão).

### Rotas do Portal (Phase 1)
- **D-12:** Rotas a criar: `/{slug}/portal/login`, `/{slug}/portal/cadastro`, `/{slug}/portal/home` (placeholder). Layout próprio do portal, separado do `(auth)/layout.tsx` e do `(app)/layout.tsx` do sistema interno.

### Claude's Discretion
- Formato de validação de CPF no formulário: reutilizar o utilitário de validação de CPF existente no codebase (v1.0 Phase 2 implementou).
- Tratamento de erro específico quando CPF não encontrado na base: mensagem genérica ("CPF não encontrado para esta corretora") sem revelar se o cliente existe ou não.
- Estrutura de diretório das rotas do portal: `src/app/(portal)/[slug]/portal/` ou estrutura similar que isole visualmente do `(app)` e `(auth)`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth e Middleware Existentes
- `src/lib/supabase/middleware.ts` — lógica de `updateSession`, estrutura de claims, padrão de redirect. A Phase 1 deve estender esta lógica, não substituí-la.
- `src/middleware.ts` — matcher e entry point. O novo matcher do portal precisa ser adicionado aqui.
- `src/lib/supabase/admin.ts` — `createAdminClient()` para operações server-side que bypassam RLS.
- `src/lib/supabase/server.ts` — `createClient()` para Server Components e Server Actions.

### Patterns de Auth do v1.0 (referência)
- `src/app/(auth)/login/login-form.tsx` — formulário de login existente como modelo de UI.
- `src/app/(auth)/cadastro/` — wizard de cadastro interno como referência de fluxo.
- `src/lib/actions/auth.ts` — Server Actions de auth existentes (padrões de validação e resposta).

### Requisitos e Contexto do Projeto
- `.planning/PROJECT.md` §Active (v1.1) — requisitos específicos do portal.
- `.planning/STATE.md` §Blockers/Concerns — lista os riscos técnicos já identificados.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/utils.ts` — funções utilitárias (cn, formatCurrency, etc.) reutilizáveis no portal.
- Validação de CPF: implementada em Phase 2 do v1.0 nos schemas Zod de clients. Reutilizar diretamente.
- `createAdminClient()`: disponível em `src/lib/supabase/admin.ts` — usar para verificar CPF na tabela `clients`.
- Componentes `shadcn/ui` (Input, Button, Form, Card) — todos disponíveis, portal usará o mesmo design system.

### Established Patterns
- `app_metadata` exclusivamente para dados de tenant/role — nunca `user_metadata`.
- Server Actions com Zod validation antes de qualquer operação de banco.
- `createAdminClient()` com `.eq('tenant_id', tenantId)` explícito — nunca confiar apenas em RLS no admin client.
- Rotas de auth agrupadas em `(auth)/` com layout próprio — portal seguirá o mesmo agrupamento `(portal)/`.

### Integration Points
- `src/middleware.ts`: adicionar bloco para rotas `/{slug}/portal/**` com lógica de role `portal_client`.
- `src/lib/supabase/middleware.ts` (`updateSession`): estender com branches para portal — ou extrair função `updatePortalSession` separada e compor.
- Nova tabela `portal_clients` no banco: migration Supabase necessária antes de qualquer Server Action do portal.

</code_context>

<specifics>
## Specific Ideas

- URL structure: `nexus.app/acme/portal/login` em Phase 1 → `acme.nexus.app/portal/login` em Phase 2 (Phase 2 adiciona o rewrite de subdomínio, as rotas Next.js continuam iguais).
- Verificação de CPF: Server Action retorna erro genérico se CPF não encontrado — sem distinguir "CPF não existe no sistema" de "CPF não cadastrado nesta corretora" (security by obscurity).

</specifics>

<deferred>
## Deferred Ideas

- Convite do corretor para o portal (Phase 1 só faz auto-cadastro) — pode ser adicionado em v1.2 se houver demanda.
- Email de confirmação pós-cadastro via Resend (v1.1 Phase 1 foca no fluxo funcional, email é nice-to-have).
- Recuperação de senha via email no portal — Supabase Auth tem suporte nativo, pode ser adicionado sem planning separado (Claude's Discretion na execução).

</deferred>

---

*Phase: 01-auth-do-portal*
*Context gathered: 2026-05-04*
