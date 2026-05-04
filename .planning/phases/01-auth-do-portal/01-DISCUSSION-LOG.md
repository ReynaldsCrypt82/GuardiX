# Phase 1: Auth do Portal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 01-auth-do-portal
**Areas discussed:** Modelo de Auth, Tenant no Phase 1, Fluxo de cadastro, Separação de sessão

---

## Modelo de Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo projeto, role portal_client | Um único projeto Supabase. app_metadata.role = 'portal_client'. RLS diferencia usuários internos de clientes. Zero custo adicional. | ✓ |
| Projeto Supabase separado | Dois projetos Supabase: isolamento máximo, mas 2x custo, 2x migrations, API entre projetos. | |

**User's choice:** Mesmo projeto, role portal_client
**Notes:** Decisão alinhada com o padrão já estabelecido no v1.0.

---

## Tenant no Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Path prefix /{slug}/portal/... | URL: nexus.app/{slug}/portal/login. Slug no path, middleware extrai. Compatible com estrutura existente. Phase 2 adiciona subdomínio por cima. | ✓ |
| Subdomínio desde Phase 1 | Implementar wildcard routing já em Phase 1. Antecipa Phase 2, acumula complexidade. | |
| Query param ?corretora=slug | URL feia, query param pode ser removido. Não é o destino final. | |

**User's choice:** Path prefix /{slug}/portal/...
**Notes:** Estratégia de migração clara: Phase 1 = path, Phase 2 = subdomínio + rewrite.

---

## Fluxo de Cadastro

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-cadastro por CPF | Cliente acessa /{slug}/portal/cadastro, informa CPF. Sistema verifica via createAdminClient, cria conta. | ✓ |
| Convite disparado pelo corretor | Corretor clica em 'Convidar para portal'. Email com link único. Mais controlado, exige ação do corretor. | |
| Ambos (auto-cadastro + convite) | Flexível, mas dobra a lógica e UI. | |

**User's choice:** Auto-cadastro por CPF

### Dados do cadastro

| Option | Description | Selected |
|--------|-------------|----------|
| CPF + email + senha | CPF verificado, email é o login Supabase, cliente cria senha. Email não precisa estar na base. | ✓ |
| Email da corretora + senha | Usa email que a corretora tem. Simples, mas frágil se email errado na base. | |
| CPF como login (sem email) | CPF + senha. Workaround necessário no Supabase Auth (email como identificador). | |

**User's choice:** CPF + email + senha

---

## Separação de Sessão

| Option | Description | Selected |
|--------|-------------|----------|
| Role portal_client + rotas separadas | Middleware verifica role. portal_client só acessa /{slug}/portal/**. Consistente com padrão existente. | ✓ |
| Cookies de sessão separados | Nome de cookie diferente para o portal. Isolamento completo, mas duplica config de clientes Supabase. | |

**User's choice:** Role portal_client + rotas separadas

### RLS do portal

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela portal_clients vinculada ao auth.users | Nova tabela portal_clients. RLS usa SELECT tenant_id FROM portal_clients WHERE id = auth.uid(). Tabelas internas não precisam ser alteradas. | ✓ |
| Apenas app_metadata.role no JWT | Mais simples. Mas exige adicionar 'AND role != portal_client' retroativamente em todas as policies internas. | |

**User's choice:** Tabela portal_clients vinculada ao auth.users
**Notes:** Abordagem mais segura — isolamento estrutural em vez de retroativo.

### Duração de sessão

| Option | Description | Selected |
|--------|-------------|----------|
| Padrão Supabase (1h + refresh auto) | Access token 1h, refresh token automático. Sem configuração adicional. | ✓ |
| Sessão curta (30 min, sem refresh) | Mais seguro, mas exige config custom e impacta UX. | |

**User's choice:** Padrão Supabase (1h + refresh auto)

---

## Claude's Discretion

- Formato de validação de CPF: reutilizar utilitário existente do v1.0
- Mensagem de erro de CPF não encontrado: genérica (sem revelar se cliente existe)
- Estrutura de diretórios: `(portal)/` agrupado separado de `(app)/` e `(auth)/`
- Recuperação de senha: Supabase nativo, sem planning separado

## Deferred Ideas

- Convite do corretor para o portal — v1.2 se houver demanda
- Email de confirmação pós-cadastro via Resend — nice-to-have em v1.1
