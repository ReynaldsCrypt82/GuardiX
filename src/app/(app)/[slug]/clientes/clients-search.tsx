'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { resetPageOnFilterChange } from '@/lib/utils/clients-query'

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return ((...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export function ClientsSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const handleSearch = useCallback(
    debounce((value: string) => {
      const params = resetPageOnFilterChange(
        new URLSearchParams(searchParams.toString()),
        'q',
        value || null,
      )
      router.replace(`${pathname}?${params.toString()}`)
    }, 400),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, pathname],
  )

  return (
    <Input
      type="search"
      placeholder="Buscar por nome, CPF ou CNPJ..."
      defaultValue={searchParams.get('q') ?? ''}
      onChange={(e) => handleSearch(e.target.value)}
      className="max-w-sm"
    />
  )
}
