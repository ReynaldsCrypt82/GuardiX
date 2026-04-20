# Domain Pitfalls: SaaS Multi-tenant para Corretoras de Seguros e Consórcio

**Domain:** Insurance + Consortium SaaS, Brazil, multi-tenant
**Stack:** Next.js + Supabase + Vercel + n8n + AI/WhatsApp
**Researched:** 2026-04-19
**Overall confidence:** HIGH (Supabase/security), MEDIUM (domain modeling, regulatory), MEDIUM (AI/WhatsApp)

---

## Critical Pitfalls

Mistakes that cause data breaches, regulatory fines, rewrites, or loss of tenant trust.

---

### Pitfall 1: service_role Key Exposed in Next.js Client Bundle

**What goes wrong:** The Supabase `service_role` key is accidentally placed in a `NEXT_PUBLIC_` environment variable or used in a client component. The key is then embedded in the JavaScript bundle shipped to the browser. Any user can extract it from DevTools, bypass ALL RLS policies, and read or write every row in every table across all tenants.

**Why it happens:** Developers use `service_role` during development to "bypass RLS issues" and forget to switch back, or they copy-paste environment variable configs without understanding the exposure boundary.

**Consequences:** Total RLS bypass — every tenant's data is readable/writable. Regulatory incident under LGPD. Undetectable without proactive audit (the key leaks silently).

**Warning signs:**
- Any env var beginning with `NEXT_PUBLIC_SUPABASE_SERVICE` exists
- A single `supabaseClient` instance used everywhere (both server and browser paths)
- "I'll just use service_role for now and fix later" in commit history

**Prevention:**
1. Maintain two separate Supabase client factories: `supabaseClient()` (anon key, browser-safe) and `supabaseAdmin()` (service_role, server-only — never imported in `/app` client components or pages without `'use server'`).
2. Lint rule: block any import of the admin client from files that don't have `'use server'` or live outside `/app/api/` and `/lib/server/`.
3. Run `npx @supabase/supabase-js audit` or equivalent at CI time.

**Phase:** Must be addressed in Phase 1 (Auth & Multi-tenancy foundation). Zero exceptions.

---

### Pitfall 2: Missing RLS Policies on New Tables (Silent Full Exposure)

**What goes wrong:** Supabase auto-generates REST and GraphQL APIs from PostgreSQL schema. RLS is opt-in, not default. When a developer creates a new table and forgets to add `ENABLE ROW LEVEL SECURITY` + policies, the anon key becomes a master key to that table. In 2025, CVE-2025-48757 affected 170+ applications from this exact mistake, with one incident exposing 13,000 users.

**Why it happens:** Fast-paced development, migrations added without review, database-first schema changes made in Supabase Studio UI rather than version-controlled migrations.

**Consequences:** Cross-tenant data leak. If the leaked table contains CPF, apólice numbers, or health data from seguros, this is a LGPD notifiable incident.

**Warning signs:**
- Any table in `public` schema without `rls_enabled = true` in `pg_tables`
- Supabase Studio shows "RLS disabled" badge on a table
- Migrations that only contain `CREATE TABLE` without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

**Prevention:**
1. Add a CI check querying `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity` — fail the build if result is non-empty.
2. Migration template always includes: `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` as a mandatory block.
3. Use Supabase's built-in Security Advisor (Dashboard → Database → Advisors) regularly.

**Phase:** Phase 1 foundation. Automated CI check must exist before any tenant data is written.

---

### Pitfall 3: RLS Policies Without `tenant_id` Index (Performance Collapse at Scale)

**What goes wrong:** RLS policies filter on `tenant_id` but the column has no index. Every query becomes a full table scan evaluated row-by-row against the policy. With 10 tenants it is invisible; with 100 tenants and 10,000 apólices each, queries that were 5ms become 2,000ms.

**Why it happens:** Developers focus on policy correctness, not performance. RLS is invisible at the query plan level unless you actively run `EXPLAIN ANALYZE`.

