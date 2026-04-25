# Phase 3: Seguros & Consórcio — Research

**Researched:** 2026-04-25
**Domain:** Insurance policy management, consortium quota management, PostgreSQL JSONB schema design, RLS multi-role access control
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tabela `policies` com colunas core + coluna JSONB `type_data` para campos específicos por tipo. Formulário dinâmico com seção condicional conforme tipo selecionado (Auto, Vida, Residencial, Empresarial, Saúde, Outros).
- **D-02:** Dois pontos de entrada — listagem global `/[slug]/seguros` e `/[slug]/consorcio` + abas "Apólices" e "Consórcio" na tela de detalhes do cliente.
- **D-03:** Semáforo de vigência calculado em runtime a partir de `vigencia_fim`: verde >60d, amarelo ≤60d e >30d, vermelho ≤30d ou vencida. Sem campo de status armazenado.
- **D-04:** Duas tabelas de consórcio: `consortium_groups` (administradora, tipo, crédito, prazo, next_assembly_date) + `consortium_quotas` (group_id, client_id, número, status, parcela, data_contemplacao, post_contemplation_notes).
- **D-05:** Sinistros e endossos como registros simples vinculados à apólice. Sem upload de arquivos em v1.
- **D-06:** Alertas apenas in-app: badge de contador no menu + toast ao abrir o sistema. Email em Phase 7.
- **RBAC (herda Phase 1 D-11):** Admin e Financeiro veem tudo; Corretor vê apenas seus registros (`assigned_to = auth.uid()`); Visualizador vê tudo, sem criar/editar.
- **Soft delete obrigatório (herda Phase 1 D-12):** `deleted_at TIMESTAMPTZ` em todas as tabelas novas.

### Claude's Discretion

- Apresentação visual da seção "Produtos" na sidebar (itens diretos vs sub-menu agrupado).
- Ordenação default das listagens (por vigência mais próxima ou por data de cadastro).
- Cores e ícones por tipo de seguro nas listagens.
- Número de colunas visíveis por default na listagem de apólices vs colunas visíveis em tela menor.

### Deferred Ideas (OUT OF SCOPE)

- Upload de documentos de apólice/sinistro/contemplação.
- Gestão completa de sinistros (regulação, perícia, valor indenizado).
- Email automático de vencimento e assembleia (Phase 7).
- Histórico de parcelas pagas do consórcio (Phase 5).
- Registro individual de cada assembleia com resultado/lance/sorteio.
- Integração com APIs das seguradoras (SUSEP).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEG-01 | Cadastrar apólice com número, seguradora, tipo, vigência, prêmio e corretor | Schema `policies` com JSONB `type_data` + `createPolicyAction` com `discriminatedUnion` |
| SEG-02 | Semáforo visual (verde/amarelo/vermelho) conforme status de vigência | Função utilitária `getVigenciaStatus(vigencia_fim)` calculada em runtime — reutiliza `Badge` do shadcn |
| SEG-03 | Alerta de vencimento X dias antes (in-app) | Query `policies WHERE vigencia_fim <= NOW() + 30 days` + badge contador na sidebar |
| SEG-04 | Registrar sinistro com data, tipo e protocolo vinculado à apólice | Tabela `claims` + `createClaimAction` |
| SEG-05 | Registrar endosso vinculado à apólice original | Tabela `endorsements` + `createEndorsementAction` |
| SEG-06 | Filtrar apólices por tipo, seguradora, corretor e status de vigência | URL state via searchParams + `buildPoliciesQuery` helper |
| SEG-07 | Apólice vinculada ao cliente e ao corretor responsável | FKs `client_id` e `assigned_to` na tabela `policies` |
| CON-01 | Cadastrar grupo de consórcio com administradora, tipo, prazo e crédito | Tabela `consortium_groups` + `createGroupAction` |
| CON-02 | Cadastrar cota de consórcio vinculada a cliente | Tabela `consortium_quotas` + `createQuotaAction` |
| CON-03 | Registrar contemplado com tipo (sorteio/lance) e valor do lance | Campo `contemplation_type` + `lance_value` na tabela `consortium_quotas` |
| CON-04 | Pipeline pós-contemplação: aguardando docs → em análise → crédito liberado | Campo `post_contemplation_stage` enum ou `post_contemplation_notes` (D-04 locked) |
| CON-05 | Alerta 3 dias antes da data de assembleia (in-app) | Query `consortium_groups WHERE next_assembly_date <= NOW() + 3 days` + badge |
| CON-06 | Filtrar cotas por status e administradora | URL state via searchParams + query filter |

</phase_requirements>

---

## Summary

A Phase 3 entrega dois módulos de produto vinculados aos clientes da Phase 2: gestão de apólices de seguros e gestão de cotas de consórcio. O padrão arquitectural está totalmente definido pelas fases anteriores — o trabalho é extensão, não invenção. O padrão de Server Action com Zod + guard de role + RLS do `clients.ts` se replica exatamente para `policies`, `claims`, `endorsements`, `consortium_groups` e `consortium_quotas`.

O desafio técnico central é o schema JSONB para `type_data` da tabela `policies`. A decisão D-01 é adequada: schema fixo para campos comuns, JSONB para campos específicos por tipo, com `z.discriminatedUnion` no Zod para validação type-safe. O mesmo padrão já existe no projeto (toggle PF/PJ dos clientes usa `discriminatedUnion`).

