# Phase 2: CRM & Clientes — Research

**Researched:** 2026-04-24
**Domain:** CRM module — cadastro PF/PJ, pipeline de vendas, timeline de interações, tarefas de follow-up com notificação in-app
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Formulário de Cliente (CRM-01, CRM-02)**
- D-01: Um único formulário com toggle PF/PJ — URL única `/[slug]/clientes/novo`. Campos mudam conforme o tipo selecionado (CPF vs CNPJ, nome completo vs razão social/responsável).
- D-02: CPF sem enriquecimento automático. Apenas validação de dígito verificador (módulo-11, mesmo padrão do CNPJ já implementado em Phase 1). API pública de CPF não existe sem autenticação paga.
- D-03: Cadastro mínimo obrigatório: tipo (PF/PJ) + documento (CPF/CNPJ) + nome. Contatos (email, telefone) e endereço são opcionais — preenchidos depois na tela de detalhes.
- D-04: Corretor responsável é campo obrigatório no cadastro — select com lista de corretores ativos do tenant. Todo cliente nasce vinculado a um corretor.

**Listagem de Clientes (CRM-08, CRM-09)**
- D-05: Tabela paginada — reutiliza o componente `Table` do shadcn/ui já instalado. Colunas default: nome, tipo (badge PF/PJ), documento, corretor responsável, estágio do pipeline (badge colorido), data de cadastro.
- D-06: Busca inline debounced (400ms) no topo da tabela. Busca por nome, CPF ou CNPJ simultaneamente (sem precisar selecionar o tipo).
- D-07: Filtros inline visíveis acima da tabela (sem drawer): dropdowns para Corretor, Estágio do pipeline, Tipo (PF/PJ). Badge de "N filtros ativos" quando algum estiver selecionado.

**Pipeline de Vendas (CRM-05)**
- D-08: Pipeline visualizado como coluna de status na tabela — badge colorido com nome do estágio. Mudança de estágio via dropdown inline na tabela ou via select na tela de detalhes.
- D-09: Estágios completamente configuráveis por tenant — Admin pode adicionar e remover estágios via tela de configurações. Schema: tabela `pipeline_stages` com `tenant_id`, `name`, `color`, `position`, `is_closed`. Defaults ao criar tenant: Prospecção → Proposta → Aguardando → Fechado. Remoção de estágio com clientes realoca para o estágio default (primeiro da lista).

**Tela de Detalhes do Cliente**
- D-10: Tela de detalhes com abas: **Dados** | **Timeline** | **Tarefas** | **Apólices** (aba Apólices renderiza placeholder "Em breve" nesta fase). Layout: dados cadastrais no topo (card com nome, tipo, documento, corretor, estágio), abas abaixo.

**Timeline de Interações (CRM-03, CRM-04)**
- D-11: 5 tipos de interação: `ligação`, `email`, `reunião`, `WhatsApp`, `visita`. Cada tipo com ícone distinto na timeline.
- D-12: Registro de nova interação via botão "Registrar interação" → `Dialog` do shadcn/ui com: tipo (select), data/hora, descrição (textarea obrigatória). Server Action para salvar.
- D-13: Timeline em feed cronológico invertido (mais recente no topo). Cada item: ícone do tipo, data, usuário que registrou, descrição.

**Tarefas de Follow-up (CRM-06, CRM-07)**
- D-14: Tarefa vinculada a um cliente com: descrição, prazo (date picker), atribuída a (select de usuário do tenant, default = usuário atual).
- D-15: Notificação de follow-up vencendo — apenas in-app em v1: badge de contador no menu de navegação + toast quando o usuário abre o sistema. Email automático adiado para Phase 7.

**Permissões RBAC (herda Phase 1 — D-11)**
- Admin e Financeiro (somente leitura): veem todos os clientes do tenant.
- Corretor: vê apenas seus próprios clientes (tenant_id + corretor_id no RLS).
- Visualizador: vê todos, sem criar/editar.
- Soft delete obrigatório — campo `deleted_at TIMESTAMPTZ`.

### Claude's Discretion

- Paginação: tamanho de página default (25 ou 50 itens) — Claude decide.
- Animações de transição nas abas da tela de detalhes.
- Formatação de CPF/CNPJ na tabela (mascarado ou não).
- Cores default dos estágios do pipeline criados automaticamente ao registrar tenant.

### Deferred Ideas (OUT OF SCOPE)

