/**
 * Card analítico do node.
 *
 * Hover no PONTO é uma pergunta diferente de hover no documento: aqui não se
 * quer ver documentos, se quer entender o dia. Por isso o conteúdo é contagem,
 * composição e comparação com a semana — e a apresentação também é outra: o
 * card nasce ABAIXO do node, ligado por uma haste desenhada em `TimelineDay`.
 *
 * A altura é orçada: <= 280 px. O node fica a ~280 px do pé da janela em
 * 1440x900, e o card não tem para onde virar — acima dele está a zona segura
 * do cabeçalho. Card que não cabe não é card rico, é card cortado.
 *
 * A hierarquia é editorial, não tabular. A versão anterior era uma lista de
 * `rótulo | valor` com rótulos em caixa alta de 10 px numa coluna fixa — lia
 * como tabela de propriedades. Aqui a data é manchete, a contagem é o número
 * que importa, e a composição vem como frases curtas com o rótulo em cima do
 * valor, não ao lado.
 */

import { BarChart3 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import type { Coluna } from '../escalas'

interface Linha {
  rotulo: string
  valor: string
}

function resumir(coluna: Coluna): Linha[] {
  const docs = coluna.documentos
  const contar = (chave: (d: (typeof docs)[number]) => string | null | undefined) => {
    const mapa = new Map<string, number>()
    for (const d of docs) {
      const v = chave(d)
      if (!v) continue
      mapa.set(v, (mapa.get(v) ?? 0) + 1)
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }

  const naturezas = contar((d) => d.natureza)
  const destinos = contar((d) => d.destinatario)
  const materias = contar((d) => d.macrogrupo_juridico)

  const linhas: Linha[] = []
  if (naturezas.length) {
    linhas.push({
      rotulo: naturezas.length === 1 ? 'Natureza' : 'Naturezas',
      valor: naturezas
        .slice(0, 2)
        .map(([n, c]) => (naturezas.length > 1 ? `${n} (${c})` : n))
        .join(' · '),
    })
  }
  if (destinos.length) {
    linhas.push({
      rotulo: destinos.length === 1 ? 'Destinatário' : 'Destinatários',
      valor:
        destinos.length === 1
          ? (destinos[0]?.[0] ?? '—')
          : `${destinos[0]?.[0]} e mais ${destinos.length - 1}`,
    })
  }
  if (materias.length) {
    linhas.push({
      rotulo: 'Matéria',
      valor: materias
        .slice(0, 2)
        .map(([n, c]) => (materias.length > 1 ? `${n} (${c})` : n))
        .join(' · '),
    })
  }
  return linhas
}

export function PeriodInfoCard({
  coluna,
  mediaSemanal,
  compacto = false,
}: {
  coluna: Coluna
  mediaSemanal: number
  /**
   * Janela baixa: o card encolhe em vez de transbordar.
   *
   * O que sai é o sobrescrito ("Contexto do dia") e a terceira linha de
   * composição — nunca o corpo do texto, que continua em 12,5 px. Card que
   * encolhe até ficar ilegível não resolveu o problema, trocou de problema.
   */
  compacto?: boolean
}) {
  const todas = React.useMemo(() => resumir(coluna), [coluna])
  /**
   * Com o que esta coluna está sendo comparada.
   *
   * Sai da própria coluna, sem precisar saber a escala: coluna que começa e
   * termina no mesmo dia É um dia; se cobre um intervalo, é um mês. Dizer
   * "média das colunas" seria falar a língua do código dentro do produto.
   */
  const paresDaColuna = coluna.inicio === coluna.fim ? 'dias' : 'meses'
  const linhas = compacto ? todas.slice(0, 2) : todas
  const desvio = mediaSemanal > 0 ? Math.round(((coluna.total - mediaSemanal) / mediaSemanal) * 100) : 0
  const acima = desvio > 0

  return (
    <div className={cn('w-[296px]', compacto ? 'px-4 pb-3.5 pt-3' : 'p-4')}>
      {/* ------------------------------------------------------ manchete */}
      {compacto ? null : (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          Contexto do período
        </p>
      )}
      <h4 className="mt-1 text-[16px] font-semibold leading-tight tracking-tight text-white">
        {coluna.rotuloLongo}
      </h4>

      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[23px] font-semibold leading-none tabular-nums text-accent">
          {coluna.total}
        </span>
        <span className="text-[12.5px] text-white/50">
          {coluna.total === 1 ? 'documento' : 'documentos'}
        </span>
      </p>

      {/* --------------------------------------------------- composição */}
      {linhas.length > 0 ? (
        <dl className={cn(compacto ? "mt-3 space-y-2" : "mt-3.5 space-y-2.5")}>
          {linhas.map((l, i) => (
            <div
              key={l.rotulo}
              className="stagger-in"
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              <dt className="text-[10px] uppercase tracking-[0.13em] text-white/35">{l.rotulo}</dt>
              <dd className="mt-0.5 text-[12.5px] leading-snug text-white/[0.86]">{l.valor}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-white/45">
          Nenhum documento neste período dentro do recorte atual. A data continua
          válida — a ausência é do acervo, não do calendário.
        </p>
      )}

      {/* -------------------------------------------------------- insight
          Uma linha, não uma caixa. A caixa custava ~50 px de altura e era ela
          que fazia o card estourar os 280 px disponíveis abaixo do node em
          1440x900 — e card cortado não informa nada. A mesma frase cabe numa
          linha com o ícone à frente. */}
      {coluna.total > 0 && mediaSemanal > 0 ? (
        <p
          className={cn(
            'stagger-in flex items-center gap-2 border-t border-white/[0.07] text-[11.5px] leading-snug',
            compacto ? 'mt-3 pt-2.5' : 'mt-3.5 pt-3',
          )}
          style={{ animationDelay: `${100 + linhas.length * 50}ms` }}
        >
          <BarChart3
            className={cn('size-3.5 shrink-0', acima ? 'text-accent' : 'text-white/40')}
          />
          <span className="min-w-0">
            {desvio === 0 ? (
              <span className="text-white/70">Na média da semana</span>
            ) : (
              <>
                <span className={cn('font-semibold', acima ? 'text-accent' : 'text-white/80')}>
                  {Math.abs(desvio)}% {acima ? 'acima' : 'abaixo'}
                </span>
                <span className="text-white/45">
                  {' '}da média d{paresDaColuna === 'dias' ? 'os dias' : 'os meses'} com documento
                </span>
              </>
            )}
          </span>
        </p>
      ) : null}
    </div>
  )
}
