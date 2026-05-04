---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Defining requirements
stopped_at: Phase 1 context gathered
last_updated: "2026-05-04T18:52:31.981Z"
last_activity: 2026-05-04 — 4 fases adicionadas ao ROADMAP (v1.1 Portal do Cliente)
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 18
  completed_plans: 18
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-04)

**Core value:** Corretoras de pequeno e médio porte controlam todo o ciclo de vida de seguros e consórcio em um único sistema, substituindo planilhas e ferramentas dispersas.
**Current focus:** Milestone v1.1 — Portal do Cliente

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-04 — 4 fases adicionadas ao ROADMAP (v1.1 Portal do Cliente)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity (v1.0 histórico):**

- Total plans completed: 28
- Average duration: ~20m/plan

**Recent Trend (v1.0):**

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 03-seguros-consorcio | 6 | ~14m |
| 05-financeiro | 3 | ~35m |
| 06-dashboards-relatorios | 3 | ~16m |
| 07-automacoes-ia | 4 | ~40m |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Decisions carregadas do v1.0 relevantes para v1.1:

- Multi-tenant via RLS no Supabase — isolamento por tenant_id sem infra separada
- `@supabase/ssr` para auth (auth-helpers esta depreciado)
- `app_metadata` (nao `user_metadata`) para tenant_id e role no JWT
- Ledger de comissoes append-only — nunca UPDATE em valores ja registrados
- [Phase 03-01]: supabase db push contornado via supabase db query --linked -f por versioning collision
- [Phase 03-02]: Server Actions usam as any cast no Supabase client para tabelas nao em generated types
- [Phase 07-01]: pg_cron schedule automation-cron-daily aplicado em producao com sucesso (schedule=1); vault secrets necessarios antes do cron disparar
- [Phase 07-automacoes-ia]: AI SDK v6: stopWhen:stepCountIs(N) replaces maxSteps; convertToModelMessages is async; makeTool helper bypasses TS2769 overload issue

### Roadmap Evolution

- Phase 1 added: Auth do Portal
- Phase 2 added: Wildcard Routing e Layout do Portal
- Phase 3 added: Portal Apolices e Consorcio
- Phase 4 added: Portal Financeiro e PDFs

### Pending Todos

None yet.

### Blockers/Concerns

- Portal client auth: novo user type (portal_client) no Supabase Auth — precisa de RLS policies separadas dos usuários internos
- Wildcard subdomain routing no Vercel: requer configuração de domínio wildcard (*.nexus.app ou domínio customizado) + middleware changes significativas
- Supabase Storage: buckets privados para PDFs de apólices — signed URLs com expiração curta (LGPD: sem URLs públicas permanentes)
- Supabase região `sa-east-1` (São Paulo) — verificar disponibilidade para LGPD data residency

## Session Continuity

Last session: 2026-05-04T18:52:31.963Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-auth-do-portal/01-CONTEXT.md
