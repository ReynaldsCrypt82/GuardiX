# Phase 7: Automações & IA — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 07-automacoes-ia
**Areas discussed:** Disparo de automações

---

## Disparo de automações

| Option | Description | Selected |
|--------|-------------|----------|
| Cron job diário | Edge Function agendada que varre o banco em batch | ✓ |
| PostgreSQL trigger → Edge Function | Trigger realtime por linha inserida/atualizada | |
| Dentro das Server Actions | Disparo síncrono na ação do usuário | |

**User's choice:** Cron job diário
**Notes:** Simplicidade e um único ponto de controle foram os fatores decisivos.

---

## Eventos disponíveis para webhook

| Option | Description | Selected |
|--------|-------------|----------|
| 3 eventos core | Vencimento de apólice, Inadimplência, Contemplação | ✓ |
| 5 eventos expandido | + Assembleia próxima + Follow-up vencido | |
| Apenas vencimento e inadimplência | Foco nos eventos financeiros críticos | |

**User's choice:** 3 eventos core (policy_expiring, financial_overdue, consortium_contemplated)
**Notes:** Exatamente o que está em AUTO-01. Restante é fase 2.

---

## Falha de webhook

| Option | Description | Selected |
|--------|-------------|----------|
| Logar e seguir | Registra em webhook_logs, sem retry | ✓ |
| Retry automático 3x | Backoff exponencial na mesma execução | |
| Sem log — fire and forget | Não recomendado | |

**User's choice:** Logar e seguir
**Notes:** Auditabilidade preferida sobre complexidade de retry.

---

## Emails: timing

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo cron, simultâneo | Webhook + email no mesmo job diário | ✓ |
| Cron separado para email | Schedule independente com horário diferente | |
| Email apenas sob demanda | Sem cron de email — n8n envia externamente | |

**User's choice:** Mesmo cron, simultâneo
**Notes:** Um único scheduler simplifica manutenção.

---

## Destinatários do email

| Option | Description | Selected |
|--------|-------------|----------|
| Corretor responsável | Email apenas para o corretor vinculado | |
| Cliente diretamente | Email apenas para o cliente | |
| Ambos (corretor + cliente) | Corretor recebe notificação + cliente recebe aviso | ✓ |

**User's choice:** Ambos — corretor + cliente
**Notes:** Se cliente não tiver email, apenas corretor recebe (sem erro).

---

## Template de email

| Option | Description | Selected |
|--------|-------------|----------|
| Template fixo | HTML pré-definido com React Email | |
| Personalizável por tenant | Admin edita assunto + corpo via textarea | ✓ |

**User's choice:** Personalizável por tenant
**Notes:** Variáveis substituídas server-side ({{nome_cliente}}, {{vencimento}}, etc.). Fallback para template padrão se não configurado.

---

## Nível de personalização do template

| Option | Description | Selected |
|--------|-------------|----------|
| Assunto + corpo (textarea simples) | Texto plano com variáveis dinâmicas | ✓ |
| Assunto apenas | Corpo fixo, só assunto editável | |

**User's choice:** Assunto + corpo em textarea simples
**Notes:** Sem WYSIWYG — fase 2 se necessário.

---

## Teste de webhook

| Option | Description | Selected |
|--------|-------------|----------|
| Sim — botão Testar webhook | Envia payload de exemplo, mostra HTTP status | ✓ |
| Não — salvar e aguardar cron | Admin valida apenas no próximo disparo | |

**User's choice:** Sim — botão Testar webhook
**Notes:** Deve mostrar também o payload JSON que será enviado.

---

## Claude's Discretion

- WhatsApp: endpoint REST exposto, integração WhatsApp é responsabilidade do n8n/tenant
- Chat interno: widget flutuante vs página dedicada — planner decide
- LLM provider: GPT-4o-mini default via Vercel AI SDK
- RAG vs tool calling: planner decide
- Threshold de escalação: 0.7 default — planner define se hardcoded ou configurável

## Deferred Ideas

- Editor WYSIWYG de email — fase 2
- Retry automático de webhook — fase 2
- WhatsApp Business API nativo na plataforma — fora do v1
- Fan-out múltiplos webhooks por evento — fase 2
