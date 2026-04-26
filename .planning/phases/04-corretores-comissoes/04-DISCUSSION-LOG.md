# Phase 4: Corretores & Comissões — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 04-corretores-comissoes
**Areas discussed:** Corretor interno ↔ usuário, Regra de comissão, Parceiros externos, Dashboard individual

---

## Corretor interno ↔ usuário do sistema

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre tem conta (profiles) | Corretor interno = profiles.role='corretor'. broker_profiles para atributos extras. | ✓ |
| Pode existir sem conta | Tabela 'brokers' independente de profiles. | |

**User's choice:** Sempre tem conta de usuário.

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela broker_profiles | 1:1 com profiles.id. Separa auth de negócio. | ✓ |
| Colunas direto em profiles | Simples mas polui tabela de auth. | |

**User's choice:** Tabela broker_profiles.

| Option | Description | Selected |
|--------|-------------|----------|
| SUSEP + meta + taxa | susep_number, monthly_goal, commission_rate. | ✓ |
| + regras por produto | Idem + JSONB override por tipo. | |

**User's choice:** Apenas SUSEP + meta + taxa (overrides foram adicionados depois na área de comissão).

---

## Regra e base de cálculo de comissão

| Option | Description | Selected |
|--------|-------------|----------|
| Premio total | commission = premio_total × rate. | ✓ |
| Primeiro pagamento | Baseado na primeira parcela paga. | |

**User's choice:** Premio total.

| Option | Description | Selected |
|--------|-------------|----------|
| No momento do cadastro | Server Action de criar já insere no ledger. | |
| Ao marcar como pago | Botão "marcar pago" na apólice/cota. | ✓ |

**User's choice:** Ao marcar como pago — botão na tela de detalhes.

| Option | Description | Selected |
|--------|-------------|----------|
| Botão simples na apólice | campo commission_paid_at na apólice. Phase 5 integra depois. | ✓ |
| Comissão pendente ao criar | Ledger com status='pendente', confirmado na Phase 5. | |

**User's choice:** Botão simples — commission_paid_at na apólice/cota.

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo padrão para consórcio | valor_credito × rate. | ✓ |
| Consórcio não gera comissão em v1 | Apenas seguros. | |

**User's choice:** Mesmo padrão (consórcio também gera comissão).

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre a taxa do corretor | commission_rate_default único. | |
| Override por tipo de seguro | Default + JSONB com overrides por tipo. | ✓ |

**User's choice:** Override por tipo de produto.

| Option | Description | Selected |
|--------|-------------|----------|
| Seguros e consórcio | JSONB unificado com prefixo consorcio_. | ✓ |
| Apenas seguros | Consórcio sempre usa taxa default. | |

**User's choice:** Seguros e consórcio unificados no mesmo JSONB.

| Option | Description | Selected |
|--------|-------------|----------|
| Tipo + valor + ref + data + corretor | entry_type, amount, policy_id/quota_id, broker_id, notes. | ✓ |
| Apenas valor + corretor + data | Minimalista, sem FK para apólice. | |

**User's choice:** Entrada completa com todos os campos de auditoria.

---

## Parceiros externos: modelo e split

| Option | Description | Selected |
|--------|-------------|----------|
| Não — apenas registro | Tabela partners sem vínculo com profiles. | ✓ |
| Sim — acesso de leitura | Novo papel 'parceiro' no RBAC. | |

**User's choice:** Parceiro sem conta de usuário.

| Option | Description | Selected |
|--------|-------------|----------|
| Dois ledger entries: corretor + parceiro | Rates independentes. | ✓ |
| Só o parceiro recebe | Sem comissão para corretor quando há parceiro. | |
| Parceiro % do total, corretor o resto | Soma sempre a taxa base. | |

**User's choice:** Dois ledger entries independentes.

| Option | Description | Selected |
|--------|-------------|----------|
| Opcional (nullable) | partner_id null na maioria das apólices. | ✓ |
| Obrigatório | Sempre deve ter parceiro ou "sem parceiro" explícito. | |

**User's choice:** partner_id nullable — opcional.

---

## Dashboard individual do corretor

| Option | Description | Selected |
|--------|-------------|----------|
| Rota dedicada /corretores/[id] | Admin vê qualquer; corretor redirecionado para o próprio. | ✓ |
| Filtro no dashboard geral | Phase 6 só. Sem rota em Phase 4. | |

**User's choice:** Rota dedicada /[slug]/corretores/[id].

| Option | Description | Selected |
|--------|-------------|----------|
| Produção + comissão + carteira | Básico do COM-06. | |
| + meta mensal e % atingido | Ambas as opções — completo. | ✓ |

**User's choice:** Produção + comissão + carteira + meta + % atingido.

| Option | Description | Selected |
|--------|-------------|----------|
| Nome + SUSEP + meta + produção do mês | Listagem com métricas. | ✓ |
| Apenas dados cadastrais | Simples sem métricas. | |

**User's choice:** Listagem com métricas de produção.

| Option | Description | Selected |
|--------|-------------|----------|
| Apenas Admin edita broker_profiles | SUSEP e meta definidos pelo admin. | ✓ |
| Corretor pode editar parcialmente | Corretor atualiza SUSEP, admin controla meta/taxa. | |

**User's choice:** Apenas Admin.

| Option | Description | Selected |
|--------|-------------|----------|
| Tab 'Relatório' no dashboard | Aba na mesma rota /corretores/[id]. | ✓ |
| Página separada /corretores/[id]/relatorio | Rota própria para relatório. | |

**User's choice:** Aba no dashboard do corretor.

---

## Claude's Discretion

- Fluxo de criação de corretor: Admin convida via Phase 1; Phase 4 adiciona "Completar perfil" para preencher broker_profiles — Claude decide se é Dialog ou página separada.
- Paginação da listagem: 25 itens (padrão Phase 2).
- Seletor de mês no dashboard: mês corrente como default.
- Formatação BRL: Intl.NumberFormat pt-BR.

## Deferred Ideas

- Exportação de relatório PDF/Excel — Phase 6
- Notificação por email de comissão — Phase 7
- Portal do parceiro externo — Out of scope v1
- Comissão por parcela paga — decidido usar premio_total em v1
