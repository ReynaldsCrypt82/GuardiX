# Research Summary — NEXUS AGENT

**Domínio:** SaaS multi-tenant para corretoras de seguros e consórcio (Brasil)
**Data:** 2026-04-19
**Fonte:** 4 agents de pesquisa paralela (STACK, FEATURES, ARCHITECTURE, PITFALLS)

---

## 1. Stack Recomendada

| Camada | Tecnologia | Notas críticas |
|--------|-----------|----------------|
| Framework | Next.js 15 + TypeScript 5 + React 19 | App Router exclusivamente. Pages Router em manutenção. |
| Backend/DB | Supabase (PostgreSQL 15+) | RLS nativo — isolamento de tenant sem código extra |
| Auth | `@supabase/ssr` | `@supabase/auth-helpers` está **depreciado** — não usar |
| Multi-tenancy | Shared Schema + `tenant_id` + Custom JWT Hook | `app_metadata` (não `user_metadata` — editável pelo usuário) |
| Storage | Supabase Storage + RLS por bucket | Para PDFs de apólices e docs de contemplação |
| UI | shadcn/ui + Tailwind CSS | Padrão dominante em SaaS Next.js 2025 |
| Tabelas | TanStack Table v8 | Listagens de apólices, clientes, comissões |
| Estado | TanStack Query + Zustand | Query para server state, Zustand para UI state local |
| Email | Resend + React Email | Supabase built-in SMTP é limitado para produção |
| Pagamentos | Stripe (Pix via EBANX confirmado 2025) | Stripe suporta CPF/CNPJ, Pix Automático (recorrente) |
| Deploy | Vercel | Edge Functions, ISR, integração nativa Next.js |
| Automações | n8n externo via webhooks | Cada tenant configura seu próprio endpoint n8n |
| IA | OpenAI/Anthropic API via Supabase Edge Function | Nunca expor chave no cliente |

---

## 2. Features: Table Stakes vs Diferenciais

### Table Stakes (ausência = churn imediato)

- **CRM**: Cadastro PF/PJ, histórico de interações, pipeline de vendas (funil), alertas de renovação, follow-up
- **Apólices**: Cadastro completo, controle de vigência com semáforo, alertas de vencimento configuráveis, registro de sinistro inicial
- **Consórcio**: Grupos + cotas, assembleias mensais, registro de contemplados, acompanhamento de crédito
- **Comissões**: Cálculo automático por apólice/cota, relatório mensal, repasse a corretores internos e parceiros externos
- **Financeiro**: Contas a receber/pagar, fluxo de caixa, inadimplência com alertas
- **Dashboards**: KPIs de produção, vencimentos próximos, inadimplência, comissões do período

### Diferenciais competitivos (NEXUS pode vencer aqui)

- **n8n nativo**: Nenhum concorrente SMB tem integração configurável com n8n — mercado usa ferramentas externas desconectadas
- **IA no WhatsApp**: AgentCorr (Multiplic IA) demonstrou 80% menos tempo de resposta e 40% mais conversão — nenhum sistema de gestão SMB oferece isso nativamente
- **Seguros + Consórcio juntos**: Maioria dos sistemas é um ou outro. Turn2C é consórcio-only (R$299-599/mês), Segfy é seguros-only
- **Assembleia management completo**: Registro de lances, sorteios, contemplados e pipeline pós-contemplação

### Anti-features (NÃO construir em v1)

- **Multicálculo**: 6-18 meses de integração por seguradora (Agger levou décadas). Fora do escopo.
- **Gestão completa de sinistros**: Território das seguradoras. Apenas registro inicial.
- **ERP de administradora de consórcio**: NEXUS é o lado corretor, não o administrador (Turn2C/RGSystem são os players desse nicho)
- **Contabilidade/DRE**: Financeiro operacional cobre a necessidade de v1
- **NFS-e Nacional**: LC 214/2025 obriga jan/2026 — preparar data model agora, implementar em milestone seguinte

---

## 3. Arquitetura: Componentes e Ordem de Build

**8 domínios com dependências explícitas:**

```
AUTH → CRM → (SEGUROS + CONSÓRCIO em paralelo) → COMISSÕES → FINANCEIRO → DASHBOARDS → AUTOMAÇÕES
```

