# Technology Stack — NEXUS AGENT

**Project:** SaaS multi-tenant para corretoras de seguros e consórcio no Brasil
**Researched:** 2026-04-19
**Overall confidence:** HIGH (core stack validated; supporting libraries MEDIUM-HIGH)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (stable) | Full-stack React framework | App Router + Server Components + Server Actions — elimina uma camada de API separada. Vercel-first deployment. Note: Next.js 16 existe mas 15.x é o ponto de estabilidade comprovado para produção. |
| TypeScript | 5.x | Type safety | Obrigatório para um domínio com regras de negócio complexas (apólices, comissões, vigências). Erros de tipo detectados em compile-time evitam bugs em produção. |
| React | 19.x | UI runtime | Incluído com Next.js 15. Server Components reduzem JS enviado ao cliente — importante para dashboards pesados de dados. |

**Decisão de arquitetura Next.js:** Usar App Router exclusivamente. Pages Router está em modo manutenção. Server Components para todas as páginas de dados (leitura-pesada). Client Components apenas onde necessário (formulários interativos, tempo real).

---

### Backend & Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | Latest (gerenciado) | PostgreSQL + Auth + Storage + Realtime | Backend completo sem gerenciar infra. RLS nativo no PostgreSQL — isolamento de tenant sem código de aplicação. |
| PostgreSQL | 15+ (via Supabase) | Banco relacional | Relações complexas entre apólices, clientes, comissões e parcelas de consórcio se beneficiam de FK constraints reais e transações ACID. |
| Supabase Auth | — | Autenticação | Integração nativa com RLS. @supabase/ssr para SSR com Next.js App Router (substitui o deprecado @supabase/auth-helpers). |
| Supabase Storage | — | Arquivos (apólices PDF, documentos de contemplação) | Integra RLS diretamente nos buckets — controle de acesso a documentos por tenant sem lógica adicional. |
| Supabase Realtime | — | Notificações em tempo real | Alertas de vencimento, notificações de sinistro e atualizações de dashboard sem polling. Via WebSockets gerenciados. |
| Supabase Edge Functions | Deno runtime | Lógica serverless (webhooks, IA) | Para processamentos que não devem rodar no cliente (chamadas a LLMs, integrações n8n) sem expor chaves de API. |

---

### Multi-Tenancy: Padrão RLS com Supabase

**Abordagem: Shared Schema com tenant_id + Custom JWT Claims**

Esta é a arquitetura correta para o projeto. Cada corretora é um tenant. Toda tabela de dados recebe uma coluna `tenant_id` (UUID). RLS policies filtram automaticamente todos os SELECTs, INSERTs, UPDATEs e DELETEs com base no claim do JWT.

**Por que app_metadata e NÃO user_metadata:**
- `user_metadata` pode ser modificado pelo próprio usuário
- `app_metadata` é controlado exclusivamente pelo servidor — imutável pelo usuário

**Fluxo de implementação:**

```sql
-- 1. Tabela de tenants (corretoras)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Toda tabela de dados recebe tenant_id
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  -- ...demais campos
  CONSTRAINT clientes_tenant_id_idx UNIQUE (tenant_id, id)
);

-- SEMPRE indexar tenant_id — sem isso o RLS destrói a performance
CREATE INDEX idx_clientes_tenant_id ON public.clientes(tenant_id);

-- 3. Função helper para extrair tenant_id do JWT
-- Usa app_metadata que é server-controlled
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT nullif(
    (((current_setting('request.jwt.claims', true))::jsonb
      -> 'app_metadata') ->> 'tenant_id'),
    ''
  )::UUID
$$ LANGUAGE sql STABLE;

-- 4. RLS Policy padrão para toda tabela de dados
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_clientes"
ON public.clientes
FOR ALL
USING (tenant_id = auth.tenant_id())
WITH CHECK (tenant_id = auth.tenant_id());

-- 5. Custom Access Token Hook — injeta tenant_id no JWT no login
-- Configurar via Supabase Dashboard > Auth > Hooks > Custom Access Token
-- A Edge Function lê auth.users.raw_app_meta_data e adiciona tenant_id ao JWT
```

