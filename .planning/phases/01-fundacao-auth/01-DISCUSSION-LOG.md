# Phase 1: Fundação & Auth — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — este log preserva as alternativas consideradas.

**Date:** 2026-04-20
**Phase:** 01-fundacao-auth
**Areas discussed:** URL do tenant, Onboarding da corretora, Permissões por papel, Visual das telas de auth

---

## URL do Tenant

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Domínio único | app.nexusagent.com.br para todas — tenant por sessão | ✓ |
| Subdomínio por tenant | corretora.nexusagent.com.br — wildcard SSL | |
| Domínio próprio | White-label com domínio da corretora | |

**Escolha:** Domínio único

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Sim, slug na URL | app.nexus.com.br/[slug]/dashboard | ✓ |
| Não, só por sessão | URL genérica sem identificador | |

**Escolha:** Slug na URL

---

## Onboarding da Corretora

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Wizard em 3 steps | Dados empresa → Admin → Plano | ✓ |
| Form único | Tudo em uma página | |
| Admin cria manualmente | Sem auto-registro | |

**Escolha:** Wizard em 3 steps

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Validar dígito + buscar dados | ReceitaWS — razão social automática | ✓ |
| Só validar dígito | Valida mas preenche manualmente | |
| Só aceitar o que digitar | Sem validação | |

**Escolha:** Validar dígito + buscar dados (ReceitaWS)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Trial de 14 dias gratuito | Acesso completo, sem cartão, bloqueio após | ✓ |
| Trial ilimitado (MVP) | Sem prazo | |
| Já escolhe o plano no registro | Pagamento obrigatório antes do acesso | |

**Escolha:** Trial de 14 dias gratuito

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Email com magic link | Convidado define senha, entra no tenant certo | ✓ |
| Admin define a senha | Senha temporária enviada por outro canal | |
| Link compartilhável por papel | Qualquer um com o link pode entrar | |

**Escolha:** Email com magic link

---

## Permissões por Papel

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Só leitura geral | Vê clientes, apólices, dashboards — sem financeiro | |
| Leitura sem financeiro | Vê tudo exceto contas e comissões | |
| Só leitura geral | Ver tudo, sem editar, sem financeiro | ✓ |

**Escolha (Visualizador):** Só leitura geral (clientes, apólices, dashboards — sem financeiro nem comissões)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Financeiro + leitura geral | Financeiro completo + visualizar CRM/apólices | |
| Só módulo financeiro | Restrito às contas | |
| Igual ao Admin menos configurações | Tudo exceto gerenciar usuários e settings | ✓ |

**Escolha (Financeiro):** Igual ao Admin menos configurações do tenant

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Só a própria carteira | Vê apenas seus próprios registros | |
| Vê tudo, edita só a própria | Leitura global, escrita restrita | |
| Configurável pelo Admin | Admin decide a visibilidade compartilhada | ✓ |

**Escolha (Corretor):** Configurável pelo Admin — toggle nas configurações do tenant

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Só Admin | Exclusão é ação crítica | |
| Admin + dono do registro | Quem criou pode excluir | |
| Nunca exclui (soft delete) | Arquivamento com deleted_at — LGPD friendly | ✓ |

**Escolha:** Soft delete sempre — apenas Admin pode arquivar

---

## Visual das Telas de Auth

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Minimalista profissional | Branco/cinza, card limpo, estilo Linear/Vercel | |
| Split-screen com visual | Imagem/gradiente à esquerda, form à direita | ✓ |
| Branded com cor primária | Fundo na cor da marca | |

**Escolha:** Split-screen com visual

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Ainda não, deixo você decidir | Sistema escolhe paleta profissional | |
| Tenho uma ideia | Sugerir cores | |
| Usar shadcn/ui padrão | Começar com tema padrão | ✓ |

**Escolha:** shadcn/ui padrão — personalização de marca adiada

---

## Claude's Discretion

- Estrutura de pastas do projeto Next.js (App Router)
- Biblioteca de validação de formulários (React Hook Form + Zod)
- Animações entre steps do wizard

## Deferred Ideas

- White-label / domínio próprio por corretora — v2
- Customização de paleta por corretora — v2
- 2FA / Google OAuth — v2
- Subdomínio por tenant — adiado
