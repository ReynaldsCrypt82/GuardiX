// src/lib/utils/webhook-url.ts
// Phase 07 Plan 01 — SSRF guard contra T-07-SSRF (07-RESEARCH.md Pitfall 3)
// Bloqueia URLs com IPs privados RFC1918, loopback, link-local e protocolos nao-http/https.

const PRIVATE_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
]

export function isUrlSafe(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) return false
  return !PRIVATE_HOSTNAME_PATTERNS.some((p) => p.test(hostname))
}