| # | Domínio | Depende de | Motivo |
|---|---------|-----------|--------|
| 1 | AUTH + Multi-tenant | — | Blocker absoluto. RLS deve existir antes de qualquer dado de tenant |
| 2 | CRM (Clientes) | AUTH | Todo produto precisa de cliente. Sem cliente, sem apólice nem cota |
| 3a | Seguros (Apólices) | CRM | FK para clientes. Pode ser construído em paralelo com Consórcio |
| 3b | Consórcio (Grupos + Assembleias) | CRM | FK para clientes. Paralelo com Seguros |
| 4 | Comissões | Seguros + Consórcio | Bridge table: referencia policy_id OU quota_id com CHECK constraint |
| 5 | Financeiro | Comissões | Ledger de receitas/despesas linka comissões e prêmios |
| 6 | Dashboards | Todos | Views PostgreSQL sobre todos os domínios — zero write paths próprios |
| 7 | Automações + IA | Financeiro | Webhooks n8n, Edge Functions IA, WhatsApp routing |

**Dashboards são PostgreSQL views** — não um módulo separado com data store próprio.

**n8n é fan-out por tenant**: cada tenant configura seu webhook URL; uma `webhook_events` queue table + pg_cron dispara por tenant. Nunca compartilhar um endpoint n8n entre tenants.

---

## 4. Top 5 Pitfalls Críticos

### 1. RLS não ativado em tabela nova → data leak entre tenants
**Prevenção:** CI check que lista tabelas sem RLS habilitado. Toda migration deve incluir `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + policy. CVE-2025-48757 afetou 170+ apps por esse motivo.

### 2. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` → bypass total de RLS
**Prevenção:** `service_role` key **nunca** em variável com prefixo `NEXT_PUBLIC_`. Usar somente em Server Actions, API Routes ou Edge Functions.

### 3. Vigência armazenada como `DATE` em UTC → alertas no dia errado
**Prevenção:** Apólices brasileiras iniciam legalmente às 14:00 BRT. Usar `TIMESTAMPTZ` + `America/Sao_Paulo` em toda tabela de vigência. Erro silencioso: alertas disparam no dia errado sem mensagem de erro.

### 4. Comissão como campo mutável → disputas irresolvíveis
**Prevenção:** Modelo de ledger append-only com tipos de evento (`calculo`, `estorno`, `correcao`). Nunca `UPDATE` em valor de comissão já registrada.

### 5. IA respondendo perguntas de cobertura sem RAG → risco SUSEP
**Prevenção:** LLM deve ter contexto injetado da apólice real do cliente (RAG). Sem grounding = conselho de seguro incorreto = exposição regulatória. Escalação para humano quando confiança < threshold.

---

## 5. Mercado Brasileiro: Específicos

| Tema | Detalhe | Impacto no projeto |
|------|---------|-------------------|
| **LGPD** | Dados de saúde/vida = "dado sensível" — requer consentimento explícito | `base_legal` + `deleted_at` (soft delete) desde migration 001 |
| **SUSEP** | Número SUSEP por corretor obrigatório | Campo `codigo_susep` no cadastro de corretores |
| **Timezone** | `America/Sao_Paulo` (UTC-3 / UTC-2 no horário de verão) | Usar `TIMESTAMPTZ` em todo timestamp de negócio |
| **CPF/CNPJ** | Validação por dígito verificador + unicidade por tenant | Validação client-side (cpf-cnpj-validator) + constraint DB |
| **Moeda** | BRL com centavos — `numeric(15,2)` | **Nunca** `float` para valores monetários |
| **NFS-e** | LC 214/2025 obriga jan/2026 | Preparar campo `nfse_numero` no schema de comissões agora |
| **Pix** | Stripe suporta Pix via EBANX (confirmado abr/2025) | Pix Automático disponível para assinaturas recorrentes |

---

## 6. Questões Abertas para Planejamento

1. **WhatsApp API path**: Evolution API (informal, sem custo por mensagem, risco de bloqueio) vs Meta Business API oficial (R$0,08-0,25/msg, verificação de CNPJ). Definir antes da fase de Automações.
2. **NFS-e**: LC 214/2025 obriga jan/2026 — implementar antes do lançamento ou como update pós-lançamento?
3. **Assembleia data source**: Registros manuais pelo corretor ou possibilidade de API de administradoras? Afeta o design do fluxo de assembleia.
4. **Comissão: projetada vs realizada**: Calcular no momento da emissão da apólice ou na confirmação do pagamento? Validar com corretoras reais antes de construir.
5. **Supabase região**: `sa-east-1` (São Paulo) disponível a partir de qual plano? Crítico para LGPD data residency.

---

*Pesquisa concluída em 2026-04-19. Próximo passo: definição de requisitos e roadmap.*
