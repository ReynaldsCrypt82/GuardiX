---
phase: quick
plan: 260509-lcj
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260509_0025_clients_partner_id.sql
  - src/lib/validations/client-schemas.ts
  - src/lib/actions/clients.ts
  - src/app/(app)/[slug]/clientes/novo/page.tsx
  - src/app/(app)/[slug]/clientes/novo/new-client-form.tsx
  - src/app/(app)/[slug]/clientes/[id]/page.tsx
  - src/components/clientes/client-broker-selector.tsx
  - src/app/(app)/[slug]/corretores/page.tsx
autonomous: true
requirements: [UAT-01, UAT-02]

must_haves:
  truths:
    - "Coluna partner_id existe em clients com FK para partners ON DELETE SET NULL"
    - "Formulário de novo cliente exibe selector unificado (brokers internos + parceiros) sem quebrar clientes sem partner_id"
    - "Ficha do cliente mostra 'Parceiro: [nome]' quando partner_id preenchido, 'Corretor: [nome]' quando assigned_to preenchido"
    - "Página /corretores exibe seção 'Corretores Parceiros' listando parceiros com badge 'Parceiro Externo'"
    - "ClientBrokerSelector permite alterar corretor/parceiro e está desabilitado quando stage.name = 'Fechado'"
    - "updateClientBrokerAction retorna erro quando o cliente está no stage 'Fechado'"
  artifacts:
    - path: "supabase/migrations/20260509_0025_clients_partner_id.sql"
      provides: "ALTER TABLE clients ADD COLUMN partner_id + RLS update policy fix"
    - path: "src/lib/actions/clients.ts"
      provides: "updateClientBrokerAction Server Action"
    - path: "src/components/clientes/client-broker-selector.tsx"
      provides: "ClientBrokerSelector client component"
    - path: "src/lib/validations/client-schemas.ts"
      provides: "updateClientBrokerSchema Zod schema"
  key_links:
    - from: "ClientBrokerSelector"
      to: "updateClientBrokerAction"
      via: "server action call with { clientId, assignedTo?, partnerId?, slug }"
    - from: "updateClientBrokerAction"
      to: "pipeline_stages.name"
      via: "SELECT stage via clients.stage_id JOIN pipeline_stages — block if name = 'Fechado'"
    - from: "new-client-form.tsx"
      to: "createClientAction"
      via: "partner_id optional in FormData — action stores to clients.partner_id"
---

<objective>
Implementar Issues #1 e #2 do UAT: (1) partners aparecem na página /corretores e no formulário de novo cliente como opção de atribuição via partner_id; (2) troca de corretor/parceiro bloqueada quando o cliente está no stage "Fechado".

Purpose: Fechar dois gaps críticos do UAT que afetam o ciclo de vida do cliente — atribuição a parceiro externo e proteção contra reatribuição pós-fechamento.
Output: Migration SQL, Server Action, componente ClientBrokerSelector, form atualizado, ficha e página /corretores atualizados.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<interfaces>
<!-- Contratos existentes que o executor precisa — extraídos do codebase. -->

Da tabela clients (20260420_0006_clients_schema.sql):
```sql
assigned_to UUID NOT NULL REFERENCES public.profiles(id)
-- ATENÇÃO: a migration 0025 muda assigned_to para NULLABLE e adiciona partner_id
```

De src/lib/actions/clients.ts — createClientAction aceita FormData com:
```typescript
{ type, document, name, email?, phone?, assigned_to: string (UUID) }
// Após Task 1: assigned_to passa a ser opcional; partner_id UUID opcional adicionado
```

De src/lib/validations/client-schemas.ts:
```typescript
// baseFields atual — será atualizado em Task 1:
assigned_to: z.string().uuid('Corretor responsável obrigatório')
// Novo: assigned_to opcional ou partner_id obrigatório (um dos dois deve existir)
```

De src/app/(app)/[slug]/clientes/[id]/page.tsx — query atual:
```typescript
.select('*, stage:pipeline_stages(name, color), profile:profiles!assigned_to(full_name)')
// Após Task 3: adicionar partner:partners!partner_id(id, name) ao select
```

De src/app/(app)/[slug]/clientes/novo/page.tsx:
```typescript
// Passa corretores: Corretor[] para NewClientForm
// Após Task 2: também passa parceiros: Partner[] — buscados do supabase
```

