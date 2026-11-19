/**
 * Gaveta lateral de detalhamento.
 *
 * Existe para tirar a tabela grande da Visão Geral SEM apagar a tabela. O
 * painel responde perguntas de leitura; quem precisa da linha a linha abre a
 * gaveta, e o que estava na página continua inteiro lá dentro — mesma tabela,
 * mesmos filtros, mesma ordenação.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export function Gaveta({
  aberta,
  onFechar,
  titulo,
  descricao,
  largura = 'max-w-5xl',
  children,
}: {
  aberta: boolean
  onFechar: () => void
  titulo: string
  descricao?: string
  largura?: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={aberta} onOpenChange={(o) => !o && onFechar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-pop',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            largura,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-base font-semibold text-ink">
                {titulo}
              </DialogPrimitive.Title>
              {descricao ? (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-ink-muted">
                  {descricao}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
