'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { registerStep1Schema } from '@/lib/validations/auth-schemas'
import { validateCNPJ, stripCNPJ, formatCNPJ } from '@/lib/validations/cnpj'
import { useRegisterWizard } from '@/stores/register-wizard.store'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Step1Values = z.infer<typeof registerStep1Schema>

type CnpjStatus = 'idle' | 'loading' | 'success' | 'error' | 'invalid'

export function StepEmpresa() {
  const { empresaData, setEmpresaData, setStep } = useRegisterWizard()
  const [cnpjStatus, setCnpjStatus] = useState<CnpjStatus>('idle')
  const [cnpjMessage, setCnpjMessage] = useState<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<Step1Values>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: {
      cnpj: empresaData?.cnpj ? formatCNPJ(empresaData.cnpj) : '',
      companyName: empresaData?.companyName ?? '',
      segment: empresaData?.segment ?? undefined,
    },
  })

  async function lookupCNPJ(digits: string) {
    setCnpjStatus('loading')
    setCnpjMessage('Consultando CNPJ...')
    try {
      const res = await fetch(`/api/cnpj/${digits}`)
      if (res.ok) {
        const data = await res.json()
        if (data.razao_social) {
          form.setValue('companyName', data.razao_social, { shouldValidate: true })
          setCnpjStatus('success')
          setCnpjMessage('CNPJ válido — razão social encontrada')
        } else {
          setCnpjStatus('error')
          setCnpjMessage(
            'CNPJ não encontrado na Receita Federal. Preencha a razão social manualmente.',
          )
        }
      } else {
        setCnpjStatus('error')
        setCnpjMessage(
          'CNPJ não encontrado na Receita Federal. Preencha a razão social manualmente.',
        )
      }
    } catch {
      setCnpjStatus('error')
      setCnpjMessage(
        'CNPJ não encontrado na Receita Federal. Preencha a razão social manualmente.',
      )
    }
  }

  function handleCNPJChange(raw: string) {
    // Apply mask progressively (no zero-padding on partial input)
    const digits = stripCNPJ(raw).slice(0, 14)
    let masked = digits
    if (digits.length > 12) masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
    else if (digits.length > 8) masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
    else if (digits.length > 5) masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
    else if (digits.length > 2) masked = `${digits.slice(0, 2)}.${digits.slice(2)}`
    form.setValue('cnpj', masked, { shouldValidate: false })

    setCnpjStatus('idle')
    setCnpjMessage('')

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (digits.length === 14) {
      if (!validateCNPJ(digits)) {
        setCnpjStatus('invalid')
        setCnpjMessage('CNPJ inválido. Verifique o número e tente novamente.')
        return
      }
      // Debounce API call 500ms after last digit entered
      debounceRef.current = setTimeout(() => lookupCNPJ(digits), 500)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function onSubmit(values: Step1Values) {
    setEmpresaData({
      cnpj: stripCNPJ(values.cnpj),
      companyName: values.companyName,
      segment: values.segment,
    })
    setStep(2)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Cadastre sua corretora</h1>
        <p className="text-sm text-muted-foreground">
          Comece com o CNPJ e vamos preencher o resto automaticamente.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* CNPJ Field */}
          <FormField
            control={form.control}
            name="cnpj"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CNPJ</FormLabel>
                <FormControl>
                  <Input
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    {...field}
                    onChange={(e) => handleCNPJChange(e.target.value)}
                  />
                </FormControl>
                {/* CNPJ status message */}
                {cnpjStatus === 'loading' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Consultando CNPJ...
                  </div>
                )}
                {cnpjStatus === 'success' && (
                  <p className="text-xs text-green-600">{cnpjMessage}</p>
                )}
                {(cnpjStatus === 'error' || cnpjStatus === 'invalid') && (
                  <p className="text-xs text-destructive">
                    {cnpjStatus === 'invalid'
                      ? 'CNPJ inválido. Verifique o número e tente novamente.'
                      : 'CNPJ não encontrado na Receita Federal. Preencha a razão social manualmente.'}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Razão social */}
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razão social</FormLabel>
                <FormControl>
                  <Input placeholder="Nome da sua corretora" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Preenchido automaticamente após validação do CNPJ
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Segment */}
          <FormField
            control={form.control}
            name="segment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Segmento de atuação</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="seguros">Seguros</SelectItem>
                    <SelectItem value="consorcio">Consórcio</SelectItem>
                    <SelectItem value="ambos">Seguros e Consórcio</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-11 w-full">
            Continuar
          </Button>
        </form>
      </Form>
    </div>
  )
}