**Como tenant_id chega no JWT:**
1. Usuário faz signup/login
2. Custom Access Token Hook (Edge Function) é acionado
3. Hook lê `raw_app_meta_data` do usuário (onde tenant_id foi gravado durante onboarding)
4. Hook retorna claims adicionais: `{ "app_metadata": { "tenant_id": "uuid", "role": "admin" } }`
5. PostgreSQL acessa via `auth.tenant_id()` em todas as queries — zero roundtrip ao banco

**Roles por tenant (corretores, admin, financeiro, visualizador):**
```sql
-- Adicionar role também no JWT
CREATE OR REPLACE FUNCTION auth.tenant_role()
RETURNS TEXT AS $$
  SELECT (((current_setting('request.jwt.claims', true))::jsonb
    -> 'app_metadata') ->> 'role')
$$ LANGUAGE sql STABLE;

-- Policy com role check
CREATE POLICY "only_admin_delete_clientes"
ON public.clientes
FOR DELETE
USING (
  tenant_id = auth.tenant_id()
  AND auth.tenant_role() IN ('admin')
);
```

**Importante — usar service_role apenas server-side:**
- `service_role` bypassa RLS — NUNCA expor no cliente
- Usar apenas em Edge Functions e Server Actions para operações administrativas (onboarding de tenant, migrações, background jobs)
- No cliente: sempre usar `anon` key com RLS ativo

---

### Auth (Supabase Auth + @supabase/ssr)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @supabase/ssr | latest | SSR client para Next.js App Router | Pacote oficial. @supabase/auth-helpers está deprecado. Gerencia sessões via cookies (não localStorage) para compatibilidade com Server Components. |
| @supabase/supabase-js | latest | Cliente JavaScript | SDK principal para todas as operações do banco. |

**Padrão de cliente SSR — três clientes necessários:**
```typescript
// lib/supabase/server.ts — para Server Components e Server Actions
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// lib/supabase/client.ts — para Client Components
import { createBrowserClient } from '@supabase/ssr'

// middleware.ts — para refresh de token e proteção de rotas
// Necessário porque Server Components não podem escrever cookies
```

**Regra de segurança crítica:** Usar `supabase.auth.getUser()` (faz roundtrip ao servidor, valida o token) — NUNCA `supabase.auth.getSession()` em código server-side (não valida, usa cache local não confiável).

---

### UI & Componentes

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS | Padrão da indústria com Next.js. Tailwind v4 usa CSS-based config, mais rápido. Zero CSS morto em produção. |
| shadcn/ui | latest (não versionado — copiado no repo) | Component library | Não é uma dependência, é código copiado para o projeto. Componentes acessíveis (Radix UI), customizáveis. Data Table (TanStack Table + shadcn) é essencial para listagens de apólices e clientes. Charts via Recharts integrado. |
| Lucide React | latest | Ícones | Padrão do shadcn/ui. Tree-shakeable, consistente. |
| Recharts | 2.x | Gráficos e dashboards | Incluído via shadcn/ui charts. Suficiente para dashboards executivos do projeto (receita, produção, inadimplência). |

**Não usar:** Material UI, Ant Design, Chakra UI — overhead de bundle e dificulta customização visual para o contexto do produto.

---

### Formulários e Validação

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | 7.x | Gerenciamento de estado de formulários | Performance superior (não re-renderiza no onChange), integração nativa com Zod. Formulários de cadastro de apólice com 20+ campos se beneficiam muito. |
| Zod | 3.x | Schema validation | Compartilhamento de schemas entre client e server — validação idêntica no formulário e no Server Action. Tipagem TypeScript automática via `z.infer<>`. |

**Padrão recomendado:** React Hook Form + Zod + Server Actions. Não criar API routes REST desnecessárias para mutações — usar Server Actions diretamente nos formulários.

---

### Data Fetching & State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TanStack Query (React Query) | 5.x | Server state (listas, detalhes) em Client Components | Para páginas onde Client Components precisam de dados em tempo real ou paginação interativa. Caching, background refresh, optimistic updates. |
| Zustand | 4.x | Client state (UI state, seleções, filtros) | Lightweight, sem boilerplate. Para estado de UI que não vive no servidor (filtros de dashboard, estado de sidebar, modal state). |

**Regra:** Server Components para leitura inicial de dados (sem waterfall, sem loading states). TanStack Query apenas em Client Components que precisam de reatividade ou paginação. Não duplicar dados entre Zustand e TanStack Query.

---

