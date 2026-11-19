/**
 * Navegação pelas bordas — hotspots, não cápsulas.
 *
 * As caixas verticais "Datas anteriores / Próximas datas" da versão anterior
 * ocupavam área nobre para dizer o óbvio. No lugar: um gradiente discreto, uma
 * seta, e duas saídas que não competem entre si.
 *
 *   CLIQUE na seta — vai para a semana vizinha na hora. É a intenção
 *   declarada: quem clicou sabe para onde quer ir e não quer esperar.
 *
 *   PARADO na borda por 4 s — o trilho começa a deslizar sozinho. É a
 *   intenção hesitante: o cursor foi parar ali e ficou. Só então o movimento
 *   começa.
 *
 * A versão anterior deslizava assim que o cursor entrava na faixa de 120 px, e
 * era isso que incomodava: passar o mouse perto da borda para alcançar
 * qualquer outra coisa arrastava a semana junto. Aproximar-se agora não move
 * nada — só ACENDE a borda, que é o aviso de que existe ali um atalho.
 *
 * "Parado" tem tolerância de 4 px: tremor de mão não reinicia a contagem, mas
 * atravessar a faixa reinicia. Enquanto a contagem corre, um anel se fecha em
 * volta da seta — sem ele os 4 s leriam como interface travada.
 *
 * Depois que o deslize começa, a velocidade continua vindo da distância à
 * borda, que é o que dá a sensação de aproximação:
 *   120 px -> quase parado     70 px -> lento
 *    50 px -> médio            25 px -> rápido
 *
 * A intensidade do gradiente é escrita DIRETO no estilo do elemento, não em
 * estado do React: `mousemove` dispara dezenas de vezes por segundo, e um
 * `setState` por evento repintaria a semana inteira a cada movimento do
 * cursor.
 *
 * Quando a semana inteira já cabe na tela não há o que deslizar; nesse caso a
 * espera de 4 s leva direto à semana vizinha, que é o que o usuário quer ali.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MotionValue } from 'motion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const ZONA = 120
const VELOCIDADE_MAX = 14 // px por frame na borda

/** Quanto tempo o cursor precisa ficar parado na borda antes de o trilho andar. */
const ESPERA_MS = 4000
/** Tremor de mão não é movimento: abaixo disto a contagem não reinicia. */
const TOLERANCIA_PARADO = 4

/** Geometria do anel de contagem, em torno da seta de 36 px. */
const RAIO_ANEL = 16.5
const VOLTA_ANEL = 2 * Math.PI * RAIO_ANEL

function fatorDeVelocidade(distancia: number): number {
  if (distancia > ZONA) return 0
  // curva quadrática: fica lento por mais tempo e acelera de verdade só no fim
  const t = 1 - distancia / ZONA
  return t * t
}