A segunda complexidade é o semáforo de vigência calculado em runtime. É uma função utilitária pura (`getVigenciaStatus(vigencia_fim: string): 'verde' | 'amarelo' | 'vermelho'`) que retorna um dos três estados com base em `differenceInDays` do `date-fns`. Deve ser testada unitariamente.

**Primary recommendation:** Estruturar a Phase 3 em 4 planos paralelos — (1) Schema e RLS, (2) módulo Seguros + UI listagem, (3) módulo Consórcio + UI listagem, (4) Abas nas telas de cliente + alertas in-app. Planos 2 e 3 podem rodar em paralelo após o plano 1.

---

## Standard Stack

### Core (já instalado no projeto)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.3.x | Framework full-stack | Locked em CLAUDE.md |
| Supabase JS | 2.104.x | Database + Auth client | Locked em CLAUDE.md |
| Zod | 3.25.x | Schema validation (client + server) | Padrão estabelecido na Phase 1 e 2 |
| React Hook Form | 7.73.x | Formulário dinâmico de apólice | Padrão estabelecido na Phase 2 |
| shadcn/ui (Badge, Dialog, Tabs, Table) | latest | UI components | Padrão estabelecido |
| date-fns | 4.1.x | `differenceInDays` para semáforo de vigência | Já instalado; pt-BR locale |
| sonner | 2.0.x | Toast para alertas in-app | Já instalado (usado nas fases anteriores) |
| lucide-react | 1.8.x | Ícones por tipo de seguro (Car, Heart, Home, Building, etc.) | Já instalado |

[VERIFIED: package.json do projeto]

### Sem Dependências Novas

Toda a stack necessária para a Phase 3 já está instalada. Nenhuma instalação de pacote é necessária.

[VERIFIED: package.json — todas as bibliotecas verificadas acima estão presentes]

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(app)/[slug]/
│   ├── seguros/
│   │   ├── page.tsx                    # Server Component — listagem global de apólices
│   │   ├── nova/
│   │   │   └── page.tsx                # formulário dinâmico nova apólice
│   │   └── [id]/
│   │       └── page.tsx                # detalhes + sinistros/endossos da apólice
│   └── consorcio/
│       ├── page.tsx                    # Server Component — listagem grupos + cotas
│       ├── grupos/novo/page.tsx        # formulário novo grupo
│       └── [id]/page.tsx               # detalhes do grupo + cotas
├── components/
│   ├── seguros/
│   │   ├── policy-form.tsx             # Client Component — formulário dinâmico com campos por tipo
│   │   ├── policy-table.tsx            # tabela paginada com semáforo
│   │   ├── vigencia-badge.tsx          # semáforo visual (verde/amarelo/vermelho)
│   │   ├── claim-dialog.tsx            # dialog registro de sinistro
│   │   └── endorsement-dialog.tsx      # dialog registro de endosso
│   └── consorcio/
│       ├── group-form.tsx              # Client Component — formulário novo grupo
│       ├── quota-form.tsx              # Client Component — formulário nova cota
│       ├── quota-table.tsx             # tabela cotas com filtros
│       └── contemplation-dialog.tsx    # dialog registro de contemplação
├── lib/
│   ├── actions/
│   │   ├── policies.ts                 # createPolicy, updatePolicy, softDeletePolicy
│   │   ├── claims.ts                   # createClaim
│   │   ├── endorsements.ts             # createEndorsement
│   │   ├── consortium-groups.ts        # createGroup, updateGroup
│   │   └── consortium-quotas.ts        # createQuota, updateQuota (contemplação)
│   ├── validations/
│   │   ├── policy-schemas.ts           # discriminatedUnion por tipo de seguro
│   │   ├── claim-schemas.ts
│   │   ├── endorsement-schemas.ts
│   │   └── consortium-schemas.ts
│   └── utils/
│       └── vigencia.ts                 # getVigenciaStatus(vigencia_fim) — função pura testável
supabase/migrations/
│   ├── 20260420_0011_seguros_schema.sql
│   ├── 20260420_0012_seguros_rls.sql
│   ├── 20260420_0013_consorcio_schema.sql
│   └── 20260420_0014_consorcio_rls.sql
tests/
│   ├── utils/vigencia.test.ts          # testes unitários do semáforo
│   ├── actions/policies.test.ts        # testes createPolicy (Zod + guards)
│   ├── actions/claims.test.ts          # testes createClaim
│   ├── actions/consortium.test.ts      # testes createGroup + createQuota
│   └── db/rls-seguros.test.ts          # stubs de isolamento RLS (todo)
```

### Pattern 1: Schema SQL das Novas Tabelas

**O que é:** Extensão do schema com 5 novas tabelas seguindo o padrão das migrations existentes.
**Quando usar:** Primeiro plano da phase (Wave 0 do schema).

```sql
-- Source: padrão estabelecido em 20260420_0006_clients_schema.sql

-- policies: campo JSONB type_data para campos específicos por tipo (D-01)
CREATE TABLE public.policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  policy_number   TEXT NOT NULL,
  insurer         TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('auto','vida','residencial','empresarial','saude','outros')),
  vigencia_inicio DATE NOT NULL,
  vigencia_fim    DATE NOT NULL,
  premio_total    NUMERIC(12,2) NOT NULL CHECK (premio_total >= 0),
  client_id       UUID NOT NULL REFERENCES public.clients(id),
  assigned_to     UUID NOT NULL REFERENCES public.profiles(id),
  type_data       JSONB NOT NULL DEFAULT '{}',
  observacoes     TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT policies_number_tenant_unique UNIQUE (tenant_id, policy_number)
);

