'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { resetPageOnFilterChange } from '@/lib/utils/clients-query'

interface ClientsFiltersProps {
  corretores: { id: string; full_name: string | null }[]
  stages: { id: string; name: string; color: string; position: number }[]
}

export function ClientsFilters({ corretores, stages }: ClientsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const currentCorretor  = searchParams.get('corretor')  ?? ''
  const currentStage     = searchParams.get('stage')     ?? ''
  const currentType      = searchParams.get('type')      ?? ''
  const currentCategory  = searchParams.get('category')  ?? ''

  const activeCount = [currentCorretor, currentStage, currentType, currentCategory].filter(Boolean).length

  function handleChange(key: string, value: string) {
    const params = resetPageOnFilterChange(
      new URLSearchParams(searchParams.toString()),
      key,
      value === '_all' ? null : value || null,
    )
    router.replace(`${pathname}?${params.toString()}`)
  }

  function handleClear() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('corretor')
    params.delete('stage')
    params.delete('type')
    params.delete('category')
    params.delete('q')
    params.set('page', '1')
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentCorretor} onValueChange={(v) => handleChange('corretor', v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Corretor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os corretores</SelectItem>
          {corretores.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.full_name ?? 'Sem nome'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentStage} onValueChange={(v) => handleChange('stage', v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Estágio" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os estágios</SelectItem>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentType} onValueChange={(v) => handleChange('type', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todos os tipos</SelectItem>
          <SelectItem value="pf">Pessoa Física</SelectItem>
          <SelectItem value="pj">Pessoa Jurídica</SelectItem>
        </SelectContent>
      </Select>

      <Select value={currentCategory} onValueChange={(v) => handleChange('category', v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas as categorias</SelectItem>
          <SelectItem value="novo">Novo</SelectItem>
          <SelectItem value="renovacao">Renovação</SelectItem>
        </SelectContent>
      </Select>

      {activeCount > 0 && (
        <>
          <Badge variant="secondary">{activeCount} filtro(s) ativo(s)</Badge>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Limpar filtros
          </Button>
        </>
      )}
    </div>
  )
}
