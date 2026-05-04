---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: portal-do-cliente
status: defining-requirements
stopped_at: —
last_updated: "2026-05-04T00:00:00.000Z"
last_activity: 2026-05-04
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
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
Last activity: 2026-05-04 — Milestone v1.1 iniciado

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

### Pending Todos

None yet.

### Blockers/Concerns

- Portal client auth: novo user type (portal_client) no Supabase Auth — precisa de RLS policies separadas dos usuários internos
- Wildcard subdomain routing no Vercel: requer configuração de domínio wildcard (*.nexus.app ou domínio customizado) + middleware changes significativas
- Supabase Storage: buckets privados para PDFs de apólices — signed URLs com expiração curta (LGPD: sem URLs públicas permanentes)
- Supabase região `sa-east-1` (São Paulo) — verificar disponibilidade para LGPD data residency

## Session Continuity

Last session: 2026-05-04
Stopped at: Iniciando definição de requirements v1.1
Resume file: None
