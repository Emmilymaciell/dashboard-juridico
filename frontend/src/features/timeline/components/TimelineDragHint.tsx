/**
 * Dica de primeiro uso do arraste.
 *
 * Aparece **uma vez na vida do navegador** e some sozinha. Affordance de
 * arraste é difícil: o cursor `grab` só aparece quando o ponteiro já está em
 * cima, e quem não passa por ali nunca descobre que o trilho anda.
 *
 * A persistência é `localStorage` puro, e de propósito: uma preferência de
 * onboarding não justifica ir ao servidor, não é dado do acervo e não precisa
 * atravessar máquinas. O acesso vai dentro de `try/catch` porque em janela
 * anônima ou com armazenamento bloqueado ele lança — e uma dica opcional nunca
 * pode derrubar a tela.
 */

import { MoveHorizontal } from 'lucide-react'
import * as React from 'react'

const CHAVE = 'prog.timeline.dica-arraste'
const SEGUNDOS = 6

function jaViu(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === '1'
  } catch {
    // Sem armazenamento: mostra a dica nesta sessão e não insiste depois.
    return false
  }
}

function marcarVisto() {
  try {
    window.localStorage.setItem(CHAVE, '1')
  } catch {
    /* vazio de propósito: a dica é dispensável, o erro não */
  }
}

export function DicaDeArraste({
  ativa,
  jaArrastou,
}: {
  /** Só faz sentido quando existe excedente para arrastar. */
  ativa: boolean
  /** O usuário arrastou: a dica cumpriu o papel e vai embora. */
  jaArrastou: boolean
}) {
  const [visivel, setVisivel] = React.useState(false)

  React.useEffect(() => {
    if (!ativa || jaViu()) return
    setVisivel(true)
    const id = window.setTimeout(() => {
      setVisivel(false)
      marcarVisto()
    }, SEGUNDOS * 1000)
    return () => window.clearTimeout(id)
  }, [ativa])

  React.useEffect(() => {
    if (!jaArrastou) return
    setVisivel(false)
    marcarVisto()
  }, [jaArrastou])

  if (!visivel) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center"
      aria-hidden
    >
      <span
        className="reveal-up inline-flex items-center gap-2 rounded-full border border-white/10
                   px-3 py-1.5 text-[11px] text-white/55"
        style={{
          background: 'rgba(7, 13, 22, 0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <MoveHorizontal className="size-3.5 text-accent/80" />
        Arraste para navegar
      </span>
    </div>
  )
}
