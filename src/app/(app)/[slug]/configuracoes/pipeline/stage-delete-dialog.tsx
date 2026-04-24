'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteStage } from '@/lib/actions/pipeline'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface StageDeleteDialogProps {
  stage: {
    id: string
    name: string
    clientCount: number
  }
  defaultStageName: string
  slug: string
  disabled?: boolean
}

export function StageDeleteDialog({
  stage,
  defaultStageName,
  slug,
  disabled,
}: StageDeleteDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleConfirm() {
    startTransition(async () => {
      const result = await deleteStage(slug, stage.id)
      if (result?.error) {
        toast.error(result.error._form?.[0] ?? 'Erro ao remover estágio')
        setOpen(false)
        return
      }
      const count = result.relocated ?? 0
      if (count > 0) {
        toast.success(
          `Estágio removido. ${count} cliente(s) movido(s) para "${defaultStageName}".`
        )
      } else {
        toast.success(`Estágio "${stage.name}" removido com sucesso.`)
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          title={disabled ? 'É necessário manter ao menos um estágio ativo' : `Remover estágio ${stage.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover estágio</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {stage.clientCount > 0 ? (
                <>
                  O estágio{' '}
                  <strong>&ldquo;{stage.name}&rdquo;</strong> possui{' '}
                  <strong>{stage.clientCount} cliente(s)</strong>. Eles serão
                  movidos para{' '}
                  <strong>&ldquo;{defaultStageName}&rdquo;</strong> antes da
                  remoção. Deseja continuar?
                </>
              ) : (
                <>
                  Tem certeza que deseja remover o estágio{' '}
                  <strong>&ldquo;{stage.name}&rdquo;</strong>? Esta ação não
                  pode ser desfeita.
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isPending}
          >
            {isPending ? 'Removendo...' : 'Confirmar remoção'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
