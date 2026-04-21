# Phase 2: CRM & Clientes — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregar o módulo completo de gestão de clientes: cadastro PF/PJ com validação de documento, listagem com busca e filtros, pipeline de vendas com estágios configuráveis por tenant, timeline de interações, tarefas de follow-up com notificação in-app. Esta fase não inclui apólices, consórcio ou comissões — apenas o cliente e seu relacionamento com a corretora.

</domain>

<decisions>
## Implementation Decisions

### Formulário de Cliente (CRM-01, CRM-02)

- **D-01:** Um único formulário com toggle PF/PJ — URL única `/[slug]/clientes/novo`. Campos mudam conforme o tipo selecionado (CPF vs CNPJ, nome completo vs razão social/responsável).
- **D-02:** CPF sem enriquecimento automático. Apenas validação de dígito verificador (módulo-11, mesmo padrão do CNPJ já implementado em Phase 1). API pública de CPF não existe sem autenticação paga.
- **D-03:** Cadastro mínimo obrigatório: tipo (PF/PJ) + documento (CPF/CNPJ) + nome. Contatos (email, telefone) e endereço são opcionais — preenchidos depois na tela de detalhes.
- **D-04:** Corretor responsável é campo obrigatório no cadastro — select com lista de corretores ativos do tenant. Todo cliente nasce vinculado a um corretor.

### Listagem de Clientes (CRM-08, CRM-09)

- **D-05:** Tabela paginada — reutiliza o componente `Table` do shadcn/ui já instalado. Colunas default: nome, tipo (badge PF/PJ), documento, corretor responsável, estágio do pipeline (badge colorido), data de cadastro.
- **D-06:** Busca inline debounced (400ms) no topo da tabela. Busca por nome, CPF ou CNPJ simultaneamente (sem precisar selecionar o tipo).
- **D-07:** Filtros inline visíveis acima da tabela (sem drawer): dropdowns para Corretor, Estágio do pipeline, Tipo (PF/PJ). Badge de "N filtros ativos" quando algum estiver selecionado.

### Pipeline de Vendas (CRM-05)

- **D-08:** Pipeline visualizado como coluna de status na tabela de clientes — badge colorido com nome do estágio. Mudança de estágio via dropdown inline na tabela (sem sair da listagem) ou via select na tela de detalhes do cliente.
- **D-09:** Estágios completamente configuráveis por tenant — Admin pode adicionar e remover estágios livremente via tela de configurações.
  - Schema: tabela `pipeline_stages` com colunas `tenant_id`, `name`, `color`, `position` (ordem), `is_closed` (boolean — indica estágio final ganho/perdido).
  - Defaults ao criar tenant: Prospecção → Proposta → Aguardando → Fechado.
  - Remoção de estágio: clientes naquele estágio são realocados para o estágio default (primeiro da lista) antes da exclusão — UX de confirmação obrigatório.

### Tela de Detalhes do Cliente

- **D-10:** Tela de detalhes com abas: **Dados** | **Timeline** | **Tarefas** | **Apólices** (aba Apólices renderiza placeholder "Em breve" nesta fase — Phase 3 preenche).
- Layout: dados cadastrais no topo (card com nome, tipo, documento, corretor, estágio), abas abaixo.

### Timeline de Interações (CRM-03, CRM-04)

- **D-11:** 5 tipos de interação: `ligação`, `email`, `reunião`, `WhatsApp`, `visita`. Cada tipo com ícone distinto na timeline.
- **D-12:** Registro de nova interação via botão "Registrar interação" → `Dialog` do shadcn/ui com: tipo (select), data/hora, descrição (textarea obrigatória). Server Action para salvar.
- **D-13:** Timeline exibida em feed cronológico invertido (mais recente no topo). Cada item: ícone do tipo, data, usuário que registrou, descrição.

### Tarefas de Follow-up (CRM-06, CRM-07)

- **D-14:** Tarefa vinculada a um cliente com: descrição, prazo (date picker), atribuída a (select de usuário do tenant, default = usuário atual).
- **D-15:** Notificação de follow-up vencendo — apenas in-app em v1: badge de contador no menu de navegação + toast quando o usuário abre o sistema. Email automático adiado para Phase 7 (requer job agendado).

### Permissões RBAC (herda Phase 1 — D-11)

- Admin e Financeiro (somente leitura): veem todos os clientes do tenant.
- Corretor: vê apenas seus próprios clientes (tenant_id + corretor_id no RLS).
- Visualizador: vê todos, sem criar/editar.
- Soft delete obrigatório (herda D-12 da Phase 1) — campo `deleted_at TIMESTAMPTZ`.

### Claude's Discretion

