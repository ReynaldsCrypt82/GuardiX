import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  slug: string
  type: 'apolices' | 'clientes' | 'comissoes'
  params?: Record<string, string>
  label?: string
}

// ExportButton usa <a download> em vez de <Link> — Pitfall 5 do RESEARCH.md:
// <Link> faz client-side routing e nao dispara o download do browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ExportButton({ slug, type, params, label = 'Exportar Excel' }: ExportButtonProps) {
  const search = new URLSearchParams({ type })
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) search.set(k, v)
    }
  }
  const href = `/api/${slug}/export?${search.toString()}`
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        {label}
      </a>
    </Button>
  )
}
