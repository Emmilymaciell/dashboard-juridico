/**
 * Cross-filter da Visão Geral.
 *
 * NÃO é um estado novo. A fonte da verdade do filtro é a URL desde a `DEC-011`,
 * e `useFilters` já faz tudo o que um cross-filter precisa: acumula dimensões,
 * alterna valor, remove um chip, limpa tudo, e sobrevive a recarregar a página
 * e a compartilhar o link. Criar um `GlobalDashboardFilterState` ao lado dele
 * seria uma segunda fonte de verdade — e duas fontes de verdade sobre o mesmo
 * recorte é como se produz tela que discorda de si mesma.
 *
 * O que falta ali, e mora aqui, é o vocabulário do gráfico: um gráfico clica em
 * "Sancionatório", não em `macrogrupo=Sancionatório`; clica num mês, não num par
 * de datas. Esta camada traduz uma dimensão visual para a chave de filtro, e é
 * o único lugar da página que conhece essa tradução.
 *
 *   GRÁFICO -> aplicar(dimensão, valor) -> URL -> queries -> TODOS os gráficos
 *
 * Nenhum gráfico conhece outro gráfico.
 */

import * as React from 'react'

import { useFilters } from '@/lib/filters'

/** O que um gráfico consegue selecionar. */
export type Dimensao =
  | 'materia'
  | 'natureza'
  | 'tema'
  | 'destinatario'
  | 'rodovia'
  | 'contrato'
  | 'ano'
  | 'mes'
  | 'dia'

/** Dimensões que viram lista de valores acumuláveis na URL. */
const CHAVE_MULTIPLA = {
  materia: 'macrogrupo',
  natureza: 'natureza',
  tema: 'tema',
  destinatario: 'destinatario',
  rodovia: 'rodovia',
  contrato: 'contrato',
} as const

type DimensaoMultipla = keyof typeof CHAVE_MULTIPLA

function ehMultipla(d: Dimensao): d is DimensaoMultipla {
  return d in CHAVE_MULTIPLA
}

/**
 * Intervalo fechado de uma seleção temporal.
 *
 * Ano `2026` -> 01/01 a 31/12. Mês `2026-03` -> 01/03 a 31/03, com o último dia
 * calculado (`new Date(ano, mes, 0)` devolve o último dia do mês anterior ao
 * índice, que com `mes` 1-based é exatamente o último dia do mês pedido). Dia é
 * ele mesmo nas duas pontas.
 */
export function intervaloDe(dimensao: 'ano' | 'mes' | 'dia', valor: string) {
  if (dimensao === 'dia') return { inicio: valor, fim: valor }
  if (dimensao === 'ano') return { inicio: `${valor}-01-01`, fim: `${valor}-12-31` }
  const [ano, mes] = valor.split('-')
  const ultimo = new Date(Number(ano), Number(mes), 0).getDate()
  return { inicio: `${valor}-01`, fim: `${valor}-${String(ultimo).padStart(2, '0')}` }
}

export interface Cruzamento {
  /** Clique: liga o filtro; clicar de novo no mesmo valor desliga. */
  aplicar: (dimensao: Dimensao, valor: string) => void
  /**
   * Duas dimensões de uma vez, para a célula de uma matriz.
   *
   * Existe porque `aplicar` duas vezes seguidas NÃO funciona: as duas chamadas
   * leem o mesmo instantâneo da URL e a segunda apaga a primeira. Aqui as duas
   * entram na mesma escrita.
   */
  aplicarVarios: (selecoes: Array<{ dimensao: Dimensao; valor: string }>) => void
  /** O valor está selecionado agora? Usado para destacar e para atenuar o resto. */
  ativo: (dimensao: Dimensao, valor: string) => boolean
  /** Alguma coisa desta dimensão está selecionada? */
  dimensaoAtiva: (dimensao: Dimensao) => boolean
  /** Quantas seleções existem no total, de qualquer dimensão. */
  total: number
}

export function useCruzamento(): Cruzamento {
  const { filters, toggle, setMany } = useFilters()

  const aplicar = React.useCallback(
    (dimensao: Dimensao, valor: string) => {
      if (ehMultipla(dimensao)) {
        toggle(CHAVE_MULTIPLA[dimensao], valor)
        return
      }
      // Tempo não acumula: dois períodos selecionados ao mesmo tempo seriam uma
      // união que a API não sabe expressar com um intervalo só. Clicar num
      // segundo período troca o recorte; clicar no mesmo de novo desfaz.
      const { inicio, fim } = intervaloDe(dimensao, valor)
      const mesmo = filters.data_inicio === inicio && filters.data_fim === fim
      setMany({
        data_inicio: mesmo ? null : inicio,
        data_fim: mesmo ? null : fim,
      })
    },
    [filters.data_inicio, filters.data_fim, setMany, toggle],
  )

  const aplicarVarios = React.useCallback(
    (selecoes: Array<{ dimensao: Dimensao; valor: string }>) => {
      const mudancas: Record<string, string | string[] | null> = {}
      for (const { dimensao, valor } of selecoes) {
        if (ehMultipla(dimensao)) {
          const chave = CHAVE_MULTIPLA[dimensao]
          const atuais = (mudancas[chave] as string[] | undefined) ?? filters[chave] ?? []
          mudancas[chave] = atuais.includes(valor) ? atuais : [...atuais, valor]
          continue
        }
        const { inicio, fim } = intervaloDe(dimensao, valor)
        mudancas['data_inicio'] = inicio
        mudancas['data_fim'] = fim
      }
      setMany(mudancas)
    },
    [filters, setMany],
  )

  const ativo = React.useCallback(
    (dimensao: Dimensao, valor: string) => {
      if (ehMultipla(dimensao)) {
        return (filters[CHAVE_MULTIPLA[dimensao]] ?? []).includes(valor)
      }
      const { inicio, fim } = intervaloDe(dimensao, valor)
      return filters.data_inicio === inicio && filters.data_fim === fim
    },
    [filters],
  )

  const dimensaoAtiva = React.useCallback(
    (dimensao: Dimensao) => {
      if (ehMultipla(dimensao)) return (filters[CHAVE_MULTIPLA[dimensao]] ?? []).length > 0
      return Boolean(filters.data_inicio || filters.data_fim)
    },
    [filters],
  )

  const total = React.useMemo(() => {
    let n = 0
    for (const chave of Object.values(CHAVE_MULTIPLA)) n += filters[chave]?.length ?? 0
    if (filters.data_inicio || filters.data_fim) n += 1
    return n
  }, [filters])

  return { aplicar, aplicarVarios, ativo, dimensaoAtiva, total }
}
