# NEXUS AGENT — Plataforma SaaS para Corretoras de Seguros e Consórcio

## What This Is

Plataforma SaaS multi-tenant para corretoras de seguros e consórcio de pequeno e médio porte. Centraliza a gestão completa do negócio: clientes, apólices, consórcio, comissões, financeiro e CRM — com automações via n8n e atendimento por IA (WhatsApp/chat). Cada corretora opera em ambiente isolado com seus próprios dados, usuários e plano de assinatura.

## Core Value

Corretoras de pequeno e médio porte controlam todo o ciclo de vida de seguros e consórcio em um único sistema, substituindo planilhas e ferramentas dispersas, sem precisar contratar equipe de TI.

## Current Milestone: v1.1 Portal do Cliente

**Goal:** Dar aos clientes das corretoras acesso direto às suas apólices, cotas de consórcio e financeiro via portal próprio por subdomínio, sem precisar do sistema interno.

**Target features:**
- Auto-cadastro por CPF (validado na base da corretora) com criação de senha
- Login email/senha exclusivo do portal (auth separado do interno)
- Visualização de apólices ativas (read-only)
- Visualização de cotas de consórcio (status, contemplação)
- Financeiro: parcelas em aberto, vencidas e pagas
- Download de PDFs de apólices (corretor faz upload na ficha da apólice)
- URL por subdomínio da corretora (wildcard routing no Vercel + middleware)

## Current State (v1.0 — Shipped 2026-05-04)

- 20,141 LOC TypeScript | 378 files | 207 commits
- Stack: Next.js 15.3.9 + Supabase PostgreSQL + Vercel + Tailwind v4 + shadcn/ui
- 7 fases entregues (Fundação → CRM → Seguros/Consórcio → Corretores → Financeiro → Dashboards → Automações/IA)
- Pendente: UAT manual com Supabase/Resend/OpenAI conectados em produção

## Requirements

### Validated (v1.0)

**Multi-tenant & Auth** — Phase 1: Fundação & Auth
- ✓ Onboarding com wizard CNPJ, criação de tenant isolado e slug único — v1.0
- ✓ Autenticação por email/senha com sessão persistente via @supabase/ssr (cookie-based) — v1.0
- ✓ Convites por email com token single-use, aceite e reenvio — v1.0
- ✓ Papéis: Admin, Corretor, Financeiro, Visualizador com RBAC em Server Actions e middleware — v1.0
- ✓ RLS PostgreSQL isolando dados por tenant via JWT claim app_metadata — v1.0

**CRM & Clientes** — Phase 2: CRM & Clientes
- ✓ Cadastro PF (CPF módulo-11) e PJ (CNPJ módulo-11) com validação de dígito verificador — v1.0
- ✓ Timeline de interações (ligação, email, reunião) com histórico completo — v1.0
- ✓ Pipeline kanban: Prospecção → Proposta → Aguardando Aprovação → Fechado — v1.0
- ✓ Follow-up com tarefas e lembretes vinculados ao cliente — v1.0
- ✓ Busca por nome/CPF/CNPJ e filtros por corretor, estágio e tipo — v1.0

**Seguros** — Phase 3: Seguros & Consórcio
- ✓ Apólices com número, seguradora, tipo, vigência, prêmio — vinculadas a cliente e corretor — v1.0
- ✓ VigenciaBadge semáforo (verde/amarelo ≤30d/vermelho vencida) — v1.0
- ✓ Sinistros (data, tipo, protocolo) e endossos vinculados à apólice — v1.0
- ✓ Filtros por tipo, seguradora, corretor, status de vigência — v1.0

**Consórcio** — Phase 3: Seguros & Consórcio
- ✓ Grupos de consórcio (administradora, tipo, prazo, crédito total) e cotas por cliente — v1.0
- ✓ Contemplação: sorteio ou lance com valor condicional — v1.0
- ✓ Pipeline pós-contemplação: aguardando_docs → em_analise → credito_liberado — v1.0
- ✓ Alertas de assembleia (badge + toast Sonner 3 dias antes) — v1.0
- ✓ Filtros por status e administradora — v1.0

**Corretores & Comissões** — Phase 4: Corretores & Comissões
- ✓ Corretores internos (SUSEP, metas, taxas por produto e categoria novo/renovação) — v1.0
- ✓ Parceiros externos com regras de repasse diferenciadas — v1.0
- ✓ Ledger append-only imutável (commission_entries sem UPDATE/DELETE policies) — v1.0
- ✓ Cálculo automático de comissão ao registrar apólice/contemplação — v1.0
- ✓ Dashboard individual /corretores/[id] com produção, comissão acumulada e carteira — v1.0
- ✓ MarkCommissionPaidDialog integrado em /seguros/[id] e /consorcio/[id] — v1.0

**Financeiro** — Phase 5: Financeiro
- ✓ Contas a receber (prêmio, parcela de consórcio) e a pagar (repasse, comissão) com vencimento — v1.0
- ✓ Fluxo de caixa consolidado por período — v1.0
- ✓ Identificação de inadimplência e alerta de atraso — v1.0
- ✓ Marcação de pagamento recebido/quitado com data de liquidação — v1.0