De pipeline_stages — campo is_closed (BOOLEAN) já existe; Task 3 usa stage.name = 'Fechado'
(is_closed não é confiável para o lock — a spec do UAT pede comparação por name)
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Migration + validação + Server Action updateClientBrokerAction</name>
  <files>
    supabase/migrations/20260509_0025_clients_partner_id.sql,
    src/lib/validations/client-schemas.ts,
    src/lib/actions/clients.ts
  </files>
  <action>
**1a. Migration `supabase/migrations/20260509_0025_clients_partner_id.sql`:**

```sql
-- UAT Issue #1: adiciona partner_id em clients
-- UAT Issue #2: assigned_to torna-se nullable (cliente pode ser atribuído a parceiro)

ALTER TABLE public.clients
  ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

-- assigned_to pode ser NULL quando partner_id estiver preenchido
ALTER TABLE public.clients
  ALTER COLUMN assigned_to DROP NOT NULL;

-- Constraint: pelo menos um dos dois deve estar preenchido
ALTER TABLE public.clients
  ADD CONSTRAINT clients_broker_or_partner_check CHECK (
    assigned_to IS NOT NULL OR partner_id IS NOT NULL
  );

CREATE INDEX idx_clients_partner_id ON public.clients(partner_id) WHERE partner_id IS NOT NULL;

-- RLS clients_update: também permite update quando partner_id pertence ao tenant
-- (a policy existente usa assigned_to = auth.uid() para corretor — mantém,
--  pois corretor só opera sobre seus próprios clientes; admin pode atualizar qualquer um)
-- Nenhuma alteração na policy clients_update necessária — admin já cobre tudo,
-- corretor só atualiza seus próprios clientes (assigned_to = uid) que é o comportamento correto.
```

Aplicar via: `supabase db query --linked -f supabase/migrations/20260509_0025_clients_partner_id.sql`

**1b. Atualizar `src/lib/validations/client-schemas.ts`:**

Trocar o `baseFields` atual para permitir assigned_to opcional e partner_id opcional, com refinamento de que exatamente um deve estar presente:

```typescript
const baseFields = {
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  partner_id: z.string().uuid().optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
}
```

Adicionar ao final do arquivo o schema de atualização de corretor/parceiro:

```typescript
export const updateClientBrokerSchema = z.object({
  clientId: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
}).refine(
  (d) => d.assignedTo || d.partnerId,
  { message: 'Informe corretor ou parceiro', path: ['assignedTo'] }
)
export type UpdateClientBrokerInput = z.infer<typeof updateClientBrokerSchema>
```

Exportar `ClientFormError` (já existe) e o novo `UpdateClientBrokerInput`.

**1c. Atualizar `src/lib/actions/clients.ts` — dois pontos:**

(i) Em `createClientAction`: ajustar `base` para incluir `partner_id`:
```typescript
const base = {
  tenant_id: tenantId,
  type: parsed.data.type,
  document: strip(parsed.data.document),
  name: parsed.data.name,
  email: parsed.data.email || null,
  phone: parsed.data.phone || null,
  assigned_to: parsed.data.assigned_to || null,
  partner_id: (parsed.data as { partner_id?: string }).partner_id || null,
}
```

Remover a guard `role === 'corretor' && parsed.data.assigned_to !== user.id` — mantê-la apenas quando `assigned_to` estiver presente e o role for corretor.

(ii) Adicionar `updateClientBrokerAction` após `createClientAction`:

```typescript
export async function updateClientBrokerAction(input: {
  clientId: string
  assignedTo?: string
  partnerId?: string
  slug: string
}): Promise<{ error?: string }> {
  const parsed = updateClientBrokerSchema.safeParse({
    clientId: input.clientId,
    assignedTo: input.assignedTo,
    partnerId: input.partnerId,
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada' }

  const role = (user.app_metadata as { role?: string })?.role
  // Apenas admin pode alterar corretor/parceiro
  if (role !== 'admin') return { error: 'Apenas admin pode alterar corretor responsável' }

  // Buscar stage do cliente para verificar lock "Fechado"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data: clientRow } = await supabaseAny
    .from('clients')
    .select('stage_id, stage:pipeline_stages!stage_id(name)')
    .eq('id', parsed.data.clientId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!clientRow) return { error: 'Cliente não encontrado' }

  const stageName = clientRow.stage?.name as string | undefined
  if (stageName === 'Fechado') {
    return { error: 'Corretor não pode ser alterado após o cliente ser Fechado' }
  }

  const { error: updateError } = await supabaseAny
    .from('clients')
    .update({
      assigned_to: parsed.data.assignedTo ?? null,
      partner_id: parsed.data.partnerId ?? null,
    })
    .eq('id', parsed.data.clientId)
    .is('deleted_at', null)

  if (updateError) return { error: 'Erro ao atualizar corretor/parceiro' }

  revalidatePath(`/${input.slug}/clientes/${input.clientId}`)
  revalidatePath(`/${input.slug}/clientes`)
  return {}
}
```
  </action>
  <verify>
    TypeScript compila sem erros: `npx tsc --noEmit`
    Migration aplicada: confirmar com `supabase db query --linked "SELECT column_name FROM information_schema.columns WHERE table_name='clients' AND column_name='partner_id'"`
  </verify>
  <done>
    - `clients.partner_id` existe no banco (nullable UUID FK para partners)
    - `clients.assigned_to` aceita NULL
    - `createClientSchema` aceita partner_id opcional
    - `updateClientBrokerSchema` exportado
    - `updateClientBrokerAction` exportada com guard de stage "Fechado"
  </done>