- Busca global tipo Cmd+K (clientes + apólices + outros) — Phase 6 ou feature separada
- Notificação de follow-up por email — Phase 7 (requer job agendado: Supabase Cron ou Vercel Cron)
- Tipos de interação configuráveis por tenant — v2
- Importação de clientes via CSV — v2
- Kanban visual com drag-and-drop para pipeline — pode ser adicionado em v2 sem quebrar o schema
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRM-01 | Usuário pode cadastrar cliente PF com CPF, nome, contatos e endereço | D-01, D-02, D-03, D-04 — formulário único PF/PJ com validação módulo-11 CPF, campos opcionais para contatos/endereço |
| CRM-02 | Usuário pode cadastrar cliente PJ com CNPJ, razão social, responsável e contatos | D-01, D-02, D-03, D-04 — mesmo formulário com toggle; `validateCNPJ` existente reutilizável |
| CRM-03 | Usuário pode visualizar histórico de interações por cliente | D-10, D-13 — aba Timeline na tela de detalhes, feed cronológico invertido |
| CRM-04 | Usuário pode registrar interação manualmente na timeline do cliente | D-11, D-12 — 5 tipos, Dialog do shadcn/ui, Server Action com Zod |
| CRM-05 | Usuário pode mover cliente pelo pipeline de vendas | D-08, D-09 — dropdown inline na tabela e na tela de detalhes; `pipeline_stages` configurável por tenant |
| CRM-06 | Usuário pode criar tarefas de follow-up vinculadas a um cliente com data de prazo | D-14 — aba Tarefas na tela de detalhes, date picker, atribuição a usuário |
| CRM-07 | Sistema notifica usuário quando tarefa de follow-up está vencendo | D-15 — badge de contador no nav + toast no load; verificação via query no Server Component do layout |
| CRM-08 | Usuário pode buscar cliente por nome, CPF ou CNPJ | D-06 — busca debounced 400ms, PostgreSQL ilike ou full-text via trigram |
| CRM-09 | Usuário pode segmentar clientes por produto, corretor responsável e status | D-07 — filtros inline: Corretor, Estágio do pipeline, Tipo PF/PJ |
</phase_requirements>

---

## Summary

Phase 2 constrói o módulo CRM completo do NEXUS AGENT sobre a fundação multi-tenant estabelecida na Phase 1. O trabalho é predominantemente de UI e schema — 4 novas tabelas PostgreSQL com RLS, 5 rotas Next.js (listagem, novo cliente, detalhes, configurações de pipeline, settings), e um sistema de notificação in-app simples (badge + toast). Todos os padrões base já estão definidos e provados: RLS com `jwt_tenant_id()`, Server Actions com Zod, React Hook Form, tabela shadcn/ui, sonner para toasts.

O principal desafio técnico desta fase é a busca multi-campo debounced eficiente (nome + CPF + CNPJ em uma query) e o sistema de pipeline configurável por tenant com realocação segura ao remover estágios. A notificação in-app de follow-up exige uma query de "tarefas vencidas/vencendo hoje" executada no Server Component do layout — mínima mas suficiente para v1 sem job agendado.

CPF requer implementar o mesmo algoritmo módulo-11 já existente em `src/lib/validations/cnpj.ts`, com leve adaptação para 11 dígitos. A data-fns v4 (confirmado no `package.json`) cobre toda formatação de datas em pt-BR.

**Recomendação primária:** Seguir exatamente os padrões estabelecidos na Phase 1 — RLS com helpers existentes, Server Actions com Zod, sonner para toasts, shadcn/ui componentes. Nenhuma nova biblioteca necessária além das já instaladas.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|------------|-----------|
| Stack | Next.js 15 + Supabase + Vercel — não negociável |
| Multi-tenancy | RLS com `tenant_id` em toda tabela; helper `public.jwt_tenant_id()` em todas as policies |
| Mercado | Brasil — datas pt-BR, moeda BRL, LGPD aplicável |
| Auth | `@supabase/ssr` (não `@supabase/auth-helpers` — depreciado) |
| Permissões | `app_metadata` (não `user_metadata`) para tenant_id e role no JWT |
| ORM | Supabase JS client direto — sem Prisma, sem Drizzle |
| UI | shadcn/ui + Tailwind v4 — componentes já instalados no repo |
| Forms | React Hook Form 7.x + Zod 3.x |
| Soft delete | `deleted_at TIMESTAMPTZ` obrigatório — nunca DELETE físico por non-service_role |
| Service role | NUNCA em variável `NEXT_PUBLIC_*` — apenas Server Actions e Edge Functions |
| Escala v1 | 5.000 clientes/tenant, 10.000 apólices/tenant |

---

## Standard Stack

### Core (já instalado — confirmado em `package.json`)

| Library | Version | Purpose | Por que padrão |
|---------|---------|---------|----------------|
| Next.js | ^15.3.3 | Framework full-stack | App Router + Server Actions + Server Components |
| @supabase/ssr | ^0.10.2 | SSR client para Next.js | Padrão oficial — auth-helpers depreciado |
| @supabase/supabase-js | ^2.104.0 | SDK principal | Todas operações de banco |
| React Hook Form | ^7.73.1 | Formulários | Performance, integração Zod, padrão Phase 1 |
| Zod | ^3.25.76 | Validação de schema | Client + server compartilhado, Phase 1 pattern |
| sonner | ^2.0.7 | Toasts/notificações | Já integrado no layout via `<Toaster />` |
| date-fns | ^4.1.0 | Datas pt-BR | Modular, tree-shakeable, já instalado |
| Lucide React | ^1.8.0 | Ícones | Padrão shadcn/ui, Phone/Mail/Video/MessageCircle/MapPin para timeline |
| Zustand | ^5.0.12 | Estado de UI (filtros, search) | Já instalado, padrão projeto |
| TanStack Query | ^5.99.2 | Server state client-side | Já instalado — para inline stage dropdown |

[VERIFIED: package.json no repositório]

### Novos componentes shadcn/ui necessários

