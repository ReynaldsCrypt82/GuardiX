'use client'
import { useRef, useState, useTransition } from 'react'
import { MessageSquare, Phone, Mail, Users, Smartphone, MapPin, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addInteraction } from '@/lib/actions/crm'

const TYPES = [
  { value: 'comentario', label: 'Comentário', icon: MessageSquare },
  { value: 'ligacao',    label: 'Ligação',    icon: Phone },
  { value: 'email',      label: 'E-mail',     icon: Mail },
  { value: 'reuniao',    label: 'Reunião',    icon: Users },
  { value: 'whatsapp',   label: 'WhatsApp',   icon: Smartphone },
  { value: 'visita',     label: 'Visita',     icon: MapPin },
]

interface Props {
  clientId: string
  slug: string
}

export function AddInteractionForm({ clientId, slug }: Props) {
  const [type, setType] = useState('comentario')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const res = await addInteraction(formData)
      if (res.error) {
        setError(res.error)
      } else {
        formRef.current?.reset()
        setType('comentario')
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-xl border bg-muted/40 p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="slug" value={slug} />

      {/* Tipo */}
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={[
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              type === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />

      {/* Data */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Data:</label>
        <input
          type="datetime-local"
          name="occurred_at"
          defaultValue={new Date().toISOString().slice(0, 16)}
          className="rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Descrição */}
      <textarea
        name="description"
        required
        placeholder="Descreva o contato ou adicione um comentário…"
        rows={3}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
          Registrar
        </Button>
      </div>
    </form>
  )
}