CREATE INDEX idx_policies_tenant_id   ON public.policies(tenant_id);
CREATE INDEX idx_policies_client_id   ON public.policies(client_id);
CREATE INDEX idx_policies_assigned_to ON public.policies(assigned_to);
CREATE INDEX idx_policies_vigencia_fim ON public.policies(vigencia_fim);
CREATE INDEX idx_policies_type        ON public.policies(type);
CREATE INDEX idx_policies_deleted_at  ON public.policies(deleted_at) WHERE deleted_at IS NULL;
```

```sql
-- claims (sinistros)
CREATE TABLE public.claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id),
  policy_id      UUID NOT NULL REFERENCES public.policies(id),
  claim_date     DATE NOT NULL,
  type           TEXT NOT NULL,
  protocol_number TEXT,
  status         TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','encerrado')),
  description    TEXT NOT NULL,
  created_by     UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- endorsements (endossos)
CREATE TABLE public.endorsements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  policy_id       UUID NOT NULL REFERENCES public.policies(id),
  endorsement_date DATE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('inclusao','exclusao','alteracao')),
  description     TEXT NOT NULL,
  premium_impact  NUMERIC(12,2),
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- consortium_groups
CREATE TABLE public.consortium_groups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id),
  administrator       TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('auto','imovel','servico')),
  credit_value        NUMERIC(14,2) NOT NULL CHECK (credit_value > 0),
  term_months         INTEGER NOT NULL CHECK (term_months > 0),
  start_date          DATE NOT NULL,
  total_quotas        INTEGER NOT NULL CHECK (total_quotas > 0),
  next_assembly_date  DATE,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- consortium_quotas
CREATE TABLE public.consortium_quotas (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES public.tenants(id),
  group_id                  UUID NOT NULL REFERENCES public.consortium_groups(id),
  client_id                 UUID NOT NULL REFERENCES public.clients(id),
  quota_number              TEXT NOT NULL,
  monthly_payment           NUMERIC(12,2) NOT NULL CHECK (monthly_payment >= 0),
  status                    TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','contemplado','cancelado')),
  contemplation_date        DATE,
  contemplation_type        TEXT CHECK (contemplation_type IN ('sorteio','lance')),
  lance_value               NUMERIC(14,2),
  post_contemplation_notes  TEXT,
  assigned_to               UUID NOT NULL REFERENCES public.profiles(id),
  deleted_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quotas_number_group_unique UNIQUE (group_id, quota_number)
);
```

### Pattern 2: Zod `discriminatedUnion` para Formulário Dinâmico de Apólice

**O que é:** Schema Zod com campos obrigatórios core + campos opcionais específicos por tipo, compartilhado entre cliente e Server Action. Padrão já estabelecido no projeto para PF/PJ.
**Quando usar:** `policy-schemas.ts` + `createPolicyAction`.

```typescript
// Source: padrão de src/lib/validations/client-schemas.ts (mesmo projeto)
// Adaptado para apólices com discriminatedUnion por tipo

import { z } from 'zod'

const coreFields = {
  policy_number: z.string().min(1, 'Número obrigatório'),
  insurer: z.string().min(2, 'Seguradora obrigatória'),
  vigencia_inicio: z.string().date('Data de início inválida'),
  vigencia_fim: z.string().date('Data de fim inválida'),
  premio_total: z.coerce.number().min(0, 'Prêmio inválido'),
  client_id: z.string().uuid('Cliente obrigatório'),
  assigned_to: z.string().uuid('Corretor obrigatório'),
  observacoes: z.string().optional(),
}

export const createPolicySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auto'), ...coreFields,
    placa: z.string().min(7, 'Placa obrigatória'),
    chassi: z.string().optional(),
    marca_modelo: z.string().min(2, 'Marca/modelo obrigatório'),
    ano: z.coerce.number().int().min(1900).max(2100),
    valor_fipe: z.coerce.number().min(0),
    cobertura: z.enum(['basica','compreensiva']),
  }),
  z.object({ type: z.literal('vida'), ...coreFields,
    valor_assegurado: z.coerce.number().min(0),
    // beneficiários como array no JSONB — serializado antes de enviar
    beneficiarios: z.string().optional(), // JSON string no FormData
  }),
  z.object({ type: z.literal('residencial'), ...coreFields,
    endereco_imovel: z.string().min(5),
    valor_imovel: z.coerce.number().min(0),
    tipo_imovel: z.enum(['proprio','alugado']),
    cobertura: z.string().optional(),
  }),
  z.object({ type: z.literal('empresarial'), ...coreFields,
    cnpj_risco: z.string().refine(v => validateCNPJ(v), 'CNPJ inválido'),
    endereco_empresa: z.string().min(5),
    tipo_atividade: z.string().min(2),
    valor_patrimonial: z.coerce.number().min(0),
  }),
  z.object({ type: z.literal('saude'), ...coreFields,
    operadora: z.string().min(2),
    numero_carteirinha: z.string().min(1),
    acomodacao: z.enum(['enfermaria','apartamento']),
    dependentes: z.string().optional(), // JSON string no FormData
  }),
  z.object({ type: z.literal('outros'), ...coreFields }),
])