| Componente | Status | Uso |
|------------|--------|-----|
| `tabs.tsx` | NAO instalado — Wave 0 | Abas da tela de detalhes (Dados/Timeline/Tarefas/Apólices) |
| `textarea.tsx` | NAO instalado — Wave 0 | Campo descrição no Dialog de interação |
| `calendar.tsx` + `date-picker` | NAO instalado — Wave 0 | Prazo da tarefa (date picker) |
| `popover.tsx` | NAO instalado — Wave 0 | Base para date picker |
| `tooltip.tsx` | NAO instalado — Wave 0 | Ícones da timeline com label |
| `scroll-area.tsx` | NAO instalado — Wave 0 | Timeline feed com scroll interno |

[VERIFIED: `ls src/components/ui` — componentes ausentes confirmados]

**Instalação Wave 0:**
```bash
npx shadcn@latest add tabs textarea calendar popover tooltip scroll-area
```

### Alternativas Consideradas

| Em vez de | Poderia usar | Trade-off |
|-----------|-------------|-----------|
| Busca PostgreSQL ilike | pg_trgm (trigram) | trigram é mais preciso para buscas parciais; ilike é suficiente para busca por nome/CPF/CNPJ com índice — mais simples para v1 |
| Badge inline para pipeline | Kanban drag-and-drop | Kanban adiado para v2; badge na tabela é funcional e não quebra o schema |
| Toast (sonner) para notificações | Supabase Realtime | Realtime adiciona WebSocket; toast ao carregar é suficiente para v1 sem infra adicional |

---

## Architecture Patterns

### Estrutura de Rotas Recomendada

```
src/app/(app)/[slug]/
├── clientes/
│   ├── page.tsx                    # Listagem paginada com busca/filtros (Server Component)
│   ├── novo/
│   │   └── page.tsx                # Formulário novo cliente PF/PJ (Client Component)
│   └── [id]/
│       └── page.tsx                # Tela de detalhes com abas (Server Component + Client tabs)
├── configuracoes/
│   └── pipeline/
│       └── page.tsx                # Gerenciamento de estágios do pipeline

src/lib/
├── validations/
│   ├── cnpj.ts                     # Já existe — reutilizar
│   └── cpf.ts                      # NOVO — mesmo algoritmo, adaptado para 11 dígitos
├── actions/
│   ├── clients.ts                  # NOVO — createClient, updateClient, softDeleteClient
│   ├── interactions.ts             # NOVO — createInteraction
│   ├── tasks.ts                    # NOVO — createTask, completeTask
│   └── pipeline.ts                 # NOVO — updateClientStage, createStage, deleteStage

supabase/migrations/
├── 20260420_0006_clients_schema.sql          # clients, pipeline_stages tables
├── 20260420_0007_clients_rls.sql             # RLS policies para clients
├── 20260420_0008_interactions_tasks.sql      # client_interactions, client_tasks tables
├── 20260420_0009_interactions_tasks_rls.sql  # RLS policies para interactions e tasks
├── 20260420_0010_pipeline_defaults.sql       # Trigger para criar estágios default ao criar tenant
```

### Pattern 1: Validação de CPF (módulo-11 adaptado de cnpj.ts)

CPF usa o mesmo algoritmo módulo-11 do CNPJ, mas com pesos diferentes e 11 dígitos (9 base + 2 verificadores).

```typescript
// src/lib/validations/cpf.ts
// [VERIFIED: algoritmo módulo-11 CPF — mesmo padrão que cnpj.ts já testado]

export function stripCPF(cpf: string): string {
  return (cpf ?? '').replace(/\D/g, '')
}

export function formatCPF(cpf: string): string {
  const d = stripCPF(cpf).padStart(11, '0').slice(0, 11)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

export function validateCPF(cpf: string): boolean {
  const digits = stripCPF(cpf)
  if (digits.length !== 11) return false
  if (/^(\d)\1+$/.test(digits)) return false  // rejeita sequências iguais (000...000)

  const calcDigit = (input: string, len: number): number => {
    let sum = 0
    for (let i = 0; i < len; i++) {
      sum += parseInt(input[i], 10) * (len + 1 - i)
    }
    const remainder = (sum * 10) % 11
    return remainder >= 10 ? 0 : remainder
  }

  const d1 = calcDigit(digits, 9)
  const d2 = calcDigit(digits, 10)

  return parseInt(digits[9], 10) === d1 && parseInt(digits[10], 10) === d2
}
```

[ASSUMED: algoritmo CPF — padrão bem estabelecido, verificável contra cpf.js ou algoritmo Receita Federal publicado]

### Pattern 2: Schema PostgreSQL com RLS (herda Phase 1)