**Dashboards & Relatórios** — Phase 6: Dashboards & Relatórios
- ✓ Dashboard executivo: 4 KPIs (receita, apólices ativas, inadimplência, vencimentos) — v1.0
- ✓ Ranking de produção e comissão por corretor com MonthSelector URL-driven — v1.0
- ✓ Alertas visuais em tempo real: vencimentos, cobranças, assembleias — v1.0
- ✓ Export Excel (.xlsx) contextual para apólices, clientes e comissões com filtros — v1.0

**Automações & IA** — Phase 7: Automações & IA
- ✓ Configuração de webhooks n8n por evento (vencimento, inadimplência, contemplação) — v1.0
- ✓ Edge Function pg_cron disparando webhooks e emails automáticos — v1.0
- ✓ Alertas email via Resend + 3 templates React Email (vencimento, cobrança, contemplação) — v1.0
- ✓ Endpoint WhatsApp com generateText + escalação humana (x-webhook-secret) — v1.0
- ✓ Chat interno assistido por IA com streamText + useChat + tool calling — v1.0

### Active (v1.1 — Portal do Cliente)

- ✓ Auto-cadastro por CPF no portal (verificação na base da corretora) — v1.1 Phase 1
- ✓ Login email/senha no portal (Supabase Auth separado, role portal_client) — v1.1 Phase 1
- [ ] Visualização de apólices ativas no portal (read-only) — v1.1
- [ ] Visualização de cotas de consórcio no portal (read-only) — v1.1
- [ ] Financeiro no portal: parcelas em aberto, vencidas e pagas — v1.1
- [ ] Upload de PDF de apólice pelo corretor (Supabase Storage, bucket privado) — v1.1
- [ ] Download de PDF pelo cliente via signed URL (Supabase Storage) — v1.1
- [ ] Wildcard subdomain routing (subdomínio da corretora → portal do tenant) — v1.1

### Backlog (v1.2+)

- [ ] Onboarding de self-service com InfinitePay ou Asaas (subscription billing)
- [ ] NFS-e Nacional (LC 214/2025) vinculada às comissões
- [ ] BI avançado com histórico de crescimento de carteira e churn
- [ ] Integração direta com APIs das seguradoras (SUSEP)
- [ ] App mobile nativo iOS/Android

### Out of Scope

| Feature | Motivo |
|---------|--------|
| Multicálculo (cotação direta com seguradoras) | 6-18 meses por seguradora — Agger e Quiver levaram décadas |
| Gestão completa de sinistros (regulação, perícia) | Território das seguradoras, não da corretora |
| ERP de administradora de consórcio | NEXUS é o lado corretor — administradoras têm sistemas próprios |
| Contabilidade completa / DRE | Financeiro operacional cobre v1; integração contábil é v2+ |
| App mobile nativo iOS/Android | Responsivo cobre a necessidade inicial — v1.1+ |
| Integração direta com APIs das seguradoras (SUSEP) | Complexidade regulatória e técnica para milestone futuro |

## Context

- Mercado-alvo: corretoras de seguros e consórcio de 1 a 50 funcionários no Brasil
- Problema central: corretoras usam planilhas Excel, WhatsApp e sistemas isolados — sem visão consolidada
- Stack definida pelo usuário: Next.js 15 + Supabase (PostgreSQL) + Vercel
- Automações: n8n como orquestrador de fluxos externos (não hosted internamente)
- IA: Vercel AI SDK v6 com OpenAI (streamText para chat, generateText para WhatsApp)
- Regulação: SUSEP regula corretores de seguros no Brasil — compliance de dados crítico
- UAT pendente: 11 itens em phases 4 e 7 requerem ambiente com credenciais reais

## Constraints

- **Tech Stack**: Next.js + Supabase + Vercel — decisão do usuário, não negociável
- **Multi-tenancy**: Row-Level Security (RLS) do Supabase — isolamento de dados por tenant sem infraestrutura separada
- **Mercado**: Brasil — datas em pt-BR, moeda BRL, LGPD aplicável
- **Escala v1**: Suporte a corretoras com até 5.000 clientes e 10.000 apólices por tenant

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant com RLS no Supabase | Elimina overhead de infra por cliente, escala com o SaaS | ✓ Funcionou — isolamento via JWT app_metadata + SELECT wrapper previne plan invalidation |
| Next.js + Supabase stack | Escolha do usuário — rapidez de desenvolvimento, Vercel hosting | ✓ App Router + Server Actions eliminou camada de API separada |
| n8n externo (não embedded) | Corretoras usam n8n próprio ou contratado — integramos via webhook | ✓ Edge Function cron dispara webhooks; payload por event_type bem definido |
| Consórcio + Seguros desde o MVP | Produto completo desde o início, evita retrabalho de arquitetura | ✓ Schema unificado com FKs reais desde Phase 3 |
| Ledger append-only para comissões | Imutabilidade contábil — estorno via novo lançamento | ✓ RLS sem UPDATE/DELETE policies em commission_entries |
| AI SDK v6 com makeTool helper | Overload resolution bug em tool() nativo | ✓ Workaround estável; stepCountIs substitui maxSteps |
| supabase db query --linked -f por migration | db push falha com date key collision | ⚠ Revisitar — scripts de migration precisam de keys únicas por plano |
| financial_entries com RLS UPDATE (diferente de commission_entries) | mark-paid precisa editar status | ✓ Correto — distinção intencional entre ledgers |
| Categoria novo/renovação em taxas de comissão | Corretoras cobram diferente para renovação | ✓ Adicionado em produção sem migração destrutiva |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-04 — Milestone v1.1 Portal do Cliente iniciado*
