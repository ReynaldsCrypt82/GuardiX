---
phase: 07-automacoes-ia
plan: "01"
subsystem: automacoes
tags: [schema, rls, supabase, migrations, ai-sdk, validators, wave-0, tests, react-email]
dependency_graph:
  requires:
    - "01-fundacao-auth (tenants, profiles, jwt_tenant_id, jwt_tenant_role)"
    - "03-seguros-consorcio (policies, consortium_quotas)"
    - "05-financeiro (financial_entries)"
  provides:
    - "webhook_configs table with RLS (admin-only)"
    - "webhook_logs table with RLS (SELECT-only, writes via service_role)"
    - "email_templates table with RLS (admin-only)"
    - "pg_cron schedule automation-cron-daily at 11:00 UTC"
    - "isUrlSafe() SSRF guard"
    - "renderEmailTemplate() with HTML escaping"
    - "isLowConfidenceResponse() AI escalation heuristics"
    - "webhookConfigSchema + emailTemplateSchema Zod validators"
    - "3 React Email templates (policy-expiring, financial-overdue, consortium-contemplated)"
    - "POST /api/internal/send-automation-email Route Handler"
  affects:
    - "07-02 (Edge Function consumes webhook_configs, webhook_logs, email_templates, utilities)"
    - "07-03 (UI for webhook_configs and email_templates admin pages)"
    - "07-04 (WhatsApp/chat Route Handlers consume isLowConfidenceResponse)"
tech_stack:
  added:
    - "ai@^6.0.173"
    - "@ai-sdk/openai@^3.0.57"
    - "@ai-sdk/react@^1.2.12"
    - "react-email@^6.0.5"
    - "@react-email/components@^1.0.12"
    - "@react-email/render@^2.0.8"
  patterns:
    - "React Email components for typed HTML email rendering (D-07)"
    - "SSRF guard via URL hostname blocklist (RFC1918 + loopback + link-local)"
    - "pg_cron + pg_net for Supabase Edge Function scheduling"
    - "Shared secret (x-internal-secret) for internal Route Handler auth"
key_files:
  created:
    - supabase/migrations/20260420_0021_automacoes_schema.sql
    - supabase/migrations/20260420_0022_automacoes_rls.sql
    - supabase/migrations/20260420_0023_automacoes_cron.sql
    - src/lib/utils/webhook-url.ts
    - src/lib/utils/email-template.ts
    - src/lib/utils/ai-escalation.ts
    - src/lib/validations/automation-schemas.ts
    - src/emails/policy-expiring.tsx
    - src/emails/financial-overdue.tsx
    - src/emails/consortium-contemplated.tsx
    - src/app/api/internal/send-automation-email/route.tsx
    - tests/utils/webhook-url.test.ts
    - tests/utils/email-template.test.ts
    - tests/utils/ai-escalation.test.ts
    - tests/utils/dispatch-webhook.test.ts
    - tests/actions/webhook-configs.test.ts
    - tests/actions/email-templates.test.ts
    - tests/actions/whatsapp-endpoint.test.ts
    - tests/actions/chat-isolation.test.ts
  modified:
    - package.json (6 new dependencies)
    - supabase/config.toml ([functions.automation-cron] added)
decisions:
  - "D-07 enforced: React Email components render in Node.js Route Handler, NOT in Deno Edge Function"
  - "Route Handler uses .tsx extension (not .ts) because JSX syntax requires tsx"
  - "Migration 0023 applied successfully in production (pg_cron returned schedule=1)"
  - "Fallback approach used for db push: npx supabase db query --linked -f (versioning collision known pattern)"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-01"
  tasks_completed: 6
  tasks_total: 6
  files_created: 19
  files_modified: 2
---

# Phase 7 Plan 01: Schema + Utilities + React Email + Wave 0 Tests Summary

**One-liner:** Supabase schema for webhook/email automation tables with RLS, pg_cron schedule at 11:00 UTC, AI SDK v6 + React Email installed, SSRF guard + HTML escape utilities, 3 React Email components, and internal Route Handler with shared-secret auth for Resend email dispatch.

---

## What Was Built

### 1. SQL Migrations Applied to Production

All 3 migrations applied via `npx supabase db query --linked -f` (fallback — known versioning collision).

