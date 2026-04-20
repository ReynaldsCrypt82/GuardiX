# Architecture Patterns — NEXUS AGENT

**Domain:** Multi-tenant SaaS — Insurance Brokerage (Seguros + Consórcio)
**Stack:** Next.js App Router + Supabase (PostgreSQL + RLS) + Vercel
**Researched:** 2026-04-19
**Confidence:** HIGH (Supabase RLS patterns) / MEDIUM (domain model) / MEDIUM (n8n/AI patterns)

---

## Recommended Architecture

### High-Level System Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL EDGE                              │
│  ┌─────────────┐   middleware.ts                                │
│  │  Next.js    │──────────────────→ tenant resolution          │
│  │  App Router │                   JWT refresh                  │
│  │             │                   route protection             │
│  └──────┬──────┘                                                │
│         │                                                        │
│    Server Components / Server Actions / Route Handlers          │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                      SUPABASE                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐     │
│  │  Auth        │  │ PostgreSQL   │  │  Edge Functions    │     │
│  │  (JWT +      │  │ (RLS by      │  │  (webhook bridge   │     │
│  │  app_meta)   │  │  tenant_id)  │  │   to n8n)          │     │
│  └──────────────┘  └─────────────┘  └────────────────────┘     │
│                     Storage (docs)    Realtime (notifs)          │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
┌─────────▼──────────┐              ┌────────────▼────────────────┐
│   EXTERNAL: n8n    │              │   EXTERNAL: AI Layer        │
│  (tenant-hosted    │              │  (OpenAI/Anthropic API)     │
│   or cloud)        │              │  WhatsApp Business API      │
│  Triggers:         │              │  via n8n or direct          │
│  - DB webhooks     │              └─────────────────────────────┘
│  - Schedules       │
│  - Inbound WA msgs │
└────────────────────┘
```

---

## Multi-Tenancy: Supabase RLS Pattern

### Approach: Shared Schema + Row-Level Security

Use a single PostgreSQL schema for all tenants. Every business table carries a `tenant_id` UUID column. RLS policies enforce isolation at the database level, making it impossible for application bugs to leak cross-tenant data.

**Confidence: HIGH** — documented production pattern from Supabase official docs and MakerKit production codebase.

### Tenant Identity Flow

```
1. Corretora signs up → creates record in `tenants` table
2. Supabase Auth creates user → admin sets tenant_id in raw_app_meta_data
3. JWT issued contains: { sub: user_id, app_metadata: { tenant_id, role } }
4. Every DB query → RLS reads auth.jwt() ->> 'tenant_id' from JWT claims
5. Tenant context never passes through application layer — DB enforces it
```

**Why `app_metadata` not `user_metadata`?**
`raw_app_meta_data` cannot be modified by the authenticated user — only server-side admin calls can update it. `raw_user_meta_data` can be edited by users, making it insecure for authorization decisions.

### Core RLS SQL Pattern

```sql
-- Helper function to extract tenant_id from JWT (call once, reuse in all policies)
CREATE OR REPLACE FUNCTION auth.tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  $$;

-- Every business table follows this pattern:
CREATE TABLE policies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  -- ... domain columns
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON policies
  FOR ALL
  USING (tenant_id = auth.tenant_id())
  WITH CHECK (tenant_id = auth.tenant_id());
```

### Role Hierarchy Within a Tenant

Roles live in `app_metadata` alongside `tenant_id`:

```sql
-- app_metadata payload example:
-- { "tenant_id": "uuid", "role": "admin" | "corretor" | "financeiro" | "viewer" }

-- Fine-grained policy (write restricted to admin/corretor):
CREATE POLICY "write_access" ON policies
  FOR INSERT WITH CHECK (
    tenant_id = auth.tenant_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'corretor')
  );

CREATE POLICY "read_access" ON policies
  FOR SELECT USING (tenant_id = auth.tenant_id());
