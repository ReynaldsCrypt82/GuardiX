---
phase: 07-automacoes-ia
plan: "03"
subsystem: automacoes-ui
tags: [ui, configuracoes, rbac, webhooks, email-templates, sidebar]
dependency_graph:
  requires: [07-01, 07-02]
  provides: [AUTO-01-ui]
  affects: [sidebar-shell]
tech_stack:
  added: []
  patterns: [server-component-rbac-redirect, client-component-startTransition, card-grid-layout]
key_files:
  created:
    - src/app/(app)/[slug]/configuracoes/automacoes/page.tsx
    - src/app/(app)/[slug]/configuracoes/automacoes/webhook-config-form.tsx
    - src/app/(app)/[slug]/configuracoes/automacoes/email-template-form.tsx
    - src/app/(app)/[slug]/configuracoes/automacoes/webhook-logs-table.tsx
    - src/app/(app)/[slug]/configuracoes/automacoes/test-webhook-button.tsx
  modified:
    - src/components/auth/sidebar-shell.tsx
decisions:
  - "UX: 3-column card grid (md:grid-cols-3) for webhook configs — each event type gets its own card with URL + days_before + active inputs"
  - "UX: Vertical list (flex-col gap-4) for email templates — textarea rows=10 needs full width, card layout better than grid"
  - "Form pattern: startTransition + direct Server Action call (same pattern as stages-manager.tsx) — no zodResolver, no useFormState"
  - "RBAC: Server Component redirect to /[slug]/dashboard if role !== admin — consistent with pipeline/page.tsx pattern"
  - "Sidebar: spread conditional [...(userRole === 'admin' ? [{...}] : [])] consistent with Financeiro item pattern"
  - "TestWebhookButton: green text for HTTP 2xx, destructive text for errors — color-coded result inline below button"
  - "No delete button in UI v1: softDeleteWebhookConfigAction and softDeleteEmailTemplateAction exist in Server Actions but no UI affordance — deferred to phase 2"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-01"
  tasks_completed: 1
  tasks_total: 2
  files_created: 5
  files_modified: 1
---

# Phase 7 Plan 03: Automacoes UI + Sidebar Link Summary

**One-liner:** Admin-only `/configuracoes/automacoes` page with 3-section layout — webhook n8n config cards per event, email template forms with variable helpers and restore-default, read-only dispatch log table, and conditional sidebar link.

## Status

- **Task 1:** Complete — all 5 files created, sidebar updated, commit `de26a34`
- **Task 2:** Pending human verification checkpoint (Task 2 is `checkpoint:human-verify`)

## Files Created

| File | Type | Description |
|------|------|-------------|
| `src/app/(app)/[slug]/configuracoes/automacoes/page.tsx` | Server Component | RBAC guard (admin-only redirect), Promise.all for 3 queries, renders 3 sections |
| `src/app/(app)/[slug]/configuracoes/automacoes/webhook-config-form.tsx` | Client Component | Form per event_type — url, days_before (policy_expiring only), active checkbox; calls create/updateWebhookConfigAction |
| `src/app/(app)/[slug]/configuracoes/automacoes/email-template-form.tsx` | Client Component | Form per event_type — subject, body_html textarea, TEMPLATE_VARIABLES helper, Restaurar padrao button; calls upsertEmailTemplateAction |
| `src/app/(app)/[slug]/configuracoes/automacoes/webhook-logs-table.tsx` | Server Component | Read-only shadcn Table showing last 20 dispatches: date (ptBR), event label, URL, http_status (color-coded), error_message |
| `src/app/(app)/[slug]/configuracoes/automacoes/test-webhook-button.tsx` | Client Component | POSTs to `/api/${slug}/webhook-test`, shows HTTP status + ok/falha inline, loading state |

## Sidebar Change

`src/components/auth/sidebar-shell.tsx` — added conditional spread inside Configuracoes children array:

```typescript
...(userRole === 'admin'
  ? [{ label: 'Automacoes', href: `/${slug}/configuracoes/automacoes` }]
  : [])
```

Visible only to admin users, consistent with the Financeiro item spread pattern on line 67.

## UX Decisions

1. **Webhook cards in 3-column grid** (`md:grid-cols-3`): Each event type (policy_expiring, financial_overdue, consortium_contemplated) gets its own Card component. Compact layout lets admin see all 3 configs at a glance on wider screens.

2. **Email templates in vertical list** (`flex-col gap-4`): The `body_html` textarea at `rows=10` needs full width. Cards stacked vertically allow the textarea to breathe and make the TEMPLATE_VARIABLES helper text easy to read.

3. **Form state with `startTransition`**: No `useFormState`/`useActionState` — follows the `stages-manager.tsx` pattern already established in the codebase. Errors are stored in local state (`setFieldErrors`) from the Server Action return value.

4. **days_before field conditional**: Only rendered when `eventType === 'policy_expiring'` — the other two events do not have a configurable advance notice window.

## Deferred

- **Delete button in UI**: `softDeleteWebhookConfigAction` and `softDeleteEmailTemplateAction` exist in Server Actions (Plan 02) but there is no delete affordance in the UI. Admin can only create/update in v1. Soft delete via Server Action is available for programmatic use or future UI addition (phase 2).
- **Pagination for webhook_logs**: Table shows only 20 most recent dispatches. Full paginated history deferred to phase 2.

## Deviations from Plan

None — plan executed exactly as written. TypeScript errors found during `tsc --noEmit` are pre-existing in `src/lib/actions/invites.ts` and `tests/actions/` files, none introduced by Phase 7 Plan 03 changes.

## Self-Check: PASSED

Files verified:
- `src/app/(app)/[slug]/configuracoes/automacoes/page.tsx` — EXISTS
- `src/app/(app)/[slug]/configuracoes/automacoes/webhook-config-form.tsx` — EXISTS
- `src/app/(app)/[slug]/configuracoes/automacoes/email-template-form.tsx` — EXISTS
- `src/app/(app)/[slug]/configuracoes/automacoes/webhook-logs-table.tsx` — EXISTS
- `src/app/(app)/[slug]/configuracoes/automacoes/test-webhook-button.tsx` — EXISTS
- Sidebar updated: `configuracoes/automacoes` present in sidebar-shell.tsx — CONFIRMED

Commit `de26a34` verified in git log.
