'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createPolicyAction } from '@/lib/actions/policies'

interface Cliente {
  id: string
  name: string
}

interface Corretor {
  id: string
  full_name: string | null
  role: string
}

interface Props {
  slug: string
  clientes: Cliente[]
  corretores: Corretor[]
  defaultAssignedTo: string
  lockAssignedToSelf: boolean
}

type PolicyType = 'auto' | 'vida' | 'residencial' | 'empresarial' | 'saude' | 'outros'

// Minimal form state — not Zod-typed client-side to avoid discriminatedUnion issues
// Server Action validates fully via createPolicySchema
interface FormValues {
  type: PolicyType
  policy_number: string
  insurer: string
  vigencia_inicio: string
  vigencia_fim: string
  premio_total: string
  client_id: string
  assigned_to: string
  observacoes: string
  // auto
  placa: string
  chassi: string
  marca_modelo: string
  ano: string
  valor_fipe: string
  cobertura: string
  // vida
  valor_assegurado: string
  beneficiarios: string
  // residencial
  endereco_imovel: string
  valor_imovel: string
  tipo_imovel: string
  // empresarial
  cnpj_risco: string
  endereco_empresa: string
  tipo_atividade: string
  valor_patrimonial: string
  // saude
  operadora: string
  numero_carteirinha: string
  acomodacao: string
  dependentes: string
}

