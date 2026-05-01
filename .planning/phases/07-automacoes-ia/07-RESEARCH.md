# Phase 7: Automações & IA — Research

**Researched:** 2026-04-30
**Domain:** Supabase Edge Function Cron, Resend Email API, Vercel AI SDK (streamText + tool calling), Webhook dispatch, SSRF mitigations
**Confidence:** HIGH (core stack verified via npm registry + official docs) / MEDIUM (cron pattern, AI streaming details)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Cron job diário via Supabase Edge Function agendada. Horário: 08h BRT (Claude's discretion para hora exata).
- **D-02:** 3 eventos core: `policy_expiring`, `financial_overdue`, `consortium_contemplated`.
- **D-03:** Falha de webhook → logar em `webhook_logs`, sem retry automático.
- **D-04:** Botão "Testar webhook" na UI — envia payload de exemplo e exibe código HTTP.
- **D-05:** Destinatários duplos por evento: corretor responsável + cliente (se tiver email).
- **D-06:** Template personalizável por tenant via `textarea` (assunto + corpo). Variáveis: `{{nome_cliente}}`, `{{cpf_cnpj}}`, `{{vencimento}}`, `{{valor}}`, `{{nome_apolice}}`, `{{corretor}}`.
- **D-07:** Fallback: template padrão do sistema (React Email) se tenant não configurou.
- **D-08:** Nova rota `/[slug]/configuracoes/automacoes` — aba adicional em `/configuracoes`.
- **D-09:** RBAC: apenas `role = 'admin'` acessa `/configuracoes/automacoes`.

### Claude's Discretion

- WhatsApp: plataforma expõe endpoint REST `/api/[slug]/ai/whatsapp` — integração WhatsApp é responsabilidade do n8n/tenant.
- Chat interno: planner decide UI (widget flutuante vs `/[slug]/assistente` dedicada).
- LLM provider: GPT-4o-mini como default via Vercel AI SDK.
- Threshold de escalação: 0.7 como default (confiança < 70% → mensagem de escalação humana).
- RAG fonte de dados: `policies`, `clients`, `consortium_quotas`, `commission_entries` do tenant — planner escolhe tool calling vs RAG.
- Horário do cron: 08h BRT = 11:00 UTC — planner ajusta conforme limitações pg_cron.

### Deferred Ideas (OUT OF SCOPE)

- Editor WYSIWYG de email
- Retry automático de webhook (3x com backoff)
- Integração nativa com WhatsApp Business API
- Múltiplos webhooks por evento (fan-out)
- Email scheduling por horário preferido
- Dashboard de métricas de automações
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTO-01 | Admin pode configurar URL de webhook n8n por evento (vencimento, contemplação, inadimplência) | Tabela `webhook_configs` + UI em `/configuracoes/automacoes` (RBAC admin) |
| AUTO-02 | Sistema dispara webhook para n8n quando evento ocorre, com payload de dados do cliente/apólice | Edge Function cron: pg_cron + net.http_post → `automation-cron/index.ts` |
| AUTO-03 | Sistema envia alertas automáticos por email (Resend) para vencimentos, cobranças e contemplações | Mesmo cron — Resend fetch API em Deno, templates em `email_templates` |
| AUTO-04 | Plataforma oferece endpoint de IA para atendimento via WhatsApp com contexto do cliente injetado (RAG) | Route Handler `/api/[slug]/ai/whatsapp` — streamText + tool calling Supabase |
| AUTO-05 | IA escalona para humano quando confiança da resposta está abaixo do threshold | Lógica de threshold no Server Action / Route Handler — sem ferramenta externa |
| AUTO-06 | Corretor pode usar chat interno assistido por IA para consultar dados de clientes e apólices | Route Handler `/api/[slug]/ai/chat` + useChat (@ai-sdk/react) no Client Component |
</phase_requirements>

---

## Summary

A Phase 7 tem três pilares de implementação tecnicamente independentes que compartilham a mesma base de dados Supabase: (1) Cron job diário via Supabase Edge Function que despacha webhooks e emails; (2) Endpoint REST para IA no WhatsApp; (3) Chat interno assistido por IA para corretores.

O cron job é implementado como uma Supabase Edge Function Deno chamada via `pg_cron + pg_net` — o mesmo mecanismo que o projeto já usa para o custom-access-token hook, mas agendado via SQL. A Edge Function consulta as tabelas existentes (`policies`, `financial_entries`, `consortium_quotas`) com `service_role` key e dispara webhooks HTTP e emails Resend. Email em Deno é feito via `fetch()` direto para a API REST do Resend (sem SDK nativo Deno oficial). Três novas tabelas são necessárias: `webhook_configs`, `webhook_logs`, `email_templates`.

A IA (AUTO-04 a AUTO-06) usa Vercel AI SDK (`ai` v6, `@ai-sdk/openai` v3, `@ai-sdk/react` v1) com `streamText + tool calling` — sem pgvector/RAG. Tool calling é a abordagem correta para este caso: o dataset é pequeno, estruturado e mutável (apólices de um tenant específico), e a precisão importa mais que recall. O LLM recebe ferramentas para consultar Supabase e retorna respostas fundamentadas em dados reais.

**Primary recommendation:** Use tool calling (não pgvector RAG) para injetar contexto do tenant. Use `fetch()` direto para Resend na Edge Function. Configure cron via SQL `pg_cron + pg_net` com `verify_jwt = false` no config.toml da função. Instale `ai`, `@ai-sdk/openai`, `@ai-sdk/react` para o chat.

---

## Standard Stack

### Core (já instalado — verificado em package.json)
| Library | Version Instalada | Purpose | Status |
|---------|-------------------|---------|--------|
| `zod` | ^3.25.76 | Schema validation (tool input schemas) | Instalado |
| `@supabase/supabase-js` | ^2.104.0 | Supabase client para Edge Function e Route Handlers | Instalado |
| `@supabase/ssr` | ^0.10.2 | SSR client (Route Handlers de IA) | Instalado |
| `react-hook-form` | ^7.73.1 | Formulários de configuração de webhooks/templates | Instalado |

### A Instalar (verificado via npm registry em 2026-04-30)
| Library | Versão Atual | Purpose | Por que |
|---------|-------------|---------|---------|
| `ai` | 6.0.172 | Vercel AI SDK core — `streamText`, `tool`, `generateText` | SDK oficial Vercel para LLMs; suporte nativo Next.js App Router |
| `@ai-sdk/openai` | 3.0.55 | Provider OpenAI para Vercel AI SDK | GPT-4o-mini via `openai('gpt-4o-mini')` |
| `@ai-sdk/react` | 1.x (bundle via `ai`) | `useChat` hook para Client Component | Streaming de chat na UI interna |

**Nota de versão:** O pacote `ai` v6 (`6.0.172`) exporta `@ai-sdk/react` — instalar `ai` é suficiente para `useChat`. Verificar se `@ai-sdk/react` precisa ser instalado separadamente na v6. [ASSUMED — verificar no npm install]

**Resend — sem SDK Deno oficial:** A Edge Function usa `fetch()` direto para `https://api.resend.com/emails`. O SDK Node.js (`resend@6.12.2`) funciona em ambiente Next.js/Server Actions mas NÃO em Deno nativo. [VERIFIED: resend.com/deno]

**Installation:**
```bash
npm install ai @ai-sdk/openai @ai-sdk/react
```

**Version verification:** [VERIFIED: npm registry 2026-04-30]
- `ai` 6.0.172 (publicado 2026-04-30)
- `@ai-sdk/openai` 3.0.55
- `@supabase/supabase-js` latest: 2.105.1 (projeto usa 2.104.0 — OK, sem necessidade de upgrade)

### Alternativas Consideradas
| Em vez de | Poderia usar | Tradeoff |
|-----------|-------------|----------|
| Tool calling (sem pgvector) | pgvector + embeddings (RAG full) | RAG: overkill para dataset pequeno e estruturado; tool calling é mais preciso, mais rápido de implementar, sem infraestrutura de embeddings |
| `fetch()` Resend em Deno | `resend` npm SDK | SDK npm não funciona em Deno sem compatibilidade layer; fetch direto é a abordagem oficial Resend para Deno |
| pg_cron + pg_net (SQL) | Vercel Cron Jobs | Vercel Cron exige plano Pro e é separado do Supabase; pg_cron é nativo ao ecossistema Supabase já em uso |

---

## Architecture Patterns

### Estrutura de Arquivos Recomendada
```
supabase/
├── functions/
│   ├── custom-access-token/       # Existente
│   └── automation-cron/           # NOVO
│       └── index.ts               # Edge Function Deno — cron handler
├── migrations/
│   └── 20260420_0021_automacoes_schema.sql  # webhook_configs, webhook_logs, email_templates
│   └── 20260420_0022_automacoes_rls.sql     # RLS policies para as 3 tabelas
└── config.toml                    # Adicionar [functions.automation-cron]

src/app/
├── (app)/[slug]/
│   ├── configuracoes/
│   │   └── automacoes/            # NOVO — RBAC admin only
│   │       └── page.tsx           # Server Component + guard redirect
│   │           automacoes-tabs.tsx # Client: tabs Webhooks | Templates Email
│   │           webhook-config-form.tsx  # RHF + Server Action
│   │           email-template-form.tsx  # RHF + Server Action
│   │           webhook-logs-table.tsx   # Data table de logs
│   └── assistente/                # NOVO (ou widget flutuante — planner decide)
│       └── page.tsx               # Chat interno corretor
│           chat-window.tsx        # 'use client' — useChat
└── api/[slug]/
    ├── ai/
    │   ├── chat/
    │   │   └── route.ts           # POST — streamText + tool calling (AUTO-06)
    │   └── whatsapp/
    │       └── route.ts           # POST — recebe payload externo, responde JSON (AUTO-04/05)
    └── webhook-test/
        └── route.ts               # POST — "Testar webhook" button (D-04)
```

### Pattern 1: Supabase Edge Function Agendada (Cron)

**O que é:** Edge Function Deno invocada por `pg_cron + pg_net` via SQL. Não há cron nativo no config.toml — o agendamento é SQL executado no banco.

**Configuração em config.toml:**
```toml
# Adicionar após [functions.custom-access-token]
[functions.automation-cron]
verify_jwt = false
```
[VERIFIED: supabase.com/docs/guides/functions/function-configuration]

**SQL de agendamento (executar via migration ou SQL editor):**
```sql
-- Habilitar extensões (caso não estejam ativas no projeto)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Armazenar URL e chave no Vault
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
SELECT vault.create_secret('<SUPABASE_ANON_KEY>', 'publishable_key');

-- Agendar: 08h BRT = 11:00 UTC (pg_cron usa UTC)
SELECT cron.schedule(
  'automation-cron-daily',
  '0 11 * * *',   -- 11:00 UTC = 08:00 BRT (UTC-3)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/automation-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
```
[CITED: supabase.com/docs/guides/functions/schedule-functions]

**IMPORTANTE — BRT vs UTC:** pg_cron opera exclusivamente em UTC. 08:00 BRT (UTC-3) = 11:00 UTC = cron `0 11 * * *`. [VERIFIED: múltiplas fontes concordam que pg_cron usa UTC]

**Estrutura da Edge Function `automation-cron/index.ts`:**
```typescript
// Source: baseado em supabase/functions/custom-access-token/index.ts (padrão do projeto)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0'

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // service_role: bypassa RLS para ler todos os tenants
    )

    // 1. Detectar eventos pendentes (policy_expiring, financial_overdue, consortium_contemplated)
    // 2. Para cada evento: consultar webhook_configs do tenant
    // 3. Disparar POST para URL configurada + logar em webhook_logs
    // 4. Enviar email via fetch() Resend API
    
    return new Response(JSON.stringify({ processed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('automation-cron error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
```

**Variáveis de ambiente da Edge Function:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase em Edge Functions — não precisam ser declarados manualmente. `RESEND_API_KEY` deve ser configurado via `supabase secrets set RESEND_API_KEY=<key>`. [ASSUMED — padrão documentado Supabase mas não verificado na sessão]

### Pattern 2: Resend via fetch() em Deno

**O que é:** Sem SDK nativo Deno — usar REST API diretamente.

```typescript
// Source: resend.com/deno — abordagem oficial para Deno
async function sendEmail(params: {
  to: string[]
  subject: string
  html: string
  from?: string
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
    },
    body: JSON.stringify({
      from: params.from ?? 'NEXUS AGENT <noreply@suacorretora.com.br>',
      to: params.to,              // array de strings — suporta múltiplos destinatários
      subject: params.subject,
      html: params.html,
    }),
  })
  return res.ok
}
```

**Múltiplos destinatários:** O campo `to` aceita array — `['corretor@email.com', 'cliente@email.com']`. Uma única chamada à API envia para todos. [CITED: resend.com/deno + API docs padrão Resend]

**Substituição de variáveis de template:** Server-side string replace simples — sem template engine externa:
```typescript
function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  )
}
// Uso: renderTemplate(template.body, { nome_cliente: 'João', vencimento: '2026-05-30', ... })
```

### Pattern 3: Vercel AI SDK — streamText + Tool Calling

**O que é:** Route Handler Next.js que recebe mensagens, executa queries Supabase via tools e retorna stream.

```typescript
// src/app/api/[slug]/ai/chat/route.ts
// Source: ai-sdk.dev/docs/getting-started/nextjs-app-router
import { streamText, tool, UIMessage, convertToModelMessages } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { messages }: { messages: UIMessage[] } = await request.json()

  // Auth + tenant isolation (padrão do projeto — igual ao export/route.ts)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const meta = user.app_metadata as { slug?: string; tenant_id?: string }
  if (!meta.slug || meta.slug !== slug) return new Response('Forbidden', { status: 403 })

  const result = streamText({
    model: openai('gpt-4o-mini'),     // GPT-4o-mini: D-01 discretion
    system: `Você é um assistente para corretores de seguros e consórcio. 
              Responda apenas sobre dados do tenant ${slug}. 
              Se não encontrar dados, informe que não há registros.`,
    messages: await convertToModelMessages(messages),
    maxSteps: 5,                       // allow multi-step tool calls
    tools: {
      buscarClientes: tool({
        description: 'Busca clientes do tenant por nome ou documento',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from('clients')
            .select('id, name, type, document, email, phone')
            .or(`name.ilike.%${query.slice(0, 50)}%,document.ilike.%${query.slice(0, 14)}%`)
            .is('deleted_at', null)
            .limit(10)
          return data ?? []
        }
      }),
      buscarApolices: tool({
        description: 'Busca apólices do tenant por número ou cliente',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from('policies')
            .select('id, policy_number, type, insurer, vigencia_fim, premio_total, client:clients(name)')
            .or(`policy_number.ilike.%${query.slice(0, 50)}%`)
            .is('deleted_at', null)
            .limit(10)
          return data ?? []
        }
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
```

**Client Component — useChat:**
```typescript
// 'use client'
import { useChat } from '@ai-sdk/react'

export function ChatWindow({ slug }: { slug: string }) {
  const { messages, sendMessage } = useChat({
    api: `/${slug}/api/ai/chat`,  // ou /api/${slug}/ai/chat — ajustar path
  })
  // ...render messages
}
```
[CITED: ai-sdk.dev/docs/getting-started/nextjs-app-router]

**NOTA API v6:** O AI SDK v6 mudou alguns nomes de exports. `toDataStreamResponse()` foi renomeado para `toUIMessageStreamResponse()`. `useChat` agora usa arquitetura transport-based e não gerencia input state internamente. [VERIFIED: ai-sdk.dev docs + vercel.com/blog/ai-sdk-6]

### Pattern 4: Endpoint WhatsApp (AUTO-04/05)

**O que é:** Route Handler que recebe payload do n8n/Evolution API, processa via IA, retorna JSON (não streaming).

```typescript
// src/app/api/[slug]/ai/whatsapp/route.ts
import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = await request.json()
  // body.message: string (mensagem do cliente WhatsApp)
  // body.phone: string (número do remetente)
  
  // Sem sessão de usuário — proteção via shared secret (ver Security Domain)
  const authHeader = request.headers.get('x-webhook-secret')
  if (authHeader !== process.env.WHATSAPP_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // generateText (não stream) — WhatsApp precisa de resposta completa, não stream
  const { text, finishReason } = await generateText({
    model: openai('gpt-4o-mini'),
    system: `...contexto do tenant ${slug}...`,
    prompt: body.message,
    maxSteps: 3,
    tools: { /* mesmas tools do chat interno */ },
  })

  // AUTO-05: escalação por finish reason
  const lowConfidence = finishReason === 'max-steps' || text.length < 20
  
  return Response.json({
    response: lowConfidence
      ? 'Não consegui responder com segurança. Um corretor irá te atender em breve.'
      : text,
    escalated: lowConfidence,
  })
}
```

**Nota sobre escalação (AUTO-05):** A confiança da resposta do LLM não é um número nativo do `streamText`/`generateText`. A escalação deve ser detectada por heurísticas: `finishReason === 'max-steps'` (atingiu limite sem resolver), `finish_reason === 'content_filter'`, ou response muito curta/genérica. O threshold de 0.7 pode ser implementado como flag booleano baseado nessas heurísticas — não há API nativa de "confiança" no Vercel AI SDK. [ASSUMED — behavior de escalação baseado em heurísticas]

### Pattern 5: Botão "Testar Webhook" (D-04)

**O que é:** Route Handler ou Server Action que dispara uma request HTTP para a URL configurada e retorna o status code.

```typescript
// src/app/api/[slug]/webhook-test/route.ts
// POST body: { url: string, event_type: string }
export async function POST(request: Request, ...) {
  // Auth + RBAC admin guard (igual ao export/route.ts)
  const { url, event_type } = await request.json()
  
  // SSRF protection (ver Security Domain)
  const parsedUrl = new URL(url)
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return Response.json({ error: 'Protocolo inválido' }, { status: 400 })
  }
  // Block private IP ranges (RFC 1918 + loopback)
  // ...validação de hostname
  
  const samplePayload = buildSamplePayload(event_type)
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    })
    return Response.json({ status: res.status, ok: res.ok, payload: samplePayload })
  } catch (err) {
    return Response.json({ error: String(err), status: 0 }, { status: 200 })
  }
}
```

### Anti-Patterns a Evitar

- **Usar service_role no cliente:** Service_role bypassa RLS. Usar apenas em Edge Functions e Server Actions. Nunca expor ao browser.
- **Usar streaming para WhatsApp:** n8n/Evolution espera JSON response completo — usar `generateText` (não `streamText`) no endpoint WhatsApp.
- **Guardar URL de webhook sem validação SSRF:** Admin pode configurar qualquer URL — validar protocolo e bloquear IPs privados.
- **Template com variáveis sem escape HTML:** `{{nome_cliente}}` pode conter `<script>`. Escapar antes de inserir em HTML de email.
- **Usar `'* * * * *'` pg_cron para BRT sem converter para UTC:** pg_cron usa UTC exclusivamente — 08:00 BRT = `0 11 * * *` UTC.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar em vez disso | Por que |
|----------|---------------|-------------------|---------|
| LLM streaming chat | WebSockets manuais, SSE manual | `streamText` + `useChat` (Vercel AI SDK) | Protocolo AI streaming, retry, cancel, tool call handling |
| Template engine | Parser de `{{variáveis}}` complexo | `String.replaceAll()` simples | 6 variáveis fixas — regex overkill; replaceAll é suficiente e seguro |
| Retry de webhook | Fila de retry customizada | Nada (decisão D-03: sem retry) | Out of scope nesta fase |
| Auth em Route Handler de IA | JWT parsing manual | `createClient()` + `supabase.auth.getUser()` | Padrão estabelecido no projeto (ver export/route.ts) |
| Cron scheduler | Vercel Cron, BullMQ, cron em Node | `pg_cron` via SQL | Nativo ao Supabase, sem infra adicional, já disponível no projeto |
| Embeddings/RAG | pgvector, chunking, similarity search | Tool calling (query SQL direta) | Dataset do tenant é pequeno e estruturado; tool calling > RAG neste caso |

---

## New Tables Required

### `webhook_configs` — Configuração por tenant e por evento

```sql
CREATE TABLE public.webhook_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  event_type    TEXT NOT NULL CHECK (event_type IN ('policy_expiring', 'financial_overdue', 'consortium_contemplated')),
  url           TEXT NOT NULL,
  days_before   INTEGER CHECK (days_before > 0),  -- para policy_expiring: X dias antes
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_configs_tenant_event_unique UNIQUE (tenant_id, event_type) WHERE deleted_at IS NULL
);

CREATE INDEX idx_webhook_configs_tenant_id ON public.webhook_configs(tenant_id);
CREATE INDEX idx_webhook_configs_event_type ON public.webhook_configs(event_type);
CREATE INDEX idx_webhook_configs_active ON public.webhook_configs(active) WHERE active = true AND deleted_at IS NULL;
```

**RLS:** Apenas admin do tenant pode ler/gravar. Service_role ignora RLS (Edge Function).

### `webhook_logs` — Histórico de disparos

```sql
CREATE TABLE public.webhook_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  event_type    TEXT NOT NULL,
  config_id     UUID REFERENCES public.webhook_configs(id),
  url_destino   TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  http_status   INTEGER,              -- NULL se timeout/network error
  error_message TEXT,                 -- NULL se sucesso
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SEM deleted_at, SEM updated_at: log é imutável (append-only)
);

-- Índice composto para listagem paginada admin (especificado em 07-CONTEXT.md §Specifics)
CREATE INDEX idx_webhook_logs_tenant_created ON public.webhook_logs(tenant_id, triggered_at DESC);
CREATE INDEX idx_webhook_logs_config_id ON public.webhook_logs(config_id);
```

**RLS:** Admin do tenant pode SELECT. Nenhum INSERT/UPDATE/DELETE via RLS — escrita apenas via service_role (Edge Function).

### `email_templates` — Templates por tenant e por evento

```sql
CREATE TABLE public.email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id),
  event_type    TEXT NOT NULL CHECK (event_type IN ('policy_expiring', 'financial_overdue', 'consortium_contemplated')),
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,        -- textarea com variáveis {{nome_cliente}} etc.
  active        BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_templates_tenant_event_unique UNIQUE (tenant_id, event_type) WHERE deleted_at IS NULL
);

CREATE INDEX idx_email_templates_tenant_id ON public.email_templates(tenant_id);
CREATE INDEX idx_email_templates_event_type ON public.email_templates(event_type);
```

**RLS:** Admin SELECT/INSERT/UPDATE. Leitura pela Edge Function via service_role.

### Dados existentes consultados pelo cron

| Tabela | Campos relevantes | Condição do evento |
|--------|------------------|--------------------|
| `policies` | `vigencia_fim`, `assigned_to`, `client_id`, `type` | `vigencia_fim BETWEEN today AND today + days_before` |
| `financial_entries` | `due_date`, `status`, `client_id` | `due_date < today AND status = 'pending'` |
| `consortium_quotas` | `contemplation_date`, `status`, `assigned_to`, `client_id` | `status = 'contemplado' AND contemplation_date >= today - 1` |
| `clients` | `email`, `name`, `document` | JOIN em qualquer evento |
| `profiles` | `full_name` | JOIN para email do corretor (via `auth.users` para email) |

**Nota:** O email do corretor vem de `auth.users.email` (não de `profiles`). A Edge Function com service_role pode fazer `supabase.auth.admin.getUserById(profile.id)` para obter o email. [ASSUMED — padrão Supabase Auth Admin API]

---

## Common Pitfalls

### Pitfall 1: pg_cron usa UTC, BRT é UTC-3
**O que dá errado:** Configurar `0 8 * * *` esperando 8h BRT recebe 5h da manhã no Brasil.
**Por que acontece:** pg_cron interpreta todos os horários como UTC — sem fuso horário configurável por job.
**Como evitar:** Converter sempre: hora BRT + 3 = hora UTC. 08:00 BRT = `0 11 * * *` UTC.
**Sinal de alerta:** Cron rodando 3 horas antes do esperado.

### Pitfall 2: verify_jwt = false sem proteção própria
**O que dá errado:** Edge Function acessível por qualquer request sem autenticação.
**Por que acontece:** `verify_jwt = false` desabilita o gateway-level JWT check — necessário para cron (que usa publishable key, não user JWT).
**Como evitar:** Validar o header `Authorization: Bearer <publishable_key>` dentro da função antes de processar, ou validar um `x-cron-secret` customizado.
**Sinal de alerta:** Função processa requests sem header de autenticação.

### Pitfall 3: SSRF via URL de webhook configurada pelo admin
**O que dá errado:** Admin configura URL `http://localhost/internal-api` ou `http://169.254.169.254/` (AWS metadata) — sistema faz request para infra interna.
**Por que acontece:** URL de webhook é user-supplied e disparada server-side (Edge Function ou Server Action).
**Como evitar:** Validar no Server Action de save AND no disparo: `new URL(url)` + block `localhost`, `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `172.16.x.x`, `169.254.x.x`.
**Sinal de alerta:** URL de webhook aponta para IP privado ou loopback.

### Pitfall 4: HTML injection em templates de email
**O que dá errado:** `{{nome_cliente}}` contém `<script>alert(1)</script>` — inserido sem escape no HTML do email.
**Por que acontece:** O body do template é HTML livre editado pelo admin. Se o valor de variável vier de dados do cliente (nome, por exemplo), pode conter tags HTML.
**Como evitar:** Escapar os valores das variáveis antes de substituir: `value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')`.
**Sinal de alerta:** Conteúdo HTML inesperado em emails enviados.

### Pitfall 5: AI SDK v6 — exports e API mudaram
**O que dá errado:** Importar `toDataStreamResponse()` que foi renomeado; usar API de `useChat` do AI SDK v4/v5.
**Por que acontece:** AI SDK 6 (lançado recentemente) mudou exports: `toDataStreamResponse` → `toUIMessageStreamResponse`; `useChat` não gerencia input state internamente mais.
**Como evitar:** Seguir docs de `ai-sdk.dev` versão 6. Importar `{ streamText, tool, UIMessage, convertToModelMessages }` de `'ai'`. Usar `useChat` de `'@ai-sdk/react'`.
**Sinal de alerta:** TypeScript errors ao importar funções conhecidas do AI SDK.

### Pitfall 6: generateText vs streamText para WhatsApp
**O que dá errado:** Usar `streamText` no endpoint WhatsApp — n8n/Evolution recebe stream de bytes, não JSON, e não sabe processar.
**Por que acontece:** WhatsApp precisa de response completo (JSON) para encaminhar ao usuário; stream funciona apenas para UI em tempo real.
**Como evitar:** Usar `generateText` (não `streamText`) no Route Handler de WhatsApp. Retornar `Response.json({ response: text })`.
**Sinal de alerta:** n8n recebe resposta truncada ou erro de parsing.

### Pitfall 7: Escalação de IA sem campo nativo de confiança
**O que dá errado:** Tentar ler `result.confidence` do Vercel AI SDK — não existe.
**Por que acontece:** LLMs não expõem score de confiança nativo via API pública.
**Como evitar:** Usar heurísticas: `finishReason === 'max-steps'`, resposta muito curta, ou prompt o próprio LLM a incluir `[INCERTO]` no início se não tiver dados suficientes.
**Sinal de alerta:** Tentar acessar `.confidence` retorna undefined sem erro de compilação.

---

## Code Examples

### Cron Event Detection Logic (Edge Function)
```typescript
// Detectar apólices vencendo em X dias (policy_expiring)
// Source: baseado nos schemas de migrations existentes
const today = new Date().toISOString().slice(0, 10)

// Buscar configurações de webhook ativas para policy_expiring
const { data: configs } = await supabase
  .from('webhook_configs')
  .select('*')
  .eq('event_type', 'policy_expiring')
  .eq('active', true)
  .is('deleted_at', null)

for (const config of configs ?? []) {
  const daysAhead = config.days_before ?? 30
  const futureDate = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10)
  
  const { data: policies } = await supabase
    .from('policies')
    .select('id, policy_number, vigencia_fim, insurer, client:clients(name, email, document), profile:profiles!assigned_to(id, full_name)')
    .eq('tenant_id', config.tenant_id)
    .gte('vigencia_fim', today)
    .lte('vigencia_fim', futureDate)
    .is('deleted_at', null)
  
  for (const policy of policies ?? []) {
    await dispatchWebhook(config, 'policy_expiring', policy)
    await sendAlertEmail(config.tenant_id, 'policy_expiring', policy)
  }
}
```

### Webhook Dispatch com Log
```typescript
async function dispatchWebhook(config: WebhookConfig, eventType: string, data: unknown) {
  const payload = { event: eventType, timestamp: new Date().toISOString(), data }
  let httpStatus: number | null = null
  let errorMessage: string | null = null

  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),  // 15s timeout
    })
    httpStatus = res.status
  } catch (err) {
    errorMessage = String(err)
  }

  // Log sempre — sucesso ou falha (D-03: log and continue)
  await supabase.from('webhook_logs').insert({
    tenant_id: config.tenant_id,
    event_type: eventType,
    config_id: config.id,
    url_destino: config.url,
    payload,
    http_status: httpStatus,
    error_message: errorMessage,
  })
}
```

### RLS Policy Pattern (baseado no padrão estabelecido)
```sql
-- webhook_configs: admin SELECT/INSERT/UPDATE
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_configs_admin_manage" ON public.webhook_configs
  FOR ALL TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );

-- webhook_logs: admin SELECT apenas (escritas via service_role/Edge Function)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_logs_admin_select" ON public.webhook_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) = 'admin'
  );
```

### SSRF Validation
```typescript
// Source: OWASP SSRF Prevention Cheat Sheet
function isUrlSafe(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  
  const hostname = parsed.hostname.toLowerCase()
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ]
  
  return !privatePatterns.some(p => p.test(hostname))
}
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|------------------|-----------------|--------------|---------|
| RAG completo (pgvector) para qualquer dado | Tool calling para dados estruturados pequenos | 2024-2025 | Tool calling é mais simples, mais rápido, mais preciso para datasets estruturados |
| `toDataStreamResponse()` no AI SDK | `toUIMessageStreamResponse()` | AI SDK v6 (2026) | Breaking change — importações devem ser atualizadas |
| `@supabase/auth-helpers` | `@supabase/ssr` | 2024 | auth-helpers deprecado — projeto já usa `@supabase/ssr` |
| `useChat` com input state interno | `useChat` com transport-based architecture | AI SDK v5+ | Input state não gerenciado pelo hook — componente gerencia próprio input |

**Deprecated/Outdated:**
- `serve()` do Deno std (`import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'`): Deno 2 usa `Deno.serve()` nativo — padrão já usado no `custom-access-token/index.ts`.
- `toDataStreamResponse()`: renomeado para `toUIMessageStreamResponse()` no AI SDK v6.

---

## Assumptions Log

| # | Claim | Section | Risk se Errado |
|---|-------|---------|---------------|
| A1 | SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente nas Edge Functions sem declaração manual | Architecture Patterns (Pattern 1) | Se não forem auto-injetados, Edge Function falha com env vars undefined — corrigir adicionando ao secrets |
| A2 | `@ai-sdk/react` está incluído no bundle do `ai` v6 e não precisa de instalação separada | Standard Stack | Se precisar de instalação separada, adicionar `npm install @ai-sdk/react` |
| A3 | Email do corretor vem de `auth.users.email` acessível via `supabase.auth.admin.getUserById()` na Edge Function | Architecture Patterns / New Tables | Se não disponível, alternativa: adicionar campo `email` em `profiles` |
| A4 | `finishReason === 'max-steps'` é indicativo suficiente para escalação de IA (AUTO-05) | Pattern 4 (WhatsApp endpoint) | Se finish reasons mudaram no AI SDK v6, usar alternativa baseada em prompt engineering |
| A5 | `AbortSignal.timeout(15000)` está disponível no Deno runtime da Edge Function | Pattern de webhook dispatch | Se não disponível, usar `Promise.race()` com `setTimeout` como fallback |

---

## Open Questions

1. **Vault Secrets vs Env Vars para auth do cron**
   - O que sabemos: pg_cron usa `net.http_post()` com headers; Supabase recomenda Vault para armazenar publishable key
   - O que está unclear: se a forma recomendada é publishable key (anon) + `verify_jwt = false` + validação própria, ou service_role via Vault (mais seguro mas mais complexo de configurar)
   - Recomendação: Usar publishable key (anon key) no header Authorization da cron request + validar um `x-cron-secret` customizado dentro da Edge Function — mais simples e seguro

2. **Chat interno: widget flutuante vs página dedicada**
   - O que sabemos: CONTEXT.md deixou para o planner decidir; sidebar já tem estrutura `children` para sub-items de Configurações
   - O que está unclear: se o chat deve ser acessível em todas as páginas (widget) ou apenas em `/[slug]/assistente`
   - Recomendação: Página dedicada `/[slug]/assistente` para v1 — mais simples de implementar, fácil de evoluir para widget depois

3. **Threshold de escalação (AUTO-05) — valor configurável ou hardcoded**
   - O que sabemos: CONTEXT.md diz threshold default 0.7, planner pode decidir se configurável via UI
   - Recomendação: Hardcoded 0.7 via heurísticas (`max-steps`, resposta curta, `[INCERTO]` no response) para v1 — configurável via UI é V2

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm install ai` | Yes | v24.14.0 | — |
| `pg_cron` extension | AUTO-02 cron scheduling | [ASSUMED] enabled no Supabase hosted | Verificar em SQL Editor: `SELECT * FROM pg_extension WHERE extname = 'pg_cron'` | Usar Supabase Cron dashboard para ativar |
| `pg_net` extension | net.http_post() | [ASSUMED] enabled no Supabase hosted | Verificar: `SELECT * FROM pg_extension WHERE extname = 'pg_net'` | Ativar via Dashboard > Extensions |
| Supabase Vault | Armazenamento de publishable_key | [ASSUMED] enabled | Verificar via `SELECT vault.create_secret(...)` | Hardcode no SQL (menos seguro, aceitável para início) |
| OpenAI API key | GPT-4o-mini (AUTO-04/05/06) | Não verificado nesta sessão | — | Configurar em `.env.local` como `OPENAI_API_KEY` |
| Resend API key | Emails automáticos (AUTO-03) | Não verificado | — | Configurar como `RESEND_API_KEY` em Supabase secrets |

**Missing dependencies with no fallback:**
- OpenAI API key: sem ela AUTO-04/05/06 não funcionam. Deve ser configurada antes da execução.
- Resend API key: sem ela AUTO-03 não envia emails. Configurar como Supabase secret para Edge Function.

**Missing dependencies with fallback:**
- pg_cron / pg_net: ativáveis via Dashboard sem mudança de código.
- Supabase Vault: pode ser substituído por env var no SQL (menos seguro).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (exists) |
| Test directory | `tests/` (padrão do projeto) |
| Quick run command | `npm test -- --run tests/actions/webhook-configs.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | Admin configura URL de webhook; non-admin é rejeitado | unit (Server Action) | `npm test -- --run tests/actions/webhook-configs.test.ts` | No — Wave 0 |
| AUTO-01 | Template de email salvo e recuperado corretamente | unit (Server Action) | `npm test -- --run tests/actions/email-templates.test.ts` | No — Wave 0 |
| AUTO-02 | dispatchWebhook() loga em webhook_logs com http_status correto | unit (Edge Function logic) | `npm test -- --run tests/utils/dispatch-webhook.test.ts` | No — Wave 0 |
| AUTO-02 | SSRF: URL privada rejeitada por isUrlSafe() | unit (validation) | `npm test -- --run tests/validations/webhook-url.test.ts` | No — Wave 0 |
| AUTO-03 | renderTemplate() substitui todas as 6 variáveis corretamente | unit (util) | `npm test -- --run tests/utils/email-template.test.ts` | No — Wave 0 |
| AUTO-03 | renderTemplate() escapa HTML em valores de variáveis | unit (util) | `npm test -- --run tests/utils/email-template.test.ts` | No — Wave 0 |
| AUTO-04 | Endpoint `/api/[slug]/ai/whatsapp` retorna 401 sem secret header | integration (Route Handler) | manual (requer env OpenAI) | No — Wave 0 |
| AUTO-05 | Resposta com `finishReason === 'max-steps'` retorna `escalated: true` | unit (lógica de escalação) | `npm test -- --run tests/utils/ai-escalation.test.ts` | No — Wave 0 |
| AUTO-06 | Endpoint `/api/[slug]/ai/chat` retorna 401 sem sessão | integration (Route Handler) | manual (requer env OpenAI) | No — Wave 0 |
| AUTO-06 | Cross-tenant: slug do JWT != slug da rota retorna 403 | unit (auth guard) | `npm test -- --run tests/auth/ai-chat-rbac.test.ts` | No — Wave 0 |

**Observação:** Testes de Route Handlers de IA são de difícil automação sem OpenAI API key real. Os testes de unidade cobrem: Server Actions de configuração, lógica pura de rendering de template, validação de URL (SSRF), e lógica de escalação — todos testáveis sem dependência externa.

### Sampling Rate
- **Per task commit:** `npm test -- --run tests/actions/` + `npm test -- --run tests/validations/`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green antes de `/gsd-verify-work`

### Wave 0 Gaps (todos os arquivos de teste são novos)
- [ ] `tests/actions/webhook-configs.test.ts` — CRUD de webhook_configs + RBAC admin-only
- [ ] `tests/actions/email-templates.test.ts` — CRUD de email_templates + RBAC
- [ ] `tests/utils/dispatch-webhook.test.ts` — lógica de disparo e log (mock fetch)
- [ ] `tests/validations/webhook-url.test.ts` — isUrlSafe() — IPs privados, protocolos inválidos
- [ ] `tests/utils/email-template.test.ts` — renderTemplate() com 6 variáveis + HTML escaping
- [ ] `tests/utils/ai-escalation.test.ts` — lógica de escalação por heurísticas
- [ ] `tests/auth/ai-chat-rbac.test.ts` — cross-tenant guard no chat endpoint

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `createClient() + supabase.auth.getUser()` em Route Handlers; `x-webhook-secret` em WhatsApp endpoint |
| V3 Session Management | No | Gerenciado pelo `@supabase/ssr` (padrão existente) |
| V4 Access Control | Yes | RBAC: `role = 'admin'` para configuracoes/automacoes; RLS em `webhook_configs`, `email_templates`, `webhook_logs` |
| V5 Input Validation | Yes | SSRF: validação de URL antes de salvar + antes de disparar; HTML escaping em template vars; Zod em tool inputSchema |
| V6 Cryptography | No | Sem criptografia custom — Supabase Vault para secrets |

### Known Threat Patterns

| Pattern | STRIDE | Mitigação Padrão |
|---------|--------|-----------------|
| SSRF via URL de webhook | Elevation of Privilege | `isUrlSafe()`: bloquear IPs RFC1918 + loopback + esquemas não-http/https |
| Prompt injection no chat IA | Tampering | System prompt com instrução explícita de scope; tool inputSchema com Zod (não aceitar SQL raw) |
| Cross-tenant data via AI | Information Disclosure | `createClient()` autenticado (RLS ativa) nas tools do chat; validação `meta.slug === slug` no Route Handler |
| Endpoint WhatsApp sem auth | Elevation of Privilege | `x-webhook-secret` header validado contra `process.env.WHATSAPP_WEBHOOK_SECRET` |
| HTML injection em email template | Tampering | Escapar valores de variáveis antes de substituir em body_html |
| Admin configura template com `<script>` | Tampering | Body do email é texto/HTML por design — admin é confiado, mas sanitizar scripts óbvios com `DOMPurify` ou regex simples |

---

## Sources

### Primary (HIGH confidence)
- [npm registry: ai@6.0.172] — versão atual verificada em 2026-04-30
- [npm registry: @ai-sdk/openai@3.0.55] — versão atual verificada
- [npm registry: resend@6.12.2] — versão atual verificada
- [supabase.com/docs/guides/functions/function-configuration] — `verify_jwt = false` em config.toml
- [supabase.com/docs/guides/functions/schedule-functions] — `pg_cron + pg_net + vault` para agendar Edge Functions
- [resend.com/deno] — fetch() direto para Resend API em Deno (sem SDK nativo)
- [ai-sdk.dev/docs/getting-started/nextjs-app-router] — streamText + useChat + toUIMessageStreamResponse
- Codebase: `supabase/functions/custom-access-token/index.ts` — padrão Deno.serve + createClient service_role
- Codebase: `src/app/api/[slug]/export/route.ts` — padrão auth + tenant isolation em Route Handler
- Codebase: `supabase/migrations/*.sql` — schemas existentes (policies, financial_entries, consortium_quotas, clients)
- Codebase: `src/components/auth/sidebar-shell.tsx` — estrutura de sidebar + children para sub-items

### Secondary (MEDIUM confidence)
- [supabase.com/docs/guides/cron/quickstart] — SQL de cron.schedule() com net.http_post()
- [vercel.com/blog/ai-sdk-6] — breaking changes AI SDK v6 (toUIMessageStreamResponse, useChat transport-based)
- [OWASP SSRF Prevention Cheat Sheet] — padrão de validação de URL para mitigar SSRF

### Tertiary (LOW confidence)
- Múltiplas fontes de busca web concordam que pg_cron usa UTC exclusivamente — não verificado via documentação pg_cron diretamente nesta sessão

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versões verificadas via npm registry em 2026-04-30
- Supabase Cron (pg_cron + pg_net): MEDIUM — documentação oficial acessada, SQL pattern confirmado; detalhes de Vault e autenticação do cron têm área cinza (assunção A1)
- Vercel AI SDK v6: MEDIUM — docs acessadas mas API v6 tem poucas referências em produção ainda
- Architecture Patterns: HIGH — baseado em padrões existentes no codebase (export/route.ts, custom-access-token/index.ts)
- Pitfalls: HIGH — baseados em padrões estabelecidos do projeto + documentação oficial
- Security: HIGH — SSRF e RLS são padrões bem documentados

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (AI SDK muda rapidamente; verificar changelog antes de implementar)