```sql
-- clients table — padrão estabelecido em Phase 1
CREATE TABLE public.clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  type          TEXT NOT NULL CHECK (type IN ('pf', 'pj')),
  document      CHAR(14) NOT NULL,              -- 11 dígitos CPF ou 14 dígitos CNPJ, sem máscara
  name          TEXT NOT NULL,                  -- nome completo (PF) ou razão social (PJ)
  responsible   TEXT,                           -- somente PJ: nome do responsável
  email         TEXT,
  phone         TEXT,
  address       JSONB,                          -- {street, number, complement, district, city, state, zip}
  stage_id      UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  assigned_to   UUID NOT NULL REFERENCES public.profiles(id),  -- corretor responsável
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: document único por tenant (não global — diferentes tenants podem ter mesmo cliente)
ALTER TABLE public.clients
  ADD CONSTRAINT clients_document_tenant_unique UNIQUE (tenant_id, document);

-- Indexes críticos para RLS performance (Pitfall 5 da Phase 1)
CREATE INDEX idx_clients_tenant_id    ON public.clients(tenant_id);
CREATE INDEX idx_clients_assigned_to  ON public.clients(assigned_to);
CREATE INDEX idx_clients_stage_id     ON public.clients(stage_id);
CREATE INDEX idx_clients_deleted_at   ON public.clients(deleted_at) WHERE deleted_at IS NULL;
-- Índice para busca por documento (CPF/CNPJ) — busca frequente
CREATE INDEX idx_clients_document     ON public.clients(document);

-- pipeline_stages — configurável por tenant
CREATE TABLE public.pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',  -- cor hex para o badge
  position    INTEGER NOT NULL,
  is_closed   BOOLEAN NOT NULL DEFAULT false,   -- estágio final (ganho/perdido)
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pipeline_stages_tenant_position
  ON public.pipeline_stages(tenant_id, position)
  WHERE deleted_at IS NULL;

-- client_interactions — timeline
CREATE TABLE public.client_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  client_id   UUID NOT NULL REFERENCES public.clients(id),
  type        TEXT NOT NULL CHECK (type IN ('ligacao','email','reuniao','whatsapp','visita')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SEM updated_at — interações são imutáveis após registro (audit trail)
);

CREATE INDEX idx_interactions_client_id  ON public.client_interactions(client_id);
CREATE INDEX idx_interactions_tenant_id  ON public.client_interactions(tenant_id);
CREATE INDEX idx_interactions_occurred_at ON public.client_interactions(occurred_at DESC);

-- client_tasks — follow-up
CREATE TABLE public.client_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id),
  client_id    UUID NOT NULL REFERENCES public.clients(id),
  description  TEXT NOT NULL,
  due_date     DATE NOT NULL,
  assigned_to  UUID NOT NULL REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_tenant_id   ON public.client_tasks(tenant_id);
CREATE INDEX idx_tasks_client_id   ON public.client_tasks(client_id);
CREATE INDEX idx_tasks_assigned_to ON public.client_tasks(assigned_to);
CREATE INDEX idx_tasks_due_date    ON public.client_tasks(due_date)
  WHERE completed_at IS NULL AND deleted_at IS NULL;
```

[ASSUMED: schema design — baseado nos padrões da Phase 1 e decisões do CONTEXT.md]

### Pattern 3: RLS Policies para clients (padrão Phase 1)

```sql
-- Habilitar RLS em todas as novas tabelas
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tasks         ENABLE ROW LEVEL SECURITY;

-- clients: Admin/Financeiro/Visualizador veem tudo do tenant
--          Corretor vê apenas os seus próprios
-- CRITICAL: (SELECT func()) para query plan caching — padrão da Phase 1
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro', 'visualizador')
      OR assigned_to = (SELECT auth.uid())
    )
  );

CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'corretor')
  );

CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (tenant_id = (SELECT public.jwt_tenant_id()));

-- pipeline_stages: todos leem, apenas admin gerencia
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
  );

CREATE POLICY "pipeline_stages_admin_manage" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );
```

[ASSUMED: policy design — segue exatamente os padrões de Phase 1 e a matriz RBAC da D-11]

### Pattern 4: Busca Multi-campo Debounced

A busca por nome, CPF ou CNPJ simultaneamente sem necessidade de selecionar o tipo requer `OR` com ilike no PostgreSQL. O approach mais simples para v1:

```typescript
// Server Component ou Server Action de busca
const { data } = await supabase
  .from('clients')
  .select(`
    id, name, type, document, email, phone,
    assigned_to ( id, full_name ),
    stage:pipeline_stages ( id, name, color )
  `)
  .is('deleted_at', null)
  .or(`name.ilike.%${query}%,document.ilike.%${stripDocument(query)}%`)
  .order('created_at', { ascending: false })
  .range(offset, offset + pageSize - 1)
```

**Nota:** `stripDocument(query)` remove pontuação (`.`, `-`, `/`) do input para buscar CNPJ/CPF sem máscara no banco, já que o banco armazena apenas dígitos.

[ASSUMED: query pattern — baseado em Supabase JS client docs e padrão do projeto]

### Pattern 5: Notificação In-App de Tarefas Vencendo

No Server Component do layout `(app)/layout.tsx` (ou em um componente filho carregado no top-level), fazer uma query de tarefas vencidas/vencendo hoje atribuídas ao usuário corrente:

```typescript
// src/components/auth/notification-badge.tsx (Server Component)
// Chamado dentro do layout já existente

const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

const { count } = await supabase
  .from('client_tasks')
  .select('*', { count: 'exact', head: true })
  .is('completed_at', null)
  .is('deleted_at', null)
  .eq('assigned_to', user.id)
  .lte('due_date', today)  // vencida ou vence hoje

// Exibir badge com count na sidebar
// Toast disparado client-side via Zustand store hidratado com o count
```

[ASSUMED: implementação de notificação — abordagem mais simples sem Realtime/job]

### Pattern 6: Pipeline Defaults ao Criar Tenant

Ao criar novo tenant (já acontece em `registerTenant` Server Action), também inserir os 4 estágios default via trigger PostgreSQL ou via Server Action:

