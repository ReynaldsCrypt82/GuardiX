import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  selected: string // YYYY-MM (ex: "2026-04")
}

export function MonthSelector({ selected }: Props) {
  // 12 ultimos meses + mes atual (13 opcoes)
  const today = startOfMonth(new Date())
  const options = Array.from({ length: 13 }, (_, i) => subMonths(today, i)).map((d) => ({
    value: format(d, 'yyyy-MM'),
    label: format(d, 'MMMM yyyy', { locale: ptBR }),
  }))

  return (
    <form method="get" className="flex justify-end">
      <select
        name="month"
        defaultValue={selected}
        className="rounded-md border px-3 py-1.5 text-sm bg-background"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="ml-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Aplicar
      </button>
    </form>
  )
}
