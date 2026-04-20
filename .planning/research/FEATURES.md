# Feature Landscape — NEXUS AGENT

**Domain:** SaaS de gestão para corretoras de seguros e consórcio (Brasil)
**Researched:** 2026-04-19
**Confidence:** MEDIUM-HIGH (mercado brasileiro bem documentado; players como Quiver, Agger, Segfy, Moltrio, Turn2C analisados)

---

## Competitors Analyzed

| Sistema | Foco Principal | Market Signal |
|---------|---------------|---------------|
| Agger (Dimensa/TOTVS) | Multicálculo + gestão | 86k usuários, 50M cotações/mês |
| Quiver (Dimensa) | Gestão + multicálculo | 30+ anos, enterprise |
| Segfy | Gestão completa + financeiro | 10k+ usuários, R$119/mês base |
| Moltrio | Gestão + financeiro | PME, contabilidade integrada |
| CRMSeguros | CRM puro | Primeiro CRM específico do setor |
| Turn2C | Consórcio com IA de contemplação | IA preditiva 97% precisão |
| SGCOR | Gestão + NFS-e integrada | Nicho: emissão de notas fiscais |

---

## Table Stakes

Funcionalidades que usuários esperam. Ausência = produto incompleto, churn imediato.

### CRM & Clientes

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Cadastro de clientes PF e PJ | Toda corretora tem carteira de clientes | Baixa | CPF/CNPJ, contatos múltiplos, endereço |
| Histórico de interações por cliente | Rastreabilidade — substitui caderno/WhatsApp | Baixa | Timeline: ligações, emails, reuniões |
| Segmentação por produto, corretor, status | Filtros básicos de carteira | Baixa | Permite campanhas e relatórios por segmento |
| Pipeline de vendas (funil) | Corretoras vendem ativamente; sem funil perdem deals | Media | Fases: Prospecção → Proposta → Aguardando → Fechado |
| Alertas de renovação automáticos | Renovação é a maior fonte de receita recorrente | Media | X dias antes do vencimento, configurável |
| Tarefas e lembretes de follow-up | Substitui o WhatsApp como agenda de cobranças | Baixa | Notificação no sistema + email |
| Busca rápida de cliente por nome/CPF/CNPJ | UX mínima de sistema de gestão | Baixa | — |

### Gestão de Apólices (Seguros)

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Cadastro de apólice com todos campos | Dados da apólice: número, seguradora, produto, vigência, prêmio | Baixa | Tipos: Auto, Vida, Residencial, Empresarial, Saúde, Rural |
| Controle de vigência com status visual | Vencidas / vigentes / a vencer são o core do negócio | Baixa | Semáforo: verde/amarelo/vermelho |
| Alerta de vencimento (X dias antes) | Sem alertas = renovações perdidas = churn de receita | Baixa | Configurável por tipo de seguro |
| Registro de endosso | Alterações de apólice são rotina operacional | Media | Vinculado à apólice original |
| Registro inicial de sinistro | Clientes ligam para sinistros — corretor precisa registrar | Baixa | Campos básicos: data, tipo, número de protocolo |
| Vínculo apólice ↔ cliente ↔ corretor | Tríplice vínculo é estrutural para comissões e relatórios | Baixa | — |
| Filtro por tipo de seguro, seguradora, vencimento | Gestão de carteira sem filtros é impossível | Baixa | — |

### Gestão de Consórcio

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Cadastro de grupos de consórcio | Unidade básica do produto consórcio | Baixa | Administradora, tipo (auto/imóvel/serviço), prazo, crédito total |
| Cadastro de cotas por cliente | Cada cota é um contrato vinculado a um cliente | Baixa | Número de cota, valor da parcela, parcelas pagas/total |
| Registro de assembleias mensais | Assembleias são o evento central do consórcio | Media | Data, resultado: sorteio/lance/sem contemplação |
| Registro de contemplados | Evento crítico — aciona fluxo de documentação e crédito | Media | Tipo (sorteio ou lance), valor do lance se aplicável |
| Acompanhamento de uso do crédito | Após contemplação começa novo processo | Media | Status: aguardando docs, em análise, crédito liberado |
| Alerta de assembleia próxima | Sem alerta o corretor esquece de acompanhar | Baixa | Lembrete X dias antes da data da assembleia |
| Status de adimplência da cota | Inadimplência cancela participação no sorteio | Baixa | Parcelas em dia / atrasadas / cancelada |

