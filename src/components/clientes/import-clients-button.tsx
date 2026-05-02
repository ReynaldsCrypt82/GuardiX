'use client'
import { useRef, useState } from 'react'
import { Upload, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { importClientsFromExcel, type ImportResult } from '@/lib/actions/import-clients'

export function ImportClientsButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const rows = [
      ['Nome', 'Tipo', 'CPF/CNPJ', 'Email', 'Telefone', 'Responsável', 'Corretor'],
      ['João da Silva', 'PF', '12345678901', 'joao@email.com', '11999999999', '', 'Nome Completo do Corretor'],
      ['Empresa Exemplo Ltda', 'PJ', '12345678000195', 'contato@empresa.com', '1133334444', 'Maria Financeiro', 'Nome Completo do Corretor'],
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-clientes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await importClientsFromExcel(fd)
    setLoading(false)
    if ('error' in res) {
      alert(res.error)
    } else {
      setResult(res)
    }
  }

  function reset() {
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    setOpen(false)
    setTimeout(reset, 300)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload size={15} className="mr-2" />
        Importar Excel
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar clientes via planilha</DialogTitle>
            <DialogDescription>
              Todos os clientes importados entram como novo lead na primeira etapa do pipeline.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
                <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {result.imported} cliente(s) importado(s) com sucesso
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                    <XCircle size={14} />
                    {result.errors.length} linha(s) com erro
                  </p>
                  <div className="max-h-52 divide-y overflow-y-auto rounded-lg border text-sm">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="truncate font-medium">{err.name || `Linha ${err.row}`}</span>
                        <span className="shrink-0 text-muted-foreground">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Fechar</Button>
                <Button onClick={reset}>Importar outro arquivo</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div className="space-y-1.5 text-sm">
                  <p className="font-medium">Colunas esperadas na primeira linha:</p>
                  <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                    Nome · Tipo · CPF/CNPJ · Email · Telefone · Responsável · Corretor
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• <strong>Tipo:</strong> escreva <code>PF</code> ou <code>PJ</code></li>
                    <li>• <strong>CPF/CNPJ:</strong> só dígitos (sem pontos ou traços)</li>
                    <li>• <strong>Corretor:</strong> nome completo conforme cadastrado no sistema</li>
                  </ul>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                  <Download size={13} className="mr-1.5" />
                  Baixar template (.csv)
                </Button>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                required
                className="block w-full cursor-pointer text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
                  {loading ? 'Importando…' : 'Importar'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
