# Phase 2: CRM & Clientes — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 02-crm-clientes
**Areas discussed:** Formulário de cliente, Listagem de clientes, Pipeline de vendas, Timeline de interações

---

## Formulário de cliente

| Option | Description | Selected |
|--------|-------------|----------|
| Um form com toggle PF/PJ | URL única /clientes/novo, campos mudam conforme tipo | ✓ |
| Páginas separadas PF e PJ | /clientes/novo/pf e /clientes/novo/pj — duplica rotas | |
| Seleção de tipo antes do form | Tela de entrada → redirect para form específico | |

**User's choice:** Um form com toggle PF/PJ
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Não — campo manual | Apenas validação de dígito verificador | ✓ |
| Sim — enriquecimento via API | API pública de CPF não existe sem autenticação paga | |

**User's choice:** CPF sem enriquecimento automático (só validação)
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo: tipo + doc + nome | PF: CPF + nome. PJ: CNPJ + razão social. Resto opcional. | ✓ |
| Completo desde o início | CPF, nome, email/telefone, endereço obrigatórios | |
| Flexível — qualquer campo | Nenhum campo obrigatório | |

**User's choice:** Mínimo — tipo + documento + nome
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| No cadastro — obrigatório | Select com lista de corretores, todo cliente nasce vinculado | ✓ |
| No cadastro — opcional | Pode deixar em branco e atribuir depois | |
| Só depois, via detalhes | Cadastro simplificado, atribuição em tela separada | |

**User's choice:** Corretor responsável obrigatório no cadastro
**Notes:** —

---

## Listagem de clientes

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela paginada | Reutiliza Table shadcn/ui. Colunas: nome, tipo, doc, corretor, status | ✓ |
| Cards em grid | Cards com avatar, nome, tipo, telefone e status. Novo componente. | |

**User's choice:** Tabela paginada
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Barra de busca inline na listagem | Input no topo, debounced, por nome/CPF/CNPJ | ✓ |
| Busca global no header do app | Cmd+K universal — mais sofisticado, melhor para fase posterior | |

**User's choice:** Busca inline na listagem
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Filtros inline acima da tabela | Dropdowns: Corretor, Status, Tipo — sempre visíveis | ✓ |
| Botão 'Filtrar' que abre drawer | Filtros escondidos até clicar | |
| Mistura: busca inline + dropdown | Busca sempre visível, filtros agrupados em botão com badge | |

**User's choice:** Filtros inline acima da tabela
**Notes:** —

---

## Pipeline de vendas

| Option | Description | Selected |
|--------|-------------|----------|
| Lista com coluna de status | Badge na tabela, dropdown inline para mudar estágio | ✓ |
| Kanban com drag-and-drop | Colunas por estágio, arrastar card para mover | |

**User's choice:** Lista com coluna de status
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixos em v1 | 4 estágios fixos conforme ROADMAP | |
| Configuráveis por tenant | Admin pode adicionar/remover estágios | ✓ |

**User's choice:** Configuráveis por tenant
**Notes:** Escolha expande o escopo do ROADMAP (que previa 4 fixos). Implica tabela `pipeline_stages` e lógica de remoção.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Renomear e reordenar os 4 fixos | Estrutura de 4 fixos, Admin muda nomes e ordem | |
| Adicionar e remover livremente | Número de estágios varia por tenant | ✓ |
| Renomear apenas | 4 fixos, só mudar rótulos | |

**User's choice:** Adicionar e remover estágios livremente
**Notes:** —

---

## Timeline de interações

| Option | Description | Selected |
|--------|-------------|----------|
| Aba dentro da tela de detalhes | Tela com abas: Dados, Timeline, Tarefas, Apólices | ✓ |
| Seção na mesma página (scroll) | Página longa com dados + timeline abaixo | |
| Modal/drawer ao clicar no cliente | Drawer lateral sem sair da lista | |

**User's choice:** Aba na tela de detalhes
**Notes:** Aba Apólices renderiza placeholder nesta fase; Phase 3 preenche.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Só os 3 definidos | Ligação, email, reunião | |
| Adicionar WhatsApp e Visita | 5 tipos | ✓ |
| Configuráveis pelo tenant | Admin define tipos | |

**User's choice:** 5 tipos — ligação, email, reunião, WhatsApp, visita
**Notes:** Contexto brasileiro — WhatsApp é canal dominante.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Botão 'Registrar interação' → modal | Dialog shadcn/ui com tipo, data, descrição | ✓ |
| Formulário inline no topo da timeline | Campo sempre visível, sem modal | |

**User's choice:** Modal via Dialog shadcn/ui
**Notes:** —

---

| Option | Description | Selected |
|--------|-------------|----------|
| Apenas in-app (badge/toast) | Badge no menu + toast no sistema | ✓ |
| In-app + email | Email automático via Resend (requer job agendado) | |

**User's choice:** Apenas in-app em v1
**Notes:** Email de follow-up adiado para Phase 7.

---

## Claude's Discretion

- Tamanho de página default da tabela (25 ou 50)
- Animações de transição nas abas
- Formatação de CPF/CNPJ na tabela
- Cores default dos estágios criados automaticamente ao registrar tenant

## Deferred Ideas

- Busca global Cmd+K — Phase 6 ou feature separada
- Email de follow-up automático — Phase 7 (requer job agendado)
- Tipos de interação configuráveis por tenant — v2
- Importação via CSV — v2
- Kanban drag-and-drop — v2 (schema compatível)