### Corretores e Comissões

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Cadastro de corretores internos | Toda corretora tem equipe | Baixa | Nome, SUSEP, metas, carteira vinculada |
| Cadastro de parceiros externos | Corretoras trabalham com parceiros / angariadores | Baixa | Regras de repasse diferenciadas por parceiro |
| Cálculo de comissão por apólice/cota | Sem cálculo automático, spreadsheet paralela volta | Alta | % sobre prêmio líquido; varia por seguradora e ramo |
| Relatório mensal de comissões | Fechamento mensal é ritual da corretora | Media | Por corretor, por produto, por seguradora |
| Dashboard individual do corretor | Cada corretor quer ver sua própria produção | Media | Meta x realizado, comissão a receber, carteira ativa |

### Financeiro

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Contas a receber (prêmios, parcelas consórcio) | Receita da corretora precisa de controle | Media | Vinculado à apólice/cota; status: pendente/pago/vencido |
| Contas a pagar (repasses, comissões) | Sem controle de saídas, fluxo de caixa é ficção | Media | Repasse a seguradoras e comissões a corretores |
| Controle de inadimplência | Inadimplência é dor crítica — seguro caduca sem pagamento | Media | Alerta de atraso, listagem de inadimplentes |
| Fluxo de caixa por período | Visão gerencial básica de qualquer negócio | Media | Entradas vs saídas por mês |
| Relatórios financeiros por período | Fechamento mensal exigido por todos | Media | Receita, comissões, repasses, saldo |

### Dashboards Gerenciais

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Dashboard executivo com KPIs principais | Gestor quer visão consolidada sem relatório manual | Media | Receita total, apólices ativas, inadimplência, vencimentos |
| Vencimentos próximos em destaque | Principal gatilho de ação diária da corretora | Baixa | Lista dos próximos 30/60/90 dias |
| Produção por corretor | Gestão de equipe básica | Baixa | Comparativo de carteira e produção |
| Alertas visuais no sistema | Notificações são substituto do alarme na planilha | Baixa | Badge/toast para vencimentos, inadimplência, assembleias |

### Multi-tenant e Autenticação

| Feature | Por Que Esperado | Complexidade | Notas |
|---------|-----------------|--------------|-------|
| Onboarding isolado por corretora | SaaS multi-tenant é premissa do produto | Alta | RLS no Supabase por tenant_id |
| Papéis de acesso (Admin, Corretor, Financeiro, Visualizador) | Corretoras têm equipe diversa com diferentes permissões | Media | Row-level + page-level permissions |
| Autenticação segura com sessão controlada | Dados de clientes são sensíveis (LGPD) | Media | Supabase Auth, MFA opcional |

---

## Differentiators

Funcionalidades que criam vantagem competitiva. Não esperadas como básico, mas valoradas quando presentes.

### Automação via n8n

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Webhooks de saída configuráveis | Permite que corretoras conectem n8n sem código | Alta | Eventos: apólice vencendo, sinistro aberto, contemplação, inadimplência |
| API RESTful documentada | Corretoras maiores querem integrar com outros sistemas | Alta | Endpoints para CRUD de entidades principais |
| Endpoint de trigger para automações | n8n consome eventos do NEXUS para disparar WhatsApp, email | Media | Padrão webhook POST com payload padronizado |

> **Por que diferencial:** Sistemas atuais como Segfy e Agger oferecem integrações fechadas. Uma API aberta + webhooks para n8n posiciona o NEXUS para corretoras que já usam automação — segmento crescente e disposto a pagar mais.

### IA para Atendimento via WhatsApp

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Integração LLM para responder status de apólices/cotas | Atendimento 24h sem contratar atendente | Alta | Consulta dados do tenant via API interna |
| Assistente de IA interno para corretor | Responde dúvidas sobre produtos, regras, histórico do cliente | Alta | Context window com dados do cliente + apólice |
| Template de fluxo n8n + WhatsApp para renovações | Corretora recebe fluxo pronto para usar | Alta | Documentação + template, não código embarcado |