```sql
-- Trigger para criar estágios default ao inserir novo tenant
CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.pipeline_stages (tenant_id, name, color, position, is_closed)
  VALUES
    (NEW.id, 'Prospecção',  '#3b82f6', 1, false),  -- azul
    (NEW.id, 'Proposta',    '#eab308', 2, false),  -- amarelo
    (NEW.id, 'Aguardando',  '#f97316', 3, false),  -- laranja
    (NEW.id, 'Fechado',     '#22c55e', 4, true);   -- verde
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenant_default_pipeline
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_pipeline_stages();
```

[ASSUMED: cores default — Prospecção azul, Proposta amarelo, Aguardando laranja, Fechado verde, conforme `<specifics>` do CONTEXT.md]

### Anti-Padrões a Evitar

- **Não usar `user_metadata` para checks de permissão:** O campo é editável pelo próprio usuário. Sempre usar `public.jwt_tenant_role()` que lê de `app_metadata`.
- **Não chamar `public.jwt_tenant_id()` diretamente nas cláusulas USING:** Sempre envolver em `(SELECT ...)` para habilitar query plan caching — padrão crítico da Phase 1.
- **Não retornar todos os clientes para filtrar no cliente:** Busca e filtros DEVEM acontecer no banco via query params na URL (searchParams do Next.js App Router).
- **Não armazenar CPF/CNPJ com máscara no banco:** Armazenar apenas dígitos (strip antes de INSERT). Formatar na UI conforme D-07 (discretion: formatado na tabela — decisão do planner).
- **Não usar `DELETE` em nenhuma tabela:** Soft delete obrigatório. O trigger `prevent_hard_delete()` já existe para `tenants` e `profiles` — replicar para as novas tabelas.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar Existente | Por quê |
|----------|--------------|----------------|---------|
| Validação CPF dígito verificador | Regex simples ou chamada a API | `validateCPF()` em `src/lib/validations/cpf.ts` (a criar, padrão de `cnpj.ts`) | Algoritmo módulo-11 tem edge cases (000.000.000-00 passa regex, falha no verifier) |
| Toast de notificação | Sistema custom de notification | `sonner` já integrado via `<Toaster />` no layout | Já instalado, zero config adicional |
| Date picker | Input type=date nativo | shadcn/ui `calendar` + `popover` | Input nativo tem UX inconsistente cross-browser, sem formatação pt-BR |
| Formatação de data | Lógica manual | `date-fns/format` com `ptBR` locale | Já instalado, handles timezones, locale |
| State de filtros/busca | Context API + useReducer | `useSearchParams` + URL state (Next.js) | Filtros na URL permitem bookmark, share, back/forward — padrão App Router |
| Realtime para notificação de tarefa | Supabase Realtime subscription | Query no load + toast (D-15) | Decisão de produto: email adiado para Phase 7; Realtime adiciona complexidade desnecessária em v1 |

---

## Common Pitfalls

### Pitfall 1: RLS com Corretor não vendo seus clientes

**O que dá errado:** Policy `clients_select` com `OR assigned_to = auth.uid()` não funciona se `auth.uid()` for chamado diretamente sem `SELECT`.
**Por que acontece:** PostgreSQL otimiza query plans e pode não reexecutar a função. O padrão da Phase 1 usa `(SELECT auth.uid())` para forçar avaliação correta.
**Como evitar:** Todas as chamadas a funções em cláusulas USING/WITH CHECK devem usar `(SELECT func())` — obrigatório desde a Phase 1.
**Sinal de alerta:** Corretor vê zero clientes ou vê clientes de outros corretores.

### Pitfall 2: Busca por CPF/CNPJ encontra zero resultados

**O que dá errado:** Usuário digita `123.456.789-01` na busca, banco armazena `12345678901` — ilike não encontra.
**Por que acontece:** Banco armazena apenas dígitos, mas usuário digita com máscara.
**Como evitar:** Implementar `stripDocument(query: string)` que remove `/\D/g` antes de buscar. Aplicar no lado da query, não apenas no cadastro.
**Sinal de alerta:** Busca por documento retorna vazio mesmo com cliente cadastrado.

### Pitfall 3: Remoção de estágio do pipeline deixa clientes órfãos

**O que dá errado:** Admin remove estágio com clientes vinculados. `stage_id` torna-se NULL ou viola FK.
**Por que acontece:** FK `ON DELETE SET NULL` resolve o FK, mas clientes ficam sem estágio (null) sem o admin saber.
**Como evitar:** Antes de permitir DELETE de um estágio: (1) contar clientes naquele estágio, (2) exibir dialog de confirmação com "X clientes serão movidos para [estágio default]", (3) fazer UPDATE nos clientes para o primeiro estágio da lista ANTES do soft delete do estágio.
**Sinal de alerta:** Clientes com `stage_id = null` sem intenção explícita.

### Pitfall 4: Paginação com filtros quebra offset

**O que dá errado:** Usuário está na página 3 (offset 50), aplica um filtro, mas a query ainda usa offset 50 — resultados vazios ou incorretos.
**Por que acontece:** Offset é calculado a partir do número de página mantido em estado; ao filtrar, o count total muda.
**Como evitar:** Ao aplicar qualquer filtro (Corretor, Estágio, Tipo), resetar para página 1 (offset 0). Manter `page=1` como default ao modificar searchParams de filtro.
**Sinal de alerta:** Filtros resultam em lista vazia com "X clientes encontrados" > 0.