**Consequences:** Dashboard pages time out for larger tenants. Vercel serverless functions hit 10s limit. User churn from perceived slowness. Impossible to diagnose without Postgres access.

**Warning signs:**
- `EXPLAIN ANALYZE` on `SELECT * FROM apólices WHERE ...` shows `Seq Scan` on the base table
- Dashboard load time increases linearly with tenant data volume
- Supabase logs show queries > 500ms on tenant-filtered tables

**Prevention:**
1. Every table with `tenant_id` gets a `CREATE INDEX ON table_name (tenant_id)` in the same migration as the table creation.
2. For compound filters add composite indexes: `(tenant_id, status)`, `(tenant_id, vigencia_fim)`.
3. Wrap `auth.uid()` and `auth.jwt()` calls in a `(SELECT ...)` subquery within RLS policies to enable PostgreSQL optimizer caching: `(SELECT auth.jwt() ->> 'tenant_id')` instead of `auth.jwt() ->> 'tenant_id'`.
4. Benchmark with 50k rows per tenant before launch.

**Phase:** Phase 1 schema design. Indexes are non-negotiable from day one.

---

### Pitfall 4: PostgreSQL Views Bypass RLS (Silently)

**What goes wrong:** Dashboard aggregate views (e.g., `vw_producao_corretor`, `vw_comissoes_mes`) are created without `security_invoker = true`. These views run as the `postgres` superuser role, bypassing all RLS policies. A tenant querying the view gets data from all tenants.

**Why it happens:** Views are a natural choice for complex aggregations. The RLS bypass behavior is a PostgreSQL default that most developers do not know about.

**Consequences:** Cross-tenant data leakage through legitimate-looking queries. Particularly dangerous for financial aggregate views (comissões, prêmios, receita) — a broker can see competitor revenue.

**Warning signs:**
- Any `CREATE VIEW` in migrations without `WITH (security_invoker = true)`
- Views used in API routes without server-side tenant filtering
- View returning more rows than expected when tested as a non-admin user

**Prevention:**
1. All views must be created with: `CREATE VIEW public.view_name WITH (security_invoker = true) AS ...`
2. Supabase Dashboard → Database → Advisors shows lint `0010_security_definer_view` — this must be zero.
3. Test every view by querying via the anon/authenticated role (not the postgres role) and verifying row count matches tenant-only data.

**Phase:** Phase 1 and any phase that introduces reporting/dashboard views.

---

### Pitfall 5: JWT `user_metadata` Used in RLS (User-Spoofable Claims)

**What goes wrong:** Developer stores `tenant_id` or `role` in `auth.users.user_metadata` and references `auth.jwt() -> 'user_metadata' ->> 'tenant_id'` in RLS policies. Since users can update their own `user_metadata` via the Supabase client, they can change their own `tenant_id` and access another tenant's data.

**Why it happens:** `user_metadata` is the most visible field in the Supabase auth response. Documentation examples use it for custom claims. The security implications of user-writability are not prominently documented.

**Consequences:** Tenant impersonation. A user from Corretora A can claim to be from Corretora B and read their data.

**Warning signs:**
- RLS policies containing `auth.jwt() -> 'user_metadata'`
- No server-side auth hook setting custom claims
- `tenant_id` stored only in user_metadata, not in a server-controlled `app_metadata`

**Prevention:**
1. Store `tenant_id` in `auth.users.app_metadata` (server-side only, not user-editable).
2. Use Supabase Auth Hook (Database Hook or Edge Function Hook) to inject `tenant_id` into the JWT as a top-level custom claim during login.
3. RLS policies reference: `(SELECT auth.jwt() ->> 'tenant_id')` — not `user_metadata`.

**Phase:** Phase 1, before any tenant data exists.

---

## Moderate Pitfalls

Mistakes that cause significant rework, incorrect data, or compliance gaps.

---

### Pitfall 6: Apólice Vigência Modeling with Simple Dates (Ignoring Edge Cases)

