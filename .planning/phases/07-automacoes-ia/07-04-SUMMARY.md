---
phase: 07-automacoes-ia
plan: "04"
subsystem: ai-layer
tags: [ai, whatsapp, chat, streaming, tool-calling, route-handler, ui, AUTO-04, AUTO-05, AUTO-06]
dependency_graph:
  requires: [07-01, 07-03]
  provides: [whatsapp-endpoint, chat-endpoint, assistente-page, chat-interface, sidebar-assistente]
  affects: [sidebar-shell, app-layout]
tech_stack:
  added:
    - "ai@6.x stepCountIs (replaces maxSteps in generateText/streamText)"
    - "convertToModelMessages (async in v6)"
    - "toUIMessageStreamResponse (renamed from toDataStreamResponse in v6)"
    - "makeTool helper pattern (bypasses AI SDK v6 tool() overload resolution issue)"
  patterns:
    - "generateText for WhatsApp (complete JSON response for n8n)"
    - "streamText for chat (UI message stream for useChat)"
    - "service_role client with explicit tenant_id on all tool queries (T-07-03)"
    - "x-webhook-secret header validation for public endpoint (T-07-02)"
    - "System prompt scope constraint in PT-BR (anti prompt injection — T-07-04)"
key_files:
  created:
    - src/app/api/[slug]/ai/whatsapp/route.ts
    - src/app/api/[slug]/ai/chat/route.ts
    - src/app/(app)/[slug]/assistente/page.tsx
    - src/components/assistente/chat-interface.tsx
    - tests/actions/whatsapp-endpoint.test.ts
    - tests/actions/chat-isolation.test.ts
  modified:
    - src/components/auth/sidebar-shell.tsx
decisions:
  - "Used stopWhen: stepCountIs(5) instead of maxSteps — AI SDK v6 breaking change"
  - "convertToModelMessages is async in v6 — requires await before passing to streamText"
  - "Used makeTool() helper (identity function typed as any) to bypass tool() overload resolution bug in AI SDK v6 TypeScript types — runtime behavior identical"
  - "tools typed as Record<string,any> on whatsapp route; makeTool pattern on chat route"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-01T22:45:00Z"
  tasks_completed: 3
  files_created: 6
  files_modified: 1
---

# Phase 07 Plan 04: AI Route Handlers (whatsapp + chat) + Assistente UI Summary

One-liner: JWT-authenticated chat endpoint with streamText tool calling + x-webhook-secret WhatsApp endpoint with generateText escalation + /assistente page with useChat UI, all tenant-isolated via explicit .eq('tenant_id', tenantId) on service_role queries.

## Status

All 3 tasks complete. Zero TypeScript errors in production source files. 13 tests green.

## Route Handlers Created

### A. `src/app/api/[slug]/ai/whatsapp/route.ts` (AUTO-04, AUTO-05)

**Auth:** `x-webhook-secret` header validated against `process.env.WHATSAPP_WEBHOOK_SECRET` — returns 401 if absent or incorrect (T-07-02).

**Engine:** `generateText` (NOT streamText) — n8n/Evolution API needs complete JSON response, not a stream (Pitfall 6).

**Tools (3):**
- `getClientByPhone` — searches `clients` by phone with `ilike` + `eq('tenant_id', tenantId)`
- `getClientPolicies` — queries `policies` by `client_id` + `eq('tenant_id', tenantId)`
- `getFinancialSummary` — queries overdue pending `financial_entries` by `client_id` + `eq('tenant_id', tenantId)`

**Escalation (AUTO-05):** After `generateText`, calls `isLowConfidenceResponse({ finishReason, text })` from `@/lib/utils/ai-escalation`. Returns `{ response: ESCALATION_MESSAGE, escalated: true }` on low confidence or error.

**Response:** `{ response: string, escalated: boolean }` — always HTTP 200 (n8n needs valid JSON even on escalation).

### B. `src/app/api/[slug]/ai/chat/route.ts` (AUTO-06)

**Auth:** `createClient()` + `supabase.auth.getUser()` — returns 401 if no session.

**Cross-tenant guard:** `meta.slug !== slug` → 403 (same pattern as `export/route.ts`).

**RBAC:** `meta.role === 'visualizador'` → 403.

**Engine:** `streamText` + `result.toUIMessageStreamResponse()` — UI message stream protocol for `useChat` (Pitfall 5).

**Tools (3):**
- `searchClients` — searches `clients` by name or document with input sanitization
- `getClientPolicies` — queries `policies` by `client_id`
- `getOverduePayments` — queries overdue pending `financial_entries` for entire tenant (no clientId filter)

**AI SDK v6 fixes applied:**
- `stopWhen: stepCountIs(5)` instead of `maxSteps: 5`
- `await convertToModelMessages(messages as any)` — async in v6
- `makeTool()` helper — bypasses TS2769 overload resolution issue in AI SDK v6 types

## UI Created

### C. `src/app/(app)/[slug]/assistente/page.tsx`

Server Component. Calls `createClient()` → `getUser()`. Calls `notFound()` for unauthenticated users and `visualizador` role. Renders header + `<ChatInterface slug={slug} />`. Exports `metadata` with title.

### D. `src/components/assistente/chat-interface.tsx`

Client Component (`'use client'`). Uses `useChat` from `@ai-sdk/react` with `{ api: /api/${slug}/ai/chat, maxSteps: 5 }`. Features:
- Auto-scroll via `useRef` + `useEffect`
- Loading indicator (`animate-pulse "..."`) when `status === 'submitted' || 'streaming'`
- Error state display
- Message rendering via `m.parts?.map` (AI SDK v6 message structure)
- Input form with `handleSubmit` + `handleInputChange`