</task>

<task type="auto">
  <name>Task 2: Formulário novo cliente com selector unificado + página /corretores com seção Parceiros</name>
  <files>
    src/app/(app)/[slug]/clientes/novo/page.tsx,
    src/app/(app)/[slug]/clientes/novo/new-client-form.tsx,
    src/app/(app)/[slug]/corretores/page.tsx
  </files>
  <action>
**2a. Atualizar `src/app/(app)/[slug]/clientes/novo/page.tsx`:**

Além dos corretores já carregados, buscar parceiros do tenant:

```typescript
const { data: parceiros } = await supabase
  .from('partners')
  .select('id, name')
  .is('deleted_at', null)
  .order('name')
```

Passar `parceiros={parceiros ?? []}` para `NewClientForm`.

**2b. Atualizar `src/app/(app)/[slug]/clientes/novo/new-client-form.tsx`:**

Adicionar interface:
```typescript
interface Partner { id: string; name: string }
```

Adicionar `parceiros: Partner[]` nos Props.

Substituir o campo "Corretor responsável" (FormField `assigned_to`) por um selector unificado com grupos:

```tsx
<FormField
  control={form.control}
  name="assigned_to"  // reutilizar field name mas lógica muda abaixo
  render={() => (
    <FormItem>
      <FormLabel>Corretor / Parceiro responsável<span className="ml-1 text-destructive">*</span></FormLabel>
      <Select
        disabled={lockAssignedToSelf}
        value={selectedAssignee}
        onValueChange={(val) => {
          // val = "broker:UUID" ou "partner:UUID"
          if (val.startsWith('broker:')) {
            const id = val.replace('broker:', '')
            form.setValue('assigned_to', id)
            form.setValue('partner_id' as keyof CreateClientInput, '')
            setSelectedAssignee(val)
          } else {
            const id = val.replace('partner:', '')
            form.setValue('assigned_to', '')
            form.setValue('partner_id' as keyof CreateClientInput, id)
            setSelectedAssignee(val)
          }
        }}
      >
        <FormControl><SelectTrigger><SelectValue placeholder="Selecione corretor ou parceiro" /></SelectTrigger></FormControl>
        <SelectContent>
          {corretores.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Corretores Internos</div>
              {corretores.map((c) => (
                <SelectItem key={c.id} value={`broker:${c.id}`}>{c.full_name ?? c.id}</SelectItem>
              ))}
            </>
          )}
          {parceiros.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Parceiros Externos</div>
              {parceiros.map((p) => (
                <SelectItem key={p.id} value={`partner:${p.id}`}>{p.name}</SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

Adicionar estado `selectedAssignee` inicializado como `defaultAssignedTo ? \`broker:${defaultAssignedTo}\` : ''`.

Manter `partner_id` como campo hidden no formulário (não visível — populado via setValue acima). Ajustar `onSubmit` para incluir `partner_id` no FormData quando presente:
```typescript
if (data.partner_id) fd.append('partner_id', data.partner_id)
```

O `createClientSchema` já aceita `partner_id` opcional após Task 1.

**2c. Atualizar `src/app/(app)/[slug]/corretores/page.tsx`:**

Após o bloco dos rows de corretores internos, adicionar busca de parceiros:

```typescript
const { data: partnerRows } = await supabase
  .from('partners')
  .select('id, name, contact_email, cnpj, commission_rate_default')
  .is('deleted_at', null)
  .order('name')
```

Após o componente `<BrokerListTable>` e paginação, adicionar seção de parceiros:

```tsx
{/* Corretores Parceiros */}
<div className="mt-8 space-y-4">
  <div>
    <h2 className="text-lg font-semibold">Corretores Parceiros</h2>
    <p className="text-sm text-muted-foreground">Parceiros externos cadastrados nesta corretora</p>
  </div>
  {(partnerRows ?? []).length === 0 ? (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">Nenhum parceiro externo cadastrado.</p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href={`/${slug}/parceiros`}>Gerenciar Parceiros</Link>
      </Button>
    </div>
  ) : (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Nome</th>
            <th className="px-4 py-3 text-left font-medium">CNPJ</th>
            <th className="px-4 py-3 text-left font-medium">E-mail</th>
            <th className="px-4 py-3 text-left font-medium">Taxa padrão</th>
            <th className="px-4 py-3 text-left font-medium">Tipo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(partnerRows ?? []).map((p: { id: string; name: string; contact_email: string | null; cnpj: string | null; commission_rate_default: number }) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.cnpj ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.contact_email ?? '—'}</td>
              <td className="px-4 py-3">{new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(p.commission_rate_default)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-blue-200 bg-blue-50 text-blue-700">Parceiro Externo</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```
  </action>
  <verify>
    1. Acessar /[slug]/clientes/novo: selector unificado exibe grupos "Corretores Internos" e "Parceiros Externos" (se existirem parceiros no tenant)
    2. Acessar /[slug]/corretores: seção "Corretores Parceiros" aparece abaixo da lista de corretores internos
    3. `npx tsc --noEmit` sem erros
  </verify>
  <done>
    - Selector unificado no formulário mostra brokers + parceiros com grupos visuais distintos
    - Selecionar parceiro: partner_id preenchido, assigned_to vazio
    - Selecionar broker: assigned_to preenchido, partner_id vazio
    - Página /corretores exibe seção "Corretores Parceiros" com badge "Parceiro Externo"
  </done>
</task>

<task type="auto">
  <name>Task 3: Ficha do cliente — exibir parceiro + ClientBrokerSelector com lock</name>
  <files>
    src/app/(app)/[slug]/clientes/[id]/page.tsx,
    src/components/clientes/client-broker-selector.tsx
  </files>
  <action>
**3a. Criar `src/components/clientes/client-broker-selector.tsx`:**

Client component que recebe dados atuais e lista de opções e chama `updateClientBrokerAction`:

```tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateClientBrokerAction } from '@/lib/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover'

interface Broker { id: string; full_name: string }
interface Partner { id: string; name: string }

interface Props {
  clientId: string
  slug: string
  currentAssignedTo: string | null
  currentPartnerId: string | null
  currentBrokerName: string | null
  currentPartnerName: string | null
  isClosed: boolean  // stage.name === 'Fechado'
  brokers: Broker[]
  partners: Partner[]
}

export function ClientBrokerSelector({
  clientId, slug,
  currentBrokerName, currentPartnerName,
  isClosed, brokers, partners,
  currentAssignedTo, currentPartnerId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>(
    currentAssignedTo ? `broker:${currentAssignedTo}` :
    currentPartnerId  ? `partner:${currentPartnerId}` : ''
  )
  const [isPending, setIsPending] = useState(false)

  const displayName = currentPartnerName
    ? `Parceiro: ${currentPartnerName}`
    : currentBrokerName
    ? `Corretor: ${currentBrokerName}`
    : 'Sem atribuição'

  async function handleSave() {
    setIsPending(true)
    const assignedTo = selected.startsWith('broker:') ? selected.replace('broker:', '') : undefined
    const partnerId  = selected.startsWith('partner:') ? selected.replace('partner:', '') : undefined
    const result = await updateClientBrokerAction({ clientId, assignedTo, partnerId, slug })
    setIsPending(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Corretor/parceiro atualizado.')
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{displayName}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isClosed}
            title={isClosed ? 'Bloqueado: cliente Fechado' : 'Alterar corretor/parceiro'}
          >
            {isClosed ? 'Bloqueado' : 'Alterar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="start">
          <p className="text-sm font-medium">Alterar corretor/parceiro</p>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {brokers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Corretores Internos</div>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={`broker:${b.id}`}>{b.full_name}</SelectItem>
                  ))}
                </>
              )}
              {partners.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Parceiros Externos</div>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={`partner:${p.id}`}>{p.name}</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending || !selected}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

**3b. Atualizar `src/app/(app)/[slug]/clientes/[id]/page.tsx`:**

(i) Atualizar a query de `client` para incluir parceiro:
```typescript
const { data: client } = await supabase
  .from('clients')
  .select(
    '*, stage:pipeline_stages(name, color), profile:profiles!assigned_to(full_name), partner:partners!partner_id(id, name)',
  )
  .eq('id', clientId)
  .is('deleted_at', null)
  .single()