export type CreatePolicyInput = z.infer<typeof createPolicySchema>
```

**Nota de implementação:** Os campos específicos por tipo são extraídos no Server Action e inseridos no JSONB `type_data`, excluindo os campos core.

### Pattern 3: Função Utilitária `getVigenciaStatus` (Semáforo — D-03)

**O que é:** Função pura que recebe `vigencia_fim` (string ISO date) e retorna um dos três estados. Calculada em runtime no Server Component ao renderizar a tabela. Testável unitariamente.
**Quando usar:** Em `vigencia-badge.tsx` e em qualquer listagem que exibe o semáforo.

```typescript
// Source: decisão D-03 do CONTEXT.md + date-fns já instalado
import { differenceInDays, parseISO, startOfToday } from 'date-fns'

export type VigenciaStatus = 'verde' | 'amarelo' | 'vermelho'

export function getVigenciaStatus(vigencia_fim: string): VigenciaStatus {
  const today = startOfToday()
  const end = parseISO(vigencia_fim)
  const daysLeft = differenceInDays(end, today)
  if (daysLeft > 60) return 'verde'
  if (daysLeft > 30) return 'amarelo'
  return 'vermelho'  // inclui vencidas (daysLeft <= 0)
}
```

**Cores do Badge por status:**
- Verde: `bg-green-100 text-green-800` (shadcn Badge variant ou className direto)
- Amarelo: `bg-yellow-100 text-yellow-800`
- Vermelho: `bg-red-100 text-red-800`

### Pattern 4: RLS para `policies` — Regras RBAC

**O que é:** Mesma estrutura das policies de `clients`, com a distinção de que `policies.assigned_to` controla o escopo do corretor.

```sql
-- Source: padrão estabelecido em 20260420_0007_clients_rls.sql (mesmo projeto)
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_select" ON public.policies
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro','visualizador')
      OR assigned_to = (SELECT auth.uid())
    )
  );

CREATE POLICY "policies_insert" ON public.policies
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

CREATE POLICY "policies_update" ON public.policies
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND assigned_to = (SELECT auth.uid())
      )
    )
  );
```

**`claims` e `endorsements`:** Policy SELECT herdada via policy na `policies` que os referencia — mas o Supabase exige policies próprias por tabela. Claims/endorsements seguem o mesmo padrão de `tenant_id = jwt_tenant_id()` mais join com a policy da apólice (verificar que a apólice pertence ao tenant é suficiente).

**`consortium_groups` e `consortium_quotas`:** Mesmo padrão. `consortium_quotas.assigned_to` controla o escopo do corretor.

### Pattern 5: Server Action para `createPolicyAction`

**O que é:** Replica exatamente o padrão de `createClientAction` com Zod safeParse + guard de role + extração de JSONB.

```typescript
// Source: padrão de src/lib/actions/clients.ts (mesmo projeto)
'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPolicySchema } from '@/lib/validations/policy-schemas'

export async function createPolicyAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  const parsed = createPolicySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor' && parsed.data.assigned_to !== user.id) {
    return { error: { assigned_to: ['Corretor só pode registrar apólice em seu próprio nome.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant não identificado.'] } }

  // Separar campos core dos campos específicos por tipo → type_data JSONB
  const { type, policy_number, insurer, vigencia_inicio, vigencia_fim,
          premio_total, client_id, assigned_to, observacoes, ...typeSpecific } = parsed.data

  const { data, error } = await supabase
    .from('policies')
    .insert({
      tenant_id: tenantId,
      type, policy_number, insurer, vigencia_inicio, vigencia_fim,
      premio_total, client_id, assigned_to, observacoes: observacoes || null,
      type_data: Object.keys(typeSpecific).length > 0 ? typeSpecific : {},
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { error: { policy_number: ['Número de apólice já cadastrado nesta corretora.'] } }
    }
    return { error: { _form: ['Erro ao salvar apólice.'] } }
  }

  revalidatePath(`/${slug}/seguros`)
  revalidatePath(`/${slug}/clientes/${client_id}`)
  return { id: data.id }
}
```

### Pattern 6: Alerta In-App (Semáforo Badge + Toast)

**O que é:** Duas queries executadas no Server Component do layout para contar alertas pendentes. Resultado passado para o `SidebarShell` como props. Mesmo padrão da Phase 2 (tasks vencendo).

```typescript
// Source: padrão estabelecido em Phase 2 (D-15 do 02-CONTEXT.md)
// Em src/app/(app)/[slug]/layout.tsx — Server Component
const today = new Date().toISOString().split('T')[0]
const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString().split('T')[0]

// Apólices vencendo/vencidas (vermelho)
const { count: policiesAlert } = await supabase
  .from('policies')
  .select('id', { count: 'exact', head: true })
  .lte('vigencia_fim', thirtyDaysLater)
  .is('deleted_at', null)

// Assembleias em 3 dias
const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  .toISOString().split('T')[0]
const { count: assemblyAlert } = await supabase
  .from('consortium_groups')
  .select('id', { count: 'exact', head: true })
  .gte('next_assembly_date', today)
  .lte('next_assembly_date', threeDaysLater)
  .is('deleted_at', null)