**What goes wrong:** `vigencia_inicio` and `vigencia_fim` are stored as `DATE` without timezone awareness. In Brazil, apólices typically start at 14:00 local time (horário de Brasília) — this is a regulatory standard. Renewal logic calculates "days until expiry" based on UTC, producing off-by-one alerts or missed alerts entirely for policies expiring the same day.

**Why it happens:** Developers from outside the Brazilian insurance market model vigência as a simple calendar date range, matching international habits.

**Consequences:** Automated renewal alerts (core product feature) fire on the wrong day. Corretoras miss critical expiry windows. Loss of trust in the system, which is supposed to replace manual Excel tracking.

**Warning signs:**
- `vigencia_fim` stored as `DATE` without `TIMESTAMPTZ`
- Alert cron job computes `NOW() > vigencia_fim` without timezone conversion
- Alerts fire at midnight UTC (21:00 BRT) rather than at end-of-business

**Prevention:**
1. Store `vigencia_inicio` and `vigencia_fim` as `TIMESTAMPTZ`, defaulting to `14:00 America/Sao_Paulo` when only a date is provided.
2. All "days until expiry" calculations run in `America/Sao_Paulo` timezone: `(vigencia_fim AT TIME ZONE 'America/Sao_Paulo')::date - CURRENT_DATE`.
3. Alert queries explicitly specify the timezone in all comparisons.

**Phase:** Phase 2 (Seguros module). Get this right before alert automation is built.

---

### Pitfall 7: Commission Calculation Without Audit Trail

**What goes wrong:** Commission calculations run as a single `UPDATE` statement based on current prêmio values. If the prêmio is amended, the commission is recalculated and the historical value is lost. Corretores dispute monthly payouts with no way to audit how each number was derived.

**Why it happens:** Commissions are modeled as a derived value rather than a journal/ledger of events. Simple CRUD approach applied to a financial ledger problem.

**Consequences:** Broker disputes require manual reconstruction from spreadsheets. LGPD and basic financial audit trails require preserving calculation history. Loss of user trust — commissions are the most financially sensitive feature.

**Warning signs:**
- `comissao_valor` is a column on the apólice/quota table, not a separate events table
- No `calculado_em`, `calculado_por`, `base_calculo`, `percentual` columns stored with each commission record
- Recalculation overwrites the previous value

**Prevention:**
1. Model commissions as an append-only ledger: `comissoes` table with `(id, apolice_id, corretor_id, tipo, base_calculo, percentual, valor, vigencia_referencia, calculado_em, status)`.
2. Never update commission records — create adjustment entries (`tipo = 'estorno'`, `tipo = 'correcao'`).
3. Monthly closing: generate a `fechamento_comissoes` snapshot that is immutable after approval.

**Phase:** Phase 3 (Comissões). Architecture decision must precede first commission calculation.

---

### Pitfall 8: Consórcio Assembly State Machine Not Formalized

**What goes wrong:** Monthly assemblies (assembleias) have complex state: `agendada → realizada → contemplados_registrados → encerrada`. Developers implement this as ad-hoc boolean flags (`realizada: bool`, `sorteio_feito: bool`). As features grow, invalid state combinations appear (assembly "done" but no contemplados recorded). The contemplated member's credit tracking then diverges from the assembly record.

**Why it happens:** Consórcio domain is unfamiliar to most developers. The regulatory complexity (BACEN oversight, mandatory minutes/atas) is not obvious from the surface requirements.

**Consequences:** Data inconsistencies in contemplação tracking. Reports showing members as contemplated when the assembly was never formally closed. Inability to reconstruct the sequence of events for audit.

**Warning signs:**
- `assembleias` table has multiple boolean flags instead of a `status` enum
- No transition validation (can set `realizada = true` even when `data_assembleia` is in the future)
- Contemplados table not linked to a specific assembleia record

**Prevention:**
1. Model assembleia with a proper state machine: `status ENUM ('agendada', 'em_andamento', 'realizada', 'encerrada')` with DB-level constraints on valid transitions (CHECK constraint or trigger).
2. `contemplados` must have a foreign key to `assembleia_id` — contemplation is only valid in the context of an assembly.
3. Store `ata_url` (assembly minutes document) — required for BACEN audit trails for consortium administrators.