### Pitfall 5: Toggle PF/PJ não limpa validações do campo anterior

**O que dá errado:** Usuário começa a preencher CPF, troca para PJ, campo de documento muda para CNPJ mas o erro de validação do CPF ainda aparece.
**Por que acontece:** React Hook Form mantém errors no state; trocar o tipo não limpa o campo antigo.
**Como evitar:** No `onChange` do toggle PF/PJ: `form.resetField('document')` e `form.clearErrors('document')`. Também limpar campos exclusivos do tipo anterior (ex: `responsible` limpar ao trocar para PF).
**Sinal de alerta:** Mensagem de erro de CPF aparece em campo de CNPJ.

### Pitfall 6: Notificação de tarefa exibe count desatualizado

**O que dá errado:** Usuário conclui uma tarefa, navega para outra página, badge de notificação ainda exibe count antigo.
**Por que acontece:** Server Component do layout é cacheado pelo Next.js; ao concluir tarefa via Server Action, o layout não re-renderiza automaticamente.
**Como evitar:** Após Server Action de `completeTask`, usar `revalidatePath('/(app)/[slug]', 'layout')` para invalidar o cache do layout e forçar nova renderização.
**Sinal de alerta:** Badge não diminui após marcar tarefa como concluída.

### Pitfall 7: `position` do pipeline_stages gera conflito de unique em reordenação

**O que dá errado:** Admin quer mover estágio da posição 3 para posição 1. UPDATE direto viola o unique index em `(tenant_id, position)`.
**Por que acontece:** Ao fazer `UPDATE SET position = 1`, o valor já existe para outro estágio no mesmo tenant.
**Como evitar:** Para v1 (sem reordenação drag-and-drop), apenas inserir com `position = MAX(position) + 1` e exibir em ordem. Remoção não necessita reordenar — apenas soft delete. Se reordenação for necessária: usar `position * 10` como espaçamento ou fazer a reordenação em uma única transação.
**Sinal de alerta:** Erro 23505 (unique violation) ao tentar editar posição de estágio.

---

## Code Examples

### Busca Debounced com URL State (Next.js App Router)

```typescript
// src/app/(app)/[slug]/clientes/components/clients-search.tsx
'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { useDebouncedCallback } from 'use-debounce'  // NÃO instalado — ver nota abaixo

// ALTERNATIVA sem dependência adicional (setTimeout manual):
export function ClientsSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleSearch = useCallback(
    debounce((value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      params.set('page', '1')  // resetar para página 1 ao buscar
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`)
      })
    }, 400),
    [searchParams, pathname, router]
  )

  return (
    <Input
      placeholder="Buscar por nome, CPF ou CNPJ..."
      defaultValue={searchParams.get('q') ?? ''}
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}

// Helper debounce inline (sem lib adicional):
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
```

**Nota:** `use-debounce` é uma lib popular mas NÃO está instalada. A implementação acima usa um helper inline para evitar nova dependência. [ASSUMED: abordagem inline — funcional, sem dependência nova]

### Server Component de Listagem (padrão Phase 1)

```typescript
// src/app/(app)/[slug]/clientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { stripDocument } from '@/lib/validations/cpf' // reutilizar strip para busca

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; page?: string; corretor?: string; stage?: string; type?: string }>
}

export default async function ClientesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { q, page = '1', corretor, stage, type } = await searchParams
  const supabase = await createClient()

  const pageSize = 25  // Claude's Discretion — escolha: 25 itens/página
  const pageNum = Math.max(1, parseInt(page, 10))
  const offset = (pageNum - 1) * pageSize

  let query = supabase
    .from('clients')
    .select(`
      id, name, type, document, created_at,
      assigned_to:profiles!clients_assigned_to_fkey ( id, full_name ),
      stage:pipeline_stages ( id, name, color )
    `, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (q) {
    const stripped = q.replace(/\D/g, '')
    const orClause = stripped
      ? `name.ilike.%${q}%,document.ilike.%${stripped}%`
      : `name.ilike.%${q}%`
    query = query.or(orClause)
  }
  if (corretor) query = query.eq('assigned_to', corretor)
  if (stage)    query = query.eq('stage_id', stage)
  if (type)     query = query.eq('type', type)

  const { data: clients, count } = await query

  // ... render
}
```

[ASSUMED: query pattern — baseado em Supabase JS client SDK e padrões da Phase 1]

### Server Action: Criar Cliente (padrão Phase 1)

```typescript
// src/lib/actions/clients.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateCPF, stripCPF } from '@/lib/validations/cpf'
import { validateCNPJ, stripCNPJ } from '@/lib/validations/cnpj'

const createClientSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pf'),
    document: z.string().refine((v) => validateCPF(v), 'CPF inválido'),
    name: z.string().min(2, 'Nome obrigatório'),
    assigned_to: z.string().uuid(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
  }),
  z.object({
    type: z.literal('pj'),
    document: z.string().refine((v) => validateCNPJ(v), 'CNPJ inválido'),
    name: z.string().min(2, 'Razão social obrigatória'),
    responsible: z.string().optional(),
    assigned_to: z.string().uuid(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
  }),
])

