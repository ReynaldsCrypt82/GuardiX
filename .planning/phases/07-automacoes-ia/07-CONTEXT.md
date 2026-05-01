# Phase 7: Automações & IA — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Corretora pode configurar webhooks n8n por evento, receber alertas automáticos por email (cliente + corretor) com templates personalizáveis, e oferecer atendimento via IA no WhatsApp e chat interno assistido.

**3 pilares:**
1. **Webhooks n8n** (AUTO-01, AUTO-02) — Admin configura URLs por evento; cron diário detecta e dispara
2. **Email automático** (AUTO-03) — Mesmo cron, templates personalizáveis por tenant, destinatários corretor + cliente
3. **IA** (AUTO-04, AUTO-05, AUTO-06) — WhatsApp com RAG + chat interno para corretor

Fora do escopo desta phase: editor WYSIWYG de email, retry automático de webhook, integração nativa com WhatsApp Business (plataforma expõe endpoint que n8n/Evolution chamam).

</domain>

<decisions>
## Implementation Decisions

### Mecanismo de Disparo (D-01 a D-04)

- **D-01:** **Cron job diário** via Supabase Edge Function agendada. Um único job detecta eventos pendentes e dispara webhooks + emails simultaneamente. Horário recomendado: 08h BRT (Claude's discretion).
- **D-02:** **3 eventos core** disponíveis para configuração de webhook:
  - `policy_expiring` — Vencimento de apólice (X dias antes — valor configurável pelo admin por evento)
  - `financial_overdue` — Inadimplência financeira (lançamento vencido: `due_date < hoje AND status = 'pending'`)
  - `consortium_contemplated` — Contemplação de cota de consórcio
- **D-03:** **Falha de webhook → logar e seguir.** Registra em tabela `webhook_logs` (evento, tenant_id, url_destino, payload, http_status, erro, timestamp). Sem retry automático. Admin visualiza logs de disparo na UI de configuração.
- **D-04:** **Botão "Testar webhook"** na UI de configuração — envia payload de exemplo para a URL configurada e exibe o código HTTP de resposta (200, 4xx, 5xx). Permite validar antes de ativar.

### Email Automático (D-05 a D-07)

- **D-05:** **Destinatários duplos** — Para cada evento:
  - Corretor responsável pela apólice/cota recebe notificação interna (email para seu address)
  - Cliente vinculado recebe aviso (email do cadastro do cliente — se preenchido)
  - Se cliente não tiver email, apenas o corretor recebe. Sem erro.
- **D-06:** **Template personalizável por tenant** — Admin edita via `textarea` simples (assunto + corpo) por tipo de evento. Variáveis substituídas no envio: `{{nome_cliente}}`, `{{cpf_cnpj}}`, `{{vencimento}}`, `{{valor}}`, `{{nome_apolice}}`, `{{corretor}}`.
- **D-07:** Templates têm **fallback padrão** — Se tenant não configurou template para um evento, o sistema usa o template padrão do sistema (não envia email em branco). Template padrão é fixo (React Email).

### UI de Configuração de Automações (D-08 a D-09)

- **D-08:** Nova rota `/[slug]/configuracoes/automacoes` — aba adicional em `/configuracoes` (padrão das phases 1-4). Seções: "Webhooks n8n" + "Templates de email".
- **D-09:** **RBAC** — Apenas `role = 'admin'` pode configurar webhooks e templates. Corretor e demais não têm acesso a `/configuracoes/automacoes`.

### Claude's Discretion

- **WhatsApp:** Plataforma expõe endpoint REST (`/api/[slug]/ai/whatsapp`) que recebe payload do n8n/Evolution API e retorna resposta da IA. A integração com WhatsApp propriamente (número, Evolution API, Twilio) é responsabilidade do n8n do tenant — fora da plataforma.
- **Chat interno:** Planner decide UI (widget flutuante vs `/[slug]/assistente` dedicada). Contexto injetado: dados do tenant (clientes, apólices, cotas) via tool calling ou RAG — planner escolhe abordagem baseada em custo/velocidade.
- **LLM provider:** GPT-4o-mini como default (custo-benefício, citado no PROJECT.md). Claude para tarefas de análise mais complexas se necessário. Via Vercel AI SDK (decisão de projeto).
- **Threshold de escalação:** Valor numérico default = 0.7 (confiança < 70% → escala para humano via mensagem no chat/WhatsApp). Configurável por tenant via UI ou hardcoded por hora — planner decide.
- **RAG fonte de dados:** `policies`, `clients`, `consortium_quotas`, `commission_entries` do tenant — acesso via Supabase service_role na Edge Function (nunca exposta ao cliente).
- **Horário do cron:** 08h BRT diariamente — planner ajusta conforme suporte do Supabase Cron.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos desta phase
- `.planning/REQUIREMENTS.md` §AUTO-01 a AUTO-06 — acceptance criteria completos

### Schemas existentes (tabelas que o cron vai consultar)
- `.planning/phases/03-seguros-consorcio/03-CONTEXT.md` — tabela `policies` (end_date, corretor, client_id)
- `.planning/phases/05-financeiro/05-CONTEXT.md` — tabela `financial_entries` (due_date, status, client_id)
- `.planning/phases/03-seguros-consorcio/03-CONTEXT.md` — tabela `consortium_quotas` (contemplated_at)
- `supabase/migrations/` — ler migrations existentes antes de criar novas tabelas

### Edge Function de referência (padrão de código a seguir)
- `supabase/functions/custom-access-token/index.ts` — única Edge Function existente, usar como referência de estrutura Deno

### Route Handler de referência (padrão existente)
- `src/app/api/[slug]/export/route.ts` — único Route Handler existente, padrão de auth + tenant isolation

### Decisões de stack (não negociáveis)
- `CLAUDE.md` §Tech Stack — Resend para email, Vercel AI SDK para LLM, n8n externo (não hosted)
- `CLAUDE.md` §Multi-tenancy — service_role apenas em Edge Functions/Server Actions, jamais no cliente

### Configurações existentes em /configuracoes
- `src/app/(app)/[slug]/configuracoes/usuarios/` — padrão RBAC e estrutura de rota a replicar
- `src/app/(app)/[slug]/configuracoes/pipeline/` — padrão de UI de configuração a seguir

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/functions/custom-access-token/index.ts` — estrutura base de Edge Function Deno para criar a cron Edge Function
- `src/app/(app)/[slug]/configuracoes/` — estrutura de rotas e sidebar de configurações
- `src/app/api/[slug]/export/route.ts` — padrão de Route Handler autenticado com isolamento por tenant

### Established Patterns
- Tenant isolation: `tenant_id` em todas as tabelas + RLS baseado em JWT claim `app_metadata.tenant_id`
- RBAC: `notFound()` ou `redirect()` para roles sem permissão (padrão das phases 4, 5, 6)
- Server Actions para mutações, Server Components para leitura
- Soft delete: `deleted_at TIMESTAMPTZ` em todas as tabelas de entidade

### Integration Points
- `/[slug]/configuracoes` — adicionar aba "Automações" na sidebar de configurações
- `supabase/functions/` — criar nova Edge Function `automation-cron/index.ts`
- `supabase/migrations/` — criar tabelas `webhook_configs`, `webhook_logs`, `email_templates`
- `src/app/api/[slug]/ai/` — criar Route Handler para endpoint WhatsApp IA (AUTO-04)

</code_context>

<specifics>
## Specific Ideas

- Variáveis de template de email: `{{nome_cliente}}`, `{{cpf_cnpj}}`, `{{vencimento}}`, `{{valor}}`, `{{nome_apolice}}`, `{{corretor}}` — substituição server-side antes do envio via Resend
- Botão "Testar webhook" deve mostrar o payload JSON que será enviado (para o admin entender o formato), além do código de resposta
- `webhook_logs` deve ter índice em `(tenant_id, created_at)` para que admin visualize histórico paginado

</specifics>

<deferred>
## Deferred Ideas

- Editor WYSIWYG de email (Rich Text) — fase 2 se necessário
- Retry automático de webhook (3x com backoff) — fase 2
- Integração nativa com WhatsApp Business API (número da corretora na plataforma) — alta complexidade regulatória, fora do v1
- Configuração de múltiplos webhooks por evento (fan-out) — fase 2
- Email scheduling (dia da semana, horário preferido) — fase 2
- Dashboard de métricas de automações (taxa de entrega, erros por evento) — fase 2

</deferred>

---

*Phase: 07-automacoes-ia*
*Context gathered: 2026-04-30*