```

### Critical Performance Rule

**Index every `tenant_id` column.** RLS evaluates the predicate on every row scan. Without the index, full table scans happen per query per policy.

```sql
CREATE INDEX idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
-- Repeat for every business table
```

### Next.js Middleware Integration

```typescript
// middleware.ts — runs at Vercel Edge before every request
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: Request) {
  const response = NextResponse.next()
  const supabase = createServerClient(/* env */, { cookies: ... })

  // Refreshes JWT, sets cookies — MUST use getUser() not getSession()
  const { data: { user } } = await supabase.auth.getUser()

  // Protect authenticated routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}
```

The `tenant_id` never needs to be passed explicitly in Server Actions — the Supabase client reads the JWT from the cookie, and RLS handles the rest automatically.

---

## Bounded Domains (Component Boundaries)

Eight bounded domains, each owning its data and exposing a defined interface to the rest of the system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXUS AGENT DOMAINS                          │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  1. AUTH &   │  2. CRM &    │  3. SEGUROS  │  4. CONSÓRCIO      │
│  TENANTS     │  CLIENTES    │  (Apólices)  │  (Grupos/Cotas)    │
│              │              │              │                    │
│  tenants     │  clients     │  policies    │  consortium_groups │
│  users       │  leads       │  policy_types│  consortium_quotas │
│  roles       │  activities  │  claims      │  assemblies        │
│  plans       │  pipeline    │  renewals    │  bids              │
│              │  segments    │  insurers    │  contemplations    │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│  5. CORRETS  │  6. FINAN-   │  7. DASH-    │  8. AUTOMAÇÕES     │
│  & COMISSÕES │  CEIRO       │  BOARDS      │  & IA              │
│              │              │              │                    │
│  brokers     │  receivables │  (computed   │  webhook_events    │
│  partners    │  payables    │   views over │  ai_conversations  │
│  commissions │  cashflow    │   all tables)│  notifications     │
│  goals       │  overdue     │              │  audit_logs        │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

### Domain Communication Rules

- Domains communicate through **shared foreign keys** (e.g., `policy.client_id` references `clients.id`), never through direct service calls.
- Dashboards are **read-only computed views** (PostgreSQL views or materialized views) — they never own data.
- Automações domain is the **only outbound adapter** — it translates internal events into n8n webhooks or AI API calls.
- No circular dependencies: AUTH ← all domains; CRM ← SEGUROS, CONSÓRCIO, COMISSÕES, FINANCEIRO.

---

## Data Model: Core Schema Design

### Anchor Tables (Foundation Layer)

```sql
-- Tenant (corretora)
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,           -- "Corretora Silva Ltda"
  slug          text UNIQUE NOT NULL,    -- "silva" → silva.nexusagent.com.br
  plan          text NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- User (internal to a corretora)
-- auth.users is Supabase-managed; we extend with a profiles table
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  full_name   text,
  role        text NOT NULL CHECK (role IN ('admin','corretor','financeiro','viewer')),
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

### CRM Layer

```sql
CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  type          text NOT NULL CHECK (type IN ('pf','pj')),
  name          text NOT NULL,
  cpf_cnpj      text,
  email         text,
  phone         text,
  birth_date    date,           -- PF only
  company_name  text,           -- PJ only
  address       jsonb,
  broker_id     uuid REFERENCES profiles(id),  -- corretor responsável
  segment       text,
  pipeline_stage text DEFAULT 'lead' CHECK (pipeline_stage IN
    ('lead','prospecting','proposal','awaiting_approval','closed_won','closed_lost')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE client_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  client_id   uuid NOT NULL REFERENCES clients(id),
  type        text NOT NULL, -- 'note','call','email','meeting','task'
  description text,
  due_date    timestamptz,
  done        boolean DEFAULT false,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);
```

### Seguros Layer

```sql
CREATE TABLE policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  client_id       uuid NOT NULL REFERENCES clients(id),
  broker_id       uuid REFERENCES profiles(id),
  policy_number   text NOT NULL,
  type            text NOT NULL, -- 'auto','vida','residencial','empresarial','outros'
  insurer         text NOT NULL, -- Bradesco, Porto Seguro, etc.
  product_name    text,
  status          text DEFAULT 'active' CHECK (status IN
    ('active','expired','cancelled','pending')),
  -- Vigência
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  -- Financeiro
  premium_total   numeric(12,2) NOT NULL,  -- prêmio total
  premium_freq    text DEFAULT 'mensal',   -- mensal, trimestral, anual
  installments    int DEFAULT 1,
  -- Metadados
  coverage_details jsonb,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE claims (  -- sinistros
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  policy_id   uuid NOT NULL REFERENCES policies(id),
  client_id   uuid NOT NULL REFERENCES clients(id),
  event_date  date NOT NULL,
  description text NOT NULL,
  status      text DEFAULT 'registered' CHECK (status IN
    ('registered','in_progress','settled','rejected')),
  amount      numeric(12,2),
  created_at  timestamptz DEFAULT now()
);
```

### Consórcio Layer

```sql
CREATE TABLE consortium_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  administrator   text NOT NULL,   -- ex: "Porto Seguro Consórcios"
  type            text NOT NULL,   -- 'imovel','auto','servicos'
  group_number    text NOT NULL,
  credit_value    numeric(14,2) NOT NULL,
  total_members   int NOT NULL,
  duration_months int NOT NULL,
  start_date      date,
  status          text DEFAULT 'active',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE consortium_quotas (  -- cotas de clientes
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  group_id        uuid NOT NULL REFERENCES consortium_groups(id),
  client_id       uuid NOT NULL REFERENCES clients(id),
  broker_id       uuid REFERENCES profiles(id),
  quota_number    text NOT NULL,
  monthly_payment numeric(12,2) NOT NULL,
  status          text DEFAULT 'active' CHECK (status IN
    ('active','contemplated','cancelled','overdue')),
  -- Contemplação
  contemplated_at date,
  contemplation_type text, -- 'sorteio' | 'lance'
  credit_used     boolean DEFAULT false,
  credit_used_at  date,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE assemblies (  -- assembleias mensais
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  group_id        uuid NOT NULL REFERENCES consortium_groups(id),
  assembly_date   date NOT NULL,
  assembly_number int NOT NULL,
  contemplated_quota_ids uuid[],  -- cotas contempladas nesta assembleia
  notes           text,
  created_at      timestamptz DEFAULT now()
);
```

### Corretores & Comissões Layer

```sql
CREATE TABLE brokers (  -- extendsprofiles para corretores internos
  id              uuid PRIMARY KEY REFERENCES profiles(id),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  license_number  text,           -- número SUSEP
  monthly_goal    numeric(12,2),
  commission_rate numeric(5,4),   -- taxa padrão ex: 0.0800 = 8%
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE external_partners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  name            text NOT NULL,
  cpf_cnpj        text,
  commission_rate numeric(5,4) NOT NULL,
  bank_details    jsonb,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE commissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  -- Source: either policy or consortium quota
  policy_id       uuid REFERENCES policies(id),
  quota_id        uuid REFERENCES consortium_quotas(id),
  -- Recipient: internal broker or external partner
  broker_id       uuid REFERENCES profiles(id),
  partner_id      uuid REFERENCES external_partners(id),
  -- Values
  base_amount     numeric(12,2) NOT NULL,  -- valor base (prêmio ou parcela)
  rate            numeric(5,4) NOT NULL,
  amount          numeric(12,2) NOT NULL,  -- base_amount * rate
  -- Status
  period_month    int NOT NULL,    -- 1-12
  period_year     int NOT NULL,
  status          text DEFAULT 'pending' CHECK (status IN
    ('pending','approved','paid')),
  paid_at         date,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT source_check CHECK (policy_id IS NOT NULL OR quota_id IS NOT NULL)
);
```

### Financeiro Layer

```sql
CREATE TABLE financial_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  type            text NOT NULL CHECK (type IN ('receivable','payable')),
  category        text NOT NULL, -- 'premio','parcela_consorcio','comissao','repasse'
  -- Linking
  client_id       uuid REFERENCES clients(id),
  policy_id       uuid REFERENCES policies(id),
  quota_id        uuid REFERENCES consortium_quotas(id),
  commission_id   uuid REFERENCES commissions(id),
  -- Values
  amount          numeric(12,2) NOT NULL,
  due_date        date NOT NULL,
  paid_date       date,
  status          text DEFAULT 'pending' CHECK (status IN
    ('pending','paid','overdue','cancelled')),
  description     text,
  created_at      timestamptz DEFAULT now()
);
```

### Automações Layer

```sql
CREATE TABLE webhook_events (  -- outbound events dispatched to n8n
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  event_type      text NOT NULL,  -- 'policy.expiring','payment.overdue','assembly.upcoming'
  payload         jsonb NOT NULL,
  target_url      text NOT NULL,  -- n8n webhook URL (per-tenant config)
  status          text DEFAULT 'pending' CHECK (status IN
    ('pending','sent','failed','retrying')),
  attempts        int DEFAULT 0,
  sent_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE ai_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  client_id       uuid REFERENCES clients(id),
  channel         text NOT NULL,   -- 'whatsapp','internal_chat'
  messages        jsonb NOT NULL,  -- array of {role, content, timestamp}
  context         jsonb,           -- policy_id, quota_id for context injection
  status          text DEFAULT 'active',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  user_id         uuid REFERENCES auth.users(id),
  action          text NOT NULL,   -- 'policy.created','client.updated', etc.
  resource_type   text NOT NULL,
  resource_id     uuid,
  diff            jsonb,           -- before/after for updates
  created_at      timestamptz DEFAULT now()
);
```

---

## Data Flow: How Information Moves

### Primary Write Path (Corretor creates/updates)

```
Browser → Next.js Server Action
       → supabase-js (server) with JWT cookie
       → PostgreSQL RLS filter (tenant_id = auth.tenant_id())
       → Write to table
       → PostgreSQL trigger fires (if configured)
       → Inserts row in webhook_events
       → Supabase Edge Function (or cron) processes queue
       → HTTP POST to n8n webhook URL (tenant-configured)
       → n8n executes automation (WhatsApp alert, email, etc.)
```

### Read Path (Dashboard/Reports)

```
Browser (RSC) → Next.js Server Component
              → supabase-js (server)
              → PostgreSQL View / Direct query
              → RLS automatically filters to tenant
              → Returns typed data
              → Rendered server-side (no client fetch needed)
```

### AI/WhatsApp Path

```
WhatsApp message received
→ WhatsApp Business API (Meta)
→ n8n webhook trigger
→ n8n calls Next.js Route Handler: POST /api/ai/whatsapp
→ Route Handler authenticates webhook signature
→ Looks up client by phone number (scoped to tenant)
→ Assembles context (client history, active policies, quotas)
→ Calls LLM API (OpenAI/Anthropic) with context + message
→ Saves conversation to ai_conversations table
→ Returns response via n8n → WhatsApp API → user
```

### Renewal Alert Path (Automated)

```
Supabase pg_cron (daily at 08:00 BRT)
→ SELECT policies WHERE end_date = today + N days AND tenant active
→ For each policy: INSERT INTO webhook_events (event_type='policy.expiring')
→ Edge Function processes queue: POST to each tenant's n8n URL
→ n8n sends WhatsApp/email alert to client and internal notification
```

---

## Next.js App Router — Directory Structure

```
src/
├── app/
│   ├── (public)/               # login, signup, landing
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   │
│   ├── (dashboard)/            # route group — all require auth
│   │   ├── layout.tsx          # sidebar, tenant context, session guard
│   │   ├── dashboard/page.tsx  # executive dashboard
│   │   ├── clientes/           # CRM domain
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── pipeline/page.tsx
│   │   ├── seguros/            # insurance domain
│   │   │   ├── apolices/
│   │   │   └── sinistros/
│   │   ├── consorcio/          # consortium domain
│   │   │   ├── grupos/
│   │   │   ├── cotas/
│   │   │   └── assembleias/
│   │   ├── corretores/         # broker/commission domain
│   │   ├── financeiro/
│   │   ├── relatorios/
│   │   └── configuracoes/      # tenant settings, n8n URLs, users
│   │
│   └── api/                    # Route Handlers (server-side only)
│       ├── webhooks/
│       │   ├── n8n/route.ts    # inbound from n8n
│       │   └── whatsapp/route.ts
│       └── ai/
│           └── chat/route.ts
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts           # createServerClient (Server Actions/RSC)
│   │   ├── client.ts           # createBrowserClient (Client Components)
│   │   └── middleware.ts       # createMiddlewareClient
│   ├── actions/                # Server Actions by domain
│   │   ├── clients.ts
│   │   ├── policies.ts
│   │   ├── consortium.ts
│   │   └── commissions.ts
│   └── types/                  # TypeScript types generated from DB schema
│
└── middleware.ts               # JWT refresh + route protection
```

---

## n8n Integration: Webhook Patterns

### Configuration Model

Each tenant configures their own n8n instance URL in the platform's settings. The platform stores this in `tenants.n8n_webhook_base_url`. Event-specific webhooks follow a convention:

```
{n8n_webhook_base_url}/policy-expiring
{n8n_webhook_base_url}/payment-overdue
{n8n_webhook_base_url}/assembly-reminder
{n8n_webhook_base_url}/new-client
```

### Outbound Event Payload Pattern

```json
{
  "event": "policy.expiring",
  "tenant_id": "uuid",
  "timestamp": "2026-04-19T08:00:00Z",
  "data": {
    "policy_id": "uuid",
    "client_name": "João Silva",
    "client_phone": "+5511999999999",
    "policy_number": "AUTO-2024-00123",
    "insurer": "Porto Seguro",
    "type": "auto",
    "end_date": "2026-04-30",
    "days_until_expiry": 11,
    "premium_total": 2400.00,
    "broker_name": "Maria Corretor"
  }
}
```

### Inbound from n8n (Route Handler Pattern)

n8n can write back to the platform via a Route Handler with shared secret auth:

```typescript
// app/api/webhooks/n8n/route.ts
export async function POST(request: Request) {
  const secret = request.headers.get('x-nexus-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Process event, update DB via server supabase client
}
```

---

## Build Order: Dependencies Between Components

### Phase Dependency Graph

```
1. FOUNDATION (blocks everything)
   tenants table + RLS + middleware + auth flow + profiles + RBAC

2. CRM (blocks SEGUROS, CONSÓRCIO, COMISSÕES)
   clients table + activities + pipeline stages

3. SEGUROS & CONSÓRCIO (parallel, both depend on CRM)
   policies + claims  |  consortium_groups + quotas + assemblies

4. CORRETORES & COMISSÕES (depends on SEGUROS + CONSÓRCIO)
   brokers + partners + commissions (reference policy_id and quota_id)

5. FINANCEIRO (depends on SEGUROS + CONSÓRCIO + COMISSÕES)
   financial_transactions (links to policies, quotas, commissions)

6. DASHBOARDS & REPORTS (depends on all above)
   PostgreSQL views aggregating all domains — no new writes

7. AUTOMAÇÕES & IA (depends on SEGUROS + CONSÓRCIO + FINANCEIRO)
   webhook_events queue + n8n integration + AI conversations
   Can be partially delivered after Phase 3 (alerts only)
```

### Why This Order

- **Foundation first**: RLS must be in place before any business data is written. Adding RLS after data exists is error-prone and risky.
- **CRM before Products**: Every policy and quota references a `client_id`. No orphaned policies.
- **Products before Commissions**: Commission records reference `policy_id` or `quota_id` — these must exist first.
- **Commissions before Financeiro**: Many financial transactions link to commissions for payables tracing.
- **Dashboards last**: Pure reads. Validate with real data only after domain data flows correctly.
- **Automações parallel-ish**: Alert webhooks (policy expiring) can ship after Phase 3. AI/WhatsApp is a Phase 7+ feature due to integration complexity.

---

## Scalability Considerations

| Concern | At v1 (5K clients / 10K policies per tenant) | At Scale (50+ tenants) | Mitigation |
|---------|----------------------------------------------|------------------------|------------|
| RLS policy performance | Acceptable with indexes | Monitor query plans | Composite indexes on (tenant_id, status), (tenant_id, end_date) |
| Dashboard query speed | Direct queries OK | May slow on large tenants | PostgreSQL materialized views, refresh on schedule |
| Webhook queue processing | Simple cron sufficient | Multiple workers needed | Move to Supabase Edge Functions + queue pattern |
| AI conversation storage | JSONB in table OK | Evaluate dedicated vector store | Supabase pgvector for RAG later |
| Supabase connection limits | Supabase handles pooling | Use Supabase connection pooler (pgBouncer) | Configure via Supabase dashboard |

---

## Anti-Patterns to Avoid

### 1. Fetching tenant_id from application layer
**Bad:** `const tenantId = session.user.appMetadata.tenant_id; db.query('WHERE tenant_id = $1', [tenantId])`
**Why bad:** If a bug skips this filter, data leaks across tenants. Application code is not the last line of defense.
**Instead:** Let RLS handle it. Never pass `tenant_id` as a query parameter — write the policy once, trust it everywhere.

### 2. Using `user_metadata` for authorization
**Bad:** Storing role or tenant_id in `raw_user_meta_data`
**Why bad:** Authenticated users can update their own `user_metadata` via the Supabase client SDK.
**Instead:** Store all authorization data in `raw_app_meta_data` — only server-side admin calls can write to it.

### 3. Skipping indexes on tenant_id
**Bad:** Adding RLS policies without corresponding btree indexes.
**Why bad:** Full table scans on every request, catastrophic at scale.
**Instead:** Index every `tenant_id` column immediately when creating the table.

### 4. Calling Supabase from Client Components for sensitive data
**Bad:** Using `createBrowserClient` in a Client Component to fetch policy financial data.
**Why bad:** Exposes the anon key flow to the browser; RLS protects the data but it's unnecessary exposure.
**Instead:** Use Server Components or Server Actions for data fetching. Client Components for interactivity only.

### 5. Building dashboards with real-time queries on raw tables
**Bad:** Complex JOIN queries across 6 tables on every dashboard load.
**Why bad:** Slow, expensive, hard to cache.
**Instead:** PostgreSQL views for standard aggregations, materialized views for heavy reports with scheduled refresh.

### 6. One global n8n webhook URL
**Bad:** All tenants share one n8n endpoint.
**Why bad:** Cannot route events per tenant; one n8n workflow handles all tenants — brittle and unscalable.
**Instead:** Each tenant configures their own n8n URL in settings. Platform fans out events per tenant.

---

## Key PostgreSQL Extensions to Enable

```sql
-- Already available in Supabase by default:
-- uuid-ossp (gen_random_uuid)
-- pgcrypto
-- pg_cron (enable in Supabase dashboard for scheduled jobs)

-- Enable for future AI/RAG use:
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for embeddings

-- For cron-based alerts:
SELECT cron.schedule(
  'check-expiring-policies',
  '0 8 * * *',  -- daily at 08:00 UTC
  $$
    INSERT INTO webhook_events (tenant_id, event_type, payload, target_url)
    SELECT ...
    FROM policies p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.end_date = CURRENT_DATE + INTERVAL '30 days'
      AND p.status = 'active'
      AND t.active = true
  $$
);
```

---

## Sources

- Supabase RLS official documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase custom claims / RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- MakerKit RLS production patterns: https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- AntStack multi-tenant RLS: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/
- Next.js multi-tenant official guide: https://nextjs.org/docs/app/guides/multi-tenant
- Vercel platforms (multi-tenant reference): https://github.com/vercel/platforms
- n8n + Supabase integration: https://n8n.io/integrations/supabase/
- Supabase + n8n official partner page: https://supabase.com/partners/integrations/n8n
- Salesforce Insurance Brokerage data model (domain reference): https://developer.salesforce.com/docs/platform/data-models/guide/insurance-brokerage.html
- WhatsApp for Insurance (use cases): https://www.gupshup.ai/resources/blog/whatsapp-for-insurance/