**Phase:** Phase 2 (Consórcio module). State machine design before any data entry UI.

---

### Pitfall 9: CPF/CNPJ Stored as String Without Validation or Canonical Format

**What goes wrong:** Users enter CPF as `123.456.789-09`, `12345678909`, or `123 456 789 09`. The system stores as-entered. Duplicate detection fails (same client exists three times with three formats). Searches break. Integration with future SUSEP APIs fails because they expect unformatted 11-digit strings.

**Why it happens:** Input masking is added to the UI but no normalization happens at the database layer.

**Consequences:** Duplicate customer records with split history. Commission reports counting the same client multiple times. CPF validation bypass by entering all-zeros (`000.000.000-00`) which passes mask validation but is not a valid CPF.

**Warning signs:**
- `cpf` column is `VARCHAR(20)` instead of `CHAR(11)` or `CHAR(14)` for CNPJ
- No DB-level `CHECK` constraint validating the digit algorithm
- Duplicate clients in production data after onboarding

**Prevention:**
1. Store CPF as `CHAR(11)` (digits only, no formatting). Store CNPJ as `CHAR(14)` (digits only). Normalization happens at the API/server layer before insert.
2. Add a PostgreSQL `CHECK` constraint using a validation function that implements the two-digit check algorithm (modulo 11). Reject invalid CPFs at the DB level.
3. Add a `UNIQUE` constraint on `(tenant_id, cpf)` to prevent duplicates within a tenant.
4. Front-end mask is for UX only — strip formatting before sending to server.
5. Explicitly reject known invalid sequences: all same digits (111.111.111-11 through 999.999.999-99).

**Phase:** Phase 1 (data model). Retrofit is painful — get this right in the schema migration.

---

### Pitfall 10: LGPD Consent and Data Subject Rights Not Built In

**What goes wrong:** The system collects sensitive personal data (CPF, health info for vida/saúde seguros, financial data) without recording the legal basis for processing. When a LGPD data subject access request (DSAR) or deletion request arrives, there is no mechanism to identify all data associated with a specific CPF across the tenant's dataset.

**Why it happens:** LGPD compliance is treated as a legal/compliance task for "later." The data model is built without consent tracking from the start.

**Consequences:** ANPD fines up to 2% of annual revenue (capped at R$ 50M per incident). Inability to fulfill deletion requests. Reputational damage. Corretoras using the SaaS also inherit compliance risk if the platform is the processor.

**Warning signs:**
- No `consentimentos` table or `base_legal` column on data collection records
- No soft-delete mechanism — `DELETE` physically removes records
- No data export function for a specific CPF across all tables

**Prevention:**
1. Add `base_legal ENUM ('consentimento', 'contrato', 'obrigacao_legal', 'interesse_legitimo')` to any table collecting personal data.
2. Implement soft-delete with `deleted_at TIMESTAMPTZ` — never hard-delete personal records without a formal retention policy.
3. Build a "data export by CPF" function in Phase 1 foundations — it becomes exponentially harder to add later.
4. For seguros de saúde/vida, treat health-adjacent data as `dados_sensiveis` requiring explicit, specific consent.

**Phase:** Phase 1 (must). LGPD cannot be bolted on — the data model must support it from migration 001.

---

### Pitfall 11: n8n Webhooks Without Idempotency (Duplicate Financial Records)

**What goes wrong:** n8n webhook triggers fire automations on insurance events (policy renewed, payment received, commission calculated). If the webhook is retried (network timeout, n8n restart), the automation executes twice — creating duplicate comissão records, duplicate payment notifications, or double-counted receita.

**Why it happens:** n8n in "respond immediately" mode doesn't guarantee exactly-once delivery. The Supabase endpoint doesn't check for duplicate event IDs.

**Consequences:** Financial records corrupted. Corretores receive two commission payments. Client billed twice. Manual reconciliation required.

