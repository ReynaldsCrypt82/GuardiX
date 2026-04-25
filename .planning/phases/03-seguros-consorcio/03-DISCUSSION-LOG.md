---
phase: 03-seguros-consorcio
date: 2026-04-25
participants: [user, claude]
outcome: context_created
---

# Phase 3 Discussion Log — Seguros & Consórcio

## Session Overview

Discussed 4 gray areas to lock implementation decisions before planning. All areas resolved in one session. No decisions deferred to future discussion.

---

## Area 1: Tipos de Seguro — Schema por Tipo (D-01)

**Question:** How to handle insurance-type-specific fields — single generic table vs. separate tables vs. JSONB?

**Options presented:**
- A: Single generic schema (only shared fields, type-specific data lost)
- B: Type-specific fields via dynamic form + JSONB column

**User choice:** B — schema específico por tipo

**Rationale:** Preserves type-specific data integrity while avoiding schema migrations for each type. JSONB `type_data` on `policies` table holds Auto/Vida/Residencial/Empresarial/Saúde-specific fields. Same pattern as PF/PJ discriminated union in Phase 2.

**Locked:** 6 insurance types with their specific fields defined. See CONTEXT.md D-01.

---

## Area 2: Navegação das Listagens (D-02)

**Question:** Where should insurance and consortium lists live — sidebar only, or also embedded in client detail?

**Options presented:**
- A: Sidebar only (global listing, no client context)
- B: Listagem global + dentro do cliente (two entry points)

**User choice:** B — dois pontos de entrada

**Rationale:** Corretores need both views: a global list to manage all policies and a client-specific view when working with a specific customer. Phase 2 already left placeholder tabs on the client detail page.

**Locked:** `/[slug]/seguros` and `/[slug]/consorcio` as top-level sidebar items + "Apólices" and "Consórcio" tabs in client detail. See CONTEXT.md D-02.

---

## Area 3: Modelo de Dados do Consórcio (D-04)

**Question:** How complex should the consortium data model be in v1?

**Options presented:**
- A: Modelo simplificado (2 tables: groups + quotas, next_assembly_date on group)
- B: Modelo completo (assembly records, installment history, auction tracking)

**User choice:** A — modelo simplificado

**Rationale:** v1 needs to be shippable. Full consortium lifecycle management belongs to Phase 5 (Financeiro). Two tables cover the core use case: tracking which client has which quota in which group.

**Locked:** `consortium_groups` + `consortium_quotas`, assembleia via `next_assembly_date` field, pós-contemplação via `status='contemplado'` + free-text notes. See CONTEXT.md D-04.

---

## Area 4: Alertas (D-06)

**Question:** Should Phase 3 include email alerts for policy expiry and assembly dates?

**Options presented:**
- A: In-app only (badge + toast, same pattern as Phase 2)
- B: In-app + email (requires Resend setup, n8n hooks)

**User choice:** A — só in-app

**Rationale:** Email automation belongs with n8n in Phase 7. Keeping Phase 3 focused avoids introducing email infrastructure prematurely. In-app alerts (badge counter + toast on login) cover the immediate UX need.

**Locked:** Badge counts expired/near-expiry policies (≤30 days). Assembly alert 3 days before `next_assembly_date`. Email deferred to Phase 7. See CONTEXT.md D-06.

---

## Summary

| Area | Decision |
|------|----------|
| D-01 Tipos de Seguro | Schema por tipo — JSONB `type_data` + formulário dinâmico |
| D-02 Navegação | Global (/seguros, /consorcio) + dentro do cliente (abas) |
| D-03 Semáforo | Verde >60d, Amarelo ≤60d, Vermelho ≤30d — calculado em runtime |
| D-04 Consórcio | 2 tabelas (grupos + cotas), next_assembly_date, pós-contemplação como notes |
| D-05 Sinistros/Endossos | Registro simples (sem upload) — data, tipo, protocolo, status |
| D-06 Alertas | In-app apenas — email na Phase 7 com n8n |

All decisions captured in `03-CONTEXT.md`. Ready for `/gsd-plan-phase 3`.