```

### Anti-Patterns to Avoid

- **Status de vigência armazenado no banco:** D-03 proíbe campo `status` persistido para apólices — sempre calcular em runtime para evitar dessincronização. O banco armazena apenas `vigencia_fim`.
- **Usar `user_metadata` para tenant_id/role:** D-17 da Phase 1 proíbe — usar exclusivamente `app_metadata` (imutável pelo usuário).
- **DELETE físico:** Padrão D-12 da Phase 1 — todas as tabelas novas recebem trigger `prevent_hard_delete()`.
- **Expor `SUPABASE_SERVICE_ROLE_KEY` no cliente:** D-20 da Phase 1 — uso exclusivo em Server Actions/Edge Functions.
- **JSONB sem índice:** Não criar índice GIN em `type_data` em v1 — queries de filtro não pesquisam dentro do JSONB, apenas os campos core. Adicionar GIN apenas em Phase 6 se necessário para relatórios.
- **Query sem (SELECT ...) em RLS:** Padrão da Phase 1/2 — toda chamada de função nas RLS policies deve ser envolvida em `(SELECT ...)` para caching do query plan.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validação CNPJ de beneficiários PJ | Custom regex | `validateCNPJ` de `src/lib/validations/cnpj.ts` | Já existe, testado |
| Cálculo de dias entre datas | Aritmética manual com timestamps | `differenceInDays` do `date-fns` | Trata DST, timezones, fuso pt-BR corretamente |
| Toast de alerta in-app | Custom toast component | `sonner` já instalado | Padrão estabelecido no projeto |
| Formulário com campos condicionais | State manual com useState | `React Hook Form` + `watch('type')` | Já instalado, evita re-renders desnecessários |
| Geração de UUID para FK | Custom ID | `gen_random_uuid()` no PostgreSQL (DEFAULT) | Padrão do projeto |
| Paginação de tabelas | Custom offset/limit | Padrão URL searchParams + `.range()` do Supabase | Padrão estabelecido na Phase 2 |
| Ícones por tipo de seguro | SVGs custom | `lucide-react` (Car, Heart, Home, Building2, HeartPulse, Shield) | Já instalado |

**Key insight:** Esta phase é 90% replicação do padrão estabelecido nas Phases 1 e 2. Nenhuma dependência nova é necessária. O único código genuinamente novo é `getVigenciaStatus` e o formulário dinâmico de apólice.

---

## Common Pitfalls

### Pitfall 1: JSONB `type_data` sem Desestruturação Correta no Server Action
**What goes wrong:** O Server Action recebe todos os campos do FormData misturados (core + type-specific). Se o planner não separar explicitamente os campos core dos campos do JSONB, o `insert` pode tentar colocar campos inválidos nas colunas da tabela.
**Why it happens:** `discriminatedUnion` do Zod retorna um objeto plano — os campos específicos por tipo ficam no mesmo nível dos campos core.
**How to avoid:** Desestruturar explicitamente todos os campos core e usar o spread `...typeSpecific` para o JSONB (ver Pattern 5 acima).
**Warning signs:** Erro Supabase `"column X of relation policies does not exist"` no insert.

### Pitfall 2: Campos `DATE` vs `TIMESTAMPTZ` para Vigência
**What goes wrong:** Usar `TIMESTAMPTZ` para `vigencia_inicio`/`vigencia_fim` pode causar problemas de timezone — uma vigência "2026-12-31" pode aparecer como "2026-12-30T21:00:00Z" em um servidor UTC.
**Why it happens:** Supabase usa UTC internamente. Datas de vigência de seguros são datas puras, sem hora.
**How to avoid:** Declarar as colunas como `DATE` (não `TIMESTAMPTZ`) no schema SQL. No Zod, usar `z.string().date()`. Em `getVigenciaStatus`, usar `parseISO` + `startOfToday()` do date-fns que retorna midnight no timezone local.
**Warning signs:** Semáforo mostrando "vermelho" para apólices que expiram hoje mas ainda estão vigentes no horário de Brasília.

### Pitfall 3: Filtro de Status de Vigência na Query SQL sem Índice
**What goes wrong:** Filtrar `WHERE vigencia_fim <= '...'` em tabelas grandes sem índice causa seq scan.
**Why it happens:** O índice `idx_policies_vigencia_fim ON policies(vigencia_fim)` é necessário explicitamente.
**How to avoid:** Incluir o índice na migration (ver Pattern 1 — já documentado).
**Warning signs:** Performance degradando com volume de dados; `EXPLAIN` mostrando Seq Scan.

### Pitfall 4: RLS em `claims`/`endorsements` Sem Verificar Tenant
**What goes wrong:** Claims e endorsements referem-se a `policy_id`, mas se a RLS verificar apenas `policy_id NOT NULL`, um usuário pode inserir sinistro referenciando uma apólice de outro tenant.
**Why it happens:** FK para `policies.id` não garante que a policy pertence ao tenant do usuário.
**How to avoid:** Incluir `tenant_id = (SELECT public.jwt_tenant_id())` na política de INSERT de `claims` e `endorsements` — mesmo padrão das outras tabelas.
**Warning signs:** Ausência de `tenant_id` na tabela `claims`/`endorsements` (deve estar presente em todas as tabelas).

### Pitfall 5: `next_assembly_date` Nulo no Alerta
**What goes wrong:** Query de alerta de assembleia retorna erro se `next_assembly_date IS NULL` não for filtrado.
**Why it happens:** O campo é nullable — grupos podem não ter assembleia agendada.
**How to avoid:** Adicionar `.not('next_assembly_date', 'is', null)` antes do filtro de data na query de alertas.
**Warning signs:** Erros de comparação de data com NULL no PostgreSQL.

### Pitfall 6: Formulário Dinâmico Resetando ao Trocar Tipo
**What goes wrong:** Ao usuário trocar o tipo de seguro (ex: Auto → Vida), campos preenchidos de Auto persistem no estado do formulário e chegam ao Server Action junto com os novos campos.
**Why it happens:** React Hook Form mantém valores de campos não-visíveis no estado.
**How to avoid:** Usar `reset()` do React Hook Form ao trocar o tipo: `watch('type')` + `useEffect` que chama `reset({ type: newType })` quando o tipo muda. Ou usar `unregister` nos campos específicos ao troca.
**Warning signs:** Server Action recebendo `placa` em uma apólice do tipo `vida`.

### Pitfall 7: Numeração de Migrations (Conflito de Sequence)
**What goes wrong:** A última migration existente é `20260420_0010_...`. A Phase 3 deve continuar a partir de `0011`.
**Why it happens:** Migrations Supabase são ordenadas por nome de arquivo — um número errado pode executar fora de ordem.
**How to avoid:** As migrations da Phase 3 devem usar os prefixos `20260420_0011_`, `0012_`, `0013_`, `0014_` (ver estrutura recomendada acima).
**Warning signs:** Supabase CLI reportando "migration already applied" ou executando fora de ordem.

---

## Code Examples

### Exemplo 1: `VigenciaBadge` Component

```tsx
// Source: padrão Badge de src/components/ui/badge.tsx + decisão D-03
import { Badge } from '@/components/ui/badge'
import { getVigenciaStatus } from '@/lib/utils/vigencia'
import { cn } from '@/lib/utils'

