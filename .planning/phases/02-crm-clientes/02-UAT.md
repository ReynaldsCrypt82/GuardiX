---
status: complete
phase: 02-crm-clientes
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-04-25T03:30:00Z
updated: 2026-04-25T04:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from the project root. Server boots without errors and http://localhost:3000 responds (redirect to login is fine). No import errors, no missing module crashes, no TypeScript compile failures on startup.
result: pass

### 2. Link Clientes na Sidebar
expected: After logging in, the dashboard sidebar shows a "Clientes" link between "Dashboard" and "Configurações". Clicking it navigates to /{slug}/clientes.
result: issue
reported: "ao clicar em configurações aparece desta forma — 404 page at /{slug}/configuracoes"
severity: major

### 3. Rota /clientes/novo Renderiza
expected: Visit /{slug}/clientes/novo. You should see a form titled "Novo cliente" (or similar) with a PF/PJ toggle (tabs), a document field labeled "CPF", a name field, and a "Corretor responsável" select. The page loads without errors.
result: pass
note: /clientes page had SelectItem value="" runtime error (fixed inline before test). /clientes/novo itself loaded cleanly.

### 4. Toggle PF/PJ no Formulário
expected: On the /clientes/novo form, click the "PJ" tab. The document field label changes to "CNPJ" and the mask format changes. A new "Responsável" field (for the legal representative) appears. Switching back to "PF" reverts the form cleanly (document field clears, responsible field disappears).
result: pass

### 5. Máscara CPF left-to-right
expected: On the /clientes/novo form (PF tab), click the CPF field and type digits one by one: 1, 1, 1, 4, 4, 4, 7, 7, 7, 3, 5. The mask should build left-to-right: 1 → 11 → 111 → 111.4 → 111.44 → 111.444 → 111.444.7 → 111.444.77 → 111.444.777 → 111.444.777-3 → 111.444.777-35. At no point should digits appear on the right side of a partially filled field.
result: pass

### 6. Máscara CNPJ left-to-right (PJ)
expected: On the /clientes/novo form, switch to PJ tab, click the CNPJ field and type digits: 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 1, 9, 0. The mask builds left-to-right just like CNPJ on the cadastro wizard. Final value: 12.345.678/0001-90.
result: pass

### 7. Cadastro de Cliente PF (requer Supabase + migrations)
expected: On /clientes/novo (PF tab), enter a valid CPF (e.g. 111.444.777-35), a name (e.g. "João Silva"), select a corretor, and click "Salvar". The client is created, a success toast appears, and you are redirected to /{slug}/clientes where "João Silva" appears in the list.
result: pass

### 8. Listagem /clientes — Tabela com Clientes
expected: Visit /{slug}/clientes. You should see a table with columns: Nome, Tipo (PF/PJ badge), Documento (formatted CPF or CNPJ with mask), Corretor, Estágio, and Data de cadastro. The client created in Test 7 appears in the list.
result: pass

### 9. Busca por Nome Debounced
expected: On /{slug}/clientes, type part of a client name in the search field (e.g. "João"). After ~400ms the table updates to show only matching clients — without clicking a button. Clearing the search restores all clients.
result: pass

### 10. Filtro por Tipo (PF/PJ)
expected: On /{slug}/clientes, open the "Tipo" filter and select "PF". The table shows only PF clients. The URL updates with ?type=pf. Selecting "PJ" shows only PJ clients. Selecting the blank option shows all. A badge "1 filtro(s) ativo(s)" appears when any filter is active.
result: pass

### 11. Estado Vazio com Filtros Ativos
expected: Apply a filter or search term that matches no clients (e.g. search for "xyzxyz"). The table area shows a "Nenhum cliente corresponde aos filtros." message — no crash, no empty table with no message.
result: pass

### 12. Link Pipeline na Sidebar (Configurações)
expected: In the sidebar, the "Configurações" section (or submenu) includes a "Pipeline" item. Clicking it navigates to /{slug}/configuracoes/pipeline. Non-admin users clicking Pipeline should be redirected away (to dashboard).
result: pass

### 13. Tela Admin Pipeline Renderiza
expected: Visit /{slug}/configuracoes/pipeline as admin. You should see a list of pipeline stages (at least the default ones created by the DB seed/migration), each showing name, color swatch, position, client count, and a delete button. A form to add new stages (name input, color picker, is_closed checkbox) is also visible.
result: pass

### 14. Adicionar e Remover Estágio
expected: On /configuracoes/pipeline, add a new stage: name "Aguardando doc", pick a color, click save. The stage appears in the list. Then delete it — if it has 0 clients, a simple confirmation dialog appears. After confirming, the stage disappears from the list.
result: pass

### 15. Dropdown Inline de Estágio na Tabela de Clientes
expected: On /{slug}/clientes, the "Estágio" column for each client shows a colored badge. Clicking the badge (for a client you can edit) opens a dropdown with all available stages. Selecting a different stage updates the badge immediately (optimistic update) and persists on page refresh.
result: pass
note: User initially clicked client name link (404 expected — detail page not built until Phase 3). Stage badge dropdown worked correctly.

### 16. Validação CPF — Dígito Verificador
expected: On /clientes/novo (PF tab), enter an invalid CPF with a bad check digit (e.g. 111.444.777-36 — last digit wrong). Click save. A validation error appears on the CPF field ("CPF inválido" or similar). The form does not submit.
result: pass

### 17. CPF Unit Tests — GREEN
expected: Run `npx vitest run tests/validations/cpf.test.ts` in the project root. All tests should pass (GREEN). Covers: valid CPF with/without mask, all-same digits rejected, wrong check digit rejected, invalid length rejected.
result: pass

## Summary

total: 17
passed: 16
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Sidebar 'Configurações' section header is not a navigable page — only its children are"
  status: fixed
  reason: "User reported: ao clicar em configurações aparece desta forma — 404 at /{slug}/configuracoes"
  severity: major
  test: 2
  root_cause: "sidebar-shell.tsx rendered 'Configurações' as <Link href='/{slug}/configuracoes'> but no page.tsx exists at that route."
  fix: "Changed Configurações parent NavItem from <Link> to non-clickable <div> in sidebar-shell.tsx. Fixed inline during UAT."
  artifacts:
    - path: "src/components/auth/sidebar-shell.tsx"
      issue: "Fixed — Configurações now renders as div instead of Link"

- truth: "ClientsFilters SelectItem values must be non-empty strings (Radix UI requirement)"
  status: fixed
  reason: "Runtime error: A <Select.Item /> must have a value prop that is not an empty string — in clients-filters.tsx"
  severity: major
  test: 3
  root_cause: "Three <SelectItem value=''> for 'Todos' options violated Radix UI constraint."
  fix: "Replaced value='' with value='_all' on all three SelectItems. handleChange converts '_all' back to null to clear the filter. Fixed inline during UAT."
  artifacts:
    - path: "src/app/(app)/[slug]/clientes/clients-filters.tsx"
      issue: "Fixed — SelectItem values changed to '_all' sentinel"
