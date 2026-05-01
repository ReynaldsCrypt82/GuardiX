---
plan: 07-02
phase: 07-automacoes-ia
status: complete
completed_at: 2026-05-01
---

# Plan 02 Summary — Edge Function Cron + Server Actions

## What Was Built

### Server Actions
- `src/lib/actions/webhook-configs.ts` — createWebhookConfigAction, updateWebhookConfigAction, softDeleteWebhookConfigAction (RBAC admin, Zod validation with SSRF guard via `webhookConfigSchema.refine(isUrlSafe)`)
- `src/lib/actions/email-templates.ts` — upsertEmailTemplateAction (SELECT then INSERT or UPDATE), softDeleteEmailTemplateAction

### Route Handler
- `src/app/api/[slug]/webhook-test/route.ts` — POST, RBAC admin, SSRF guard, builds sample payload per event_type, AbortSignal.timeout(10000), returns { http_status, ok, payload }

### Utility
- `src/lib/utils/dispatch-webhook.ts` — pure functions: buildWebhookPayload(), classifyHttpResponse()

### Edge Function
- `supabase/functions/automation-cron/index.ts` — Deno.serve, 302 lines
  - Validates `x-cron-secret` header → 401 if invalid (T-07-05)
  - 3 event detectors:
    - policy_expiring: policies WHERE vigencia_fim BETWEEN today AND today+days_before
    - financial_overdue: financial_entries WHERE due_date < today AND status='pending'
    - consortium_contemplated: consortium_quotas WHERE contemplated_at BETWEEN yesterday AND today
  - dispatchWebhook(): SSRF guard inline (defense in depth) → fetch → INSERT webhook_logs
  - callEmailRoute(): auth.admin.getUserById for corretor email → [corretor, client].filter(Boolean) → POST /api/internal/send-automation-email

## D-07 Compliance Confirmed
The Edge Function contains **ZERO** direct Resend calls (`api.resend.com` not present).
Email is fully delegated to the Next.js Route Handler via `callEmailRoute()` which POSTs to `/api/internal/send-automation-email` with `x-internal-secret`.

## Tests (25 green)
- `tests/utils/dispatch-webhook.test.ts` — 9 tests (buildWebhookPayload + classifyHttpResponse)
- `tests/actions/webhook-configs.test.ts` — 8 tests (create/update/softDelete RBAC + SSRF + Zod)
- `tests/actions/email-templates.test.ts` — 8 tests (upsert insert/update + RBAC + Zod)

## Production Deployment Requirements

### Supabase Secrets (required before cron fires)
```bash
supabase secrets set CRON_SHARED_SECRET=<random-uuid>
supabase secrets set INTERNAL_EMAIL_SECRET=<same-value-as-nextjs-env>
supabase secrets set NEXTJS_APP_URL=https://your-app.vercel.app
```

### Deploy Edge Function
```bash
supabase functions deploy automation-cron
```

### Vault Secrets (for pg_cron migration 0023)
```sql
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
SELECT vault.create_secret('<ANON_KEY>', 'cron_publishable_key');
SELECT vault.create_secret('<CRON_SHARED_SECRET>', 'cron_shared_secret');
```

## Behavior When Env Vars Not Configured
- `NEXTJS_APP_URL` or `INTERNAL_EMAIL_SECRET` missing → `callEmailRoute()` returns `false` silently (no error, no email)
- `CRON_SHARED_SECRET` not set → ALL requests to Edge Function return 401

## Commits
- `1322012` feat(07-02): server actions webhook-configs + email-templates + webhook-test route
- `bf5bd80` feat(07-02): edge function automation-cron — 3 event detectors + webhook dispatch + email delegation (D-07)
