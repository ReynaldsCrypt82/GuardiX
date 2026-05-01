'use client'
// Phase 07 Plan 03 — Client Component: botao para testar webhook via /api/[slug]/webhook-test
// D-04: envia payload de exemplo e exibe http_status + ok/falha.

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface TestWebhookButtonProps {
  slug: string
  url: string
  eventType: string
}

export function TestWebhookButton({ slug, url, eventType }: TestWebhookButtonProps) {
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    if (!url || !url.trim()) {
      setResult('Preencha a URL antes de testar.')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/${slug}/webhook-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, event_type: eventType }),
      })

      const data = await res.json()

      if (data.error) {
        setResult(`Erro: ${data.error}`)
      } else {
        const statusText = data.ok ? '(sucesso)' : '(falha)'
        setResult(`HTTP ${data.http_status} ${statusText}`)
      }
    } catch (e) {
      setResult(`Erro de rede: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={loading}
      >
        {loading ? 'Testando...' : 'Testar webhook'}
      </Button>
      {result && (
        <p
          className={`text-xs ${
            result.startsWith('HTTP 2') ? 'text-green-600' : 'text-destructive'
          }`}
        >
          {result}
        </p>
      )}
    </div>
  )
}