export function TimelineEdgeNavigation({
  x,
  limites,
  alvoRef,
  reduzido,
  onFimDaBorda,
  larguraDia,
}: {
  x: MotionValue<number>
  limites: { left: number; right: number }
  alvoRef: React.RefObject<HTMLDivElement>
  reduzido: boolean
  onFimDaBorda: (direcao: -1 | 1) => void
  larguraDia: number
}) {
  const [lado, setLado] = React.useState<null | 'esq' | 'dir'>(null)
  const faixaRef = React.useRef<Record<'esq' | 'dir', HTMLDivElement | null>>({
    esq: null,
    dir: null,
  })
  const anelRef = React.useRef<Record<'esq' | 'dir', SVGCircleElement | null>>({
    esq: null,
    dir: null,
  })
  const fator = React.useRef(0)

  /** Escreve a intensidade direto no DOM — sem passar pelo React. */
  const pintar = React.useCallback((qual: 'esq' | 'dir', f: number) => {
    const el = faixaRef.current[qual]
    if (!el) return
    el.style.opacity = String(Math.min(1, f * 1.35))
    const seta = el.firstElementChild as HTMLElement | null
    if (!seta) return
    const deslocar = (qual === 'esq' ? -1 : 1) * f * 5
    seta.style.transform = `translateX(${deslocar.toFixed(1)}px) scale(${(0.9 + f * 0.18).toFixed(3)})`
    seta.style.background = `hsl(var(--accent) / ${(f * 0.22).toFixed(3)})`
  }, [])

  /**
   * O anel da contagem, também escrito direto no DOM.
   *
   * `transition: none` + leitura forçada de layout antes de religar a
   * transição: sem isso o navegador funde as duas escritas num quadro só e o
   * anel salta para o fim em vez de percorrer os 4 s.
   */
  const anel = React.useCallback((qual: 'esq' | 'dir', correndo: boolean) => {
    const c = anelRef.current[qual]
    if (!c) return
    c.style.transition = 'none'
    c.style.strokeDashoffset = String(VOLTA_ANEL)
    if (!correndo) return
    void c.getBoundingClientRect()
    c.style.transition = `stroke-dashoffset ${ESPERA_MS}ms linear`
    c.style.strokeDashoffset = '0'
  }, [])

  const direcao = React.useRef<-1 | 1>(1)
  const arrastavel = limites.left < 0

  /**
   * O laço só existe enquanto há deslize em curso.
   *
   * A primeira versão mantinha um `requestAnimationFrame` rodando para sempre,
   * "sem fazer nada" quando o fator era zero. Custa pouco por frame, mas a
   * página nunca fica ociosa: o compositor não descansa, a captura de tela não
   * conclui e, com o vídeo atrás, o custo deixa de ser irrelevante.
   */
  const frameRef = React.useRef(0)
  const rodando = React.useRef(false)
  /** Temporizador da espera de 4 s; `null` quando ninguém está contando. */
  const espera = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  /** De que lado o deslize está em curso — `null` enquanto só se espera. */
  const deslizando = React.useRef<null | 'esq' | 'dir'>(null)
  /** Onde o cursor estava no último evento, para saber se ele ficou parado. */
  const ultimaPos = React.useRef({ x: 0, y: 0 })

  const parar = React.useCallback(() => {
    if (!rodando.current) return
    rodando.current = false
    cancelAnimationFrame(frameRef.current)
  }, [])

  const cancelarEspera = React.useCallback(
    (qual: 'esq' | 'dir') => {
      if (espera.current !== null) {
        clearTimeout(espera.current)
        espera.current = null
      }
      anel(qual, false)
    },
    [anel],
  )

  /**
   * Reagendar a espera depois de cada avanço automático depende de `iniciar`,
   * que por sua vez precisa reagendar — dois `useCallback` não podem se
   * referenciar em círculo. A ponte é esta referência, escrita logo abaixo.
   */
  const agendarRef = React.useRef<(qual: 'esq' | 'dir') => void>(() => {})

  const iniciar = React.useCallback(() => {
    if (rodando.current || reduzido) return
    rodando.current = true
    const passo = () => {
      const f = fator.current
      if (f <= 0.001 || deslizando.current === null) {
        rodando.current = false
        return
      }
      const proximo = x.get() - direcao.current * VELOCIDADE_MAX * f
      const preso = Math.min(limites.right, Math.max(limites.left, proximo))
      x.set(preso)
      // Chegou ao fim do trilho com o cursor ainda no canto: passa a semana e
      // volta a CONTAR. Emendar direto na semana seguinte viraria uma esteira
      // de semanas passando sozinhas, impossível de parar no lugar certo;
      // assim, cada semana nova custa outros 4 s parado — ou um clique.
      if (preso !== proximo) {
        const qual = deslizando.current
        deslizando.current = null
        rodando.current = false
        onFimDaBorda(direcao.current)
        if (qual) agendarRef.current(qual)
        return
      }
      frameRef.current = requestAnimationFrame(passo)
    }
    frameRef.current = requestAnimationFrame(passo)
  }, [limites.left, limites.right, onFimDaBorda, reduzido, x])

  /**
   * Começa (ou recomeça) a contagem de 4 s deste lado.
   *
   * É o único lugar que arma o temporizador: entra aqui quem acabou de chegar
   * à borda, quem se mexeu dentro dela e quem acabou de ganhar uma semana no
   * deslize.
   */
  const agendarEspera = React.useCallback(
    (qual: 'esq' | 'dir') => {
      if (espera.current !== null) clearTimeout(espera.current)
      deslizando.current = null
      parar()
      anel(qual, true)
      espera.current = setTimeout(() => {
        espera.current = null
        anel(qual, false)
        // Sem nada a deslizar — ou com movimento reduzido, onde deslizar não é
        // opção —, a espera leva direto à semana vizinha e recomeça a contar.
        if (!arrastavel || reduzido) {
          onFimDaBorda(qual === 'esq' ? -1 : 1)
          agendarRef.current(qual)
          return
        }
        deslizando.current = qual
        iniciar()
      }, ESPERA_MS)
    },
    [anel, arrastavel, iniciar, onFimDaBorda, parar, reduzido],
  )

  React.useEffect(() => {
    agendarRef.current = agendarEspera
  }, [agendarEspera])

  /** Um clique na seta não espera nada: vai para a semana vizinha agora. */
  const irAgora = React.useCallback(
    (qual: 'esq' | 'dir') => {
      cancelarEspera(qual)
      deslizando.current = null
      parar()
      onFimDaBorda(qual === 'esq' ? -1 : 1)
    },
    [cancelarEspera, onFimDaBorda, parar],
  )

  React.useEffect(
    () => () => {
      if (espera.current !== null) clearTimeout(espera.current)
      cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  React.useEffect(() => {
    const alvo = alvoRef.current
    if (!alvo) return

    /** Fora de qualquer borda: desliga tudo e zera a contagem. */
    const limpar = () => {
      setLado(null)
      fator.current = 0
      deslizando.current = null
      cancelarEspera('esq')
      cancelarEspera('dir')
      pintar('esq', 0)
      pintar('dir', 0)
      parar()
    }

    const aoMover = (e: MouseEvent) => {
      const r = alvo.getBoundingClientRect()
      const dEsq = e.clientX - r.left
      const dDir = r.right - e.clientX
      const foraVertical = e.clientY < r.top || e.clientY > r.bottom

      const qual: 'esq' | 'dir' | null = foraVertical
        ? null
        : dDir <= ZONA && dDir <= dEsq
          ? 'dir'
          : dEsq <= ZONA
            ? 'esq'
            : null

      if (qual === null) {
        limpar()
        return
      }

      const oposto = qual === 'esq' ? 'dir' : 'esq'
      const distancia = Math.max(0, qual === 'esq' ? dEsq : dDir)
      setLado(qual)
      direcao.current = qual === 'esq' ? -1 : 1
      fator.current = fatorDeVelocidade(distancia)
      pintar(qual, fator.current)
      pintar(oposto, 0)

      // Já deslizando deste lado: mover dentro da faixa só muda a velocidade.
      // Reiniciar a contagem aqui faria o trilho parar a cada esbarrão.
      if (deslizando.current === qual) return

      const mexeu =
        Math.abs(e.clientX - ultimaPos.current.x) > TOLERANCIA_PARADO ||
        Math.abs(e.clientY - ultimaPos.current.y) > TOLERANCIA_PARADO
      ultimaPos.current = { x: e.clientX, y: e.clientY }

      // Entrou agora, trocou de lado ou moveu de verdade: a contagem recomeça.
      if (espera.current === null || mexeu || deslizando.current !== null) {
        cancelarEspera(oposto)
        agendarEspera(qual)
      }
    }

    alvo.addEventListener('mousemove', aoMover)
    alvo.addEventListener('mouseleave', limpar)
    return () => {
      alvo.removeEventListener('mousemove', aoMover)
      alvo.removeEventListener('mouseleave', limpar)
    }
  }, [agendarEspera, alvoRef, cancelarEspera, parar, pintar])

  return (
    <>
      {(['esq', 'dir'] as const).map((qual) => {
        const Icone = qual === 'esq' ? ChevronLeft : ChevronRight
        const ativo = lado === qual
        return (
          <div
            key={qual}
            aria-hidden
            ref={(el) => {
              faixaRef.current[qual] = el
            }}
            className={cn(
              'pointer-events-none absolute inset-y-0 z-30 flex w-[120px] items-center',
              qual === 'esq' ? 'left-0 justify-start pl-3' : 'right-0 justify-end pr-3',
            )}
            style={{
              background:
                qual === 'esq'
                  ? 'linear-gradient(90deg, rgba(4,10,18,0.72) 0%, rgba(4,10,18,0.28) 46%, transparent 100%)'
                  : 'linear-gradient(270deg, rgba(4,10,18,0.72) 0%, rgba(4,10,18,0.28) 46%, transparent 100%)',
              // Invisível em repouso. A intensidade é escrita por `pintar`.
              opacity: 0,
              transition: 'opacity 220ms ease-out',
            }}
          >
            {/* A seta só aceita clique quando a borda está acesa. Clicável
                invisível, ela roubaria o clique do último documento da semana,
                que mora exatamente embaixo desta faixa.

                Fica fora da ordem de tabulação de propósito: a mesma navegação
                existe com nome e foco visível na barra de controles, e dois
                caminhos para a mesma coisa só poluiriam o percurso do teclado. */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => irAgora(qual)}
              className={cn(
                'relative grid size-9 place-items-center rounded-full border border-white/10',
                ativo ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none',
              )}
              style={{
                background: 'rgba(255,255,255,0.045)',
                transform: 'scale(0.9)',
                transition: 'transform 200ms ease-out, background 200ms ease-out',
              }}
            >
              {/* Anel da contagem: fecha uma volta nos 4 s da espera. */}
              <svg
                aria-hidden
                viewBox="0 0 36 36"
                className="pointer-events-none absolute inset-0 size-full -rotate-90"
              >
                <circle
                  ref={(el) => {
                    anelRef.current[qual] = el
                  }}
                  cx="18"
                  cy="18"
                  r={RAIO_ANEL}
                  fill="none"
                  stroke="hsl(var(--accent) / 0.75)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray={VOLTA_ANEL}
                  strokeDashoffset={VOLTA_ANEL}
                />
              </svg>
              <Icone className={cn('size-4', ativo ? 'text-accent' : 'text-white/55')} />
            </button>
          </div>
        )
      })}
      {/* largura do dia entra no cálculo de quanto uma "semana" desloca */}
      <span className="hidden" data-largura-dia={larguraDia} />
    </>
  )
}
