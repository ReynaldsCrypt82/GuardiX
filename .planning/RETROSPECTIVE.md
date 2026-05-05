# Project Retrospective

*Documento vivo — atualizado após cada milestone. Lições alimentam o próximo ciclo.*

---

## Milestone: v1.0 MVP

**Shipped:** 2026-05-04
**Phases:** 7 | **Plans:** 28 | **Commits:** 207 | **LOC:** 20,141 TS
**Timeline:** 2026-04-19 → 2026-05-04 (15 dias)

### What Was Built

- **Fundação multi-tenant** completa com RLS PostgreSQL + JWT claims customizados, wizard de onboarding CNPJ e middleware de proteção de rotas
- **CRM** com cadastro PF/PJ validado, pipeline kanban, timeline de interações e follow-up com tarefas
- **Seguros & Consórcio** com VigenciaBadge semáforo, sinistros/endossos, grupos/cotas, contemplação e pipeline pós-contemplação
- **Corretores & Comissões** com ledger append-only imutável e dashboard individual por corretor
- **Financeiro** com contas a receber/pagar, fluxo de caixa e controle de inadimplência
- **Dashboards & Export** executivo com 4 KPIs, 3 alertas em tempo real e export Excel contextual
- **Automações & IA** com webhooks n8n via Edge Function pg_cron, alertas email (Resend + React Email), endpoint WhatsApp e chat interno com streaming

### What Worked

- **Server Actions como camada de API** eliminou controllers separados — padrão consistente em todas as 7 fases
- **TDD com stubs Wave 0** antes de cada implementação capturou edge cases antes de chegarem à UI (ex: boundary cases de vigência, validação CPF/CNPJ)
- **RLS com SELECT wrapper** `(SELECT auth.tenant_id())` preveniu plan invalidation no PostgreSQL — lição crítica adotada desde Phase 1
- **app_metadata exclusivo** (nunca user_metadata) para JWT claims garantiu imutabilidade de tenant_id pelo usuário
- **shadcn/ui + Radix UI** acelerou UI acessível sem styling de zero — componentes copiados no repo evitaram breaking changes
- **Zod discriminatedUnion** para tipos polimórficos (seguros por tipo, contemplação sorteio/lance) capturou erros em compile time

### What Was Inefficient

- **Traceability table em REQUIREMENTS.md nunca atualizada** — ficou desatualizada desde Phase 1, gerando confusão no milestone completion
- **One-liner field vazio em vários SUMMARYs** — CLI de summary-extract não encontrou o campo formatado corretamente, exigindo retrabalho manual no MILESTONES.md
- **supabase db push com date key collision** — migrations de fases diferentes compartilharam prefix `20260420_`, causando erros de versioning; workaround via `db query --linked -f` por arquivo
- **AI SDK v6 tool() overload bug** — exigiu `makeTool` helper pattern não documentado oficialmente; descoberto por trial/error

### Patterns Established

- `(SELECT auth.tenant_id())` em todas as RLS policies — wrapper previne query plan cache invalidation
- `app_metadata` exclusivamente para dados de tenant — nunca `user_metadata`
- Ledger append-only via `CREATE POLICY ... FOR INSERT` (sem UPDATE/DELETE) para dados financeiros imutáveis
- `makeTool` helper ao invés de `tool()` nativo do AI SDK v6 para evitar overload resolution
- `service_role` client com `.eq('tenant_id', tenantId)` explícito em Edge Functions e endpoints de IA
- React Email templates como componentes TSX — preview no browser, type-safe, compartilham tipos com o app

### Key Lessons

1. **Atualizar traceability table em cada fase** — não acumular para o milestone completion. Custo zero em cada transição, custo alto na hora de arquivar.
2. **Padronizar one-liner no SUMMARY.md** — usar `**One-liner:**` (bold) em vez de seção YAML para compatibilidade com `summary-extract`
3. **Migrations com keys temporais únicas por plano** — usar `YYYYMMDD_HHMM_NNN` incluindo hora+minuto para evitar colisão entre planos do mesmo dia
4. **UAT manual com credenciais reais é bloqueador** — 11 itens de verificação ficaram como `human_needed`; planejar ambiente de staging desde o início do próximo milestone
5. **AI SDK v6 — documentação ainda em catching up** — preferir exemplos do repo oficial `ai` no GitHub em vez de docs prose para APIs novas (streamText, convertToModelMessages, toUIMessageStreamResponse)

### Cost Observations

- Modelo mix: claude-sonnet-4-x (execução), claude-opus-4-x (planejamento/pesquisa)
- Notable: GSD workflow com código review integrado capturou 1 bypass crítico de cross-tenant (Phase 6) e múltiplos SSRF guards — ROI alto em segurança

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Fases | Planos | Key Change |
|-----------|-------|--------|------------|
| v1.0 MVP | 7 | 28 | Baseline — estabelecimento de padrões RLS, TDD, Server Actions |

### Cumulative Quality

| Milestone | Testes unitários | Fases com code review | Gaps críticos capturados |
|-----------|------------------|-----------------------|--------------------------|
| v1.0 MVP | ~70+ tests | 7/7 | 1 cross-tenant bypass, 3 SSRF, 2 RLS assimetrias |

### Top Lessons (Cross-Milestone)

1. RLS com wrapper `(SELECT auth.uid())` e `(SELECT auth.tenant_id())` — adotar desde a primeira migration de cada milestone
2. Manter traceability em tempo real — nunca deixar para o milestone completion