> **Por que diferencial:** AgentCorr (Multiplic IA) mostrou que IA no WhatsApp reduz 80% do tempo de resposta e aumenta 40% conversão de propostas. Nenhum sistema de gestão SMB integra isso nativamente.

### Gestão de Consórcio Avançada

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Histórico de assembleias com análise gráfica | Corretor visualiza padrão de contemplação do grupo | Alta | Gráfico de lances vencedores por assembleia |
| Projeção de parcelas futuras (reajuste) | Clientes perguntam quanto vão pagar nos próximos meses | Alta | Baseado em índice contratual (INCC, IPCA) |
| Cálculo de lance mínimo estimado | Agrega valor na negociação com o cliente | Alta | Baseado em histórico do grupo |
| Acompanhamento de documentação pós-contemplação | Checklist de documentos do contemplado até a carta de crédito | Media | Status de cada documento: pendente/enviado/aprovado |

> **Por que diferencial:** Turn2C cobra R$299-599/mês APENAS pela parte de consórcio inteligente. NEXUS pode incluir isso como módulo premium dentro de um plano superior.

### NFS-e Integrada

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Emissão de NFS-e de comissão direto no sistema | Elimina acesso ao portal da Prefeitura | Alta | NFS-e Nacional obrigatória em 2026 (LC 214/2025) |
| Relatório fiscal de comissões para imposto | Facilita declaração IR da corretora | Media | Agrupamento por seguradora + período |

> **Por que diferencial:** SGCOR aponta emissão de NFS-e como "módulo inédito" entre sistemas de corretoras. Com a NFS-e Nacional obrigatória a partir de jan/2026, isso passa de diferencial para table stakes ao longo do tempo.

### Portal do Cliente (Self-Service)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Portal onde cliente vê suas apólices/cotas ativas | Reduz ligações de "onde está minha apólice?" | Alta | Link público autenticado por email/token |
| Solicitação de renovação pelo portal | Cliente inicia renovação sem ligar | Alta | Dispara fluxo interno no sistema |
| Upload de documentos pelo cliente | Elimina troca de docs por WhatsApp | Media | Para sinistros e contemplação de consórcio |

> **Por que diferencial:** Poucos sistemas SMB de corretoras oferecem portal do cliente funcional. Minuto Seguros e Bidu (corretoras digitais) já fazem isso, mas sistemas de gestão para corretoras tradicionais raramente.

### Relatórios Avançados e BI

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Dashboard BI com drill-down por produto/corretor/seguradora | Gestão data-driven ao invés de feeling | Alta | Gráficos interativos, não só tabelas |
| Relatório de retenção (% de renovações vs perdas) | KPI crítico que nenhum planilhista calcula bem | Media | Cohort de renovações por período |
| Exportação de dados em CSV/Excel | Compatibilidade com ferramentas do usuário | Baixa | Toda entidade principal exportável |
| Mapa de carteira por região (CEP) | Para corretoras com cobertura geográfica | Alta | Mapa heat map — defer para v2 |

---

## Anti-Features (Deliberadamente Fora do v1)

Coisas a NÃO construir agora, com justificativa clara.