```

(ii) Buscar brokers e partners para o selector (apenas quando `canEdit`):
```typescript
const { data: availableBrokers } = canEdit
  ? await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'corretor'])
      .eq('active', true)
      .is('deleted_at', null)
      .order('full_name')
  : { data: [] }

const { data: availablePartners } = canEdit
  ? await supabase
      .from('partners')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
  : { data: [] }
```

(iii) No header do Card, substituir o bloco:
```tsx
{client.profile?.full_name && (
  <span>Corretor: {client.profile.full_name}</span>
)}
```

por:
```tsx
{canEdit ? (
  <ClientBrokerSelector
    clientId={clientId}
    slug={slug}
    currentAssignedTo={client.assigned_to ?? null}
    currentPartnerId={client.partner_id ?? null}
    currentBrokerName={client.profile?.full_name ?? null}
    currentPartnerName={client.partner?.name ?? null}
    isClosed={client.stage?.name === 'Fechado'}
    brokers={(availableBrokers ?? []) as { id: string; full_name: string }[]}
    partners={(availablePartners ?? []) as { id: string; name: string }[]}
  />
) : (
  <span className="text-sm text-muted-foreground">
    {client.partner?.name
      ? `Parceiro: ${client.partner.name}`
      : client.profile?.full_name
      ? `Corretor: ${client.profile.full_name}`
      : null}
  </span>
)}
```

Adicionar import do ClientBrokerSelector no topo do arquivo:
```typescript
import { ClientBrokerSelector } from '@/components/clientes/client-broker-selector'
```
  </action>
  <verify>
    1. Ficha de cliente com partner_id: exibe "Parceiro: [nome]" no header
    2. Ficha de cliente com assigned_to: exibe "Corretor: [nome]" + botão "Alterar"
    3. Cliente no stage "Fechado": botão mostra "Bloqueado" e está disabled
    4. Clicar "Alterar" em cliente não-fechado: abre popover com selector broker/parceiro, salva e atualiza
    5. `npx tsc --noEmit` sem erros
  </verify>
  <done>
    - Ficha exibe corretor OU parceiro no header
    - ClientBrokerSelector abre popover para reatribuição
    - Botão desabilitado + tooltip "Bloqueado: cliente Fechado" quando stage.name = 'Fechado'
    - updateClientBrokerAction bloqueia no servidor (guard dupla: componente + action)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | updateClientBrokerAction recebe clientId + assignedTo/partnerId não verificados |
| RLS | assigned_to e partner_id devem pertencer ao mesmo tenant |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lcj-01 | Tampering | updateClientBrokerAction | mitigate | Zod valida UUIDs antes de qualquer DB call; RLS clients_update bloqueia update fora do tenant |
| T-lcj-02 | Elevation of Privilege | updateClientBrokerAction | mitigate | Guard `role !== 'admin'` retorna erro antes de qualquer leitura do banco |
| T-lcj-03 | Tampering | stage lock bypass | mitigate | Guard de stage verificado server-side na action; componente desabilitado é apenas UX defense |
| T-lcj-04 | Tampering | partner_id de outro tenant | accept | RLS SELECT em partners filtra por tenant_id — insert de partner_id inválido retorna violação FK ou null na query de verificação |
</threat_model>

<verification>
Após as 3 tasks:
1. `npx tsc --noEmit` — zero erros TypeScript
2. `npx next build` — build production sem erros
3. Verificação manual: criar cliente com parceiro, conferir ficha, tentar alterar em stage "Fechado"
</verification>

<success_criteria>
- Migration 20260509_0025 aplicada: `clients.partner_id` existe, `assigned_to` nullable, constraint broker_or_partner ativa
- Formulário /clientes/novo: selector unificado com grupos visuais; cliente salvo com partner_id quando parceiro selecionado
- Página /corretores: seção "Corretores Parceiros" visível com badge "Parceiro Externo"
- Ficha /clientes/[id]: exibe "Parceiro: X" ou "Corretor: X"; botão "Alterar" funcional
- Stage "Fechado": botão "Bloqueado" (disabled) na ficha; action retorna erro "Corretor não pode ser alterado após o cliente ser Fechado"
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260509-lcj-partners-em-corretores-e-troca-de-corret/260509-lcj-SUMMARY.md` com:
- Tasks concluídas
- Arquivos criados/modificados
- Migration aplicada
- Decisões tomadas
- Problemas encontrados
</output>