### Billing & Pagamentos

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Stripe | latest | Subscription billing | Suporte nativo a Pix via EBANX (ativo em 2025). Pix Automático para assinaturas recorrentes. Suporte a CPF/CNPJ para verificação de contas brasileiras. Cards, boleto e Pix em um único provider. |
| stripe (npm) | latest | SDK server-side | Usar APENAS em Server Actions e Edge Functions, nunca exposto ao cliente. |
| @stripe/stripe-js | latest | SDK client-side (Stripe.js) | Para checkout elements e redirect seguro ao Stripe. |

**Padrão de billing:** Stripe Checkout + Webhooks. Fluxo: usuário seleciona plano → redirect para Stripe Checkout → webhook `checkout.session.completed` atualiza `tenants.plan` no Supabase via service_role → usuário redirecionado de volta.

**Nota sobre PIX:** Stripe processa Pix via EBANX para contas com origem brasileira. Para SaaS com corretoras (B2B), cartão de crédito CNPJ e boleto ainda são métodos primários. Pix Automático (recorrente) é viável mas requer mais configuração.

**Alternativa considerada e descartada:** Abacate Pay, Asaas — locais e mais simples de configurar para PIX, mas sem a robustez de Stripe para features futuras (trials, coupons, metered billing). Manter Stripe desde o início.

---

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Resend | latest | Transactional email | Integração oficial com Supabase Auth hooks. API developer-friendly. O SMTP nativo do Supabase é rate-limited (apenas dev) — produção EXIGE provider externo. |
| React Email | latest | Email templates | Templates de email como componentes React — compartilha lógica e tipos com o app. Preview no browser durante desenvolvimento. |

**Casos de uso críticos:** Alertas de vencimento de apólice, cobranças de consórcio em atraso, boas-vindas de onboarding, convite de usuários internos.

**Configuração:** Supabase Auth envia emails de magic link e reset de senha via Resend (configurado no hook "Send Email"). Emails transacionais de negócio (alertas, cobranças) via Resend API direto nas Server Actions ou Edge Functions.

---

### Automações & Integrações Externas

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| n8n | External (hosted separadamente) | Orquestrador de automações | Corretoras usam n8n próprio ou contratado. A plataforma expõe webhooks para receber/enviar dados ao n8n. Sem n8n embedded na infra do produto — reduz complexidade operacional. |
| Vercel AI SDK (ai) | latest | Integração com LLMs | SDK oficial da Vercel para streaming de respostas de LLMs em Next.js. Suporta OpenAI, Anthropic, etc. Abstraí a troca de provider. |
| OpenAI / Anthropic API | — | LLM para atendimento IA | Via Vercel AI SDK. Iniciar com GPT-4o-mini (custo-benefício) para chat de suporte ao corretor. Claude para tarefas de análise mais complexas. |

**Padrão de webhook para n8n:**
```typescript
// app/api/webhooks/n8n/route.ts — recebe eventos do n8n
// app/api/trigger/[event]/route.ts — dispara eventos para n8n

// Autenticação de webhook: secret compartilhado via header Authorization
// x-webhook-secret: process.env.N8N_WEBHOOK_SECRET
```

---

