# Requirements: NEXUS AGENT

**Defined:** 2026-04-20
**Core Value:** Corretoras de pequeno e médio porte controlam todo o ciclo de vida de seguros e consórcio em um único sistema, substituindo planilhas e ferramentas dispersas.

## v1 Requirements

### Auth & Multi-tenant (AUTH)

- [ ] **AUTH-01**: Corretora pode se registrar com nome, CNPJ e email — criando um tenant isolado
- [ ] **AUTH-02**: Usuário pode fazer login com email e senha com sessão persistente entre refreshes
- [ ] **AUTH-03**: Admin pode convidar corretores por email com link de acesso
- [ ] **AUTH-04**: Sistema suporta papéis: Admin, Corretor, Financeiro, Visualizador com permissões distintas
- [ ] **AUTH-05**: Dados de cada corretora são isolados por RLS — nenhum tenant acessa dados de outro

### CRM & Clientes (CRM)

- [ ] **CRM-01**: Usuário pode cadastrar cliente PF com CPF, nome, contatos e endereço
- [ ] **CRM-02**: Usuário pode cadastrar cliente PJ com CNPJ, razão social, responsável e contatos
- [ ] **CRM-03**: Usuário pode visualizar histórico de interações (ligações, emails, reuniões) por cliente
- [ ] **CRM-04**: Usuário pode registrar interação manualmente na timeline do cliente
- [ ] **CRM-05**: Usuário pode mover cliente pelo pipeline de vendas (Prospecção → Proposta → Aguardando → Fechado)
- [ ] **CRM-06**: Usuário pode criar tarefas de follow-up vinculadas a um cliente com data de prazo
- [ ] **CRM-07**: Sistema notifica usuário quando tarefa de follow-up está vencendo
- [ ] **CRM-08**: Usuário pode buscar cliente por nome, CPF ou CNPJ
- [ ] **CRM-09**: Usuário pode segmentar clientes por produto, corretor responsável e status

### Gestão de Apólices — Seguros (SEG)

- [x] **SEG-01**: Usuário pode cadastrar apólice com número, seguradora, tipo de seguro, vigência, prêmio e corretor
- [x] **SEG-02**: Sistema exibe status visual da apólice (verde: vigente / amarelo: a vencer em X dias / vermelho: vencida)
- [x] **SEG-03**: Sistema envia alerta de vencimento de apólice X dias antes — configurável por tipo de seguro
- [x] **SEG-04**: Usuário pode registrar sinistro com data, tipo e número de protocolo vinculado à apólice
- [x] **SEG-05**: Usuário pode registrar endosso vinculado à apólice original com descrição da alteração
- [x] **SEG-06**: Usuário pode filtrar apólices por tipo, seguradora, corretor e status de vigência
- [x] **SEG-07**: Apólice fica vinculada ao cliente e ao corretor responsável

### Gestão de Consórcio (CON)

- [x] **CON-01**: Usuário pode cadastrar grupo de consórcio com administradora, tipo (auto/imóvel/serviço), prazo e crédito total
- [x] **CON-02**: Usuário pode cadastrar cota de consórcio vinculada a um cliente com número, parcela e parcelas pagas/total
- [x] **CON-03**: Usuário pode registrar contemplado com tipo (sorteio ou lance) e valor do lance se aplicável
- [x] **CON-04**: Usuário pode acompanhar pipeline pós-contemplação: aguardando docs → em análise → crédito liberado
- [x] **CON-05**: Sistema envia alerta X dias antes da data de assembleia do grupo
- [x] **CON-06**: Usuário pode filtrar cotas por status (ativa / contemplada / encerrada) e administradora

### Corretores & Comissões (COM)

- [ ] **COM-01**: Admin pode cadastrar corretor interno com nome, SUSEP, metas de produção e carteira de clientes
- [ ] **COM-02**: Admin pode cadastrar parceiro externo com regras de repasse diferenciadas (% por produto)
- [ ] **COM-03**: Sistema calcula comissão automaticamente ao registrar apólice ou contemplação — baseado nas regras do corretor
- [ ] **COM-04**: Sistema mantém ledger append-only de comissões (cálculo, estorno, correção) — imutável após registro
- [ ] **COM-05**: Usuário pode visualizar relatório mensal de comissões por corretor
- [ ] **COM-06**: Corretor pode ver seu dashboard individual: produção do mês, comissão acumulada, carteira de clientes

### Controle Financeiro (FIN)

- [x] **FIN-01**: Usuário pode registrar conta a receber (prêmio de seguro, parcela de consórcio) com valor, vencimento e status
- [x] **FIN-02**: Usuário pode registrar conta a pagar (repasse a seguradora, comissão a corretor) com valor e vencimento
- [x] **FIN-03**: Usuário pode visualizar fluxo de caixa consolidado por período (entradas e saídas)
- [x] **FIN-04**: Sistema identifica clientes inadimplentes e envia alerta automático de atraso
- [x] **FIN-05**: Usuário pode marcar pagamento como recebido/quitado com data de liquidação

### Dashboards Gerenciais (DASH)

- [x] **DASH-01**: Admin visualiza KPIs executivos: receita do período, total de apólices ativas, inadimplência e vencimentos próximos
- [x] **DASH-02**: Admin visualiza ranking de produção e comissão por corretor no período
- [x] **DASH-03**: Sistema exibe alertas visuais em tempo real: apólices vencendo, cobranças em atraso, assembleias próximas
- [x] **DASH-04**: Usuário pode exportar relatórios de apólices, clientes e comissões em PDF ou Excel

### Automações & IA (AUTO)