| Anti-Feature | Por Que Evitar | O Que Fazer Agora |
|-------------|---------------|-------------------|
| **Multicálculo de cotação (integração com seguradoras)** | Agger e Quiver dominam esse mercado há décadas; exige homologação bilateral com cada seguradora (Porto, Bradesco, SulAmérica etc.) — 6-18 meses de integração | Permitir importação de cotação gerada em outra ferramenta |
| **Integração direta com APIs das seguradoras (endossos, emissão)** | Complexidade regulatória SUSEP; APIs proprietárias e não padronizadas por seguradora; exige certificado digital da corretora | Out of scope explícito no PROJECT.md |
| **Contabilidade completa (DRE, Balanço, Razão)** | Corretoras usam contador externo; integração com Conta Azul é mais simples | Financeiro operacional: contas a pagar/receber, fluxo de caixa |
| **Gestão completa de sinistros (regulação, perícia, indenização)** | Processo gerido pela seguradora, não pelo corretor; envolve reguladores, peritos e SLAs da seguradora | Registro do sinistro + número de protocolo + acompanhamento básico |
| **App mobile nativo (iOS/Android)** | Custo de desenvolvimento 2-3x; corretoras trabalham no escritório ou laptop; PWA cobre 80% do uso | Responsividade total no Next.js |
| **ERP completo (RH, estoque, compras)** | Corretoras são empresas de serviço; não têm estoque | Escopo: apenas gestão da operação de seguros/consórcio |
| **Portal de cotação pública (como Minuto Seguros ou Bidu)** | B2C é outro negócio; exige regulação separada, marketing massivo | NEXUS é B2B (ferramenta para corretoras) |
| **Geração de apólice (emissão pela corretora)** | Quem emite é a seguradora, não a corretora; gera risco regulatório | Registro da apólice emitida pela seguradora |
| **Módulo de ERP para administradora de consórcio** | Turn2C e RG System têm ERP de administradora (gestão de grupos, caixa do grupo, sorteio) — NEXUS é ferramenta do CORRETOR | Gestão da visão do corretor: suas cotas, seus clientes, suas comissões |
| **Assinatura digital de contratos** | Requer integração com Clicksign, DocuSign ou ITI — adiciona custo e complexidade; nice-to-have | Registro do número do contrato + data; upload de PDF assinado |

---

## Brazilian Market Specifics

### Regulação SUSEP

| Requisito | Impacto no Sistema | Complexidade |
|-----------|-------------------|--------------|
| Corretor deve ter número de registro SUSEP | Campo obrigatório no cadastro de corretores | Baixa |
| SUSEP monitora produção das corretoras | Relatórios de produção exportáveis no formato esperado | Media |
| Corretora PJ precisa de CNPJ e autorização SUSEP | Campo obrigatório no cadastro do tenant | Baixa |
| Normas de conduta ética SUSEP | Auditoria de ações críticas (log de alterações) | Media |
| Novos regulamentos 2025 (consulta pública SUSEP sobre corretores) | Sistema deve ser flexível para adaptações de campos | Media |

> **Fonte:** L4594 (Lei do Corretor de Seguros), SUSEP gov.br, regulamentação 2025.

### LGPD (Lei 13.709/2018)

| Requisito | Impacto no Sistema | Complexidade |
|-----------|-------------------|--------------|
| Dados sensíveis (saúde, biometria) exigem consentimento explícito | Formulários de cadastro com checkbox de consentimento + registro do consentimento | Media |
| Titular pode solicitar exclusão/portabilidade | Endpoint ou funcionalidade de export/delete de dados do cliente | Alta |
| Dados pessoais devem ter finalidade declarada | Política de privacidade por tenant + finalidade registrada | Media |
| Segurança técnica obrigatória | Criptografia em repouso (Supabase), HTTPS, sem senhas em plaintext | Media |
| Notificação de incidentes à ANPD | Processo documentado (não é feature do sistema, é processo da empresa) | Operacional |
| Isolamento de dados por tenant | RLS do Supabase impede cross-tenant data access | Alta |

> **Dado crítico:** LGPD aplica multas de até 2% do faturamento (máx R$50M por infração). Para SaaS com dados de CPF e saúde, RLS rigoroso no Supabase é obrigatório, não opcional.

### Localização pt-BR / BRL

| Item | Especificação |
|------|--------------|
| Moeda | BRL (R$) com máscara 1.234,56 |
| Datas | DD/MM/YYYY em toda a UI |
| Fuso horário | UTC-3 (Brasília) padrão; respeitar fuso do tenant |
| CPF/CNPJ | Validação com algoritmo oficial + máscara |
| CEP | Integração com ViaCEP para autocompletar endereço |
| Telefone | Máscara (11) 99999-9999 — WhatsApp número BR |
| NFS-e | Padrão nacional a partir de jan/2026 (LC 214/2025) |
| Impostos | ISS sobre comissões (municipal, varia por cidade) |

### Contexto Operacional das Corretoras PME