const statusConfig = {
  verde:    { label: 'Vigente', className: 'bg-green-100 text-green-800 border-green-200' },
  amarelo:  { label: 'A vencer', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  vermelho: { label: 'Vencida', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function VigenciaBadge({ vigencia_fim }: { vigencia_fim: string }) {
  const status = getVigenciaStatus(vigencia_fim)
  const { label, className } = statusConfig[status]
  return <Badge className={cn('text-xs font-medium', className)}>{label}</Badge>
}
```

### Exemplo 2: Sidebar com Seção "Produtos"

```tsx
// Source: src/components/auth/sidebar-shell.tsx — extensão do padrão existente
// Decisão de Claude's Discretion: seção "Produtos" como label de grupo com 2 filhos diretos
// Razão: mesmo padrão de "Configurações" que já tem filhos — consistência visual
{
  label: 'Seguros',
  href: `/${slug}/seguros`,
  icon: <Shield size={16} />,
},
{
  label: 'Consórcio',
  href: `/${slug}/consorcio`,
  icon: <CircleDollarSign size={16} />,
},
```

**Recomendação de Claude:** Adicionar "Seguros" e "Consórcio" como itens diretos na nav (sem sub-menu agrupado), entre "Clientes" e "Configurações". Um label de seção estático "Produtos" (não clicável) acima dos dois links para agrupamento visual. Mantém a nav simples e sem hierarquia excessiva para uma barra lateral de 60px de largura.

### Exemplo 3: Aba Apólices na Tela do Cliente (implementando placeholder Phase 2)

```tsx
// Source: padrão de tabs em src/components/ui/tabs.tsx — Phase 2 D-10
// A aba "Apólices" já existe como placeholder — Phase 3 implementa o conteúdo
// Em src/app/(app)/[slug]/clientes/[id]/page.tsx

const policies = await supabase
  .from('policies')
  .select('id, policy_number, type, insurer, vigencia_fim, premio_total')
  .eq('client_id', clientId)
  .is('deleted_at', null)
  .order('vigencia_fim', { ascending: true })

// Passa para <PolicyTab policies={policies.data ?? []} />
```

### Exemplo 4: Filtros de Listagem com URL State

```tsx
// Source: padrão estabelecido em Phase 2 (D-07 do 02-CONTEXT.md)
// Em src/app/(app)/[slug]/seguros/page.tsx — Server Component
const type = searchParams.type as string | undefined
const insurer = searchParams.insurer as string | undefined
const assigned_to = searchParams.assigned_to as string | undefined

let query = supabase
  .from('policies')
  .select('*')
  .is('deleted_at', null)
  .order('vigencia_fim', { ascending: true })

if (type) query = query.eq('type', type)
if (insurer) query = query.ilike('insurer', `%${insurer}%`)
if (assigned_to) query = query.eq('assigned_to', assigned_to)

// status filter (verde/amarelo/vermelho) — calculado client-side após fetch
// ou via query SQL com date ranges:
if (searchParams.status === 'vermelho') {
  query = query.lte('vigencia_fim', thirtyDaysLater)
} else if (searchParams.status === 'amarelo') {
  query = query.gt('vigencia_fim', thirtyDaysLater).lte('vigencia_fim', sixtyDaysLater)
} else if (searchParams.status === 'verde') {
  query = query.gt('vigencia_fim', sixtyDaysLater)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase auth-helpers | @supabase/ssr | 2024 (Phase 1 D-16) | Padrão já correto no projeto |
| Status armazenado em campo de status | Calculado em runtime | Decisão D-03 | Sem cron jobs de sincronização |
| Formulário único para todos os tipos | `discriminatedUnion` por tipo | Phase 2 estabeleceu o padrão PF/PJ | Type-safe, validação correta por tipo |

---

## Runtime State Inventory

Esta é uma phase greenfield de novos módulos — sem renomeações, migrações de dados ou estado em runtime. Não aplicável.

**Confirmado:** Nenhuma das 5 categorias de runtime state se aplica a esta phase.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next.js dev/build | ✓ | (projeto já rodando) | — |
| Supabase CLI | Migrations | ✓ | 2.93.x [VERIFIED: package.json devDependencies] | — |
| Vitest | Testes unitários | ✓ | 2.1.x [VERIFIED: package.json] | — |
| date-fns | Cálculo de vigência | ✓ | 4.1.x [VERIFIED: package.json] | — |
| sonner | Toast de alertas | ✓ | 2.0.x [VERIFIED: package.json] | — |

Todas as dependências necessárias estão disponíveis. Nenhuma instalação necessária.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.x + @testing-library/react 16.x |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Quick run command | `npx vitest run tests/utils/vigencia.test.ts tests/actions/policies.test.ts` |
| Full suite command | `npm test` (alias para `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SEG-01 | `createPolicyAction` valida campos core + rejeita tipos inválidos | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ Wave 0 |
| SEG-01 | `createPolicyAction` extrai type_data JSONB corretamente por tipo | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ Wave 0 |
| SEG-01 | `createPolicyAction` bloqueia corretor atribuindo a outro corretor | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ Wave 0 |
| SEG-02 | `getVigenciaStatus` retorna 'verde' para >60 dias | unit | `npx vitest run tests/utils/vigencia.test.ts` | ❌ Wave 0 |
| SEG-02 | `getVigenciaStatus` retorna 'amarelo' para ≤60d e >30d | unit | `npx vitest run tests/utils/vigencia.test.ts` | ❌ Wave 0 |
| SEG-02 | `getVigenciaStatus` retorna 'vermelho' para ≤30d | unit | `npx vitest run tests/utils/vigencia.test.ts` | ❌ Wave 0 |
| SEG-02 | `getVigenciaStatus` retorna 'vermelho' para data passada | unit | `npx vitest run tests/utils/vigencia.test.ts` | ❌ Wave 0 |
| SEG-03 | Alert count query retorna apenas apólices com vigencia_fim ≤ 30 dias | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ Wave 0 |
| SEG-04 | `createClaimAction` valida campos obrigatórios e vincula policy_id | unit | `npx vitest run tests/actions/claims.test.ts` | ❌ Wave 0 |
| SEG-05 | `createEndorsementAction` valida tipo endosso e aceita premium_impact nulo | unit | `npx vitest run tests/actions/endorsements.test.ts` | ❌ Wave 0 |
| SEG-06 | Query de filtro por tipo aplica `eq('type', ...)` | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ Wave 0 |
| SEG-07 | Insert de apólice inclui client_id e assigned_to | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ Wave 0 |
| CON-01 | `createGroupAction` valida administradora, tipo, crédito, prazo | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ Wave 0 |
| CON-02 | `createQuotaAction` vincula client_id e group_id | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ Wave 0 |
| CON-03 | `updateQuotaContemplation` valida contemplation_type e lance_value | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ Wave 0 |
| CON-05 | Assembly alert query filtra next_assembly_date IS NOT NULL + ≤ 3 dias | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ Wave 0 |
| RLS | Tenant A nunca vê apólices do Tenant B | integration (stub) | `npx vitest run tests/db/rls-seguros.test.ts` | ❌ Wave 0 |
| RLS | Corretor vê apenas apólices com assigned_to = auth.uid() | integration (stub) | `npx vitest run tests/db/rls-seguros.test.ts` | ❌ Wave 0 |

**Testes manuais (não automatizados nesta phase):**
- SEG-02: renderização visual do Badge com cores corretas no browser
- CON-04: fluxo visual do pipeline pós-contemplação (pipeline de notas de texto)
- SEG-06/CON-06: UX dos filtros inline na listagem

### Sampling Rate
- **Por task commit:** `npx vitest run tests/utils/vigencia.test.ts tests/actions/policies.test.ts tests/actions/claims.test.ts tests/actions/consortium.test.ts`
- **Por wave merge:** `npm test` (suite completa)
- **Phase gate:** Suite completa verde + TypeScript sem erros (`npm run typecheck`) antes de `/gsd-verify-work`

### Wave 0 Gaps

Todos os arquivos de teste abaixo devem ser criados no Wave 0 (schema + stubs) antes do Wave 1 (implementação):

- [ ] `tests/utils/vigencia.test.ts` — cobre SEG-02 (função pura, testes críticos)
- [ ] `tests/actions/policies.test.ts` — cobre SEG-01, SEG-03, SEG-06, SEG-07
- [ ] `tests/actions/claims.test.ts` — cobre SEG-04
- [ ] `tests/actions/endorsements.test.ts` — cobre SEG-05
- [ ] `tests/actions/consortium.test.ts` — cobre CON-01, CON-02, CON-03, CON-05
- [ ] `tests/db/rls-seguros.test.ts` — stubs RLS isolation (padrão `it.todo(...)` como em `rls-clients.test.ts`)

**Mocks necessários** (mesmo padrão dos testes existentes em `tests/actions/clients.test.ts`):
- `vi.mock('@/lib/supabase/server')` — mock do cliente Supabase
- `vi.mock('next/cache')` — mock de `revalidatePath`
- `vi.mock('next/headers')` — alias já configurado em `vitest.config.ts`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim (herdado) | Supabase Auth + @supabase/ssr — padrão estabelecido Phase 1 |
| V3 Session Management | sim (herdado) | Cookie-based session via @supabase/ssr |
| V4 Access Control | sim | RLS policies por tabela + guard de role em Server Actions |
| V5 Input Validation | sim | Zod discriminatedUnion client + server |
| V6 Cryptography | não direto | Sem criptografia adicional nesta phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corretor acessando apólices de outro corretor | Elevação de privilégio | RLS `assigned_to = (SELECT auth.uid())` + guard no Server Action |
| Tenant A inserindo apólice com tenant_id do Tenant B | Spoofing | `tenant_id` vem do JWT (`app_metadata`) — nunca do FormData |
| Inserção de sinistro referenciando apólice de outro tenant | Tampering | `tenant_id` obrigatório em `claims` table + RLS |
| JSONB `type_data` com conteúdo malicioso | Injection | Zod valida campos específicos por tipo antes de inserir — sem SQL injection em JSONB via Supabase SDK |
| Número de apólice duplicado entre tenants | Não é ameaça | UNIQUE é `(tenant_id, policy_number)` — duplicação entre tenants é OK |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A aba "Apólices" na tela de detalhes do cliente foi criada como placeholder em Phase 2 (D-10 do 02-CONTEXT.md) mas pode não ter sido implementada se Phase 2 não completou | Architecture Patterns / Pattern 3 | Se o placeholder não existe, Wave 0 precisa criar a rota `src/app/(app)/[slug]/clientes/[id]/page.tsx` |
| A2 | `next_assembly_date` é atualizado manualmente pelo corretor após cada assembleia (decisão D-04) — sem cron automático | Common Pitfalls / Pitfall 5 | Se o planner esperar cron automático, a Phase 3 fica incompleta |
| A3 | `post_contemplation_notes` como texto livre cobre CON-04 ("pipeline pós-contemplação") — sem enum de stages separado | Architecture / Schema | Se CON-04 exige stages distintos (não apenas notas), o schema precisa de campo `post_contemplation_stage enum` adicional |

[ASSUMED]: A3 — CON-04 menciona "pipeline pós-contemplação: aguardando docs → em análise → crédito liberado" mas D-04 do CONTEXT.md diz "post_contemplation_notes (text)". A decisão D-04 prevalece, mas o planner deve confirmar se um campo de enum `post_contemplation_stage` é necessário além das notas de texto.

---

## Open Questions (RESOLVED)

1. **CON-04: Pipeline pós-contemplação — campo enum ou apenas notas?**
   - O que sabemos: D-04 do CONTEXT.md define `post_contemplation_notes TEXT`. O REQUIREMENTS.md CON-04 menciona "aguardando docs → em análise → crédito liberado" como stages distintos.
   - O que estava ambíguo: Se o usuário quer poder filtrar/reportar por stage de pós-contemplação ou apenas anotar livremente.
   - **RESOLVED:** Schema inclui ambos — `post_contemplation_stage TEXT CHECK (IN ('aguardando_docs','em_analise','credito_liberado')) DEFAULT 'aguardando_docs'` E `post_contemplation_notes TEXT` na tabela `consortium_quotas`. Adição aditiva ao D-04: notas de texto + stage filtrável. Implementado no Plan 03-01 T1.

2. **SEG-03 vs D-06: "Configurável por tipo de seguro" vs "alerta fixo 30 dias"**
   - O que sabemos: SEG-03 diz "X dias antes — configurável por tipo de seguro". D-06 do CONTEXT.md diz "badge conta apólices com semáforo vermelho (≤ 30 dias)".
   - O que estava ambíguo: Se a configurabilidade (X dias por tipo) está no escopo desta phase ou é Phase 7.
   - **RESOLVED:** Implementar alerta fixo de 30 dias conforme D-06. Configurabilidade por tipo deferred para Phase 7 junto com n8n e emails. D-06 substitui SEG-03 v1 in-app. Implementado no Plan 03-04 T2.

---

## Sources

### Primary (HIGH confidence)
- Codebase do projeto (verificado via Read tool) — schema migrations, validations, Server Actions, vitest config
- `03-CONTEXT.md` — decisões D-01 a D-06 (fontes primárias das decisões de produto)
- `01-CONTEXT.md` + `02-CONTEXT.md` — padrões RBAC, soft delete, RLS, Server Actions
- `package.json` — versões verificadas de todas as dependências

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — stack constraints verificados
- `REQUIREMENTS.md` — requisitos SEG-01 a SEG-07, CON-01 a CON-06

### Tertiary (LOW confidence — nenhum item nesta pesquisa)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas as dependências verificadas em package.json
- Schema SQL: HIGH — replicação exata dos padrões das migrations existentes
- Architecture patterns: HIGH — extensão direta dos padrões Phase 1/2
- Validation (test map): HIGH — vitest.config.ts verificado, estrutura de testes existente verificada
- CON-04 post-contemplation stage: LOW — ambiguidade entre REQUIREMENTS.md e CONTEXT.md

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stack estável, sem dependências externas voláteis)
