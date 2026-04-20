# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Corretoras de pequeno e médio porte controlam todo o ciclo de vida de seguros e consórcio em um único sistema, substituindo planilhas e ferramentas dispersas.
**Current focus:** Phase 1 — Fundacao & Auth

## Current Position

Phase: 1 of 7 (Fundacao & Auth)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-19 — Roadmap created (7 phases, 48 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Multi-tenant via RLS no Supabase — isolamento por tenant_id sem infra separada
- `@supabase/ssr` para auth (auth-helpers esta depreciado)
- `app_metadata` (nao `user_metadata`) para tenant_id e role no JWT
- Seguros + Consorcio agrupados na Phase 3 — paralelos, ambos dependem apenas do CRM
- Ledger de comissoes append-only — nunca UPDATE em valores ja registrados

### Pending Todos

None yet.

### Blockers/Concerns

- Questao aberta: WhatsApp API path (Evolution API vs Meta Business API oficial) — decidir antes da Phase 7
- Questao aberta: Comissao projetada vs realizada — validar com corretoras reais antes da Phase 4
- Questao aberta: Supabase regiao `sa-east-1` (Sao Paulo) — verificar disponibilidade de plano para LGPD data residency

## Session Continuity

Last session: 2026-04-19
Stopped at: Roadmap criado — pronto para planejar Phase 1 (Fundacao & Auth)
Resume file: None