### E. `src/components/auth/sidebar-shell.tsx` (updated)

Added `Bot` import from `lucide-react`. Added conditional nav item after `Financeiro`:
```typescript
...(userRole === 'admin' || userRole === 'corretor' || userRole === 'financeiro'
  ? [{ label: 'Assistente IA', href: `/${slug}/assistente`, icon: <Bot size={16} /> }]
  : [])
```
`visualizador` does NOT see the link.

## Tests Populated

### `tests/actions/whatsapp-endpoint.test.ts` (5 tests — was placeholder)
1. `isLowConfidenceResponse({ finishReason: 'max-steps', text: '...' })` → `true`
2. `isLowConfidenceResponse({ finishReason: 'stop', text: 'A apolice X...' })` → `false`
3. `isLowConfidenceResponse({ finishReason: 'stop', text: 'sim' })` → `true` (short text)
4. `isLowConfidenceResponse({ finishReason: 'length', text: '...' })` → `true`
5. `ESCALATION_MESSAGE` is non-empty string

### `tests/actions/chat-isolation.test.ts` (8 tests — was placeholder)
- `isCrossTenantViolation({}, 'slug')` → `true` (missing slug)
- `isCrossTenantViolation({ slug: 'other' }, 'slug')` → `true` (different tenant)
- `isCrossTenantViolation({ slug: 'slug' }, 'slug')` → `false` (matching)
- `isChatAllowed('admin')` → `true`
- `isChatAllowed('corretor')` → `true`
- `isChatAllowed('financeiro')` → `true`
- `isChatAllowed('visualizador')` → `false`
- `isChatAllowed(undefined)` → `false`

**Result:** 13/13 tests pass. Full suite: 240 pass, 1 pre-existing failure (rls-isolation.test.ts — intentional expect.fail TODO from Phase 1).

## Required Environment Variables

| Variable | Used By | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Both route handlers | GPT-4o-mini via `@ai-sdk/openai` |
| `WHATSAPP_WEBHOOK_SECRET` | `/api/[slug]/ai/whatsapp` | Must match `x-webhook-secret` header sent by n8n/Evolution |
| `SUPABASE_SERVICE_ROLE_KEY` | Both route handlers (tool queries) | Server-side only — never exposed to client |
| `NEXT_PUBLIC_SUPABASE_URL` | Both route handlers | Already set in project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `createClient()` for chat auth | Already set in project |

**Operational note:** `WHATSAPP_WEBHOOK_SECRET` must be configured in both `.env.local` (Next.js) AND in the n8n workflow/Evolution API as the `x-webhook-secret` request header value. Without this match, the endpoint returns 401 to all requests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AI SDK v6 `maxSteps` removed from generateText/streamText**
- **Found during:** Task 2
- **Issue:** `maxSteps` no longer exists in `generateText`/`streamText` in AI SDK v6 — TypeScript error TS2353. API changed to `stopWhen: stepCountIs(N)`.
- **Fix:** Replaced `maxSteps: 5` with `stopWhen: stepCountIs(5)` in both route handlers. Imported `stepCountIs` from `'ai'`.
- **Files modified:** `src/app/api/[slug]/ai/whatsapp/route.ts`, `src/app/api/[slug]/ai/chat/route.ts`

**2. [Rule 1 - Bug] `convertToModelMessages` is async in AI SDK v6**
- **Found during:** Task 2
- **Issue:** TypeScript error TS2740 — `convertToModelMessages` returns `Promise<ModelMessage[]>` not `ModelMessage[]`. The RESEARCH.md pattern showed it synchronously but v6 made it async.
- **Fix:** Added `await` before `convertToModelMessages(messages as any)`.
- **Files modified:** `src/app/api/[slug]/ai/chat/route.ts`

**3. [Rule 1 - Bug] AI SDK v6 `tool()` TypeScript overload resolution (TS2769)**
- **Found during:** Task 2
- **Issue:** `tool()` function overloads in `@ai-sdk/provider-utils` fail to resolve when the `execute` function is typed. Last overload `tool(tool: Tool<never, never>)` requires `execute: undefined`, which conflicts with any execute function. Runtime works fine — type-only issue.
- **Fix:** Created `makeTool()` helper (identity function typed as `any`) to bypass overload checking. Pattern used in both route handlers. Documented with comments.
- **Files modified:** `src/app/api/[slug]/ai/whatsapp/route.ts`, `src/app/api/[slug]/ai/chat/route.ts`

## Known Stubs

None. All data connections are wired:
- WhatsApp endpoint queries real Supabase tables via service_role
- Chat endpoint queries real Supabase tables via service_role
- ChatInterface connects to real `/api/${slug}/ai/chat` endpoint
- Sidebar link points to real `/[slug]/assistente` route

## Threat Flags

None beyond what was already in the plan's threat model (T-07-02 through T-07-08 all mitigated as designed).

## Self-Check: PASSED

Files verified:
- `src/app/api/[slug]/ai/whatsapp/route.ts` — FOUND
- `src/app/api/[slug]/ai/chat/route.ts` — FOUND
- `src/app/(app)/[slug]/assistente/page.tsx` — FOUND
- `src/components/assistente/chat-interface.tsx` — FOUND
- `src/components/auth/sidebar-shell.tsx` — FOUND (modified)
- `tests/actions/whatsapp-endpoint.test.ts` — FOUND (5 tests)
- `tests/actions/chat-isolation.test.ts` — FOUND (8 tests)

Commits verified:
- `7943148` — test(07-04): populate whatsapp-endpoint + chat-isolation test stubs
- `f379e30` — feat(07-04): AI route handlers — whatsapp generateText + chat streamText
- `f1fac78` — feat(07-04): assistente IA page + ChatInterface + sidebar link (AUTO-06)