export function PolicyForm({ slug, clientes, corretores, defaultAssignedTo, lockAssignedToSelf }: Props) {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<PolicyType>('auto')
  const [clientId, setClientId] = useState('')
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo)
  const [cobertura, setCobertura] = useState<'basica' | 'compreensiva'>('compreensiva')
  const [tipoImovel, setTipoImovel] = useState<'proprio' | 'alugado'>('proprio')
  const [acomodacao, setAcomodacao] = useState<'enfermaria' | 'apartamento'>('apartamento')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      type: 'auto',
      assigned_to: defaultAssignedTo,
    },
  })

  // CRITICAL (Pitfall 6 / T-03-11): reset campos ao trocar tipo
  // evita que campos do tipo anterior cheguem ao Server Action
  useEffect(() => {
    reset({
      type: selectedType,
      assigned_to: assignedTo,
      client_id: clientId,
    })
    // Reset select-controlled states too
    setCobertura('compreensiva')
    setTipoImovel('proprio')
    setAcomodacao('apartamento')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType])

  async function onSubmit(data: FormValues) {
    const fd = new FormData()

    // Append all non-empty fields
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        fd.append(k, String(v))
      }
    })

    // Controlled selects
    fd.set('type', selectedType)
    fd.set('client_id', clientId)
    fd.set('assigned_to', assignedTo)
    if (selectedType === 'auto') fd.set('cobertura', cobertura)
    if (selectedType === 'residencial') fd.set('tipo_imovel', tipoImovel)
    if (selectedType === 'saude') fd.set('acomodacao', acomodacao)

    const result = await createPolicyAction(slug, fd)

    if (result?.error) {
      Object.entries(result.error).forEach(([field, msgs]) => {
        if (field === '_form') {
          toast.error(msgs?.[0] ?? 'Erro ao salvar apólice.')
        } else {
          setError(field as keyof FormValues, { message: msgs?.[0] ?? 'Inválido' })
        }
      })
      return
    }

    toast.success('Apólice cadastrada com sucesso.')
    router.push(`/${slug}/seguros`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Tipo de seguro */}
      <div className="space-y-2">
        <Label>Tipo de seguro <span className="text-destructive">*</span></Label>
        <Select
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as PolicyType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="vida">Vida</SelectItem>
            <SelectItem value="residencial">Residencial</SelectItem>
            <SelectItem value="empresarial">Empresarial</SelectItem>
            <SelectItem value="saude">Saúde</SelectItem>
            <SelectItem value="outros">Outros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campos core */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="policy_number">Nº da apólice <span className="text-destructive">*</span></Label>
          <Input id="policy_number" {...register('policy_number')} placeholder="Ex.: APL-2026-001" />
          {errors.policy_number && (
            <p className="text-xs text-destructive">{errors.policy_number.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="insurer">Seguradora <span className="text-destructive">*</span></Label>
          <Input id="insurer" {...register('insurer')} placeholder="Ex.: Porto Seguro" />
          {errors.insurer && (
            <p className="text-xs text-destructive">{errors.insurer.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vigencia_inicio">Vigência início <span className="text-destructive">*</span></Label>
          <Input id="vigencia_inicio" type="date" {...register('vigencia_inicio')} />
          {errors.vigencia_inicio && (
            <p className="text-xs text-destructive">{errors.vigencia_inicio.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vigencia_fim">Vigência fim <span className="text-destructive">*</span></Label>
          <Input id="vigencia_fim" type="date" {...register('vigencia_fim')} />
          {errors.vigencia_fim && (
            <p className="text-xs text-destructive">{errors.vigencia_fim.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="premio_total">Prêmio total (R$) <span className="text-destructive">*</span></Label>
        <Input
          id="premio_total"
          type="number"
          step="0.01"
          min="0"
          {...register('premio_total')}
          placeholder="0,00"
        />
        {errors.premio_total && (
          <p className="text-xs text-destructive">{errors.premio_total.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Cliente <span className="text-destructive">*</span></Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Corretor responsável <span className="text-destructive">*</span></Label>
        <Select
          disabled={lockAssignedToSelf}
          value={assignedTo}
          onValueChange={setAssignedTo}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o corretor" />
          </SelectTrigger>
          <SelectContent>
            {corretores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name ?? c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.assigned_to && (
          <p className="text-xs text-destructive">{errors.assigned_to.message}</p>
        )}
      </div>

      {/* Campos condicionais por tipo */}

      {selectedType === 'auto' && (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium text-muted-foreground">Dados do veículo</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="placa">Placa <span className="text-destructive">*</span></Label>
              <Input id="placa" {...register('placa')} placeholder="ABC1D23" />
              {errors.placa && (
                <p className="text-xs text-destructive">{errors.placa.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="chassi">Chassi</Label>
              <Input id="chassi" {...register('chassi')} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca_modelo">Marca/Modelo <span className="text-destructive">*</span></Label>
              <Input id="marca_modelo" {...register('marca_modelo')} placeholder="Toyota Corolla" />
              {errors.marca_modelo && (
                <p className="text-xs text-destructive">{errors.marca_modelo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano">Ano <span className="text-destructive">*</span></Label>
              <Input id="ano" type="number" {...register('ano')} placeholder="2024" />
              {errors.ano && (
                <p className="text-xs text-destructive">{errors.ano.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_fipe">Valor FIPE (R$) <span className="text-destructive">*</span></Label>
              <Input id="valor_fipe" type="number" step="0.01" {...register('valor_fipe')} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Cobertura <span className="text-destructive">*</span></Label>
              <Select value={cobertura} onValueChange={(v) => setCobertura(v as 'basica' | 'compreensiva')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basica">Básica</SelectItem>
                  <SelectItem value="compreensiva">Compreensiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {selectedType === 'vida' && (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium text-muted-foreground">Dados do seguro de vida</p>
          <div className="space-y-2">
            <Label htmlFor="valor_assegurado">Valor assegurado (R$) <span className="text-destructive">*</span></Label>
            <Input id="valor_assegurado" type="number" step="0.01" {...register('valor_assegurado')} placeholder="0,00" />
            {errors.valor_assegurado && (
              <p className="text-xs text-destructive">{errors.valor_assegurado.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="beneficiarios">Beneficiários</Label>
            <Input id="beneficiarios" {...register('beneficiarios')} placeholder="Nomes dos beneficiários" />
          </div>
        </div>
      )}

      {selectedType === 'residencial' && (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium text-muted-foreground">Dados do imóvel</p>
          <div className="space-y-2">
            <Label htmlFor="endereco_imovel">Endereço do imóvel <span className="text-destructive">*</span></Label>
            <Input id="endereco_imovel" {...register('endereco_imovel')} placeholder="Rua, número, bairro, cidade" />
            {errors.endereco_imovel && (
              <p className="text-xs text-destructive">{errors.endereco_imovel.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_imovel">Valor do imóvel (R$) <span className="text-destructive">*</span></Label>
              <Input id="valor_imovel" type="number" step="0.01" {...register('valor_imovel')} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de imóvel <span className="text-destructive">*</span></Label>
              <Select value={tipoImovel} onValueChange={(v) => setTipoImovel(v as 'proprio' | 'alugado')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proprio">Próprio</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {selectedType === 'empresarial' && (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium text-muted-foreground">Dados da empresa</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj_risco">CNPJ do risco <span className="text-destructive">*</span></Label>
              <Input id="cnpj_risco" {...register('cnpj_risco')} placeholder="00.000.000/0001-00" />
              {errors.cnpj_risco && (
                <p className="text-xs text-destructive">{errors.cnpj_risco.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_atividade">Tipo de atividade <span className="text-destructive">*</span></Label>
              <Input id="tipo_atividade" {...register('tipo_atividade')} placeholder="Ex.: Comércio varejista" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endereco_empresa">Endereço da empresa <span className="text-destructive">*</span></Label>
            <Input id="endereco_empresa" {...register('endereco_empresa')} placeholder="Rua, número, bairro, cidade" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor_patrimonial">Valor patrimonial (R$) <span className="text-destructive">*</span></Label>
            <Input id="valor_patrimonial" type="number" step="0.01" {...register('valor_patrimonial')} placeholder="0,00" />
          </div>
        </div>
      )}

      {selectedType === 'saude' && (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium text-muted-foreground">Dados do plano de saúde</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operadora">Operadora <span className="text-destructive">*</span></Label>
              <Input id="operadora" {...register('operadora')} placeholder="Ex.: Unimed" />
              {errors.operadora && (
                <p className="text-xs text-destructive">{errors.operadora.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_carteirinha">Nº carteirinha <span className="text-destructive">*</span></Label>
              <Input id="numero_carteirinha" {...register('numero_carteirinha')} />
              {errors.numero_carteirinha && (
                <p className="text-xs text-destructive">{errors.numero_carteirinha.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Acomodação <span className="text-destructive">*</span></Label>
              <Select value={acomodacao} onValueChange={(v) => setAcomodacao(v as 'enfermaria' | 'apartamento')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enfermaria">Enfermaria</SelectItem>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dependentes">Dependentes</Label>
              <Input id="dependentes" {...register('dependentes')} placeholder="Opcional" />
            </div>
          </div>
        </div>
      )}

      {/* Observações — sempre presente */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          {...register('observacoes')}
          placeholder="Observações adicionais sobre a apólice..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${slug}/seguros`)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Cadastrar apólice'}
        </Button>
      </div>
    </form>
  )
}
