/**
 * Regras da página Rodovias, fora do componente para poderem ser testadas.
 *
 * O ponto delicado desta tela é a relação entre a ABA ATIVA e o FILTRO GLOBAL
 * de rodovia. Duas coisas que parecem estado e precisam ser uma só: aba dizendo
 * RD-102A enquanto o filtro diz RD-104 seria um defeito grave.
 *
 * A resolução: **a aba não tem estado próprio**. Ela É o filtro `rodovia` da
 * URL. Clicar numa aba escreve exatamente uma rodovia nesse filtro; o filtro
 * global escrevendo ali muda a aba pelo mesmo caminho. Não existe segundo
 * lugar onde a seleção possa morar, então não existe como discordarem.
 *
 * Consequência que precisa ser dita: o filtro de rodovia, NESTA PÁGINA, deixa
 * de recortar os dados e passa a escolher o que se lê. Por isso a consulta que
 * alimenta a tela ignora essa dimensão — senão selecionar uma aba apagaria as
 * outras da própria régua de abas. Todos os outros filtros (período, natureza,
 * destinatário, contrato) continuam recortando normalmente.
 */

import type { DocumentFilterValues } from '@/lib/api'

/**
 * Acento de cada rodovia — decoração para distinguir as abas, não codificação
 * de dado. É fixo por NOME porque a alternativa (posição na lista) faria a cor
 * trocar sempre que um filtro mudasse o ranking por volume.
 *
 * Rodovia nova entra aqui; sem entrada, cai na reserva, que é cinza-aço e não
 * compete com as quatro do programa.
 */
const ACENTO_POR_RODOVIA: Record<string, number> = {
  'RD-102A': 0, // ciano Programa
  'RD-101': 1, // azul petróleo
  'RD-103': 2, // verde do Parceiro
  'RD-104': 3, // âmbar
}

const ACENTO_RESERVA = 7 // aço

export function indiceDoAcento(rodovia: string): number {
  return ACENTO_POR_RODOVIA[rodovia] ?? ACENTO_RESERVA
}

/** Cor CSS do acento, para `style` e SVG. */
export function acentoDaRodovia(rodovia: string, alfa = 1): string {
  const token = `var(--data-${indiceDoAcento(rodovia) + 1})`
  return alfa === 1 ? `hsl(${token})` : `hsl(${token} / ${alfa})`
}

/**
 * Ordem da régua de abas: ALFABÉTICA, e é decisão.
 *
 * A lista chega do backend ordenada por volume, e volume muda com filtro: pôr
 * uma natureza no recorte reordenava as abas embaixo do cursor. Régua de
 * navegação que dança a cada filtro não é navegação, é sobressalto. `numeric`
 * para "RD-101" vir antes de "RD-102A" como número, não como texto.
 */
export function ordemDasAbas<T extends { rodovia: string }>(rodovias: T[]): T[] {
  return [...rodovias].sort((a, b) =>
    a.rodovia.localeCompare(b.rodovia, 'pt-BR', { numeric: true }),
  )
}

/**
 * Qual rodovia está ativa.
 *
 * O filtro é multivalorado — nada impede a usuária de marcar duas no menu
 * global. A aba é única, então vale a PRIMEIRA que também exista na lista da
 * página. Nunca devolve uma rodovia fora da régua, porque isso deixaria a régua
 * sem nenhuma aba marcada.
 *
 * Sem filtro, abre na `padrao` — que a página calcula como a rodovia de maior
 * volume. A régua é alfabética para não se mexer; a primeira LEITURA é a obra
 * com mais documentos, que é a que quase sempre se quer ver.
 */
export function rodoviaAtiva(
  disponiveis: string[],
  filtroRodovia: string[] | undefined,
  padrao?: string | null,
): string | null {
  if (disponiveis.length === 0) return null
  const escolhida = (filtroRodovia ?? []).find((r) => disponiveis.includes(r))
  if (escolhida) return escolhida
  if (padrao && disponiveis.includes(padrao)) return padrao
  return disponiveis[0]!
}

/**
 * Filtros para a consulta que alimenta a página.
 *
 * `rodovia` sai: aqui ela seleciona, não recorta. Sem isso, escolher uma aba
 * devolveria uma lista de uma rodovia só e as outras abas sumiriam.
 */
export function filtrosDaConsulta(filters: DocumentFilterValues): DocumentFilterValues {
  const { rodovia: _ignorada, ...resto } = filters
  return resto
}

/**
 * O que escrever na URL ao clicar numa aba: exatamente uma rodovia, trocando a
 * anterior. Os demais filtros ficam onde estão — trocar de rodovia não é
 * motivo para perder o período ou a natureza que a usuária escolheu.
 */
export function selecaoDaAba(rodovia: string): Record<string, string[]> {
  return { rodovia: [rodovia] }
}