**Warning signs:**
- Webhook handlers do `INSERT` without checking for existing `event_id`
- No `event_id` column on financial tables
- n8n workflows lack a "check if already processed" step before write operations

**Prevention:**
1. Every Supabase webhook endpoint accepts an `x-event-id` header. Store `event_id` on affected records or in a `webhook_events` idempotency table with `UNIQUE(event_id)`.
2. Use PostgreSQL `INSERT ... ON CONFLICT (event_id) DO NOTHING` to make webhook handlers idempotent.
3. n8n workflows check the idempotency table as the first step before any writes.
4. Always use n8n "Respond Immediately" mode to acknowledge receipt within 5 seconds, then process async.

**Phase:** Phase 4 (n8n Automations). Design idempotency keys before any financial automation is built.

---

### Pitfall 12: n8n Webhook Endpoints Without Authentication

**What goes wrong:** n8n webhook URLs are publicly accessible. Without signature verification, any external actor who discovers the URL can trigger automations — spamming notifications, creating fake records, or triggering commission calculations.

**Why it happens:** n8n webhook URLs work out of the box with no auth. Adding HMAC verification feels like over-engineering for an internal tool.

**Consequences:** Unauthorized automation triggers. Financial record pollution. Potential DoS of the n8n instance.

**Warning signs:**
- Webhook URLs in environment variables without a corresponding `WEBHOOK_SECRET`
- n8n workflows have no "Verify Signature" first node
- Webhook URLs visible in Vercel environment logs or git history

**Prevention:**
1. All n8n webhooks must be called with an HMAC-SHA256 signature header: `x-webhook-signature: sha256=<HMAC of body with shared secret>`.
2. Supabase Edge Function or Next.js API route verifies signature before processing.
3. Rotate webhook secrets quarterly. Store in Vercel environment variables, never in code.
4. Add IP allowlist for n8n cloud egress IPs as defense-in-depth.

**Phase:** Phase 4 (n8n Automations). Security must be in place before any webhook goes live.

---

### Pitfall 13: AI/WhatsApp Hallucinating Financial Data to Clients

**What goes wrong:** The AI assistant (integrated via WhatsApp) answers client questions about policy coverage, premium values, or consortium bid status. The LLM hallucinates a plausible but incorrect answer — telling a client their apólice covers something it does not, or quoting a wrong premium. The client acts on this, leading to a disputed claim.

**Why it happens:** LLMs are trained on general insurance knowledge but do not have access to the specific policy documents and real-time data of the tenant's system. Without RAG grounding, any policy-specific answer is a hallucination risk.

**Consequences:** Legal liability for the corretora. SUSEP regulatory issues (providing incorrect insurance advice). Client trust destruction. Potential insurance claim disputes.

**Warning signs:**
- AI prompt does not include the specific apólice data for the client being served
- No confidence threshold or escalation mechanism ("I'll connect you to a human")
- AI allowed to answer questions about coverage specifics without document grounding

**Prevention:**
1. Implement Retrieval-Augmented Generation (RAG): every AI response about a specific policy must be grounded in the actual apólice record fetched from Supabase, injected into the prompt context.
2. Hard rule: AI must NEVER quote specific coverage values, premium amounts, or claim statuses from general knowledge — only from the retrieved database record.
3. Implement confidence-based escalation: if the AI cannot find a matching record or the question is outside known scope, it must transfer to a human and not guess.
4. Add an explicit disclaimer injected into every AI response: "Esta informação é baseada nos dados cadastrados. Consulte sua apólice ou um corretor para confirmação oficial."
5. Log every AI interaction for audit — LGPD and potential legal review require this.

**Phase:** Phase 5 (AI/WhatsApp). Cannot go live without RAG grounding and escalation logic.

---

### Pitfall 14: WhatsApp 24-Hour Conversation Window Breaking Automation Flows