export async function createClientAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: Record<string, string[]> } | void> {
  const raw = Object.fromEntries(formData)
  const parsed = createClientSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const strip = parsed.data.type === 'pf' ? stripCPF : stripCNPJ

  const { error } = await supabase.from('clients').insert({
    ...parsed.data,
    document: strip(parsed.data.document),
  })

  if (error) {
    if (error.code === '23505') {
      return { error: { document: ['Este documento já está cadastrado nesta corretora.'] } }
    }
    return { error: { _form: ['Erro ao salvar cliente. Tente novamente.'] } }
  }

  revalidatePath(`/${slug}/clientes`)
}
```

[ASSUMED: Server Action pattern — segue exatamente o padrão de `src/lib/actions/auth.ts` já estabelecido]

---

## State of the Art

| Abordagem Antiga | Abordagem Atual (Phase 2) | Impacto |
|-----------------|--------------------------|---------|
| Busca com `useEffect` + fetch manual | `useSearchParams` + URL state + Server Components | Sem flickering, compartilhável, back/forward funciona |
| Filtros em drawer/modal | Filtros inline visíveis acima da tabela (D-07) | UX mais direta, menos clicks |
| Kanban com drag-and-drop para pipeline | Badge na tabela + dropdown inline (D-08) | Funcional para v1, sem dependência adicional (dnd-kit, etc.) |
| Notificação via polling ou Realtime | Query no load + toast (D-15) | Suficiente para v1, zero infra adicional |
| Modal para nova entidade | Rota dedicada `/novo` (D-01) | URL única facilita deep link, back button, histórico |

---

## Environment Availability

Step 2.6: SKIPPED (esta fase é puramente code/config — Next.js, Supabase, e Vitest já estão configurados e funcionais desde a Phase 1. Nenhuma nova dependência de infraestrutura externa.)

---

## Validation Architecture

### Test Framework (já configurado — Phase 1)

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16 |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Quick run command | `npx vitest run tests/validations/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Arquivo |
|--------|----------|-----------|-------------------|---------|
| CRM-01 | validateCPF aceita CPF válido, rejeita inválido e all-same | unit | `npx vitest run tests/validations/cpf.test.ts` | Wave 0 — criar |
| CRM-01 | createClientAction PF: valida CPF, rejeita duplicado no tenant | unit | `npx vitest run tests/actions/clients.test.ts` | Wave 0 — criar |
| CRM-02 | createClientAction PJ: valida CNPJ (reutiliza cnpj.ts), razão social obrigatória | unit | `npx vitest run tests/actions/clients.test.ts` | Wave 0 — criar |
| CRM-05 | updateClientStage: corretor só pode mover seus próprios clientes | unit | `npx vitest run tests/actions/clients.test.ts` | Wave 0 — criar |
| CRM-06 | createTask: prazo obrigatório, atribuição defaulta para usuário atual | unit | `npx vitest run tests/actions/tasks.test.ts` | Wave 0 — criar |
| CRM-07 | getOverdueTasks: retorna apenas tarefas não concluídas com due_date <= hoje | unit | `npx vitest run tests/actions/tasks.test.ts` | Wave 0 — criar |
| CRM-08 | busca normaliza CPF/CNPJ (strip antes de ilike) | unit | `npx vitest run tests/validations/cpf.test.ts` | Wave 0 — criar |
| CRM-09 | filtros por Corretor/Estágio/Tipo não quebram paginação (reset page=1) | unit | `npx vitest run tests/actions/clients.test.ts` | Wave 0 — criar |
| RBAC | Corretor só lê seus próprios clientes (RLS policy) | integration | `npx vitest run tests/db/` | Wave 0 — criar |

