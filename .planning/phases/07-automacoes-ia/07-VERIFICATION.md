---
phase: 07-automacoes-ia
verified: 2026-05-01T00:00:00Z
status: human_needed
score: 6/6
overrides_applied: 0
human_verification:
  - test: "Acessar /[slug]/configuracoes/automacoes como visualizador ou corretor"
    expected: "Redirecionamento para /[slug]/dashboard — apenas admin acessa"
    why_human: "Guard depende de sessao SSR real com app_metadata.role no JWT"
  - test: "Abrir /[slug]/assistente como visualizador"
    expected: "notFound() renderiza 404 — visualizador nao acessa chat"
    why_human: "Guard depende de sessao SSR real com app_metadata.role"
  - test: "Acessar /[slug]/assistente como corretor e enviar mensagem"
    expected: "Interface de chat aparece, mensagem enviada, IA responde com streaming"
    why_human: "Requer OPENAI_API_KEY real, sessao ativa e servidor rodando"
  - test: "POST /api/[slug]/ai/whatsapp sem header x-webhook-secret"
    expected: "HTTP 401 { error: 'Unauthorized' }"
    why_human: "Requer servidor rodando com WHATSAPP_WEBHOOK_SECRET configurado"
  - test: "POST /api/[slug]/ai/whatsapp com mensagem ambigua (resposta curta esperada)"
    expected: "{ response: <ESCALATION_MESSAGE>, escalated: true }"
    why_human: "Requer OpenAI API real — comportamento do modelo nao e determinístico"
  - test: "pg_cron dispara automation-cron Edge Function diariamente as 11:00 UTC"
    expected: "webhook_logs ganha novas linhas; emails enviados se RESEND_API_KEY configurado"
    why_human: "Requer ambiente Supabase producao com pg_cron + pg_net habilitados"
  - test: "Botao 'Testar' no formulario de webhook envia payload de exemplo e mostra http_status"
    expected: "Resposta JSON com http_status e payload exibida na UI"
    why_human: "Requer UI rodando, servidor Next.js ativo e URL de webhook acessivel"
---

# Phase 07: Automacoes & IA — Verification Report

