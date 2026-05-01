---
status: complete
phase: 01-fundacao-auth
source: [01-00-SUMMARY.md, 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-04-21T22:00:00Z
updated: 2026-04-25T02:30:00Z
---

## Current Test

number: 15
name: Isolamento RLS — Tenant Separation (requer Supabase)
expected: |
  Com dois usuários no mesmo tenant (admin + corretor): logado como corretor,
  verifique que a tela de clientes mostra apenas os clientes do tenant.
  Logado como admin, verifique o mesmo. O isolamento RLS deve impedir acesso
  a dados de outros tenants (public.jwt_tenant_id).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from the project root. Server boots without errors and http://localhost:3000 responds (even a redirect is fine). No import errors, no missing module crashes, no TypeScript compile failures on startup.
result: pass

### 2. Login Page Renders
expected: Visit http://localhost:3000/login. You should see a split-screen layout — on desktop: a blue-to-violet gradient panel on the left (hidden on mobile), and a form on the right with heading "Bem-vindo de volta", email field, password field, "Entrar" button, and "Esqueceu a senha?" link below.
result: pass

### 3. Registro — Wizard Passo 1 Renderiza
expected: Visit http://localhost:3000/cadastro. You should see Step 1 of a 3-step wizard with a CNPJ input field, company name field, and a segment selector (Seguros / Consórcio / Ambos). A progress indicator shows you are on step 1 of 3.
result: pass

### 4. CNPJ Auto-fill via BrasilAPI
expected: On the cadastro Step 1 form, enter a valid CNPJ (e.g. 11.222.333/0001-81). After typing, the company name field should auto-fill with data from the BrasilAPI proxy (/api/cnpj/). If BrasilAPI is unreachable, the field stays editable with no error crash.
result: pass
note: CNPJ 11.222.333/0001-81 is fictitious — BrasilAPI returned not-found. Graceful fallback shown correctly (red message + editable field, no crash). Auto-fill verified as working with real CNPJs.

### 5. Route Protection — Anonymous Redirect
expected: While logged out, visit http://localhost:3000/acme/dashboard directly. The middleware should redirect you to /login?next=/acme/dashboard (or just /login). You should NOT see any dashboard content — you should land on the login page.
result: pass

### 6. Recuperar Senha — Formulário Funcional
expected: Visit http://localhost:3000/recuperar-senha. You should see an email input field and a submit button labeled "Enviar link de recuperação". The button should be type="submit" (not dead). Submitting a valid email should show a success message ("Verifique seu e-mail" or similar) — no Supabase connection needed as the form should handle the action gracefully.
result: pass

### 7. Trial Expirado Page
expected: Visit http://localhost:3000/trial-expirado. You should see a page with "Seu período de teste chegou ao fim" (or similar), two buttons — "Ver planos" and "Falar com suporte" — and an option to sign out. The page should render without errors.
result: pass

### 8. Convite Expirado — Página Estática
expected: Visit http://localhost:3000/convite/expirado. You should see "Este convite expirou" heading and a note that "Os convites são válidos por 72 horas". The page renders cleanly without needing a database connection.
result: pass

### 9. CNPJ Unit Tests — 5/5 GREEN
expected: Run `npx vitest run tests/validations/cnpj.test.ts` in the project root. All 5 tests should pass (GREEN). Test cases include: valid CNPJ passes, all-same digits fails, wrong length fails, non-numeric fails, formatted input passes.
result: pass

### 10. Registro — Fluxo Completo (requer Supabase)
expected: With Supabase credentials configured in .env.local: complete the 3-step cadastro wizard with a valid CNPJ, company name (segment: Seguros), admin name, email, and password. On submission, a new tenant and admin user should be created. You should be auto-logged in and redirected to /{slug}/dashboard where the dashboard shell is visible.
result: issue
reported: "o campo para digitar o CNPJ não fica como placeholder — quando começo a digitar, só muda o último número (preenche da direita para a esquerda)"
severity: major

### 11. Login com Email e Senha (requer Supabase)
expected: With a registered account: visit /login, enter email and password, click "Entrar". You should be redirected to /{slug}/dashboard. After page refresh, the session persists (you remain logged in — no redirect back to /login).
result: pass

### 12. Dashboard Shell (requer Supabase)
expected: After logging in, the dashboard at /{slug}/dashboard shows a welcome message, a sidebar with "Dashboard" and "Configurações > Usuários" links, a user menu in the top-right with your avatar initials, and 6 placeholder metric cards showing "—" or "Em breve" (no live data yet — this is a Phase 1 stub).
result: pass
note: Sidebar shows Dashboard, Clientes, Configurações > Usuários + Pipeline. Avatar "R" no canto superior direito. 6 cards com "—". Três bugs de infraestrutura corrigidos durante o teste: (1) hook custom-access-token lia raw_app_meta_data em vez de app_metadata, (2) middleware não propagava cookies em redirects, (3) (app)/layout.tsx estava no nível errado da hierarquia de rotas causando redirect loop.

### 13. Gestão de Usuários + Convidar (requer Supabase)
expected: Navigate to /{slug}/configuracoes/usuarios. You see a table listing the admin user (you). Click "Convidar usuário" — a dialog opens with an email field and a role selector (Admin / Corretor / Financeiro / Visualizador, default = Corretor). Enter a valid email and submit. A toast "Convite enviado para..." appears and the invite shows in the table as "Convite pendente".
result: pass
note: Admin "Reinaldo" listado como Administrador/Ativo. Convite enviado para reinaldo@wrdigital.com.br aparece como Corretor/Convite pendente. Detalhe: coluna E-mail do admin exibe "—" (email não está sendo carregado do auth.users para o profile).

### 14. Aceitar Convite — Link Único (requer Supabase + email)
expected: After receiving an invite email, open the link /convite/{token}. You see a form to set your full name and password. After submitting, you are logged into the correct tenant's dashboard. Attempting to reuse the same link shows "Este link de convite já foi utilizado" (invite is single-use).
result: issue
severity: major
reported: "Convite foi cancelado antes do usuário conseguir aceitar — acceptInvite falhou no DB claim (invite.cancelled_at estava set). Root cause provável: double-submit do dialog de convite cancelou o invite anterior e criou novo, mas o novo também foi cancelado. Link único: funcionou corretamente (exibiu 'Este convite expirou'). Formulário renderizou corretamente. Auto-login após accept: não testado end-to-end. Reparação manual (updateUserById + profile upsert) confirmou que o login do corretor funciona uma vez configurado o app_metadata."

### 15. Isolamento RLS — Tenant Separation (requer Supabase)
expected: With two tenants registered (A and B): logged in as a user of tenant A, query the profiles table. You should see ONLY tenant A's profiles — zero rows from tenant B. The RLS namespace fix (public.jwt_tenant_id) should enforce this isolation.
result: pass
note: Verificado via SDK com anon key autenticado como corretor do tenant lukseg-corretora-de-seguros. Visíveis: 2 profiles (ambos do mesmo tenant_id). Invisíveis: profiles dos outros 2 tenants no banco (seed-1776796501260, riguetti-lima-corretora-de-seguros). RLS public.jwt_tenant_id isolando corretamente.

## Summary

total: 15
passed: 13
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Usuário consegue digitar um CNPJ válido no formulário de cadastro (Passo 1)"
  status: failed
  reason: "User reported: o campo CNPJ preenche da direita para a esquerda — ao digitar '01', mostra '00.000.000/0000-01'. O CNPJ não pode ser inserido corretamente."
  severity: major
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
