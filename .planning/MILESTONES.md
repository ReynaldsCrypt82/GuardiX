# Milestones

## v1.0 MVP (Shipped: 2026-05-04)

**Phases completed:** 7 phases (1–7), 28 plans, 207 commits
**Codebase:** 20,141 LOC TypeScript | 378 files | 2026-04-19 → 2026-05-02

**Key accomplishments:**

1. **Fundação multi-tenant** — PostgreSQL com 3 tabelas + JWT custom claims (tenant_id/role/slug via app_metadata), RLS isolando dados por tenant, LGPD soft-delete, wizard CNPJ de onboarding e middleware de proteção de rotas
2. **CRM completo** — Cadastro PF/PJ (CPF/CNPJ validado), pipeline kanban (Prospecção→Proposta→Aguardando→Fechado), timeline de interações, follow-up com tarefas e filtros avançados por corretor/estágio/tipo
3. **Seguros & Consórcio** — Gestão de apólices com VigenciaBadge semáforo (verde/amarelo/vermelho), sinistros/endossos; grupos de consórcio, cotas, contemplação (sorteio/lance) e pipeline pós-contemplação
4. **Corretores & Comissões** — Corretores internos (SUSEP, metas, taxas por produto/categoria) + parceiros externos; ledger append-only imutável; dashboard individual com produção, comissão e carteira
5. **Financeiro** — Contas a receber/pagar, fluxo de caixa consolidado, controle de inadimplência, marcação de quitação com data de liquidação
6. **Dashboards & Export** — Dashboard executivo com 4 KPIs, 3 alertas em tempo real, ranking de corretores, e export Excel contextual (apólices/clientes/comissões com filtros forwarded)
7. **Automações & IA** — Webhooks n8n por evento, alertas email (Resend + React Email), endpoint WhatsApp com generateText + escalação humana, chat interno streaming (streamText + useChat)

**Known Gaps (requirements table not updated during execution):**
- AUTH-01/02/03/04/05: Implementados na Phase 1 mas traceability table não marcada
- CRM-01..09: Implementados na Phase 2 mas traceability table não marcada
- COM-01..06: Implementados na Phase 4 mas traceability table não marcada
- AUTO-02 (disparo automático de webhook): Edge Function com pg_cron entregue mas integração end-to-end depende de Supabase conectado em produção
- AUTO-03 (alertas email automáticos): Route Handler entregue; envio real depende de chaves Resend em produção

---