**Phase Goal:** Automacao de notificacoes (webhooks n8n + email React Email/Resend) disparadas por cron diario, endpoint WhatsApp IA com escalacao automatica, e chat interno streaming para corretores.
**Verified:** 2026-05-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Admin configura webhooks n8n por evento via UI admin-only (AUTO-01) | VERIFIED | `configuracoes/automacoes/page.tsx` redireciona non-admin; `webhook-config-form.tsx` chama `createWebhookConfigAction` / `updateWebhookConfigAction`; Server Actions em `webhook-configs.ts` fazem RBAC role=admin + Zod validation com `isUrlSafe` SSRF guard; sidebar mostra link Automacoes apenas para `userRole === 'admin'` |
| 2 | Sistema dispara webhooks automaticamente via cron diario (08h BRT) e registra logs (AUTO-02) | VERIFIED | Migration 0023 agenda `cron.schedule('automation-cron-daily', '0 11 * * *', ...)` (11 UTC = 08 BRT); Edge Function `automation-cron/index.ts` (302 linhas) percorre policies/financial_entries/consortium_quotas por tenant, chama `dispatchWebhook` que insere em `webhook_logs` com http_status ou error_message |
| 3 | Sistema envia emails via React Email + Resend com Route Handler Node.js — Edge Function NAO chama Resend diretamente (AUTO-03 / D-07) | VERIFIED | `route.tsx` em `/api/internal/send-automation-email` tem `export const runtime = 'nodejs'`, importa `render` de `@react-email/render`, renderiza os 3 templates; Edge Function chama `POST ${NEXTJS_APP_URL}/api/internal/send-automation-email` com `x-internal-secret` — zero ocorrencias de `api.resend.com` na Edge Function |
| 4 | Endpoint /api/[slug]/ai/whatsapp retorna resposta da IA protegido por x-webhook-secret (AUTO-04) | VERIFIED | `whatsapp/route.ts` valida `x-webhook-secret` contra `WHATSAPP_WEBHOOK_SECRET` retornando 401 sem header; chama `generateText` com `openai('gpt-4o-mini')` + 3 tools com tenant_id explícito; retorna `{ response, escalated }` |
| 5 | Escalacao automatica quando IA nao tem confianca suficiente (AUTO-05) | VERIFIED | `isLowConfidenceResponse` importada de `@/lib/utils/ai-escalation` e aplicada em `whatsapp/route.ts` linha 139; retorna `{ response: ESCALATION_MESSAGE, escalated: true }` quando heuristica dispara (finishReason=length/max-steps, texto curto, prefixo [INCERTO]) |
| 6 | Chat interno /[slug]/assistente com streaming para corretores (AUTO-06) | VERIFIED | `assistente/page.tsx` bloqueia visualizador com `notFound()`; `chat-interface.tsx` usa `useChat({ api: /api/${slug}/ai/chat })` de `@ai-sdk/react`; `chat/route.ts` usa `streamText` + `toUIMessageStreamResponse()` + cross-tenant guard (meta.slug !== slug -> 403) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Status | Line Count | Key Evidence |
|---------|--------|-----------|-------------|
| `supabase/migrations/20260420_0021_automacoes_schema.sql` | VERIFIED | 69 | 3 tabelas com tenant_id NOT NULL, CHECK event_type, UNIQUE partial index, triggers set_updated_at + prevent_hard_delete |
| `supabase/migrations/20260420_0022_automacoes_rls.sql` | VERIFIED | 39 | RLS habilitado nas 3 tabelas; `jwt_tenant_role() = 'admin'` em USING + WITH CHECK; webhook_logs somente SELECT |
| `supabase/migrations/20260420_0023_automacoes_cron.sql` | VERIFIED | 46 | `cron.schedule('automation-cron-daily', '0 11 * * *', ...)` com pg_net HTTP POST + x-cron-secret via Vault |
| `supabase/config.toml` | VERIFIED | — | `[functions.automation-cron] / verify_jwt = false` presente na linha 374-375 |
| `src/lib/utils/webhook-url.ts` | VERIFIED | 29 | `isUrlSafe()` exportada; bloqueia RFC1918, loopback, link-local, protocolo nao-http/https |
| `src/lib/utils/email-template.ts` | VERIFIED | 57 | `renderEmailTemplate`, `escapeHtml`, `DEFAULT_TEMPLATES`, `TEMPLATE_VARIABLES` exportados |
| `src/lib/utils/ai-escalation.ts` | VERIFIED | 20 | `isLowConfidenceResponse`, `ESCALATION_MESSAGE`, `MIN_RESPONSE_LENGTH` exportados |
| `src/lib/utils/dispatch-webhook.ts` | VERIFIED | 33 | `buildWebhookPayload`, `classifyHttpResponse` exportados |
| `src/lib/validations/automation-schemas.ts` | VERIFIED | 36 | `webhookConfigSchema` com `.refine(isUrlSafe)`, `emailTemplateSchema`, `webhookTestSchema` |
| `src/emails/policy-expiring.tsx` | VERIFIED | 56 | `PolicyExpiringEmail` funcional com props tipadas; importa de `@react-email/components` |
| `src/emails/financial-overdue.tsx` | VERIFIED | SUBSTANTIVE | `FinancialOverdueEmail` funcional |
| `src/emails/consortium-contemplated.tsx` | VERIFIED | SUBSTANTIVE | `ConsortiumContemplatedEmail` funcional |
| `src/app/api/internal/send-automation-email/route.tsx` | VERIFIED | 95 | `export const runtime = 'nodejs'`; valida `x-internal-secret`; bifurcacao tenant custom vs React Email default; chama Resend |
| `supabase/functions/automation-cron/index.ts` | VERIFIED | 302 | `Deno.serve`; valida `x-cron-secret`; percorre 3 tabelas operacionais; `dispatchWebhook` insere em webhook_logs; `callEmailRoute` delega ao Route Handler Node.js |
| `src/lib/actions/webhook-configs.ts` | VERIFIED | 131 | `createWebhookConfigAction`, `updateWebhookConfigAction`, `softDeleteWebhookConfigAction`; RBAC admin; SSRF guard via schema |
| `src/lib/actions/email-templates.ts` | VERIFIED | 104 | `upsertEmailTemplateAction`, `softDeleteEmailTemplateAction`; RBAC admin |
| `src/app/api/[slug]/webhook-test/route.ts` | VERIFIED | 113 | RBAC admin + cross-tenant + `isUrlSafe` dupla defesa; payload de exemplo; `AbortSignal.timeout(10000)` |
| `src/app/(app)/[slug]/configuracoes/automacoes/page.tsx` | VERIFIED | 116 | Guard role != 'admin' -> redirect; queries paralelas configs+templates+logs; 3 secoes renderizadas |
| `src/app/(app)/[slug]/configuracoes/automacoes/webhook-config-form.tsx` | VERIFIED | 152 | `createWebhookConfigAction` / `updateWebhookConfigAction` chamados; botao TestWebhookButton integrado |
| `src/app/(app)/[slug]/configuracoes/automacoes/email-template-form.tsx` | VERIFIED | SUBSTANTIVE | `upsertEmailTemplateAction` wired; lista `TEMPLATE_VARIABLES` exibida |
| `src/app/(app)/[slug]/configuracoes/automacoes/webhook-logs-table.tsx` | VERIFIED | SUBSTANTIVE | Renderiza triggered_at, event_type, url_destino, http_status, error_message |
| `src/app/(app)/[slug]/configuracoes/automacoes/test-webhook-button.tsx` | VERIFIED | SUBSTANTIVE | Chama `POST /api/${slug}/webhook-test` |
| `src/components/auth/sidebar-shell.tsx` | VERIFIED | — | Link `Automacoes` condicional `userRole === 'admin'`; link `Assistente IA` para admin/corretor/financeiro |
| `src/app/api/[slug]/ai/whatsapp/route.ts` | VERIFIED | 145 | x-webhook-secret auth; generateText; isLowConfidenceResponse; `{ response, escalated }` retornado |
| `src/app/api/[slug]/ai/chat/route.ts` | VERIFIED | 132 | Auth + cross-tenant guard + visualizador block; streamText; toUIMessageStreamResponse() |
| `src/app/(app)/[slug]/assistente/page.tsx` | VERIFIED | 41 | `notFound()` para visualizador; renderiza `<ChatInterface slug={slug} />` |
| `src/components/assistente/chat-interface.tsx` | VERIFIED | 104 | `useChat({ api: /api/${slug}/ai/chat })`; streaming status; mensagens renderizadas |
| `package.json` | VERIFIED | — | `ai: ^6.0.173`, `@ai-sdk/openai: ^3.0.57`, `@ai-sdk/react: ^1.2.12`, `react-email: ^6.0.5`, `@react-email/components: ^1.0.12`, `@react-email/render: ^2.0.8` |
| `tests/actions/whatsapp-endpoint.test.ts` | VERIFIED | 44 | 5 testes reais sobre `isLowConfidenceResponse` — escalation logic wired |
| `tests/actions/chat-isolation.test.ts` | VERIFIED | 39 | 8 testes de cross-tenant guard + RBAC puro — guards extraidos e testados |
| `tests/actions/webhook-configs.test.ts` | VERIFIED | 239 | Testes RBAC admin-only populados com mocks Supabase |

