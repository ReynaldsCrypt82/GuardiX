import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface VencendoItem {
  id: string
  policy_number: string
  vigencia_fim: string
  client_name: string | null
}
export interface CobrancaItem {
  id: string
  description: string
  amount: number | string
  due_date: string
}
export interface AssembleiaItem {
  id: string
  administrator: string
  next_assembly_date: string
}

interface Props {
  slug: string
  vencendo: { items: VencendoItem[]; totalCount: number }
  cobrancas: { items: CobrancaItem[]; totalCount: number }
  assembleias: { items: AssembleiaItem[]; totalCount: number }
}

function formatBRL(v: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
}
function formatDateBR(iso: string) {
  return format(new Date(iso + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
}

export function AlertSection({ slug, vencendo, cobrancas, assembleias }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Alertas</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Apolices vencendo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Apolices vencendo ({vencendo.totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vencendo.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item.</p>
            ) : (
              <ul className="space-y-2">
                {vencendo.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between text-sm">
                    <Link
                      href={`/${slug}/seguros/${it.id}`}
                      className="hover:underline truncate mr-2"
                    >
                      {it.policy_number}
                      {it.client_name && ` — ${it.client_name}`}
                    </Link>
                    <Badge variant="outline" className="text-amber-600 border-amber-600 shrink-0">
                      {formatDateBR(it.vigencia_fim)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/${slug}/seguros`} className="text-sm text-primary hover:underline block pt-2">
              Ver todas as apolices →
            </Link>
          </CardContent>
        </Card>

        {/* Cobrancas em atraso */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Cobrancas em atraso ({cobrancas.totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cobrancas.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item.</p>
            ) : (
              <ul className="space-y-2">
                {cobrancas.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2">{it.description}</span>
                    <Badge variant="destructive" className="shrink-0">
                      {formatBRL(it.amount)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/${slug}/financeiro?tab=overdue`} className="text-sm text-primary hover:underline block pt-2">
              Ver lancamentos →
            </Link>
          </CardContent>
        </Card>

        {/* Assembleias proximas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Assembleias proximas ({assembleias.totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assembleias.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item.</p>
            ) : (
              <ul className="space-y-2">
                {assembleias.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between text-sm">
                    <Link
                      href={`/${slug}/consorcio/grupos/${it.id}`}
                      className="hover:underline truncate mr-2"
                    >
                      {it.administrator}
                    </Link>
                    <Badge variant="secondary" className="shrink-0">
                      {formatDateBR(it.next_assembly_date)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/${slug}/consorcio`} className="text-sm text-primary hover:underline block pt-2">
              Ver grupos de consorcio →
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
