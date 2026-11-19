/**
 * Controles da linha do tempo.
 *
 * São dois grupos, e eles não moram mais no mesmo lugar.
 *
 * O DESTINO — ir para uma data — subiu para a barra de filtros do shell, no
 * canto direito, logo abaixo do carimbo de atualização dos dados. É a mesma
 * família das outras perguntas que recortam o acervo ("qual período?", "qual
 * natureza?"), e ali ele fica junto de quem pertence em vez de ocupar uma
 * fileira própria em cima da timeline. Por isso `SaltoDeData` é exportado à
 * parte e desenhado com os tokens do shell, não com os da timeline: naquele
 * ponto da tela o fundo é a superfície do app, que acompanha tema claro e
 * escuro, e não o vídeo.
 *
 * A LEITURA — escala, Hoje e as setas de semana — continua colada na faixa,
 * porque só faz sentido junto do eixo que ela move.
 *
 * As três escalas estão vivas. A coluna muda — dia na semana e no mês, mês no
 * ano —, o resto da gramática não: mesma pilha, mesmo eixo, mesmo ponto.
 */

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/ui/primitives'

export type EscalaTemporal = 'ano' | 'mes' | 'semana'

function BotaoIcone({
  children,
  rotulo,
  onClick,
  desabilitado,
}: {
  children: React.ReactNode
  rotulo: string
  onClick: () => void
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      className="grid size-9 cursor-pointer place-items-center rounded-md text-white/65
                 outline-none transition-all duration-150
                 hover:bg-white/[0.09] hover:text-white
                 active:translate-y-px
                 focus-visible:ring-2 focus-visible:ring-accent
                 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent
                 disabled:hover:translate-y-0"
    >
      {children}
    </button>
  )
}

/**
 * Ir para uma data.
 *
 * Mora na barra de filtros do shell, por portal — ver `TimelinePage`. Daí os
 * tokens do design system (`border-line`, `bg-surface`, `text-ink`) em vez do
 * branco sobre vídeo: aqui embaixo o fundo troca com o tema, e branco fixo
 * ficaria invisível no tema claro.
 *
 * Nada de `color-scheme` fixo no input: o `ThemeProvider` já escreve o esquema
 * no elemento raiz, e o seletor nativo do navegador herda o tema certo.
 */
export function SaltoDeData({
  dataAlvo,
  onDataAlvo,
  onIrParaSemana,
}: {
  dataAlvo: string
  onDataAlvo: (iso: string) => void
  onIrParaSemana: () => void
}) {
  return (
    <div
      // `h-8`: a mesma altura dos filtros ao lado. Com a caixa dimensionada
      // pelo conteúdo ela ficava 10 px mais alta que todos os vizinhos e era
      // ela quem passava a definir a altura da barra inteira.
      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface pl-2 pr-1
                 transition-colors duration-150 focus-within:border-accent/45"
    >
      <CalendarDays className="size-3.5 shrink-0 text-ink-faint" />
      <input
        type="date"
        value={dataAlvo}
        onChange={(e) => onDataAlvo(e.target.value)}
        className="w-[7.5rem] bg-transparent text-xs text-ink outline-none
                   [&::-webkit-calendar-picker-indicator]:cursor-pointer
                   [&::-webkit-calendar-picker-indicator]:opacity-45
                   hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
        aria-label="Ir para a semana de uma data"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={onIrParaSemana}
        className="group h-6 gap-1 px-2 font-semibold text-accent hover:text-accent"
      >
        Ir
        <ChevronRight className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </Button>
    </div>
  )
}

export function TimelineToolbar({
  escala,
  onEscala,
  unidade,
  onHoje,
  onPassoSemana,
  podeVoltar,
  podeAvancar,
}: {
  escala: EscalaTemporal
  onEscala: (e: EscalaTemporal) => void
  /** 'semana' | 'mês' | 'ano' — as setas dizem para onde levam de verdade. */
  unidade: string
  onHoje: () => void
  onPassoSemana: (direcao: -1 | 1) => void
  podeVoltar: boolean
  podeAvancar: boolean
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
      <div className="flex items-center gap-0.5" role="group" aria-label="Escala de leitura">
        {(['ano', 'mes', 'semana'] as const).map((op) => {
          const ativo = escala === op
          return (
            <button
              key={op}
              type="button"
              onClick={() => onEscala(op)}
              aria-pressed={ativo}
              className={cn(
                'cursor-pointer rounded-md px-3.5 py-1.5 text-sm font-semibold outline-none',
                'transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent',
                ativo
                  ? 'bg-accent/90 text-[#04212b]'
                  : 'text-white/60 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              {op === 'ano' ? 'Ano' : op === 'mes' ? 'Mês' : 'Semana'}
            </button>
          )
        })}
      </div>

      <span aria-hidden className="mx-1 h-5 w-px bg-white/[0.09]" />

      <button
        type="button"
        onClick={onHoje}
        className="cursor-pointer rounded-md px-3.5 py-1.5 text-sm font-semibold text-white/65
                   outline-none transition-all duration-150
                   hover:bg-white/[0.09] hover:text-white active:translate-y-px
                   focus-visible:ring-2 focus-visible:ring-accent"
      >
        Hoje
      </button>
      <BotaoIcone
        rotulo={`${unidade === 'semana' ? 'Semana' : unidade === 'mês' ? 'Mês' : 'Ano'} anterior`}
        onClick={() => onPassoSemana(-1)}
        desabilitado={!podeVoltar}
      >
        <ChevronLeft className="size-[1.125rem]" />
      </BotaoIcone>
      <BotaoIcone
        rotulo={`${unidade === 'semana' ? 'Próxima semana' : unidade === 'mês' ? 'Próximo mês' : 'Próximo ano'}`}
        onClick={() => onPassoSemana(1)}
        desabilitado={!podeAvancar}
      >
        <ChevronRight className="size-[1.125rem]" />
      </BotaoIcone>
    </div>
  )
}