### Key Link Verification

| From | To | Via | Status |
|------|---|-----|--------|
| `migration_0023` | `supabase/functions/automation-cron/index.ts` | `net.http_post()` para `/functions/v1/automation-cron` | WIRED — cron expression `0 11 * * *` + URL construida via Vault secret |
| `migration_0022` | `migration_0002_rls_helpers.sql` | `jwt_tenant_id()` + `jwt_tenant_role()` | WIRED — funcoes existem em 0002, chamadas em 3 policies da 0022 |
| `automation-cron/index.ts` | `/api/internal/send-automation-email` | `fetch(${NEXTJS_APP_URL}/api/internal/send-automation-email)` com `x-internal-secret` | WIRED — linha 289 da Edge Function |
| `/api/internal/send-automation-email/route.tsx` | `src/emails/*.tsx` | `render()` de `@react-email/render` | WIRED — 3 imports + 3 branches de render na bifurcacao |
| `webhook-config-form.tsx` | `webhook-configs.ts` (Server Actions) | `createWebhookConfigAction` / `updateWebhookConfigAction` | WIRED — importados e chamados no handleSubmit |
| `chat-interface.tsx` | `/api/[slug]/ai/chat/route.ts` | `useChat({ api: /api/${slug}/ai/chat })` | WIRED — string de API construida com slug prop |
| `whatsapp/route.ts` | `ai-escalation.ts` | `isLowConfidenceResponse({ finishReason, text })` | WIRED — importado na linha 13, aplicado na linha 139 |
| `chat/route.ts` | `createClient` (Supabase server) | `supabase.auth.getUser()` | WIRED — session auth + cross-tenant guard em META |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|-------------|--------|-------------------|--------|
| `automacoes/page.tsx` | `configs`, `templates`, `logs` | `supabase.from('webhook_configs')`, `email_templates`, `webhook_logs` | Yes — queries reais com `.is('deleted_at', null)` e `.limit(20)` | FLOWING |
| `webhook-logs-table.tsx` | `logs` prop | Passada da page.tsx que consulta DB | Yes — dados reais de webhook_logs | FLOWING |
| `automation-cron/index.ts` | `policyConfigs`, `policies`, `entries`, `quotas` | Queries service_role contra policies/financial_entries/consortium_quotas | Yes — consultas com filtros de tenant_id e datas reais | FLOWING |
| `chat-interface.tsx` | `messages` | `useChat` streaming de `/api/[slug]/ai/chat` que consulta DB via tools | Yes — tools fazem queries reais via service_role | FLOWING |

