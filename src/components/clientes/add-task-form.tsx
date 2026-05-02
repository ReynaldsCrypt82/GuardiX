'use client'
import { useRef, useState, useTransition } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addTask, completeTask } from '@/lib/actions/crm'

interface Task {
  id: string
  description: string
  due_date: string
  completed_at: string | null
}

interface Props {
  clientId: string
  slug: string
  tasks: Task[]
}

export function TasksPanel({ clientId, slug, tasks }: Props) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  async function handleAdd(formData: FormData) {
    setError('')
    startTransition(async () => {
      const res = await addTask(formData)
      if (res.error) setError(res.error)
      else formRef.current?.reset()
    })
  }

  async function handleComplete(taskId: string) {
    startTransition(async () => {
      await completeTask(taskId, clientId, slug)
    })
  }

  const open = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at)

  return (
    <div className="space-y-4">
      {/* Lista de tarefas abertas */}
      {open.length === 0 && done.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
      ) : (
        <ul className="space-y-2">
          {open.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
              <button
                onClick={() => handleComplete(t.id)}
                disabled={pending}
                className="mt-0.5 shrink-0 rounded-full border-2 border-muted-foreground/40 p-0.5 hover:border-primary transition-colors"
                title="Marcar como concluída"
              >
                <div className="h-3 w-3 rounded-full" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  Prazo: {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
            </li>
          ))}
          {done.map((t) => (
            <li key={t.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 opacity-60">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm line-through text-muted-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  Concluída em {new Date(t.completed_at!).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulário nova tarefa */}
      <form ref={formRef} action={handleAdd} className="space-y-3 rounded-xl border bg-muted/40 p-4">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="slug" value={slug} />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova tarefa</p>
        <input
          name="description"
          required
          placeholder="Descrição da tarefa…"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">Prazo:</label>
            <input
              type="date"
              name="due_date"
              required
              className="rounded-lg border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending} className="ml-auto">
            {pending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
            Adicionar
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  )
}