- [ ] **AUTO-01**: Admin pode configurar URL de webhook n8n por evento (vencimento, contemplação, inadimplência)
- [ ] **AUTO-02**: Sistema dispara webhook para n8n quando evento ocorre, com payload de dados do cliente/apólice
- [ ] **AUTO-03**: Sistema envia alertas automáticos por email (Resend) para vencimentos, cobranças e contemplações
- [ ] **AUTO-04**: Plataforma oferece endpoint de IA para atendimento via WhatsApp com contexto do cliente injetado (RAG)
- [ ] **AUTO-05**: IA escalona para humano quando confiança da resposta está abaixo do threshold — evita conselho de seguro incorreto
- [ ] **AUTO-06**: Corretor pode usar chat interno assistido por IA para consultar dados de clientes e apólices

## v2 Requirements

### Funcionalidades Futuras

- **SEG-v2-01**: Registro de assembleias mensais de consórcio com lances e sorteios (gestão completa)
- **NFS-v2-01**: Emissão de NFS-e Nacional (LC 214/2025 — obrigatório jan/2026) vinculada às comissões
- **PORTAL-v2-01**: Portal do cliente para consulta de apólices e boletos sem login interno
- **RELAT-v2-01**: BI avançado com gráficos históricos de crescimento de carteira e churn

## Out of Scope

| Feature | Motivo |
|---------|--------|
| Multicálculo (cotação direta com seguradoras) | 6-18 meses por seguradora — Agger e Quiver levaram décadas |
| Gestão completa de sinistros (regulação, perícia) | Território das seguradoras, não da corretora |
| ERP de administradora de consórcio | NEXUS é o lado corretor — administradoras têm sistemas próprios |
| Contabilidade completa / DRE | Financeiro operacional cobre v1; integração contábil é v2+ |
| App mobile nativo iOS/Android | Responsivo cobre a necessidade inicial; app nativo é v2+ |
| Integração direta com APIs das seguradoras (SUSEP) | Complexidade regulatória e técnica para milestone futuro |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 — Fundacao & Auth | Pending |
| AUTH-02 | Phase 1 — Fundacao & Auth | Pending |
| AUTH-03 | Phase 1 — Fundacao & Auth | Pending |
| AUTH-04 | Phase 1 — Fundacao & Auth | Pending |
| AUTH-05 | Phase 1 — Fundacao & Auth | Pending |
| CRM-01 | Phase 2 — CRM & Clientes | Pending |
| CRM-02 | Phase 2 — CRM & Clientes | Pending |
| CRM-03 | Phase 2 — CRM & Clientes | Pending |
| CRM-04 | Phase 2 — CRM & Clientes | Pending |
| CRM-05 | Phase 2 — CRM & Clientes | Pending |
| CRM-06 | Phase 2 — CRM & Clientes | Pending |
| CRM-07 | Phase 2 — CRM & Clientes | Pending |
| CRM-08 | Phase 2 — CRM & Clientes | Pending |
| CRM-09 | Phase 2 — CRM & Clientes | Pending |
| SEG-01 | Phase 3 — Seguros & Consorcio | Complete |
| SEG-02 | Phase 3 — Seguros & Consorcio | Complete |
| SEG-03 | Phase 3 — Seguros & Consorcio | Complete |
| SEG-04 | Phase 3 — Seguros & Consorcio | Complete |
| SEG-05 | Phase 3 — Seguros & Consorcio | Complete |
| SEG-06 | Phase 3 — Seguros & Consorcio | Complete |
| SEG-07 | Phase 3 — Seguros & Consorcio | Complete |
| CON-01 | Phase 3 — Seguros & Consorcio | Complete |
| CON-02 | Phase 3 — Seguros & Consorcio | Complete |
| CON-03 | Phase 3 — Seguros & Consorcio | Complete |
| CON-04 | Phase 3 — Seguros & Consorcio | Complete |
| CON-05 | Phase 3 — Seguros & Consorcio | Complete |
| CON-06 | Phase 3 — Seguros & Consorcio | Complete |
| COM-01 | Phase 4 — Corretores & Comissoes | Pending |
| COM-02 | Phase 4 — Corretores & Comissoes | Pending |
| COM-03 | Phase 4 — Corretores & Comissoes | Pending |
| COM-04 | Phase 4 — Corretores & Comissoes | Pending |
| COM-05 | Phase 4 — Corretores & Comissoes | Pending |
| COM-06 | Phase 4 — Corretores & Comissoes | Pending |
| FIN-01 | Phase 5 — Financeiro | Complete |
| FIN-02 | Phase 5 — Financeiro | Complete |
| FIN-03 | Phase 5 — Financeiro | Complete |
| FIN-04 | Phase 5 — Financeiro | Complete |
| FIN-05 | Phase 5 — Financeiro | Complete |
| DASH-01 | Phase 6 — Dashboards & Relatorios | Complete |
| DASH-02 | Phase 6 — Dashboards & Relatorios | Complete |
| DASH-03 | Phase 6 — Dashboards & Relatorios | Complete |
| DASH-04 | Phase 6 — Dashboards & Relatorios | Complete |
| AUTO-01 | Phase 7 — Automacoes & IA | Pending |
| AUTO-02 | Phase 7 — Automacoes & IA | Pending |
| AUTO-03 | Phase 7 — Automacoes & IA | Pending |
| AUTO-04 | Phase 7 — Automacoes & IA | Pending |
| AUTO-05 | Phase 7 — Automacoes & IA | Pending |
| AUTO-06 | Phase 7 — Automacoes & IA | Pending |

---
*Last updated: 2026-04-19 após criação do roadmap (7 fases, 48 requisitos mapeados)*
