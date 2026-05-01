// src/lib/utils/dispatch-webhook.ts
// Phase 07 Plan 02 — Pure utility functions for webhook dispatch logic.
// These functions are Node.js-compatible and testable via Vitest.
// The Edge Function (Deno) inlines equivalent logic to avoid Node.js imports in Deno runtime.

/**
 * buildWebhookPayload — wraps event data in the standard envelope shape.
 * Shape: { event: string, timestamp: ISO-8601, data: unknown }
 */
export function buildWebhookPayload(
  event_type: string,
  data: unknown,
): { event: string; timestamp: string; data: unknown } {
  return {
    event: event_type,
    timestamp: new Date().toISOString(),
    data,
  }
}

/**
 * classifyHttpResponse — determines dispatch outcome from http_status + error_message.
 * Returns 'success' only for 2xx HTTP status codes with no network error.
 * Null status (network error / timeout) always returns 'failure'.
 */
export function classifyHttpResponse(
  status: number | null,
  errorMessage: string | null,
): 'success' | 'failure' {
  if (errorMessage !== null) return 'failure'
  if (status !== null && status >= 200 && status < 300) return 'success'
  return 'failure'
}