### Internacionalização & Localização Brasil

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| date-fns | 3.x | Manipulação de datas com locale pt-BR | Modular (importa apenas funções usadas), imutável, suporte completo a pt-BR locale. Mais tree-shakeable que day.js para uso intenso. |
| Intl API nativa | — | Formatação de moeda BRL | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` — zero dependência adicional para formatar valores em real. |

**Nota:** Não usar Moment.js (deprecado). date-fns v3 tem locale pt-BR com weekdays/months em lowercase correto para o português brasileiro.

---

### Observabilidade & Monitoramento

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel Analytics | — | Web vitals e performance | Incluído no plano Vercel — zero config, dados de Core Web Vitals em produção. |
| Vercel Speed Insights | — | Real User Monitoring | Complementa Analytics com dados de usuários reais. |
| Sentry | latest | Error tracking | Para capturar erros não tratados em produção (Server Actions, Edge Functions, Client Components). `@sentry/nextjs` com integração nativa. Plano free cobre o início. |

---

### Desenvolvimento & Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase CLI | latest | Migrations locais e tipo geração | `supabase gen types typescript` gera tipos TypeScript a partir do schema — elimina casting manual. Migrations versionadas no repo. |
| ESLint | 9.x | Linting | Configuração Next.js padrão. Detecta erros comuns de App Router. |
| Prettier | 3.x | Formatação | Consistência de código. |

---

## Alternativas Consideradas e Descartadas

| Categoria | Recomendado | Alternativa | Por Que Não |
|-----------|-------------|-------------|-------------|
| Auth | Supabase Auth | NextAuth.js (Auth.js) | Supabase Auth se integra nativamente com RLS — claims JWT que alimentam policies. NextAuth.js exigiria sincronizar sessões com o Supabase manualmente. |
| ORM | Supabase JS client (direto) | Prisma, Drizzle | Prisma não funciona com RLS nativamente. Drizzle é excelente mas adiciona complexidade desnecessária — Supabase client + tipos gerados por `supabase gen types` é suficiente e idiomático. |
| UI Components | shadcn/ui | Radix UI direto, MUI | shadcn/ui já encapsula Radix com styling Tailwind. MUI/Ant Design: bundle pesado, customização trabalhosa para identidade visual própria. |
| Charts | Recharts (via shadcn) | Chart.js, Tremor | Recharts já integrado via shadcn/ui charts. Tremor está em reestruturação em 2025. Chart.js requer mais configuração sem ganho claro. |
| State Management | Zustand + TanStack Query | Redux Toolkit, Jotai | Redux: overkill para este escopo. Jotai: menor ecossistema. Zustand + TanStack Query é o padrão consolidado para Next.js App Router em 2025. |
| Email | Resend | SendGrid, Postmark | Resend é o provider oficial recomendado pelo Supabase. DX superior, preço competitivo, integração nativa via hooks. |
| Pagamentos | Stripe | Asaas, Abacate Pay, Pagar.me | Stripe tem Pix via EBANX em 2025, suporta CPF/CNPJ, trials, webhooks robustos. Providers locais têm APIs menos maduras e sem os recursos de subscription management necessários. |
| Date library | date-fns v3 | Day.js, Luxon | date-fns: modular (melhor tree-shaking), imutável, pt-BR locale maduro. Day.js: menor mas menos funcional para manipulações complexas de datas de vigência e assembleia. |

---

## Instalação Base

```bash
# Framework
npx create-next-app@latest nexus-agent --typescript --tailwind --app --src-dir --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI
npx shadcn@latest init
# Components: button, input, form, table, dialog, sheet, card, badge, 
#             select, checkbox, calendar, date-picker, chart, data-table

# Formulários
npm install react-hook-form @hookform/resolvers zod

# State
npm install @tanstack/react-query zustand

# Billing
npm install stripe @stripe/stripe-js

# Email
npm install resend react-email @react-email/components

# Dates
npm install date-fns

# AI
npm install ai openai

# Error Tracking
npm install @sentry/nextjs

# Dev dependencies
npm install -D supabase prettier eslint-config-prettier
```

---

## Variáveis de Ambiente (Estrutura)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Apenas server-side, NUNCA NEXT_PUBLIC_

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=               # Apenas server-side
STRIPE_WEBHOOK_SECRET=           # Para validação de webhooks

# Email
RESEND_API_KEY=                  # Apenas server-side

# AI
OPENAI_API_KEY=                  # Apenas server-side

# n8n
N8N_WEBHOOK_SECRET=              # Secret compartilhado para autenticar webhooks

# App
NEXT_PUBLIC_APP_URL=             # URL base do app (para callbacks do Stripe)
```

**Regra crítica Vercel:** Variáveis sem `NEXT_PUBLIC_` ficam apenas no Node.js runtime (server). Variáveis com `NEXT_PUBLIC_` são inlined no bundle cliente — visíveis a qualquer usuário. Apenas `SUPABASE_URL` e `SUPABASE_ANON_KEY` são seguras para expor (anon key com RLS é projetada para ser pública).

---

## LGPD — Implicações de Stack

O projeto opera no Brasil com dados pessoais de segurados (CPF, dados de saúde, financeiros). LGPD (Lei 13.709/2018) aplica-se integralmente.