**What goes wrong:** Automated renewal reminders or payment alerts are sent as outbound messages to clients. If the client has not initiated a conversation in the last 24 hours, the message must use a pre-approved template. Developers design flows that send free-form messages outside the window, causing failures. After Meta's July 2025 pricing change (per-template pricing, no more conversation windows), costs spike unexpectedly.

**Why it happens:** WhatsApp Business API constraint is not well-understood. n8n automation flows are designed without considering whether each message falls inside or outside a conversation window.

**Consequences:** Renewal alerts silently fail to deliver. Clients miss important vigência expiry notifications. Post-July 2025, unplanned template costs create billing surprises.

**Warning signs:**
- Automation sends raw text messages without checking if a conversation window is open
- No template management strategy (approved templates for each notification type)
- No delivery receipt logging in the database

**Prevention:**
1. Design all outbound WhatsApp automation as template messages (HSM) — assume no open window.
2. Register templates in advance with Meta for every notification type: `renovacao_lembrete_30d`, `parcela_vencimento`, `contemplacao_aviso`.
3. Log every message delivery attempt and status in a `whatsapp_messages` table for debugging and cost tracking.
4. After July 2025, model WhatsApp messaging costs per template in the pricing plan — factor this into SaaS tier pricing.

**Phase:** Phase 5 (WhatsApp integration). Template registry must be set up before automation goes live.

---

## Minor Pitfalls

Mistakes that cause friction, tech debt, or minor data quality issues.

---

### Pitfall 15: Tenant Onboarding Without Data Isolation Validation

**What goes wrong:** When a new corretora signs up, the onboarding flow creates the tenant record but no automated test verifies that the new tenant cannot read data from existing tenants (and vice versa). Isolation is assumed, not verified.

**Prevention:** Automated onboarding integration test: create Tenant A with seed data, create Tenant B, authenticate as Tenant B, assert that Tenant A's tables return zero rows. Run this on every schema migration.

**Phase:** Phase 1.

---

### Pitfall 16: Consórcio Group Lifecycle Not Tracking Encerramento

**What goes wrong:** Consortium groups have a defined lifecycle (formation → active → contemplation running → all contemplated → encerrado). When the group ends, existing quotas are not properly closed and remain in "active" state indefinitely, inflating metrics.

**Prevention:** Model `grupos_consorcio.status ENUM` with a terminal state `encerrado`. Enforce `data_encerramento` is set when status transitions to `encerrado`. Quotas in an encerrado group must be read-only.

**Phase:** Phase 2 (Consórcio).

---

### Pitfall 17: Billing Per Tenant Not Aligned with Supabase Resource Limits

**What goes wrong:** The SaaS pricing plan allows unlimited tenants on the Supabase free/pro tier. As tenants grow, the database hits row limits, storage limits, or connection limits. There is no per-tenant resource usage tracking, making it impossible to enforce plan limits or identify heavy users.

**Prevention:** Track per-tenant resource usage: row counts per table, storage in MB, API calls per day (via Supabase Edge Function logs). Implement soft limits per plan tier before launch. Choose Supabase Pro tier from the start if expecting > 10 tenants in production.

**Phase:** Phase 1 (billing) and Phase 6 (scale).

---

### Pitfall 18: Supabase Realtime Used for Financial Updates Without Deduplication

**What goes wrong:** Supabase Realtime is used to push commission updates and payment status to the UI. If a user has multiple browser tabs open, the same event fires in each tab and triggers duplicate UI state updates or toast notifications.

**Prevention:** Use a broadcast ID or event deduplication key in Realtime channels. Handle `RECEIVED` events idempotently in the React state — check if the record ID already exists in state before updating.

**Phase:** Phase 3 (Financeiro/Dashboards).

---

## Phase-Specific Warning Map

