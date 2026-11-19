/**
 * Régua de rodovias. Navegação, não filtro de dashboard.
 *
 * A referência é a aba do Notion: horizontal, compacta, o ativo evidente e o
 * inativo discreto — nada de quatro botões sólidos de formulário.
 *
 * O indicador desliza porque a posição vem de MEDIÇÃO de layout com transição
 * em CSS, não de animação em JS governando geometria. Se a transição não
 * rodar — aba oculta, movimento reduzido, captura —, o indicador simplesmente
 * aparece embaixo da aba certa, em vez de ficar preso em lugar nenhum.
 */

import { Route } from 'lucide-react'
import * as React from 'react'

import { acentoDaRodovia } from '@/features/roads/rodovias'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'

export function RodoviaTabs({
  rodovias,
  ativa,
  onSelecionar,
}: {
  rodovias: Array<{ rodovia: string; documentos: number }>
  ativa: string | null
  onSelecionar: (rodovia: string) => void
}) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>())
  const trilho = React.useRef<HTMLDivElement | null>(null)
  const [marca, setMarca] = React.useState<{ left: number; width: number } | null>(null)

  /**
   * Posição do indicador.
   *
   * `getBoundingClientRect` funciona sem pintura, então a medida é confiável
   * mesmo quando a aba não está desenhando. O `window.resize` acompanha o
   * `ResizeObserver` porque este último NÃO é entregue em aba que não pinta —
   * armadilha já registrada no handoff.
   */
  React.useLayoutEffect(() => {
    const medir = () => {
      const alvo = ativa ? refs.current.get(ativa) : undefined
      const caixa = trilho.current
      if (!alvo || !caixa) {
        setMarca(null)
        return
      }
      const a = alvo.getBoundingClientRect()
      const c = caixa.getBoundingClientRect()
      setMarca({ left: a.left - c.left, width: a.width })
    }
    medir()
    const observer = new ResizeObserver(medir)
    if (trilho.current) observer.observe(trilho.current)
    window.addEventListener('resize', medir)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [ativa, rodovias])

  /** Setas, Home e End percorrem a régua — requisito de `tablist`. */
  const aoTeclar = (e: React.KeyboardEvent, indice: number) => {
    const teclas: Record<string, number> = {
      ArrowRight: indice + 1,
      ArrowLeft: indice - 1,
      Home: 0,
      End: rodovias.length - 1,
    }
    const destino = teclas[e.key]
    if (destino === undefined) return
    e.preventDefault()
    const alvo = rodovias[(destino + rodovias.length) % rodovias.length]
    if (!alvo) return
    onSelecionar(alvo.rodovia)
    refs.current.get(alvo.rodovia)?.focus()
  }

  return (
    <div
      ref={trilho}
      role="tablist"
      aria-label="Rodovias do programa"
      className="relative flex items-end gap-1 overflow-x-auto border-b border-line pb-0"
    >
      {rodovias.map((r, i) => {
        const selecionada = r.rodovia === ativa
        const cor = acentoDaRodovia(r.rodovia)
        return (
          <button
            key={r.rodovia}
            ref={(el) => {
              if (el) refs.current.set(r.rodovia, el)
              else refs.current.delete(r.rodovia)
            }}
            role="tab"
            id={`aba-${r.rodovia}`}
            aria-selected={selecionada}
            aria-controls="painel-da-rodovia"
            // Só a aba ativa fica na ordem de tabulação: de dentro da régua, a
            // navegação é por seta. É o comportamento esperado de um `tablist`.
            tabIndex={selecionada ? 0 : -1}
            onClick={() => onSelecionar(r.rodovia)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              'group relative flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5',
              'text-sm transition-colors duration-150 ease-swift',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              selecionada
                ? 'font-semibold text-ink'
                : 'text-ink-muted hover:bg-subtle/70 hover:text-ink',
            )}
          >
            <Route
              className="size-4 shrink-0 transition-opacity"
              style={{ color: cor, opacity: selecionada ? 1 : 0.55 }}
            />
            <span className="font-mono tracking-tight">{r.rodovia}</span>
            <span
              className={cn(
                'tabular rounded-md px-1.5 py-0.5 text-2xs font-semibold transition-colors',
                selecionada ? 'text-ink' : 'text-ink-faint',
              )}
              style={{ background: selecionada ? acentoDaRodovia(r.rodovia, 0.16) : undefined }}
            >
              {num(r.documentos)}
            </span>
          </button>
        )
      })}

      {/* O indicador. Fica fora dos botões para poder deslizar entre eles. */}
      {marca ? (
        <span
          aria-hidden
          className="absolute bottom-0 h-[2px] rounded-full transition-[left,width] duration-250 ease-swift"
          style={{
            left: marca.left,
            width: marca.width,
            background: ativa ? acentoDaRodovia(ativa) : 'transparent',
            boxShadow: ativa ? `0 0 10px ${acentoDaRodovia(ativa, 0.6)}` : undefined,
          }}
        />
      ) : null}
    </div>
  )
}