| Migration | Status | Description |
|-----------|--------|-------------|
| 20260420_0021_automacoes_schema.sql | Applied | webhook_configs, webhook_logs, email_templates tables |
| 20260420_0022_automacoes_rls.sql | Applied | RLS admin-only policies (D-09) |
| 20260420_0023_automacoes_cron.sql | Applied | pg_cron schedule (returned schedule=1) |

**Verification:** All 3 tables confirmed in `information_schema.tables`. RLS `rowsecurity=true` on all 3.

**pg_cron schedule:** `automation-cron-daily` at `0 11 * * *` UTC = 08:00 BRT. Uses Vault secrets for `project_url`, `cron_publishable_key`, `cron_shared_secret`.

### 2. Installed Package Versions

**AI SDK:**
- `ai`: ^6.0.173
- `@ai-sdk/openai`: ^3.0.57
- `@ai-sdk/react`: ^1.2.12

**React Email:**
- `react-email`: ^6.0.5
- `@react-email/components`: ^1.0.12
- `@react-email/render`: ^2.0.8

### 3. Pure Utility Modules

| Module | Exports | Behavior |
|--------|---------|----------|
| `src/lib/utils/webhook-url.ts` | `isUrlSafe(url)` | Returns `false` for RFC1918, loopback (127.x, ::1), link-local (169.254.x), IPv6 (fc00:, fe80:), non-http/https schemes, unparseable strings |
| `src/lib/utils/email-template.ts` | `renderEmailTemplate()`, `DEFAULT_TEMPLATES`, `TEMPLATE_VARIABLES`, `escapeHtml()` | Substitutes 6 fixed vars (`{{nome_cliente}}`, `{{cpf_cnpj}}`, `{{vencimento}}`, `{{valor}}`, `{{nome_apolice}}`, `{{corretor}}`); HTML-escapes all values before substitution |
| `src/lib/utils/ai-escalation.ts` | `isLowConfidenceResponse()`, `ESCALATION_MESSAGE` | Returns `true` if `finishReason === 'length'` or `'max-steps'`, or `text.length < 20`, or text starts with `[INCERTO]` |
| `src/lib/validations/automation-schemas.ts` | `webhookConfigSchema`, `emailTemplateSchema`, `webhookTestSchema`, `eventTypeSchema` | Zod schemas with `isUrlSafe` refine on webhook URL field |

### 4. React Email Templates (D-07)

All 3 templates in `src/emails/` compile without TypeScript errors and use `@react-email/components`.

| File | Component | Props |
|------|-----------|-------|
| `src/emails/policy-expiring.tsx` | `PolicyExpiringEmail` | nome_cliente, nome_apolice, vencimento, corretor, valor |
| `src/emails/financial-overdue.tsx` | `FinancialOverdueEmail` | nome_cliente, descricao, valor, vencimento, corretor |
| `src/emails/consortium-contemplated.tsx` | `ConsortiumContemplatedEmail` | nome_cliente, nome_grupo, valor, corretor |

### 5. Internal Route Handler

`POST /api/internal/send-automation-email` (file: `route.tsx`)
- Runtime: `nodejs` (NOT edge — required for `@react-email/render`)
- Auth: `x-internal-secret` header vs `INTERNAL_EMAIL_SECRET` env var → 403 on mismatch
- Logic: `custom_body_html` truthy → use tenant template HTML directly; null → render React Email component for event_type
- Send: Resend REST API at `https://api.resend.com/emails`

### 6. Wave 0 Test Stubs (8 files)

| File | Type | Tests | Status |
|------|------|-------|--------|
| `tests/utils/webhook-url.test.ts` | Real tests | 7 tests on `isUrlSafe()` | Green |
| `tests/utils/email-template.test.ts` | Real tests | 4 tests on `renderEmailTemplate()` + `DEFAULT_TEMPLATES` | Green |
| `tests/utils/ai-escalation.test.ts` | Real tests | 5 tests on `isLowConfidenceResponse()` + `ESCALATION_MESSAGE` | Green |
| `tests/utils/dispatch-webhook.test.ts` | Placeholder | 1 test | Green (Plan 02) |
| `tests/actions/webhook-configs.test.ts` | Placeholder | 1 test | Green (Plan 02) |
| `tests/actions/email-templates.test.ts` | Placeholder | 1 test | Green (Plan 02) |
| `tests/actions/whatsapp-endpoint.test.ts` | Placeholder | 1 test | Green (Plan 04) |
| `tests/actions/chat-isolation.test.ts` | Placeholder | 1 test | Green (Plan 04) |