| Phase | Topic | Most Likely Pitfall | Mitigation Priority |
|-------|-------|---------------------|---------------------|
| 1 - Auth & Multi-tenancy | Supabase RLS foundation | Pitfalls 1, 2, 3, 4, 5 | CRITICAL — block all other phases |
| 1 - Data Model | CPF/CNPJ, LGPD | Pitfalls 9, 10 | CRITICAL — retrofit is very costly |
| 2 - Seguros | Vigência date modeling | Pitfall 6 | HIGH — alerts are core value |
| 2 - Consórcio | Assembly state machine | Pitfall 8 | HIGH — data integrity |
| 3 - Comissões | Audit trail architecture | Pitfall 7 | HIGH — financial correctness |
| 4 - n8n Automations | Idempotency, webhook auth | Pitfalls 11, 12 | HIGH — financial safety |
| 5 - AI/WhatsApp | Hallucination, windows | Pitfalls 13, 14 | HIGH — legal exposure |
| 6 - Scale | Index strategy, resource limits | Pitfalls 3, 17 | MEDIUM — plan from start |

---

## Brazilian Market Specifics Summary

| Aspect | Key Constraint | Implication |
|--------|---------------|-------------|
| SUSEP | Corretoras legally obligated to notify clients 60 days before vigência end | Alert system is not optional — it is a regulatory obligation |
| LGPD | Health/vida seguros data is "dado sensível" — requires specific consent | Separate consent flow for seguros de saúde vs. auto/residencial |
| BACEN | Consórcio administrators (not corretoras) regulated — corretoras are intermediaries | No need to replicate BACEN reporting in v1, but audit trail is needed |
| BRL | IOF on credit card transactions (3.5%), PIX is the dominant payment method | Subscription billing must offer PIX/Boleto, not just credit card |
| Timezone | All insurance operations in Brasília time (BRT/BRST, UTC-3/UTC-2) | `America/Sao_Paulo` is the canonical timezone for all date logic |
| SUSEP Consulta Pública 05/2025 | Proposed unification of 13 CNSP resolutions, new broker registration code | Monitor this regulation — may require unique `codigo_susep` field per corretor in v1 |

---

## Sources

- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RLS performance: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- CVE-2025-48757 (170+ apps exposed): https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/
- Supabase security_definer views: https://supabase.com/docs/guides/database/database-advisors?lint=0010_security_definer_view
- Supabase API key security: https://supabase.com/docs/guides/api/api-keys
- RLS production patterns (makerkit): https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- n8n idempotency: https://medium.com/@Modexa/idempotent-webhook-retries-in-n8n-without-duplicates-8380273a95a2
- n8n webhook security: https://logicworkflow.com/blog/n8n-webhook-security/
- SUSEP Consulta Pública 05/2025: https://lefosse.com/noticias/susep-publica-edital-de-consulta-publica-n-o-5-2025-com-sugestoes-de-alteracoes-na-regulamentacao-de-corretores-de-seguros-e-entidades-do-setor/
- LGPD e corretoras de seguros: https://www.segfy.com/o-que-muda-na-minha-corretora-de-seguros-com-a-lei-geral-de-protecao-de-dados/
- LGPD penalidades seguros: https://docmanagement.com.br/01/03/2025/saiba-como-a-lgpd-afeta-o-setor-de-seguros/
- AI hallucinations in financial services: https://biztechmagazine.com/article/2025/08/llm-hallucinations-what-are-implications-financial-institutions
- WhatsApp API rate limits 2025: https://wasenderapi.com/blog/whatsapp-api-rate-limits-explained-how-to-scale-messaging-safely-in-2025
- WhatsApp pricing change July 2025: https://chat2desk.com/en/blog/articles/whatsapp-business-api-billing-to-change
- CPF/CNPJ algorithm: https://dev.to/leandrostl/demystifying-cpf-and-cnpj-check-digit-algorithms-a-clear-and-concise-approach-f3j
- Vigência e renovação SUSEP: https://www2.susep.gov.br/download/cartilha/cartilha_susep2e.pdf
- SUSEP obrigação corretor aviso vigência: https://www.jusbrasil.com.br/artigos/o-corretor-de-seguros-e-obrigado-a-avisar-ao-segurado-sobre-o-final-de-vigencia-da-apolice-e-a-necessidade-de-renovacao/1206328594
