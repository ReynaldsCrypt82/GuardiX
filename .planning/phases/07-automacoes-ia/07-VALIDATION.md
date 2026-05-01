---
phase: 7
slug: automacoes-ia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in project) |
| **Config file** | vitest.config.ts (or existing) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | AUTO-01 | T-07-SSRF | webhook_url validado contra RFC1918 antes de salvar | unit | `npx vitest run --reporter=verbose src/__tests__/07-webhook-configs.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | AUTO-01 | T-07-SSRF | URL interna bloqueada no save e no dispatch | unit | `npx vitest run src/__tests__/07-webhook-configs.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | AUTO-02 | T-07-01 | webhook_logs inserido em cada disparo | unit | `npx vitest run src/__tests__/07-webhook-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | AUTO-03 | — | email enviado via fetch Resend API com to[] array | unit | `npx vitest run src/__tests__/07-email-send.test.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | AUTO-03 | — | variáveis {{nome_cliente}} substituídas antes do envio | unit | `npx vitest run src/__tests__/07-email-template.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | AUTO-04 | T-07-02 | endpoint /api/[slug]/ai/whatsapp requer auth header | unit | `npx vitest run src/__tests__/07-whatsapp-endpoint.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | AUTO-05 | — | escalação ativada quando finishReason === 'max-steps' | unit | `npx vitest run src/__tests__/07-whatsapp-escalation.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | AUTO-06 | T-07-03 | chat route queries isoladas por tenant_id | unit | `npx vitest run src/__tests__/07-chat-isolation.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/07-webhook-configs.test.ts` — stubs para AUTO-01 (SSRF validation)
- [ ] `src/__tests__/07-webhook-dispatch.test.ts` — stubs para AUTO-02 (dispatch + log)
- [ ] `src/__tests__/07-email-send.test.ts` — stubs para AUTO-03 (Resend send)
- [ ] `src/__tests__/07-email-template.test.ts` — stubs para AUTO-03 (template variables)
- [ ] `src/__tests__/07-whatsapp-endpoint.test.ts` — stubs para AUTO-04 (endpoint auth)
- [ ] `src/__tests__/07-whatsapp-escalation.test.ts` — stubs para AUTO-05 (escalation logic)
- [ ] `src/__tests__/07-chat-isolation.test.ts` — stubs para AUTO-06 (tenant isolation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cron dispara no horário correto (08h BRT) | AUTO-02 | Requer aguardar janela de tempo real no Supabase | Verificar `webhook_logs` no dia seguinte ao deploy da Edge Function |
| Email recebido pelo corretor e cliente | AUTO-03 | Requer conta de email real e Resend em produção | Configurar evento de teste e verificar inbox do corretor + cliente de teste |
| WhatsApp recebe resposta da IA | AUTO-04 | Requer Evolution API / n8n configurado com número real | Enviar mensagem de teste via WhatsApp para o número configurado |
| IA escala para humano | AUTO-05 | Depende de resposta da IA atingir max-steps ou heurística | Enviar pergunta complexa fora do contexto da corretora e verificar mensagem de escalação |
| Chat interno responde com dados reais do tenant | AUTO-06 | Requer Supabase conectado com dados reais | Perguntar "qual o status da apólice X?" no chat e verificar resposta com dados da DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
