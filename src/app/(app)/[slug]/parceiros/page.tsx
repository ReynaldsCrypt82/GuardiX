import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PartnerTable, type PartnerRow } from '@/components/parceiros/partner-table'
import { PartnerDialog } from '@/components/parceiros/partner-dialog'

const PAGE_SIZE = 25

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function ParceirosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const pageNum = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = (pageNum - 1) * PAGE_SIZE

  const { data: partners, count } = await supabase
    .from('partners')
    .select(
      'id, name, cnpj, contact_email, contact_phone, commission_rate_default, commission_rate_overrides',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  const rows = (partners ?? []) as unknown as PartnerRow[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Parceiros externos</h1>
          <p className="text-sm text-muted-foreground">{count ?? 0} parceiro(s) cadastrado(s)</p>
        </div>
        <PartnerDialog slug={slug} triggerLabel="Novo parceiro" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="font-medium">Nenhum parceiro externo cadastrado</p>
          <p className="text-sm text-muted-foreground">
            Parceiros sao indicadores externos sem acesso ao sistema. Cadastre aqui para registrar
            repasses automaticos.
          </p>
          <PartnerDialog
            slug={slug}
            triggerLabel="Cadastrar primeiro parceiro"
            triggerVariant="outline"
          />
        </div>
      ) : (
        <PartnerTable slug={slug} rows={rows} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {pageNum} de {totalPages}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?page=${pageNum - 1}`}>Anterior</Link>
              </Button>
            )}
            {pageNum < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?page=${pageNum + 1}`}>Proxima</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