### Behavioral Spot-Checks

| Behavior | Approach | Status |
|---------|---------|--------|
| `isUrlSafe()` rejeita IPs privados | Testes em `tests/utils/webhook-url.test.ts` (7 casos) | PASS (via testes) |
| `isLowConfidenceResponse()` detecta baixa confianca | Testes em `tests/actions/whatsapp-endpoint.test.ts` (5 casos) | PASS (via testes) |
| `renderEmailTemplate()` substitui variaveis e escapa HTML | Testes em `tests/utils/email-template.test.ts` | PASS (via testes) |
| Edge Function NAO chama Resend diretamente | `grep api.resend.com supabase/functions/automation-cron/index.ts` retorna zero | PASS |
| `export const runtime = 'nodejs'` em Route Handler email | Linha 11 de `route.tsx` confirmada | PASS |
| Cron schedule 11:00 UTC em migration | `0 11 * * *` confirmado na linha 18 | PASS |
| Webhook secrets validados antes de processar | `x-cron-secret` (Edge Function linha 49), `x-webhook-secret` (whatsapp linha 29), `x-internal-secret` (email route linha 16) | PASS |
| Chat streaming com `toUIMessageStreamResponse()` | Linha 131 de `chat/route.ts` confirmada | PASS |
| Cross-tenant guard no chat | `meta.slug !== slug -> 403` na linha 38 | PASS |
| Sidebar Automacoes admin-only | `userRole === 'admin'` condicional confirmado | PASS |
| Sidebar Assistente IA excluido para visualizador | `admin || corretor || financeiro` condicional confirmado | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|------------|------------|-------------|--------|
| AUTO-01 | Plans 02, 03 | Admin configura webhooks n8n por evento (policy_expiring, financial_overdue, consortium_contemplated) via UI admin-only | SATISFIED — UI em `automacoes/page.tsx`, Server Actions em `webhook-configs.ts`, RBAC verificado, SSRF guard via isUrlSafe |
| AUTO-02 | Plans 01, 02 | Disparo automatico via cron diario 08h BRT + logs em webhook_logs | SATISFIED — migration 0023 com `0 11 * * *`, Edge Function percorre 3 tabelas, insere em webhook_logs |
| AUTO-03 | Plans 01, 02 | Emails automaticos via React Email + Resend — D-07: Route Handler Node.js (NAO Deno inline) | SATISFIED — Route Handler com `export const runtime = 'nodejs'`; templates React Email; Edge Function delega via `x-internal-secret` |
| AUTO-04 | Plan 04 | Endpoint `/api/[slug]/ai/whatsapp` para n8n/Evolution API com x-webhook-secret | SATISFIED — auth via WHATSAPP_WEBHOOK_SECRET; generateText com tools; resposta JSON completa |
| AUTO-05 | Plans 01, 04 | Escalacao automatica quando IA nao tem confianca | SATISFIED — `isLowConfidenceResponse` (finishReason + texto curto + [INCERTO] prefix) wired no whatsapp route |
| AUTO-06 | Plan 04 | Chat interno /[slug]/assistente com streaming via useChat | SATISFIED — streamText + toUIMessageStreamResponse() no chat route; ChatInterface com useChat; page bloqueia visualizador |

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|---------|-----------|
| `tests/actions/whatsapp-endpoint.test.ts` | Nao testa o Route Handler completo (requer OpenAI API key real) — documentado no cabecalho | INFO | Intencional e documentado. Testa a logica de escalacao via `isLowConfidenceResponse` puro — abordagem correta para testes unitarios |
| `tests/actions/chat-isolation.test.ts` | Guard extraido como funcao pura no teste, nao importado do Route Handler | INFO | Intencional — Route Handler nao exporta guards separados. Logica testavel em isolamento |
| `automation-cron/index.ts` linha 42 | `type SupabaseClient = any` | WARN | Necessario em Deno — sem types gerados pelo Supabase CLI para Edge Functions em Deno. Nao e stub. |
| `chat/route.ts` e `whatsapp/route.ts` | `makeTool` helper com `any` cast | INFO | Workaround documentado para AI SDK v6 overload resolution. Sem impacto funcional. |

