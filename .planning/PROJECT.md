# NEXUS AGENT — Plataforma SaaS para Corretoras de Seguros e Consórcio

## What This Is

Plataforma SaaS multi-tenant para corretoras de seguros e consórcio de pequeno e médio porte. Centraliza a gestão completa do negócio: clientes, apólices, consórcio, comissões, financeiro e CRM — com automações via n8n e atendimento por IA (WhatsApp/chat). Cada corretora opera em ambiente isolado com seus próprios dados, usuários e plano de assinatura.

## Core Value

Corretoras de pequeno e médio porte controlam todo o ciclo de vida de seguros e consórcio em um único sistema, substituindo planilhas e ferramentas dispersas, sem precisar contratar equipe de TI.

## Requirements

### Validated

**Multi-tenant & Auth** — Validated in Phase 1: Fundação & Auth
- [x] Onboarding de corretoras com isolamento total de dados por tenant (RLS + JWT claims)
- [x] Gestão de usuários internos com papéis: Admin, Corretor, Financeiro, Visualizador
- [x] Autenticação segura com controle de sessão (@supabase/ssr + cookie-based)

**CRM & Clientes** — Validated in Phase 2: CRM & Clientes
- [x] Cadastro completo de clientes (PF e PJ) com histórico de interações
- [x] Pipeline de vendas — funil: prospecção → proposta → aguardando aprovação → fechado
- [x] Follow-up com tarefas, lembretes e alertas de renovação
- [x] Segmentação de clientes por categoria, produto e corretor responsável

**Seguros** — Validated in Phase 3: Seguros & Consórcio
- [x] Cadastro e gestão de apólices por tipo de seguro (Auto, Vida, Residencial, Empresarial, Saúde, Outros)
- [x] Controle de vigências com semáforo verde/amarelo/vermelho e alertas in-app (30 dias)
- [x] Registro de sinistros e endossos vinculados à apólice

**Consórcio** — Validated in Phase 3: Seguros & Consórcio
- [x] Cadastro de grupos de consórcio e cotas por cliente
- [x] Gestão de assembleias mensais: datas, alertas 3 dias antes via badge + toast
- [x] Registro de contemplados (sorteio/lance) e pipeline pós-contemplação (aguardando_docs → em_analise → credito_liberado)

**Corretores & Comissões** — Validated in Phase 4: Corretores & Comissões
- [x] Cadastro de corretores internos com metas, SUSEP e taxas por produto (broker_profiles 1:1 com profiles)
- [x] Cadastro de parceiros externos com regras de repasse diferenciadas por produto (partners standalone)
- [x] Ledger append-only imutável (commission_entries sem UPDATE/DELETE policies) — estorno e correção via novos lançamentos
- [x] Dashboard individual por corretor: produção do mês, comissão acumulada, carteira ativa, meta % (/[slug]/corretores/[id])

### Active

**Multi-tenant & Auth**
- [ ] Onboarding de corretoras com isolamento total de dados por tenant
- [ ] Gestão de usuários internos com papéis: Admin, Corretor, Financeiro, Visualizador
- [ ] Autenticação segura com controle de sessão

**CRM & Clientes**
- [ ] Cadastro completo de clientes (PF e PJ) com histórico de interações
- [ ] Pipeline de vendas — funil: prospecção → proposta → aguardando aprovação → fechado
- [ ] Follow-up com tarefas, lembretes e alertas de renovação
- [ ] Segmentação de clientes por categoria, produto e corretor responsável

**Seguros**
- [ ] Cadastro e gestão de apólices por tipo de seguro (Auto, Vida, Residencial, Empresarial, etc.)
- [ ] Controle de vigências com alertas automáticos de vencimento (X dias antes)
- [ ] Registro de sinistros vinculados à apólice

**Consórcio**
- [ ] Cadastro de grupos de consórcio e cotas por cliente
- [ ] Gestão de assembleias mensais: datas, lances, sorteios
- [ ] Registro de contemplados e acompanhamento de uso do crédito e documentação

**Corretores & Comissões** — Validated in Phase 4: Corretores & Comissões
- [x] Cadastro de corretores internos com metas e carteira de clientes
- [x] Cadastro de parceiros externos com regras de repasse diferenciadas
- [x] Cálculo automático de comissões por apólice/consórcio com relatório mensal
- [x] Dashboard individual por corretor (produção, comissão, carteira)

**Financeiro**
- [ ] Contas a receber: prêmios, parcelas de consórcio
- [ ] Contas a pagar: repasse a seguradoras, comissões a corretores
- [ ] Fluxo de caixa com inadimplência e alertas de atraso
- [ ] Relatórios financeiros por período

**Dashboards Gerenciais** — Validated in Phase 6: Dashboards & Relatórios
- [x] Dashboard executivo: receita, produção, inadimplência, vencimentos próximos
- [x] Indicadores por produto, corretor e período (ranking por comissão, MonthSelector URL-driven)
- [x] Alertas visuais e notificações no sistema (vencimentos, cobranças, assembleias)
- [x] Export Excel contextual: apólices, clientes e corretores com filtros forwarded (DASH-04)

**Automações & IA**
- [ ] Integração com n8n via webhook/API para automações (alertas, cobranças, relatórios)
- [ ] Integração com IA para atendimento via WhatsApp (renovações, cotações, status)
- [ ] Chat interno assistido por IA para suporte ao corretor

### Out of Scope

- Integração direta com sistemas das seguradoras (SUSEP, APIs proprietárias) — complexidade regulatória para v1
- Contabilidade completa e DRE — financeiro operacional é suficiente para v1
- App mobile nativo — PWA ou responsivo cobre a necessidade inicial
- Gestão de sinistros completa (regulação, perícia) — apenas registro inicial em v1

## Context

- Mercado-alvo: corretoras de seguros e consórcio de 1 a 50 funcionários no Brasil
- Problema central: corretoras usam planilhas Excel, WhatsApp e sistemas isolados — sem visão consolidada
- Stack definida pelo usuário: Next.js + Supabase (PostgreSQL) + Vercel
- Automações: n8n como orquestrador de fluxos externos (não hosted internamente)
- IA: integração com LLM via API para atendimento e assistência interna
- Regulação: SUSEP regula corretores de seguros no Brasil — compliance de dados é crítico

## Constraints

- **Tech Stack**: Next.js + Supabase + Vercel — decisão do usuário, não negociável
- **Multi-tenancy**: Row-Level Security (RLS) do Supabase — isolamento de dados por tenant sem infraestrutura separada
- **Mercado**: Brasil — datas em pt-BR, moeda BRL, LGPD aplicável
- **Escala v1**: Suporte a corretoras com até 5.000 clientes e 10.000 apólices por tenant

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant com RLS no Supabase | Elimina overhead de infra por cliente, escala com o SaaS | — Pending |
| Next.js + Supabase stack | Escolha do usuário — rapidez de desenvolvimento, Vercel hosting | — Pending |
| n8n externo (não embedded) | Corretoras usam n8n próprio ou contratado — integramos via webhook | — Pending |
| Consórcio + Seguros desde o MVP | Produto completo desde o início, evita retrabalho de arquitetura | — Pending |

## Evolution

Este documento evolui a cada transição de fase e milestone.

**Após cada fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com motivo
2. Requisitos validados? → Mover para Validated com referência de fase
3. Novos requisitos emergiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se drifou

**Após cada milestone** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value ainda é a prioridade certa?
3. Auditoria do Out of Scope — razões ainda válidas?
4. Atualizar Context com estado atual

---
*Last updated: 2026-04-28 — Phase 4 (Corretores & Comissões) complete*
