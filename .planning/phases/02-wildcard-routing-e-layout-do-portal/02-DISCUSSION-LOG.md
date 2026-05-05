# Phase 2: Wildcard Routing e Layout do Portal — Discussion Log

**Session:** 2026-05-05
**Facilitator:** Claude (gsd-discuss-phase)
**Status:** Complete — CONTEXT.md produced

---

## Gray Areas Presented

Five gray areas were identified for Phase 2:

1. Estratégia de wildcard routing
2. Layout e branding do portal
3. Escopo do CR-01 (security fix) nesta phase
4. Passagem do slug extraído para updateSession
5. Sticky vs fixed-top no header

---

## Area 1: Estratégia de Wildcard Routing

**Question:** Como implementar o roteamento por subdomínio — abordagem, localização do rewrite, formato de URL e ativação por ambiente?

**Options offered:**
- Opção A: Middleware rewrite transparente (`NextResponse.rewrite`) — slug no subdomínio, nunca no path visível
- Opção B: Vercel rewrites via `vercel.json` — mais simples mas menos flexível, exige deploy config
- Opção C: Edge Config ou middleware mais pesado

**User choice:** "Opção A e 1"

**Follow-up on URL format:**
- Formato 1: `acme.nexus.app/portal/home` — slug só no subdomínio (limpo)
- Formato 2: `nexus.app/acme/portal/home` — path-based como fallback primário

**User choice:** Opção A com formato 1 (URL limpa)

**Follow-up on production path-based fallback:**
- Opção 1: path-based permanece funcional em produção (acme.nexus.app/portal + nexus.app/acme/portal ambos funcionam)
- Opção 2: path-based redireciona para subdomínio em produção
- Opção 3: auto-detect via `NEXT_PUBLIC_BASE_DOMAIN` env var

**User choice:** "3" → ativação por env var, path-based como dev mode

**Follow-up on rewrite location:**
- Opção 1: `src/middleware.ts` (entry point, antes de updateSession)
- Opção 2: `src/lib/supabase/middleware.ts` (dentro de updateSession)

**User choice:** "1" → `src/middleware.ts` antes de `updateSession`

**Decisions captured:** D-01, D-02, D-03, D-04

---

## Area 2: Layout e Branding do Portal

**Question:** Quais elementos o header do portal deve exibir e como o nav placeholder deve se comportar?

**Sub-question — Logo e identidade:**
- Opção 1: Só nome da corretora (sem logo, sem migration)
- Opção 2: `logo_url` TEXT na tabela `tenants` (migration) + exibe logo se existir, nome sempre visível
- Opção 3: Logo obrigatório (campo não-null, bloqueado sem logo)

**User choice:** "2" → `logo_url` nullable + nome sempre visível

**Sub-question — Top nav:**
- Opção 1: Nav placeholder com todos os itens já visíveis (4 disabled, 1 ativo)
- Opção 2: Nav mínimo (só "Início" ativo, demais aparecem em fases futuras)
- Opção 3: Sem nav na Phase 2 (adicionar nas fases que criam as rotas)

**User choice:** "1" → todos os itens visíveis desde o início

**Follow-up — Itens do nav:**
- Opção 1: Início · Apólices · Consórcio · Financeiro (4 itens)
- Opção 2: Início · Minhas Apólices · Meu Consórcio · Financeiro · Documentos (5 itens)

**User choice:** "2" → 5 itens com "Documentos"

**Sub-question — Perfil do usuário:**
- Opção 1: Avatar/nome do cliente + dropdown "Sair" (canto superior direito)
- Opção 2: Só botão "Sair" (sem avatar/nome)
- Opção 3: Perfil completo com nome, email e dados do cliente

**User choice:** "1" → avatar + nome + dropdown com "Sair"

**Decisions captured:** D-07, D-08, D-09, D-10

---

## Area 3: Escopo do CR-01 (Security Fix)

**Question:** A correção do CR-01 (middleware não valida URL slug contra JWT `portal_slug`) deve ser incluída no escopo desta Phase 2?

**Context provided:** CR-01 foi identificado no code review da Phase 1. Um portal_client do tenant A pode acessar `/tenant-b/portal/home` porque o middleware não valida o slug da URL contra o `portal_slug` do JWT. Não vaza dados na Phase 1 (home estática), mas é crítico antes da Phase 3 que adiciona apólices e dados financeiros.

**Options:**
- Opção 1: Incluir CR-01 + WR-01 no escopo da Phase 2 (resolve agora, antes de Phase 3)
- Opção 2: Adiar para Phase 3 (quando a vulnerabilidade passa a ter impacto real)

**User choice:** "1" → incluir CR-01 e WR-01 na Phase 2

**Decisions captured:** D-05 (CR-01 fix), D-06 (WR-01 fix)

---

## Areas Resolved via Claude's Discretion

**Area 4 — Passagem do slug para updateSession:**
Resolved via Claude's Discretion: injetar header `x-portal-slug` via `NextResponse.next({ headers: { 'x-portal-slug': slug } })` — cleanest approach, avoids re-parsing the host header in `updateSession`. Noted in `<specifics>` block.

**Area 5 — Sticky vs fixed-top no header:**
Resolved via Claude's Discretion: positioned as sticky (stays at top while scrolling) — better UX for longer pages that Phase 3 and 4 will introduce. Noted in `<decisions>` section.

---

## Decisions Summary

| ID | Decision | Status |
|----|----------|--------|
| D-01 | Rewrite em `src/middleware.ts` antes de `updateSession` | Locked |
| D-02 | URL limpa: `acme.nexus.app/portal/home` (slug só no subdomínio) | Locked |
| D-03 | `NEXT_PUBLIC_BASE_DOMAIN` ativa wildcard; ausente = path-based dev mode | Locked |
| D-04 | Auto-detect path-based vs subdomínio por presença de `BASE_DOMAIN` | Locked |
| D-05 | CR-01 fix: validar URL slug vs `appMeta.portal_slug` no branch isPortalClient | Locked |
| D-06 | WR-01 fix: `loginPortalClient` redireciona via JWT `portal_slug`, não do formulário | Locked |
| D-07 | Nova migration: `logo_url TEXT` nullable na tabela `tenants` | Locked |
| D-08 | Header: logo (se existir) + nome da corretora à esquerda | Locked |
| D-09 | Top nav: Início · Minhas Apólices · Meu Consórcio · Financeiro · Documentos (4 disabled) | Locked |
| D-10 | Canto direito: avatar + nome do cliente + dropdown "Sair" | Locked |
| D-11 | Vercel wildcard domain `*.nexus.app` via painel (passo manual pós-deploy) | Locked |
| D-12 | Dev local: path-based (`localhost:3000/acme/portal/home`); hosts file é opcional | Locked |

---

*Discussion completed: 2026-05-05*
*Output: 02-CONTEXT.md*
*Next: `/gsd-plan-phase 2`*
