'use client'
import { Check } from 'lucide-react'
import { useRegisterWizard } from '@/stores/register-wizard.store'
import { Progress } from '@/components/ui/progress'
import { StepEmpresa } from './step-empresa'
import { StepUsuario } from './step-usuario'
import { StepPlano } from './step-plano'

const STEPS = [
  { label: 'Dados da empresa' },
  { label: 'Usuário admin' },
  { label: 'Plano' },
]

export function Wizard() {
  const { step } = useRegisterWizard()
  const progressValue = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <div className="flex flex-col gap-8">
      {/* Step indicator */}
      <div aria-label="Etapas do cadastro" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const num = idx + 1
            const isActive = step === num
            const isCompleted = step > num

            return (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30 bg-transparent text-muted-foreground',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : (
                    <span className="text-xs font-semibold">{num}</span>
                  )}
                </div>
                <span
                  className={[
                    'text-xs',
                    isActive || isCompleted ? 'text-foreground font-semibold' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        <Progress value={progressValue} className="h-1.5" />
      </div>

      {/* Active step */}
      {step === 1 && <StepEmpresa />}
      {step === 2 && <StepUsuario />}
      {step === 3 && <StepPlano />}
    </div>
  )
}
