// src/components/assistente/chat-interface.tsx
// Phase 07 Plan 04 — Client Component de chat (AUTO-06)
// Pitfall 5: useChat v6 — status e 'submitted' | 'streaming' | 'ready' | 'error'
// Gerenciar input state manualmente (nao automatico no v6)

'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef } from 'react'

interface ChatInterfaceProps {
  slug: string
}

export function ChatInterface({ slug }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, input, handleInputChange, handleSubmit, status, error } = useChat({
    api: `/api/${slug}/ai/chat`,
    maxSteps: 5,
  })

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isLoading = status === 'submitted' || status === 'streaming'

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px] border rounded-lg bg-background">
      {/* Area de mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm text-center">
              Pergunte sobre clientes, apolices ou pagamentos pendentes.
              <br />
              <span className="text-xs opacity-70">Exemplo: &quot;Quais apolices vencem em 30 dias?&quot;</span>
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={[
                'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              ].join(' ')}
            >
              {m.parts?.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null,
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <p className="text-destructive text-xs">
              Erro ao conectar com o assistente. Tente novamente.
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t p-4 flex gap-2"
      >
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Pergunte sobre clientes, apolices ou pagamentos..."
          disabled={isLoading}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