**Implicações técnicas diretas:**
- Supabase precisa ter **região de dados configurada** — verificar disponibilidade de region `sa-east-1` (São Paulo) para manter dados no Brasil
- Implementar **cookie consent** antes de qualquer analytics (Vercel Analytics usa cookies)
- Supabase Storage: documentos com dados pessoais → buckets privados + signed URLs com expiração curta (nunca URLs públicas permanentes)
- Direito ao esquecimento: implementar mecanismo de exclusão de dados por tenant desde a fase de arquitetura
- Logs de auditoria: registrar quem acessou/modificou apólices e dados de clientes (tabela `audit_log` com trigger PostgreSQL)

---

## Diagrama de Dependências de Stack

```
Browser
  └── Next.js 15 (App Router)
        ├── Server Components (leitura de dados via Supabase server client)
        ├── Server Actions (mutações via Supabase server client + Stripe)
        ├── Client Components
        │     ├── shadcn/ui + Tailwind CSS
        │     ├── React Hook Form + Zod
        │     ├── TanStack Query (server state reativo)
        │     ├── Zustand (UI state)
        │     └── Supabase Realtime (WebSocket, notificações)
        └── API Routes
              ├── /api/webhooks/stripe (Stripe webhook handler)
              └── /api/webhooks/n8n (n8n incoming webhook)

Vercel (hosting)
  └── Edge Middleware (auth check, redirect de tenant)

Supabase (BaaS)
  ├── PostgreSQL com RLS (isolamento de tenant via tenant_id + JWT claims)
  ├── Supabase Auth + Custom Access Token Hook
  ├── Supabase Storage (documentos, apólices PDF)
  ├── Supabase Realtime (notificações push)
  └── Edge Functions (IA, integrações serverless, webhooks)

Externos
  ├── Stripe (billing, Pix via EBANX)
  ├── Resend (email transacional)
  ├── OpenAI / Anthropic (LLM via Vercel AI SDK)
  └── n8n (automações externas via webhook)
```

---

## Fontes e Confiança por Área

| Área | Confiança | Razão |
|------|-----------|-------|
| Next.js 15 App Router | HIGH | Documentação oficial + changelog verificado |
| Supabase RLS + multi-tenancy | HIGH | Documentação oficial + múltiplas fontes concordantes (Makerkit, Antstack, Supabase docs) |
| @supabase/ssr (deprecação de auth-helpers) | HIGH | Confirmado na documentação oficial de migração |
| Stripe + Pix Brasil | HIGH | Anúncio oficial Stripe/EBANX + changelog Stripe 2025-04-30 |
| Resend como email provider | HIGH | Recomendação oficial Supabase docs |
| shadcn/ui como UI library | HIGH | Adoção massiva em starters Next.js oficiais (vercel/nextjs-subscription-payments) |
| TanStack Query + Zustand | HIGH | Múltiplas fontes 2025 concordando no padrão complementar |
| date-fns v3 pt-BR | MEDIUM | pt-BR locale verificado, histórico de issues corrigidos |
| LGPD compliance | MEDIUM | Fontes jurídicas e técnicas verificadas, mas requer revisão por advogado especializado |
| Vercel AI SDK para LLM | HIGH | SDK oficial Vercel, integração nativa com Next.js |

---

## Sources

- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Makerkit — Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Stripe Pix Payments Docs](https://docs.stripe.com/payments/pix)
- [Stripe adds Pix to payment method configurations — Changelog 2025-04-30](https://docs.stripe.com/changelog/basil/2025-04-30/add_pix_to_payment_method_configuration)
- [Stripe + EBANX Pix Brazil announcement](https://www.prnewswire.com/news-releases/stripe-users-can-now-accept-pix-in-brazil-via-ebanx-302526007.html)
- [Supabase Auth Emails with React Email and Resend](https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend)
- [Next.js 15 Blog](https://nextjs.org/blog/next-15)
- [Next.js SaaS Starter (official)](https://github.com/nextjs/saas-starter)
- [vercel/nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments)
- [Multi-Tenant Applications with RLS on Supabase — Antstack](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/)
- [Federated State with Zustand + TanStack Query](https://www.nextsteps.dev/en/posts/federated-state-done-righ/)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Supabase pgvector & AI](https://supabase.com/docs/guides/ai)
- [Brazil LGPD SaaS Compliance Guide](https://complydog.com/blog/brazil-lgpd-complete-data-protection-compliance-guide-saas)
- [2025 Stripe Brazil Verification Requirements](https://support.stripe.com/questions/2025-updates-to-brazil-verification-requirements)
