/**
 * Período sem documento — semana, mês ou ano.
 *
 * A timeline continua atrás — os nodes, as datas, o eixo. O que muda é que
 * o vão onde as pilhas estariam passa a dizer o que está acontecendo e oferece
 * os dois saltos que o usuário quer nessa hora: o último registro antes e o
 * próximo depois.
 *
 * As duas datas vêm da série diária real. Se o acervo não tem nada de um dos
 * lados, aquele atalho não aparece — em vez de mostrar um botão morto.
 *
 * Não é modal, não é card gigante e não cobre o eixo: é um bloco discreto no
 * lugar exato onde faltam documentos.
 */

import { ArrowLeft, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Vizinhos } from '../vizinhos'
import { rotuloDataLongo } from '../week'

function Atalho({
  sentido,
  iso,
  documentos,
  onIr,
}: {
  sentido: 'anterior' | 'proximo'
  iso: string
  documentos: number
  onIr: (iso: string) => void
}) {
  const anterior = sentido === 'anterior'
  const Icone = anterior ? ArrowLeft : ArrowRight
  return (
    <button
      type="button"
      onClick={() => onIr(iso)}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.09]',
        'bg-white/[0.035] px-3.5 py-2.5 text-left outline-none',
        'transition-all duration-200 hover:border-accent/30 hover:bg-accent/[0.07]',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070d16]',
        anterior ? 'flex-row' : 'flex-row-reverse text-right',
      )}
    >
      <Icone
        className={cn(
          'size-4 shrink-0 text-white/35 transition-all duration-200',
          'group-hover:text-accent',
          anterior ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5',
        )}
      />
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-white/35">
          {anterior ? 'Último registro' : 'Próximo registro'}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-medium text-white/85">
          {rotuloDataLongo(iso)}
        </span>
        <span className="block text-[11px] tabular-nums text-white/40">
          {documentos === 1 ? '1 documento' : `${documentos} documentos`}
        </span>
      </span>
    </button>
  )
}

export function TimelineEmptyWeek({
  vizinhos,
  unidade,
  onIr,
  className,
}: {
  vizinhos: Vizinhos
  /** 'semana' | 'mês' | 'ano' — o texto fala do período em leitura. */
  unidade: string
  /** Leva à semana daquele dia — pelo travel, não por salto seco. */
  onIr: (iso: string) => void
  className?: string
}) {
  const { anterior, proximo } = vizinhos
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center',
        className,
      )}
    >
      <p className="text-[13px] font-medium text-white/60">
        Nenhum documento {unidade === 'ano' ? 'neste ano' : `nest${unidade === 'mês' ? 'e' : 'a'} ${unidade}`}
      </p>
      <p className="mt-1 max-w-[30rem] text-center text-[11.5px] leading-relaxed text-white/35">
        As datas continuam válidas. A ausência é do acervo, não do calendário.
      </p>

      {anterior || proximo ? (
        <div className="pointer-events-auto mt-4 flex flex-wrap items-stretch justify-center gap-2.5">
          {anterior ? (
            <Atalho
              sentido="anterior"
              iso={anterior.iso}
              documentos={anterior.documentos}
              onIr={onIr}
            />
          ) : null}
          {proximo ? (
            <Atalho
              sentido="proximo"
              iso={proximo.iso}
              documentos={proximo.documentos}
              onIr={onIr}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
