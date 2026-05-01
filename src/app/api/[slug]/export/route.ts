import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import {
  ALLOWED_EXPORT_TYPES,
  isExecutiveRole,
  parseSelectedMonth,
  aggregateBrokerRanking,
  type AllowedExportType,
} from '@/lib/utils/dashboard-queries'

// Whitelists identicas as usadas nas listagens (T-06-22, T-06-23)
const ALLOWED_POLICY_TYPES = ['auto', 'vida', 'residencial', 'empresarial', 'saude', 'outros']
const ALLOWED_STATUSES = ['verde', 'amarelo', 'vermelho']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const typeRaw = searchParams.get('type') ?? ''

  // T-06-22: whitelist obrigatoria — rejeita qualquer tipo nao previsto
  if (!ALLOWED_EXPORT_TYPES.includes(typeRaw as AllowedExportType)) {
    return new Response('Invalid type', { status: 400 })
  }
  const type = typeRaw as AllowedExportType

  // Pitfall 4 (RESEARCH.md): createClient() acessa cookies automaticamente em Route Handlers Next.js 15
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const meta = (user.app_metadata as { slug?: string; role?: string }) ?? {}

  // T-06-21: cross-tenant check — usuario do tenant A nao pode acessar /api/B/export
  // CR-01 fix: require meta.slug to be present AND equal — absent slug is also denied
  if (!meta.slug || meta.slug !== slug) {
    return new Response('Forbidden', { status: 403 })
  }

  // T-06-20: RBAC — apenas admin e financeiro podem exportar
  if (!isExecutiveRole(meta.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  if (type === 'apolices') {
    return generateApolicesXlsx(supabase, searchParams)
  }
  if (type === 'clientes') {
    return generateClientesXlsx(supabase, searchParams)
  }
  if (type === 'comissoes') {
    return generateComissoesXlsx(supabase, searchParams)
  }

  // unreachable (whitelist garante que type e um dos 3 acima)
  return new Response('Invalid type', { status: 400 })
}

// ---------------------------------------------------------------------------
// generateApolicesXlsx — exporta tabela policies com filtros whitelisted
// ---------------------------------------------------------------------------

async function generateApolicesXlsx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sp: URLSearchParams,
): Promise<Response> {
  // Forward filtros whitelisted (T-06-23)
  // Nota: query param 'type' do handler e usado para routing (apolices/clientes/comissoes).
  // Filtro de tipo da apolice e passado como 'type_filter' para evitar colisao.
  let query = supabase
    .from('policies')
    .select(
      'id, policy_number, type, insurer, vigencia_fim, premio_total, client:clients(name), profile:profiles!assigned_to(full_name)',
    )
    .is('deleted_at', null)
    .order('vigencia_fim', { ascending: true })
    .limit(10000)

  const policyType = sp.get('type_filter')
  if (policyType && ALLOWED_POLICY_TYPES.includes(policyType)) {
    query = query.eq('type', policyType)
  }
  const insurer = sp.get('insurer')
  if (insurer) query = query.ilike('insurer', `%${insurer.slice(0, 100)}%`)
  const assignedTo = sp.get('assigned_to')
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  const statusParam = sp.get('status')
  if (statusParam && ALLOWED_STATUSES.includes(statusParam)) {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const plus30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const plus60 = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10)
    if (statusParam === 'vermelho') {
      query = query.lte('vigencia_fim', plus30)
    } else if (statusParam === 'amarelo') {
      query = query.gt('vigencia_fim', plus30).lte('vigencia_fim', plus60)
    } else if (statusParam === 'verde') {
      query = query.gt('vigencia_fim', plus60)
    }
    if (statusParam !== 'vermelho') {
      query = query.gte('vigencia_fim', todayStr)
    }
  }

  const { data, error } = await query
  // T-06-24: retornar mensagem generica sem detalhes internos
  if (error) return new Response('Failed to query policies', { status: 500 })

  type PolicyRow = {
    policy_number: string
    type: string
    insurer: string
    vigencia_fim: string
    premio_total: number | string
    client: { name: string } | null
    profile: { full_name: string } | null
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NEXUS AGENT'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Apolices')
  sheet.columns = [
    { header: 'Numero', key: 'policy_number', width: 20 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Seguradora', key: 'insurer', width: 25 },
    { header: 'Vigencia Fim', key: 'vigencia_fim', width: 15 },
    { header: 'Premio Total (BRL)', key: 'premio_total', width: 18 },
    { header: 'Cliente', key: 'client_name', width: 30 },
    { header: 'Corretor', key: 'corretor_name', width: 25 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const r of (data ?? []) as PolicyRow[]) {
    sheet.addRow({
      policy_number: r.policy_number,
      type: r.type,
      insurer: r.insurer,
      vigencia_fim: r.vigencia_fim,
      premio_total: Number(r.premio_total) || 0,
      client_name: r.client?.name ?? '',
      corretor_name: r.profile?.full_name ?? '',
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // T-06-26: Cache-Control no-store — CDN e browser nao cacheiam dados sensiveis
      'Content-Disposition': 'attachment; filename="apolices.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// generateClientesXlsx — exporta tabela clients com filtros whitelisted
// ---------------------------------------------------------------------------

async function generateClientesXlsx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sp: URLSearchParams,
): Promise<Response> {
  let query = supabase
    .from('clients')
    .select(
      'id, name, type, document, created_at, assigned_to:profiles!clients_assigned_to_fkey(full_name), stage:pipeline_stages(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10000)

  const q = sp.get('q')
  if (q) {
    // T-06-23: slice 100 chars + remover wildcards SQL LIKE (defesa em profundidade alem do RLS)
    const safeQ = q.slice(0, 100).replace(/[%_]/g, '')
    query = query.or(`name.ilike.%${safeQ}%,document.ilike.%${safeQ}%`)
  }
  const corretor = sp.get('corretor')
  if (corretor) query = query.eq('assigned_to', corretor)
  const stage = sp.get('stage')
  if (stage) query = query.eq('stage_id', stage)
  const typeFilter = sp.get('type_filter')
  if (typeFilter === 'pf' || typeFilter === 'pj') query = query.eq('type', typeFilter)

  const { data, error } = await query
  if (error) return new Response('Failed to query clients', { status: 500 })

  type ClientRow = {
    name: string
    type: string
    document: string
    created_at: string
    assigned_to: { full_name: string } | null
    stage: { name: string } | null
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NEXUS AGENT'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Clientes')
  sheet.columns = [
    { header: 'Nome', key: 'name', width: 30 },
    { header: 'Tipo', key: 'type', width: 8 },
    { header: 'Documento', key: 'document', width: 20 },
    { header: 'Corretor responsavel', key: 'corretor', width: 25 },
    { header: 'Estagio', key: 'stage', width: 18 },
    { header: 'Cadastrado em', key: 'created_at', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const r of (data ?? []) as ClientRow[]) {
    sheet.addRow({
      name: r.name,
      type: r.type?.toUpperCase() ?? '',
      document: r.document,
      corretor: r.assigned_to?.full_name ?? '',
      stage: r.stage?.name ?? '',
      created_at: r.created_at?.slice(0, 10) ?? '',
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="clientes.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// generateComissoesXlsx — exporta resumo de comissoes por corretor do mes
// ---------------------------------------------------------------------------

async function generateComissoesXlsx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sp: URLSearchParams,
): Promise<Response> {
  // WR-03 fix: use static import at top of file — removed dynamic import()
  // Pitfall 2 (RESEARCH.md): reference_month e DATE yyyy-MM-dd (primeiro dia do mes)
  const month = parseSelectedMonth(sp.get('month') ?? undefined)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'corretor')
    .order('full_name')
  const profilesArr = (profiles ?? []) as Array<{ id: string; full_name: string }>
  const profileIds = profilesArr.map((p) => p.id)

  if (profileIds.length === 0) {
    return emptyComissoesXlsx(month.monthValue)
  }

  const [commRes, prodRes] = await Promise.all([
    supabase
      .from('commission_entries')
      .select('broker_id, amount')
      .in('broker_id', profileIds)
      .eq('reference_month', month.monthStartStr), // Pitfall 2: DATE, primeiro dia do mes
    supabase
      .from('policies')
      .select('assigned_to')
      .in('assigned_to', profileIds)
      .gte('created_at', month.monthStartStr)
      .lte('created_at', month.monthEndStr + 'T23:59:59')
      .is('deleted_at', null),
  ])

  const commissions = (commRes.data ?? []) as Array<{ broker_id: string; amount: number | string }>
  const productions = (prodRes.data ?? []) as Array<{ assigned_to: string }>
  const rows = aggregateBrokerRanking(profilesArr, commissions, productions)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NEXUS AGENT'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Comissoes')
  sheet.columns = [
    { header: 'Corretor', key: 'fullName', width: 30 },
    { header: 'Producao do mes (#)', key: 'productionCount', width: 18 },
    { header: 'Comissao (BRL)', key: 'commissionTotal', width: 18 },
    { header: 'Mes de referencia', key: 'referenceMonth', width: 16 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const r of rows) {
    sheet.addRow({
      fullName: r.fullName,
      productionCount: r.productionCount,
      commissionTotal: r.commissionTotal,
      referenceMonth: month.monthValue,
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="comissoes-${month.monthValue}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}

// ---------------------------------------------------------------------------
// emptyComissoesXlsx — edge case: tenant sem nenhum corretor cadastrado
// ---------------------------------------------------------------------------

async function emptyComissoesXlsx(monthValue: string): Promise<Response> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Comissoes')
  sheet.columns = [
    { header: 'Corretor', key: 'fullName', width: 30 },
    { header: 'Producao do mes (#)', key: 'productionCount', width: 18 },
    { header: 'Comissao (BRL)', key: 'commissionTotal', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="comissoes-${monthValue}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