### Sampling Rate
- **Por commit de tarefa:** `npx vitest run tests/validations/`
- **Por merge de wave:** `npx vitest run`
- **Phase gate:** Full suite green antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/validations/cpf.test.ts` — cobre CRM-01, CRM-08 (validateCPF, stripCPF, formatCPF)
- [ ] `tests/actions/clients.test.ts` — cobre CRM-01, CRM-02, CRM-05, CRM-09
- [ ] `tests/actions/tasks.test.ts` — cobre CRM-06, CRM-07
- [ ] `tests/db/rls-clients.test.ts` — cobre isolamento RBAC de clientes (padrão de `tests/db/rls-coverage.test.ts`)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Aplica | Controle padrão |
|---------------|--------|----------------|
| V2 Authentication | não — gerenciado pela Phase 1 (Supabase Auth) | — |
| V3 Session Management | não — gerenciado pela Phase 1 | — |
| V4 Access Control | sim | RLS policies com `jwt_tenant_role()` e `jwt_tenant_id()` |
| V5 Input Validation | sim | Zod schema em Server Actions; validateCPF/validateCNPJ |
| V6 Cryptography | não — CPF/CNPJ não precisam de criptografia, sem senhas nesta fase | — |

### Known Threat Patterns

| Pattern | STRIDE | Mitigação padrão |
|---------|--------|-----------------|
| Corretor acessando clientes de outro corretor | Spoofing/Info Disclosure | RLS `assigned_to = (SELECT auth.uid())` — verificado no banco, não na aplicação |
| Tenant A acessando dados do Tenant B | Info Disclosure | RLS `tenant_id = (SELECT public.jwt_tenant_id())` — obrigatório em todas as políticas |
| Submissão de CPF/CNPJ inválido malicioso | Tampering | Zod + validateCPF/validateCNPJ no Server Action antes de qualquer operação de banco |
| Soft delete bypass (DELETE físico via API) | Tampering | Trigger `prevent_hard_delete()` — replicar para as 4 novas tabelas |
| Open redirect no `?next=` param | Elevation | Não aplicável nesta fase (nenhuma redirectTo dinâmica nova) |
| document_unique constraint brute force | Info Disclosure | Erro genérico ao retornar "documento já cadastrado" — não revelar se é de outro tenant |

**LGPD:** CPF e CNPJ são dados pessoais e dados de pessoa jurídica. Armazenar apenas o necessário (sem enriquecimento desnecessário — D-02). Campo `address` como JSONB: não persistir coordenadas GPS. Soft delete (D-12) garante direito ao esquecimento via Admin.

---

## Assumptions Log

| # | Claim | Section | Risco se Errado |
|---|-------|---------|-----------------|
| A1 | Algoritmo CPF módulo-11 com pesos `(len + 1 - i)` | Code Examples — Pattern 1 | CPF inválido aceito ou válido rejeitado — coberto por testes unitários |
| A2 | Schema design das 4 tabelas (clients, pipeline_stages, client_interactions, client_tasks) | Architecture Patterns — Pattern 2 | Refactor de migration e FK — custo baixo se detectado no Wave 0 antes de executar |
| A3 | RLS policies para clients com lógica RBAC (admin/financeiro/visualizador vs corretor) | Architecture Patterns — Pattern 3 | Dados de clientes vazando entre corretores — detectado por `tests/db/rls-clients.test.ts` |
| A4 | `revalidatePath('/(app)/[slug]', 'layout')` invalida o badge de notificação após completar tarefa | Code Examples — Pattern 5 | Badge desatualizado — impacto UX leve, não de segurança |
| A5 | Debounce inline de 400ms sem `use-debounce` lib | Code Examples — Busca Debounced | Comportamento idêntico, mas pode ser substituído por `use-debounce` se necessário |
| A6 | `date-fns` instalado é v4 (não v3) — confirmar API de `ptBR` locale | Standard Stack | API de locale pode diferir se package.json não reflete instalação real — verificar com `npm ls date-fns` |

---

## Open Questions

1. **CPF na tabela: mascarado ou não?**
   - O que sabemos: D-07 deixa para "Claude's Discretion". Banco armazena sem máscara.
   - O que não está claro: Formatar na tabela como `xxx.xxx.xxx-xx` ou exibir bruto?
   - Recomendação: Formatar na UI com `formatCPF()` / `formatCNPJ()` — melhora legibilidade, zero impacto em busca.

2. **Tamanho de página: 25 ou 50?**
   - O que sabemos: D-07 deixa para "Claude's Discretion".
   - Recomendação: 25 itens/página — menor latência de renderização, escala v1 de 5.000 clientes implica 200 páginas vs 100 páginas; 25 é padrão de mercado para listagens de CRM.

3. **Animações nas abas de detalhes**
   - Deixado para "Claude's Discretion".
   - Recomendação: Usar a animação CSS nativa do shadcn/ui Tabs (`data-[state=active]` visibility) — sem biblioteca adicional (framer-motion não está instalada).

4. **soft delete trigger para novas tabelas**
   - O trigger `prevent_hard_delete()` existe para `tenants` e `profiles` mas NÃO para `clients`, `client_interactions`, `client_tasks`, `pipeline_stages`.
   - Recomendação: Adicionar trigger nas 4 novas tabelas nas migrations desta fase — manter consistência com padrão LGPD.

---

## Sources

### Primary (HIGH confidence)
- `package.json` do repositório — versões de todas as dependências instaladas [VERIFIED]
- `src/lib/validations/cnpj.ts` — algoritmo módulo-11 existente, base para CPF [VERIFIED]
- `supabase/migrations/` — padrões de schema, RLS helpers, soft delete triggers [VERIFIED]
- `src/lib/actions/auth.ts` — padrão de Server Actions com Zod [VERIFIED]
- `src/components/auth/sidebar-shell.tsx` — estrutura atual da sidebar [VERIFIED]
- `src/app/(app)/layout.tsx` — estrutura do app layout, ponto de integração da notificação [VERIFIED]
- `vitest.config.ts` e `tests/` — infraestrutura de testes existente [VERIFIED]
- `.planning/phases/02-crm-clientes/02-CONTEXT.md` — decisões locked do usuário [VERIFIED]
- `.planning/phases/01-fundacao-auth/01-CONTEXT.md` — padrões herdados da Phase 1 [VERIFIED]

### Secondary (MEDIUM confidence)
- CLAUDE.md — stack constraints e decisões de arquitetura [VERIFIED: lido diretamente]

### Tertiary (LOW confidence — marked [ASSUMED])
- Implementação do algoritmo CPF — padrão bem conhecido mas não verificado via Context7 nesta sessão
- Query patterns Supabase JS client — baseados em conhecimento de treinamento (SDK estável, baixo risco de mudança)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verificado diretamente no package.json do repo
- Architecture Patterns: MEDIUM/HIGH — schema segue exatamente os padrões da Phase 1 (verified), lógica de negócio assume baseada em CONTEXT.md
- Pitfalls: HIGH — derivados diretamente de pitfalls documentados na Phase 1 e de padrões conhecidos do stack

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stack estável; componentes shadcn/ui e Supabase JS SDK têm baixa taxa de breaking change)