| Realidade | Impacto no Design |
|-----------|------------------|
| 1-50 funcionários | UX simples; nenhuma feature que exija TI interno |
| Vêm de planilhas Excel | Importação de dados CSV na migração; UI próxima ao que já conhecem |
| Usam WhatsApp para tudo | Integração n8n + WhatsApp é diferencial real, não futuro |
| Corretor == vendedor == atendente | Perfis de acesso simples; não precisa de RBAC granular |
| Volume: até 5.000 clientes, 10.000 apólices por tenant (v1) | Escala Supabase RLS é suficiente |
| Pagamento de comissão ainda é manual em muitas | Cálculo automático é alívio real de trabalho |

---

## Feature Dependencies

```
Multi-tenant (tenant_id) → TUDO (toda feature depende de isolamento correto)

Cadastro de Cliente → Apólice → Comissão
Cadastro de Cliente → Cota de Consórcio → Assembleia → Contemplação
Apólice → Comissão → Relatório Financeiro
Apólice → Sinistro (registro básico)
Corretor → Comissão → Dashboard do Corretor
Financeiro (contas a receber) → Inadimplência → Alertas

Pipeline CRM → Proposta → Apólice (conversão)
Apólice → Alerta de Renovação → Pipeline CRM (nova venda)

n8n webhooks → Alertas externos (WhatsApp, email) [depende de Apólices + Assembleias prontos]
IA WhatsApp → Consulta dados internos via API [depende de Apólices + CRM prontos]
Portal do Cliente → Apólice + Cota visíveis [depende de Apólices + Consórcio prontos]
NFS-e → Relatório de Comissão [depende de Comissões prontas]
```

---

## MVP Recommendation

**Priorize nesta ordem:**

1. **Multi-tenant + Auth** — fundação; sem isso nada funciona de forma segura
2. **CRM básico** (cadastro de cliente + histórico) — substitui a planilha imediatamente
3. **Gestão de Apólices** (cadastro + vigência + alertas de vencimento) — core do valor do produto
4. **Gestão de Consórcio básica** (grupos + cotas + assembleias + contemplados) — diferencial de mercado vs sistemas puro-seguros
5. **Comissões** (cálculo automático + relatório mensal) — elimina a maior dor manual
6. **Financeiro operacional** (contas a pagar/receber + fluxo de caixa) — necessário para fechamento mensal
7. **Dashboard executivo** — mostra o valor do sistema num olhar

**Inclua como feature base (baixa complexidade, alto impacto):**
- Alertas de renovação automáticos (vencimento de apólice)
- Alertas de assembleia próxima (consórcio)
- Exportação CSV de qualquer lista

**Deferred — mas arquitetar para não bloquear:**
- Webhooks n8n (arquitetar a estrutura de eventos desde o início; implementar UI de configuração depois)
- IA WhatsApp (definir endpoints de consulta agora; conectar LLM depois)
- Portal do Cliente (autenticação separada de tenant; não misturar com auth de corretor)
- NFS-e (prepare campo de nota fiscal no modelo de comissão; integração depois)

---

## Sources

- Agger: https://www.agger.com.br/blog/plataformas-corretores-de-seguros/
- Quiver: https://www.quiver.net.br/solucoes-em-gestao/
- Segfy: https://www.segfy.com/sistema-com-gestao-financeira/
- Turn2C: https://turn2c.com/ferramenta/
- SUSEP: https://www2.susep.gov.br/safe/Corretores/
- LGPD Seguros: https://www.textecnologia.com.br/blog/lgpd
- LGPD Conjur: https://www.conjur.com.br/2021-jul-08/seguros-contemporaneos-aplicacao-lgpd-setor-seguros/
- NFS-e Nacional 2026: https://www.gov.br/fazenda/pt-br/assuntos/noticias/2025/agosto/a-partir-de-janeiro-de-2026-a-nota-fiscal-de-servico-eletronica-nfs-e-sera-obrigatoria
- CQCS IA WhatsApp: https://cqcs.com.br/noticia/inteligenciaartificialeautomacao-no-whatsapp-como-uma-startup-esta-revolucionando-o-atendimento-em-seguros/
- Turn2C Record Mercado: https://www.segs.com.br/info-ti/369070-turn2c-lanca-o-primeiro-chatbot-com-ia
- Comissões Quiver: https://solucoesparacorretoras.quiver.net.br/controle-de-repasse-de-comissao-como-resolver-o-que-nao-deveria-ser-um-problema/
