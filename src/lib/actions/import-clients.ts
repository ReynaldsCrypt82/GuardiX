'use server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'

export type ImportResult = {
  imported: number
  errors: Array<{ row: number; name: string; reason: string }>
}

function normalizeStr(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text).trim()
  return String(v).trim()
}

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells: string[] = []
    let inQuote = false
    let cell = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { cells.push(cell.trim()); cell = ''; continue }
      cell += ch
    }
    cells.push(cell.trim())
    rows.push(cells)
  }
  return rows
}

export async function importClientsFromExcel(
  formData: FormData,
): Promise<ImportResult | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const meta = user.app_metadata as { tenant_id?: string; role?: string }
  if (!meta.tenant_id) return { error: 'Tenant não encontrado' }
  if (meta.role !== 'admin' && meta.role !== 'financeiro')
    return { error: 'Apenas administradores podem importar clientes.' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Selecione um arquivo.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Arquivo muito grande (máx 10 MB).' }

  // ── Parse sheet ──────────────────────────────────────────────────────────
  type SheetRow = string[]
  let rows: SheetRow[] = []

  const buffer = Buffer.from(await file.arrayBuffer())
  const isCSV = file.name.toLowerCase().endsWith('.csv')

  if (isCSV) {
    const text = new TextDecoder('utf-8').decode(buffer)
    rows = parseCSVRows(text)
  } else {
    const workbook = new ExcelJS.Workbook()
    try {
      await workbook.xlsx.load(buffer)
    } catch {
      return { error: 'Não foi possível ler o arquivo. Use .xlsx ou .csv.' }
    }
    const sheet = workbook.worksheets[0]
    if (!sheet) return { error: 'Planilha vazia.' }
    sheet.eachRow((row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellText(cell)))
      rows.push(cells)
    })
  }

  if (rows.length < 2) return { error: 'Arquivo sem dados (mínimo: cabeçalho + 1 linha).' }

  // ── Map headers ──────────────────────────────────────────────────────────
  const headers = rows[0].map(normalizeStr)
  const col = (row: SheetRow, ...names: string[]) => {
    for (const name of names) {
      const idx = headers.indexOf(name)
      if (idx !== -1) return row[idx]?.trim() ?? ''
    }
    return ''
  }

  // ── Load corretores ──────────────────────────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['admin', 'corretor'])
    .eq('active', true)

  const corretorMap = new Map<string, string>()
  for (const p of profiles ?? []) {
    corretorMap.set(normalizeStr(p.full_name), p.id)
  }

  // ── First pipeline stage ─────────────────────────────────────────────────
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id')
    .is('deleted_at', null)
    .order('position')
    .limit(1)
  const firstStageId = stages?.[0]?.id ?? null

  // ── Process rows ─────────────────────────────────────────────────────────
  const errors: ImportResult['errors'] = []
  let imported = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    const nome = col(row, 'nome', 'name')
    if (!nome) continue

    // Tipo
    const tipoRaw = normalizeStr(col(row, 'tipo', 'type'))
    let tipo: 'pf' | 'pj' | null = null
    if (['pf', 'f', 'fisica', 'pessoa fisica', 'cpf'].some((v) => tipoRaw.includes(v))) tipo = 'pf'
    else if (['pj', 'j', 'juridica', 'pessoa juridica', 'cnpj'].some((v) => tipoRaw.includes(v)))
      tipo = 'pj'

    if (!tipo) {
      errors.push({ row: rowNum, name: nome, reason: 'Tipo inválido — use PF ou PJ' })
      continue
    }

    // Documento
    const docRaw = col(row, 'cpf/cnpj', 'cpf', 'cnpj', 'documento', 'document').replace(/\D/g, '')
    if (!docRaw || (docRaw.length !== 11 && docRaw.length !== 14)) {
      errors.push({ row: rowNum, name: nome, reason: 'CPF/CNPJ inválido (apenas dígitos, 11 ou 14)' })
      continue
    }

    // Corretor
    const corretorKey = normalizeStr(col(row, 'corretor', 'broker'))
    const assignedTo = corretorMap.get(corretorKey) ?? user.id

    const email = col(row, 'email') || null
    const phone = col(row, 'telefone', 'phone', 'fone', 'celular') || null
    const responsible = col(row, 'responsavel', 'responsável', 'contato') || null

    const { error } = await supabase.from('clients').insert({
      tenant_id: meta.tenant_id,
      name: nome,
      type: tipo,
      document: docRaw,
      email,
      phone,
      responsible,
      assigned_to: assignedTo,
      stage_id: firstStageId,
    })

    if (error) {
      const reason = error.code === '23505' ? 'CPF/CNPJ já cadastrado' : 'Erro ao salvar'
      errors.push({ row: rowNum, name: nome, reason })
    } else {
      imported++
    }
  }

  return { imported, errors }
}
