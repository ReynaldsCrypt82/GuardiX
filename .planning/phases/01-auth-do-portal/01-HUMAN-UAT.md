---
status: partial
phase: 01-auth-do-portal
source: [01-VERIFICATION.md]
started: 2026-05-05T01:00:00.000Z
updated: 2026-05-05T01:00:00.000Z
---

## Current Test

Awaiting final approval (smoke tests ran at Task 3 checkpoint).

## Tests

### 1. Full auto-cadastro flow with real CPF
expected: Portal client navigates to /{slug}/portal/cadastro, enters CPF existing in tenant clients table + email + password → auto-login + redirect to /{slug}/portal/home
result: [approved at checkpoint]

### 2. Login flow with portal credentials
expected: Portal client navigates to /{slug}/portal/login, enters credentials from cadastro → redirect to /{slug}/portal/home
result: [approved at checkpoint]

### 3. Middleware redirects — portal_client outside portal
expected: Logged-in portal_client navigating to /{slug}/dashboard → redirect to /{slug}/portal/home
result: [approved at checkpoint]

### 4. Middleware redirects — internal user inside portal
expected: Logged-in internal user navigating to /{slug}/portal/home → redirect to /{slug}/dashboard
result: [approved at checkpoint]

### 5. Internal user credentials rejected at portal login
expected: Internal user tries to login at portal login form → "Acesso não autorizado ao portal." error
result: [approved at checkpoint]

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