- Paginação: tamanho de página default (25 ou 50 itens) — Claude decide.
- Animações de transição nas abas da tela de detalhes.
- Formatação de CPF/CNPJ na tabela (mascarado ou não).
- Cores default dos estágios do pipeline criados automaticamente ao registrar tenant.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §CRM — CRM-01 a CRM-09 (todos os requisitos desta fase)

### Phase 1 Decisions (padrões a seguir)
- `.planning/phases/01-fundacao-auth/01-CONTEXT.md` — D-11 (RBAC), D-12 (soft delete), D-16 a D-20 (Supabase patterns)

### Project Context
- `.planning/PROJECT.md` — Constraints (Brasil, LGPD, escala v1: 5.000 clientes/tenant)

### Codebase — padrões estabelecidos
- `src/lib/supabase/server.ts` — createClient() para Server Components
- `src/lib/supabase/admin.ts` — createAdminClient() para Server Actions privilegiadas
- `src/lib/validations/cnpj.ts` — validação de documento (reutilizar pattern para CPF)
- `src/lib/actions/auth.ts` — padrão de Server Actions com Zod + error handling
- `src/components/ui/table.tsx` — componente Table para listagem
- `src/components/ui/dialog.tsx` — componente Dialog para modais de registro
- `src/components/ui/badge.tsx` — componente Badge para tipo e status
- `supabase/migrations/` — padrão de migrations com RLS habilitado e helpers `public.jwt_tenant_id()`

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/table.tsx` — Table, TableHeader, TableBody, TableRow, TableCell: pronto para listagem de clientes
- `src/components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader: pronto para modais de registro de interação
- `src/components/ui/badge.tsx` — Badge com variantes: para tipo PF/PJ e estágio do pipeline
- `src/components/ui/card.tsx` — Card, CardHeader, CardContent: para dados do cliente no topo da tela de detalhes
- `src/components/ui/select.tsx` — Select: para filtros, corretor, tipo de interação
- `src/components/ui/input.tsx` — Input: busca debounced
- `src/components/ui/form.tsx` — Form, FormField, FormItem: React Hook Form integration (padrão estabelecido)
- `src/components/ui/avatar.tsx` — Avatar: para exibir iniciais do cliente na tabela
- `src/lib/validations/cnpj.ts` — validateCNPJ/stripCNPJ/formatCNPJ: reutilizar padrão para CPF (módulo-11)
- `src/lib/actions/auth.ts` e `invites.ts` — padrão de Server Actions com Zod schema + return {error}

### Established Patterns
- **Data fetching:** Server Components para fetch inicial, `createClient()` de `@supabase/ssr`
- **Mutations:** Server Actions com Zod validation, retornam `{ error?: string }` ou redirect
- **Forms:** React Hook Form + Zod schema compartilhado entre client e server
- **RLS:** toda tabela tem `tenant_id UUID NOT NULL` + `public.jwt_tenant_id()` nas policies
- **Soft delete:** campo `deleted_at TIMESTAMPTZ`, filtrar com `.is('deleted_at', null)`
- **Routing:** `src/app/(app)/[slug]/` para rotas autenticadas

### Integration Points
- Nova rota: `src/app/(app)/[slug]/clientes/` — listagem, novo, [id]/detalhes
- Configurações de pipeline: `src/app/(app)/[slug]/configuracoes/pipeline/` 
- Dashboard (Phase 1 stub): `src/app/(app)/[slug]/dashboard/page.tsx` — conectar card "Clientes" com contagem real
- Sidebar: adicionar link "Clientes" ao `src/components/auth/sidebar-shell.tsx`
- Novas migrations: `clients`, `client_interactions`, `client_tasks`, `pipeline_stages`

</code_context>

<specifics>
## Specific Ideas

- Toggle PF/PJ no form deve ser prominent e intuitivo — não um radio button escondido
- Estágio do pipeline nos defaults ao criar tenant: Prospecção (azul) → Proposta (amarelo) → Aguardando (laranja) → Fechado (verde)
- Ao remover estágio com clientes, exibir: "X clientes serão movidos para [estágio padrão]. Confirmar?"
- Timeline: ícones distintos por tipo (Phone, Mail, Video, MessageCircle, MapPin do Lucide)
- Busca debounced: aguardar 400ms após última tecla antes de disparar query
- CPF validação: mesmo algoritmo módulo-11 do CNPJ, já testado com Vitest

</specifics>

<deferred>
## Deferred Ideas

- Busca global tipo Cmd+K (clientes + apólices + outros) — Phase 6 ou feature separada
- Notificação de follow-up por email — Phase 7 (requer job agendado: Supabase Cron ou Vercel Cron)
- Tipos de interação configuráveis por tenant — v2
- Importação de clientes via CSV — v2
- Kanban visual com drag-and-drop para pipeline — pode ser adicionado em v2 sem quebrar o schema

</deferred>

---

*Phase: 02-crm-clientes*
*Context gathered: 2026-04-21*