Nenhum bloqueador encontrado. Sem stubs de dados, sem handlers vazios, sem retornos estaticos onde dados reais sao esperados.

### Human Verification Required

#### 1. RBAC na pagina /configuracoes/automacoes

**Test:** Fazer login como corretor ou visualizador e navegar para `/[slug]/configuracoes/automacoes`
**Expected:** Redirecionamento para `/[slug]/dashboard` — pagina nao acessivel
**Why human:** Guard usa sessao SSR com `user.app_metadata.role` — impossivel simular sem JWT real do Supabase

#### 2. notFound para visualizador em /assistente

**Test:** Fazer login como visualizador e navegar para `/[slug]/assistente`
**Expected:** Pagina 404 renderizada
**Why human:** Depende de sessao real com role=visualizador no JWT

#### 3. Chat streaming funcional

**Test:** Fazer login como corretor, abrir `/[slug]/assistente`, enviar mensagem "Quais apolices vencem nos proximos 30 dias?"
**Expected:** Resposta em streaming aparece progressivamente; tools buscam dados reais de policies
**Why human:** Requer `OPENAI_API_KEY` configurada + servidor Next.js rodando + tenant com dados

#### 4. Endpoint WhatsApp retorna 401 sem secret

**Test:** `curl -s -X POST https://{app}/api/{slug}/ai/whatsapp -H "Content-Type: application/json" -d '{"message":"ola"}'`
**Expected:** HTTP 401, body `{"error":"Unauthorized"}`
**Why human:** Requer servidor de producao com `WHATSAPP_WEBHOOK_SECRET` configurado

#### 5. Escalacao automatica no WhatsApp

**Test:** Enviar mensagem muito ambigua ou que force resposta curta ao endpoint WhatsApp
**Expected:** `{ response: "Nao consegui responder com seguranca...", escalated: true }`
**Why human:** Comportamento do modelo LLM nao e deterministico — requer OpenAI API real

#### 6. Cron diario e webhook_logs

**Test:** Em ambiente Supabase de producao, verificar `cron.job` WHERE jobname='automation-cron-daily'; aguardar execucao ou executar manualmente via SQL Editor; checar insercoes em `webhook_logs`
**Expected:** Linhas em webhook_logs com http_status preenchido e triggered_at no horario esperado
**Why human:** Requer ambiente Supabase com pg_cron + pg_net habilitados (nao disponivel em local sem addon)

#### 7. Botao Testar webhook na UI

**Test:** Como admin, configurar URL de webhook real em Configuracoes > Automacoes, clicar em "Testar"
**Expected:** http_status do destino exibido na UI (ex: 200 OK ou erro de conexao)
**Why human:** Requer UI rodando, servidor Next.js e URL de webhook acessivel externamente

### Gaps Summary

Nenhum gap encontrado. Todos os 6 requisitos AUTO-01 a AUTO-06 possuem implementacao completa e verificada no codigo:

- Os 3 artefatos de banco (migrations 0021/0022/0023) existem com schema correto
- A Edge Function `automation-cron` tem 302 linhas de implementacao real — nao e stub
- O Route Handler de email tem `runtime = 'nodejs'` + React Email + Resend real
- As Server Actions tem RBAC admin-only + SSRF guard via `isUrlSafe`
- O endpoint WhatsApp tem auth via `x-webhook-secret` + `generateText` + escalacao wired
- O chat interno tem `streamText` + `toUIMessageStreamResponse()` + `useChat` wired
- A sidebar tem links condicionais corretos para Automacoes (admin) e Assistente IA (admin/corretor/financeiro)

Os 7 itens de verificacao humana sao todos comportamentais em runtime (sessoes reais, LLM real, cron em producao) — nao indicam lacunas de implementacao.

---

_Verified: 2026-05-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
