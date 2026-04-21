# Deferred Items — Phase 01 fundacao-auth

## Pre-existing Issues (Out of Scope for Current Plan)

### npm run build fails with WasmHash TypeError (Node.js 24 + webpack 5)

**Discovered during:** Plan 02, Task 3 verification
**Error:** `TypeError: Cannot read properties of undefined (reading 'length')` at `WasmHash._updateWithBuffer` in `node_modules/next/dist/compiled/webpack/bundle5.js`
**Root cause:** Pre-existing incompatibility between Node.js v24.14.0 and Next.js 15.3.3 webpack build (same error documented in Plan 00 SUMMARY — was supposedly fixed by downgrading to 15.3.3, but the build is now failing again with the same error).
**Impact:** `npm run build` exits 1. Edge runtime compilation of middleware cannot be verified via build command.
**Mitigation applied:** All middleware files verified to contain zero Node-only APIs (require, fs, path, process.cwd, __dirname). TypeScript typecheck passes. The middleware code itself is Edge-compatible.
**Recommended fix:** Pin Node.js to v20 LTS or v22 LTS for build. The webpack WasmHash bug is a Node.js 24 regression.
**Owner:** Needs resolution before production deployment.
