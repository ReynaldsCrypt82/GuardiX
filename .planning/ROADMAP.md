# Roadmap: NEXUS AGENT

## Overview

Construção do SaaS multi-tenant para corretoras de seguros e consórcio em 7 fases sequenciais, seguindo as dependências de chave estrangeira do schema: fundação multi-tenant → CRM → produtos (seguros e consórcio) → comissões → financeiro → dashboards → automações e IA. Cada fase entrega uma capacidade completa e verificável antes de desbloquear a próxima.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Fundacao & Auth** - Multi-tenant isolado, autenticacao e controle de acesso por papel
- [ ] **Phase 2: CRM & Clientes** - Cadastro completo de clientes PF/PJ, pipeline de vendas e follow-up
- [x] **Phase 3: Seguros & Consorcio** - Gestao de apolices de seguros e cotas de consorcio em paralelo (completed 2026-04-25)
- [x] **Phase 4: Corretores & Comissoes** - Cadastro de corretores, parceiros externos e ledger de comissoes (completed 2026-04-29)
- [x] **Phase 5: Financeiro** - Contas a receber/pagar, fluxo de caixa e controle de inadimplencia (completed 2026-04-30)
- [ ] **Phase 6: Dashboards & Relatorios** - KPIs executivos, rankings e exportacao de relatorios
- [ ] **Phase 7: Automacoes & IA** - Webhooks n8n, alertas por email e atendimento via IA

## Phase Details

### Phase 1: Fundacao & Auth
**Goal**: Corretoras podem se registrar, fazer login e gerenciar usuarios internos com isolamento total de dados por tenant
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Uma corretora pode se registrar com nome, CNPJ e email e receber um tenant isolado
  2. Usuario pode fazer login com email e senha e permanecer autenticado apos refresh de pagina
  3. Admin pode convidar novo corretor por email e o convidado acessa com link unico
  4. Usuarios com papel Visualizador nao conseguem criar ou editar registros
  5. Um tenant nunca visualiza dados de outro tenant — isolamento confirmado via RLS
**Plans**: TBD
**UI hint**: yes

### Phase 2: CRM & Clientes
**Goal**: Equipe da corretora pode cadastrar clientes, acompanhar o pipeline de vendas e gerenciar follow-ups
**Depends on**: Phase 1
**Requirements**: CRM-01, CRM-02, CRM-03, CRM-04, CRM-05, CRM-06, CRM-07, CRM-08, CRM-09
**Success Criteria** (what must be TRUE):
  1. Usuario pode cadastrar cliente PF com CPF e cliente PJ com CNPJ, com validacao de digito verificador
  2. Usuario pode registrar interacao (ligacao, email, reuniao) na timeline do cliente e visualizar historico completo
  3. Usuario pode mover cliente pelo pipeline de vendas (Prospeccao → Proposta → Aguardando → Fechado)
  4. Usuario recebe notificacao quando tarefa de follow-up esta vencendo
  5. Usuario pode buscar cliente por nome, CPF ou CNPJ e filtrar por corretor, produto e status
**Plans**: TBD
**UI hint**: yes

### Phase 3: Seguros & Consorcio
**Goal**: Corretores podem cadastrar e gerenciar apolices de seguros e cotas de consorcio vinculadas a clientes
**Depends on**: Phase 2
**Requirements**: SEG-01, SEG-02, SEG-03, SEG-04, SEG-05, SEG-06, SEG-07, CON-01, CON-02, CON-03, CON-04, CON-05, CON-06
**Success Criteria** (what must be TRUE):
  1. Usuario pode cadastrar apolice com numero, seguradora, tipo, vigencia e premio — vinculada a cliente e corretor
  2. Apolice exibe semaforo visual (verde/amarelo/vermelho) conforme status de vigencia
  3. Usuario pode registrar sinistro e endosso vinculados a uma apolice existente
  4. Usuario pode cadastrar grupo de consorcio e cotas por cliente, registrar contemplados e acompanhar pipeline pos-contemplacao
  5. Sistema alerta antes da data de assembleia do grupo de consorcio
  6. Usuario pode filtrar apolices e cotas por tipo, seguradora/administradora, corretor e status
**Plans**: 4 plans
Plans:
- [x] 03-01-PLAN.md — Schema SQL (5 tabelas + RLS) + utilitario vigencia + schemas Zod + stubs de teste Wave 0 + supabase db push
- [x] 03-02-PLAN.md — Modulo Seguros: Server Actions (policies/claims/endorsements) + UI listagem/formulario/detalhes + VigenciaBadge + sidebar estendida
- [x] 03-03-PLAN.md — Modulo Consorcio: Server Actions (groups/quotas/contemplation) + UI listagem/formularios/detalhes do grupo
- [x] 03-04-PLAN.md — Integracao cliente: tela /clientes/[id] com abas Apolices+Consorcio + alertas in-app (badge + toast)
**UI hint**: yes