**Total: 21 tests, 8 files, all green.**

---

## Operational Notes for Production Deploy

### New Environment Variables Required

| Variable | Where to Set | Description |
|----------|-------------|-------------|
| `INTERNAL_EMAIL_SECRET` | Vercel env vars + Supabase secrets | Shared secret between Edge Function (Plan 02) and Route Handler |
| `NEXTJS_APP_URL` | Supabase secrets (for Edge Function) | Next.js app URL — used by Edge Function to build the Route Handler URL |
| `RESEND_FROM_EMAIL` | Vercel env vars | Sender address (e.g. `NEXUS AGENT <noreply@seudominio.com.br>`) |
| `RESEND_API_KEY` | Already required — confirm set | Resend API key for email dispatch |
| `OPENAI_API_KEY` | Vercel env vars + Supabase secrets | Required for AUTO-04/05/06 (Plan 04) |

### pg_cron Vault Secrets (Production)

The cron schedule uses Supabase Vault for secrets. Run in production SQL Editor:

```sql
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
SELECT vault.create_secret('<SUPABASE_ANON_KEY>', 'cron_publishable_key');
SELECT vault.create_secret(gen_random_uuid()::text, 'cron_shared_secret');
```

The `cron_shared_secret` value must also be set as `CRON_SHARED_SECRET` in Supabase Edge Function secrets (for Plan 02 validation).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route Handler extension changed from .ts to .tsx**
- **Found during:** Task 6 TypeScript check
- **Issue:** Plan specified `route.ts` but the file uses JSX (React Email component instantiation). TypeScript cannot parse JSX in `.ts` files.
- **Fix:** Renamed to `route.tsx` — Next.js supports both `.ts` and `.tsx` for Route Handlers; the routing is identical.
- **Files modified:** `src/app/api/internal/send-automation-email/route.tsx`
- **Commit:** de6c72e

**2. Pre-existing TypeScript errors in other test files (out of scope)**
- `tests/actions/broker-profiles.test.ts`, `commission-entries.test.ts`, `financial-entries.test.ts`, `partners.test.ts`, and `src/lib/actions/invites.ts` have pre-existing TypeScript errors.
- These are out of scope for this plan and logged to deferred-items.

---

## Known Stubs

None — all stubs are intentional Wave 0 placeholders documented above. The 5 placeholder tests (`dispatch-webhook`, `webhook-configs`, `email-templates`, `whatsapp-endpoint`, `chat-isolation`) will be populated in Plan 02 and Plan 04 as specified in the plan frontmatter.

---

## Threat Flags

None — all new tables and endpoints were within the plan's threat model:
- `webhook_configs`, `email_templates`, `webhook_logs` covered by T-07-01 (RLS)
- `/api/internal/send-automation-email` covered by T-07-INTERNAL (x-internal-secret)
- `webhookConfigSchema` covered by T-07-SSRF (isUrlSafe refine)

## Self-Check: PASSED

All created files verified:
- [x] `supabase/migrations/20260420_0021_automacoes_schema.sql` — FOUND
- [x] `supabase/migrations/20260420_0022_automacoes_rls.sql` — FOUND
- [x] `supabase/migrations/20260420_0023_automacoes_cron.sql` — FOUND
- [x] `src/lib/utils/webhook-url.ts` — FOUND
- [x] `src/lib/utils/email-template.ts` — FOUND
- [x] `src/lib/utils/ai-escalation.ts` — FOUND
- [x] `src/lib/validations/automation-schemas.ts` — FOUND
- [x] `src/emails/policy-expiring.tsx` — FOUND
- [x] `src/emails/financial-overdue.tsx` — FOUND
- [x] `src/emails/consortium-contemplated.tsx` — FOUND
- [x] `src/app/api/internal/send-automation-email/route.tsx` — FOUND
- [x] 8 test files in tests/utils/ and tests/actions/ — FOUND
- [x] 3 tables in production DB with RLS active — VERIFIED
- [x] pg_cron schedule applied — VERIFIED (schedule=1)
- [x] All commits exist: ed8e922, 460952b, 663f3bd, 394bdf0, de6c72e
