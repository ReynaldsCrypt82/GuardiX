'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createClientSchema, type CreateClientInput } from '@/lib/validations/client-schemas'
import { createClientAction } from '@/lib/actions/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Corretor {
  id: string
  full_name: string | null
  role: string
}

interface Props {
  slug: string
  corretores: Corretor[]
  defaultAssignedTo: string
  lockAssignedToSelf: boolean
}

// ---------------------------------------------------------------------------
// CPF mask: 000.000.000-00 (left-to-right fill, same fix as commit d367571)
// ---------------------------------------------------------------------------
function applyCPFMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  let out = d.slice(0, 3)
  if (d.length > 3) out += '.' + d.slice(3, 6)
  if (d.length > 6) out += '.' + d.slice(6, 9)
  if (d.length > 9) out += '-' + d.slice(9, 11)
  return out
}

// ---------------------------------------------------------------------------
// CNPJ mask: 00.000.000/0000-00 (left-to-right fill, same fix as commit d367571)
// ---------------------------------------------------------------------------
function applyCNPJMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  let out = d.slice(0, 2)
  if (d.length > 2) out += '.' + d.slice(2, 5)
  if (d.length > 5) out += '.' + d.slice(5, 8)
  if (d.length > 8) out += '/' + d.slice(8, 12)
  if (d.length > 12) out += '-' + d.slice(12, 14)
  return out
}

export function NewClientForm({
  slug,
  corretores,
  defaultAssignedTo,
  lockAssignedToSelf,
}: Props) {
  const router = useRouter()
  const [clientType, setClientType] = useState<'pf' | 'pj'>('pf')

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      type: 'pf',
      document: '',
      name: '',
      email: '',
      phone: '',
      assigned_to: defaultAssignedTo,
    },
  })

  // -------------------------------------------------------------------------
  // Toggle PF/PJ — Pitfall 5 mitigation: clear document, name, responsible and errors
  // -------------------------------------------------------------------------
  function handleTypeChange(newType: string) {
    const t = newType as 'pf' | 'pj'
    setClientType(t)
    form.resetField('document')
    form.resetField('name')
    form.resetField('responsible' as keyof CreateClientInput)
    form.clearErrors(['document', 'name', 'responsible' as keyof CreateClientInput])
    form.setValue('type', t)
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  async function onSubmit(data: CreateClientInput) {
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        fd.append(k, String(v))
      }
    })

    const res = await createClientAction(slug, fd)
    if (res?.error) {
      Object.entries(res.error).forEach(([field, msgs]) => {
        form.setError(field as keyof CreateClientInput, { message: msgs?.[0] ?? 'Erro' })
      })
      const formError = res.error._form?.[0]
      if (formError) {
        toast.error(formError)
      }
      return
    }

    toast.success('Cliente cadastrado com sucesso.')
    router.push(`/${slug}/clientes`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Toggle PF/PJ */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Tipo de pessoa</p>
          <Tabs value={clientType} onValueChange={handleTypeChange}>
            <TabsList className="w-full">
              <TabsTrigger value="pf" className="flex-1">
                Pessoa Física (CPF)
              </TabsTrigger>
              <TabsTrigger value="pj" className="flex-1">
                Pessoa Jurídica (CNPJ)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Nome / Razão Social */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {clientType === 'pf' ? 'Nome completo' : 'Razão social'}
                <span className="ml-1 text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    clientType === 'pf'
                      ? 'Ex.: João da Silva'
                      : 'Ex.: Empresa Teste LTDA'
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Documento — CPF ou CNPJ */}
        <FormField
          control={form.control}
          name="document"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {clientType === 'pf' ? 'CPF' : 'CNPJ'}
                <span className="ml-1 text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    clientType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'
                  }
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const masked =
                      clientType === 'pf'
                        ? applyCPFMask(e.target.value)
                        : applyCNPJMask(e.target.value)
                    field.onChange(masked)
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Responsável — somente PJ */}
        {clientType === 'pj' && (
          <FormField
            control={form.control}
            name={'responsible' as keyof CreateClientInput}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome do responsável pela empresa"
                    value={(field.value as string) ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* E-mail */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="email@exemplo.com.br"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Telefone */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input
                  placeholder="(11) 99999-9999"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Corretor responsável */}
        <FormField
          control={form.control}
          name="assigned_to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Corretor responsável
                <span className="ml-1 text-destructive">*</span>
              </FormLabel>
              <Select
                disabled={lockAssignedToSelf}
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o corretor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {corretores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${slug}/clientes`)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Cadastrar cliente'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