### Phase 4: Corretores & Comissoes
**Goal**: Admin pode gerenciar corretores internos e parceiros externos; sistema calcula e registra comissoes automaticamente com ledger imutavel
**Depends on**: Phase 3
**Requirements**: COM-01, COM-02, COM-03, COM-04, COM-05, COM-06
**Success Criteria** (what must be TRUE):
  1. Admin pode cadastrar corretor interno com numero SUSEP, metas e taxa de comissao
  2. Admin pode cadastrar parceiro externo com regras de repasse diferenciadas por produto
  3. Ao registrar apolice ou contemplacao, comissao e calculada automaticamente e inserida no ledger
  4. Valor de comissao ja registrado nao pode ser editado — apenas estorno ou correcao via novo lancamento
  5. Corretor visualiza seu dashboard individual com producao do mes, comissao acumulada e carteira de clientes
**Plans**: 4 plans
Plans:
- [x] 04-01-PLAN.md — Migrations: broker_profiles + partners + commission_entries + ALTER policies/quotas + RLS append-only
- [x] 04-02-PLAN.md — Camada logica: resolveCommissionRate util + Zod schemas + Server Actions (broker, partner, commission) + Wave 0 tests
- [x] 04-03-PLAN.md — UI admin: sidebar (Corretores+Parceiros) + rotas /corretores e /parceiros + dialogs de perfil/parceiro/exclusao
- [x] 04-04-PLAN.md — Dashboard /corretores/[id]: 4 stat cards + month selector + Tabs (Visao geral|Relatorio) + integracao mark-commission-paid em /seguros/[id] e /consorcio/[id]
**UI hint**: yes

### Phase 5: Financeiro
**Goal**: Equipe financeira pode controlar contas a receber e a pagar, visualizar fluxo de caixa e gerenciar inadimplencia
**Depends on**: Phase 4
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05
**Success Criteria** (what must be TRUE):
  1. Usuario pode registrar conta a receber (premio, parcela de consorcio) e conta a pagar (repasse, comissao) com vencimento
  2. Usuario pode visualizar fluxo de caixa consolidado por periodo com entradas e saidas
  3. Sistema identifica automaticamente clientes inadimplentes e exibe alerta de atraso
  4. Usuario pode marcar lancamento como recebido/quitado com data de liquidacao
**Plans**: TBD
**UI hint**: yes

### Phase 6: Dashboards & Relatorios
**Goal**: Admin tem visao executiva consolidada do negocio com KPIs, rankings e capacidade de exportar relatorios
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Admin visualiza dashboard executivo com receita do periodo, total de apolices ativas, inadimplencia e vencimentos proximos
  2. Admin visualiza ranking de producao e comissao por corretor no periodo selecionado
  3. Sistema exibe alertas visuais em tempo real para apolices vencendo, cobranças atrasadas e assembleias proximas
  4. Usuario pode exportar relatorios de apolices, clientes e comissoes em PDF ou Excel
**Plans**: 3 plans
Plans:
- [ ] 06-01-PLAN.md — Wave 0: instalar exceljs + helpers puros (aggregateBrokerRanking, parseSelectedMonth, isExecutiveRole, ALLOWED_EXPORT_TYPES) + suite Vitest cobrindo DASH-01/02/03/09
- [ ] 06-02-PLAN.md — Painel executivo /[slug]/dashboard: 4 KPIs + 3 alertas + ranking de corretores + RBAC (admin/financeiro vs corretor redirect vs visualizador 404)
- [ ] 06-03-PLAN.md — Export Excel: Route Handler /api/[slug]/export com whitelist+RBAC+slug check, ExportButton em /seguros, /clientes, /corretores com filtros forwarded
**UI hint**: yes

### Phase 7: Automacoes & IA
**Goal**: Corretora pode configurar webhooks n8n por evento, receber alertas por email automaticos e oferecer atendimento via IA no WhatsApp e chat interno
**Depends on**: Phase 6
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06
**Success Criteria** (what must be TRUE):
  1. Admin pode configurar URL de webhook n8n por tipo de evento (vencimento, contemplacao, inadimplencia) e o sistema dispara o payload correto
  2. Sistema envia emails automaticos via Resend para vencimentos, cobranças e contemplacoes sem acao manual
  3. Cliente pode interagir via WhatsApp e receber respostas da IA com contexto real da sua apolice (RAG)
  4. IA escala automaticamente para humano quando confianca da resposta esta abaixo do threshold configurado
  5. Corretor pode consultar dados de clientes e apolices via chat interno assistido por IA
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundacao & Auth | 0/TBD | Not started | - |
| 2. CRM & Clientes | 0/TBD | Not started | - |
| 3. Seguros & Consorcio | 6/6 | Complete   | 2026-04-26 |
| 4. Corretores & Comissoes | 4/4 | Complete    | 2026-04-29 |
| 5. Financeiro | 3/3 | Complete   | 2026-04-30 |
| 6. Dashboards & Relatorios | 0/3 | Planned     | - |
| 7. Automacoes & IA | 0/TBD | Not started | - |
