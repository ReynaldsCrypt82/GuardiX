# Phase 3: Seguros & Consórcio — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregar dois módulos paralelos vinculados aos clientes da Phase 2:
1. **Seguros** — cadastro e gestão de apólices por tipo (Auto, Vida, Residencial, Empresarial, Saúde, Outros), com semáforo de vigência e registro de sinistros/endossos.
2. **Consórcio** — cadastro de grupos e cotas por cliente, controle de assembleias mensais, registro de contemplados e acompanhamento pós-contemplação.

Esta fase não inclui cálculo de comissões (Phase 4), financeiro (Phase 5) nem alertas por email (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Tipos de Seguro — Schema por Tipo (D-01)

- **D-01:** Schema específico por tipo — formulário dinâmico que adiciona campos conforme o tipo selecionado. Campos core genéricos presentes em todos os tipos + campos específicos por tipo:

| Tipo | Campos específicos |
|------|--------------------|
| Auto | placa, chassi, marca/modelo, ano, valor FIPE, cobertura (básica/compreensiva) |
| Vida | valor assegurado, beneficiários (nome + CPF + % cada) |
| Residencial | endereço do imóvel, valor do imóvel, tipo (próprio/alugado), cobertura |
| Empresarial | CNPJ do risco, endereço, tipo de atividade, valor patrimonial |
| Saúde | operadora, n° carteirinha, acomodação (enfermaria/apartamento), dependentes |
| Outros | sem campos extras — schema genérico cobre RC Civil, Viagem, etc. |

**Campos core (presentes em todos):** número da apólice, seguradora, tipo (select), vigência início, vigência fim, prêmio total, corretor responsável, cliente vinculado, observações, status.

**Implementação:** tabela `policies` com colunas core + coluna JSONB `type_data` para campos específicos. Formulário Next.js com seção condicional renderizada conforme tipo selecionado.

### Navegação das Listagens (D-02)

- **D-02:** Listagem global + dentro do cliente (dois pontos de entrada):
  - **Sidebar:** "Seguros" → `/[slug]/seguros` (lista todas as apólices do tenant com filtros por tipo, seguradora, corretor, status). "Consórcio" → `/[slug]/consorcio` (lista todos os grupos e cotas).
  - **Tela do cliente:** aba "Apólices" (já existe como placeholder em Phase 2) exibe apólices vinculadas a esse cliente. Aba "Consórcio" mostra cotas desse cliente.
  - **Novo item na sidebar:** "Seguros" e "Consórcio" como itens filhos de uma seção "Produtos" ou como itens diretos — Claude decide a apresentação visual mais limpa.

### Semáforo de Vigência (D-03)

- **D-03:** Três estados visuais para apólices:
  - 🟢 Verde — vigência > 60 dias
  - 🟡 Amarelo — vigência ≤ 60 dias e > 30 dias
  - 🔴 Vermelho — vigência ≤ 30 dias ou vencida
  - Calculado em runtime a partir de `vigencia_fim` — sem campo de status armazenado (evita dessincronia).

### Modelo de Dados do Consórcio (D-04)

- **D-04:** Modelo simplificado com duas tabelas:

  **`consortium_groups`** (grupos): administradora, tipo (auto/imóvel/serviço), valor do crédito, prazo em meses, data de início, total de cotas, tenant_id.

  **`consortium_quotas`** (cotas): group_id, client_id, número da cota, status (ativo/contemplado/cancelado), valor da parcela mensal, data de contemplação (nullable), observação pós-contemplação.

  **Assembleia:** campo `next_assembly_date` no grupo, atualizado manualmente pelo corretor após cada reunião. Alerta in-app disparado 3 dias antes da data.

  **Pós-contemplação:** `status = 'contemplado'` + campo `post_contemplation_notes` (text) para acompanhar uso do crédito e documentação — sem módulo de financiamento separado em v1.

### Sinistros e Endossos (D-05)

- **D-05:** Registro simples vinculado à apólice:
  - **Sinistro:** data, tipo (colisão/roubo/incêndio/etc.), número de protocolo (opcional), status (aberto/em análise/encerrado), descrição.
  - **Endosso:** data, tipo (inclusão/exclusão/alteração), descrição, impacto no prêmio (opcional).
  - Sem upload de arquivos em v1 (Out of Scope — PROJECT.md).

### Alertas (D-06)

- **D-06:** Apenas in-app — mesmo padrão da Phase 2 (badge de contador no menu + toast ao abrir o sistema):
  - **Apólices:** badge conta apólices com semáforo vermelho (≤ 30 dias ou vencidas).
  - **Assembleias:** alerta 3 dias antes de `next_assembly_date`.
  - Email automático fica para Phase 7 (junto com n8n).

### Permissões RBAC (herda Phase 1 D-11)

- Admin e Financeiro: veem todas as apólices/cotas do tenant.
- Corretor: vê apenas apólices/cotas vinculadas a ele (RLS `assigned_to = auth.uid()`).
- Visualizador: vê tudo, sem criar/editar.
- Soft delete obrigatório — `deleted_at TIMESTAMPTZ` (herda D-12 Phase 1).

### Claude's Discretion

- Apresentação visual da seção "Produtos" na sidebar (itens diretos vs sub-menu agrupado).
- Ordenação default das listagens (por vigência mais próxima ou por data de cadastro).
- Cores e ícones por tipo de seguro nas listagens.
- Número de colunas visíveis por default na listagem de apólices vs colunas visíveis em tela menor.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Seguros — SEG-01 a SEG-07
- `.planning/REQUIREMENTS.md` §Consórcio — CON-01 a CON-06

### Phase 1 Decisions (padrões a seguir)
- `.planning/phases/01-fundacao-auth/01-CONTEXT.md` — D-11 (RBAC), D-12 (soft delete)

### Phase 2 Decisions (integração)
- `.planning/phases/02-crm-clientes/02-CONTEXT.md` — D-10 (aba Apólices placeholder na tela de detalhes do cliente), D-08 (pipeline stages — padrão de badge colorido reutilizável)

### Project Context
- `.planning/PROJECT.md` §Seguros e §Consórcio — requisitos de produto
- `.planning/PROJECT.md` §Out of Scope — upload de arquivos e gestão completa de sinistros fora do escopo v1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/tabs.tsx` — abas Dados/Timeline/Tarefas na tela do cliente; reutilizar para aba Apólices/Consórcio
- `src/components/ui/badge.tsx` — badge colorido de pipeline; reutilizar para semáforo de vigência (verde/amarelo/vermelho)
- `src/components/ui/dialog.tsx` — Dialog de interações e tarefas; mesmo padrão para sinistros/endossos
- `src/components/ui/calendar.tsx` + `src/components/ui/popover.tsx` — date picker já instalado; usar para vigência início/fim e data de assembleia
- `src/lib/validations/cpf.ts` + `src/lib/validations/cnpj.ts` — reutilizar para validação de CPF de beneficiários e CNPJ do risco empresarial
- `src/lib/actions/clients.ts` — padrão de Server Action com Zod safeParse + guard de role + RLS

### Established Patterns
- Server Components para fetch de dados + Client Components para interatividade
- Zod `discriminatedUnion` para schemas com campos variáveis por tipo (mesmo padrão do toggle PF/PJ em Phase 2)
- URL state via `router.replace` + `searchParams` para filtros de listagem (sem Zustand)
- `revalidatePath` após Server Action para atualizar dados na listagem

### Integration Points
- `src/app/(app)/[slug]/layout.tsx` — sidebar-shell receberá novos links "Seguros" e "Consórcio"
- `src/app/(app)/[slug]/clientes/[id]/` — rota de detalhes do cliente (Phase 3 implementa, Phase 2 deixou placeholder)
- `src/lib/types/database.types.ts` — adicionar tipos para `policies`, `policy_type_data`, `consortium_groups`, `consortium_quotas`, `claims`, `endorsements`

</code_context>

<specifics>
## Specific Ideas

- Semáforo de vigência calculado em runtime (não armazenado) — evita cron job de sincronização
- `type_data` como JSONB na tabela `policies` para dados específicos por tipo — schema core fixo, extensão por tipo sem migrations adicionais
- Modelo de consórcio intencional em 2 tabelas (grupos + cotas) — simplicidade sobre completude em v1
- Pós-contemplação como campo de observação livre — sem módulo de financiamento separado

</specifics>

<deferred>
## Deferred Ideas

- Upload de documentos de apólice/sinistro/contemplação — fora do escopo v1 (PROJECT.md Out of Scope)
- Gestão completa de sinistros (regulação, perícia, valor indenizado) — apenas registro inicial em v1
- Email automático de vencimento e assembleia — Phase 7 (junto com n8n)
- Histórico de parcelas pagas do consórcio — Phase 5 (Financeiro)
- Registro individual de cada assembleia (resultado, lance, sorteio) — Phase 5 ou posterior
- Integração com APIs das seguradoras (SUSEP, sistemas proprietários) — fora do escopo v1

</deferred>

---

*Phase: 03-seguros-consorcio*
*Context gathered: 2026-04-25*
