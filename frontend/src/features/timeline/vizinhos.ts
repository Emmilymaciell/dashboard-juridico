/**
 * O registro mais próximo antes e depois de uma semana vazia.
 *
 * Existe para o empty state poder dizer "o último registro foi em 14 de agosto"
 * em vez de "nenhum documento" e deixar o usuário perdido no vazio. As duas
 * datas saem da **série diária real** do acervo — nenhuma é calculada, chutada
 * ou arredondada. Se o acervo não tem nada antes, o retorno é `null` e o empty
 * state simplesmente não oferece o atalho.
 *
 * Fica fora de componente porque é regra, não apresentação: o mesmo cálculo
 * serve para a semana, o mês e o ano — só muda a janela que se pula.
 */

import { somarDias } from './week'

export interface RegistroVizinho {
  /** Data ISO do dia com documento. */
  iso: string
  /** Quantos documentos há naquele dia. */
  documentos: number
}

export interface Vizinhos {
  anterior: RegistroVizinho | null
  proximo: RegistroVizinho | null
}

/**
 * @param dias   série diária do acervo (`/timeline?granularidade=dia`)
 * @param inicio primeiro dia do período em questão
 * @param fimDado último dia do período. Omitido, assume a semana de sete dias —
 *                é o que mantém a assinatura antiga válida para quem só tem
 *                semana em mãos.
 */
export function registrosVizinhos(
  dias: { periodo: string; documentos: number }[],
  inicio: string,
  fimDado?: string,
): Vizinhos {
  const fim = fimDado ?? somarDias(inicio, 6)

  let anterior: RegistroVizinho | null = null
  let proximo: RegistroVizinho | null = null

  for (const ponto of dias) {
    if (ponto.documentos <= 0) continue
    if (ponto.periodo < inicio) {
      // A série vem ordenada, mas não confiamos nisso: o mais próximo ANTES é
      // o maior de todos os que ficaram atrás.
      if (!anterior || ponto.periodo > anterior.iso) {
        anterior = { iso: ponto.periodo, documentos: ponto.documentos }
      }
    } else if (ponto.periodo > fim) {
      if (!proximo || ponto.periodo < proximo.iso) {
        proximo = { iso: ponto.periodo, documentos: ponto.documentos }
      }
    }
  }

  return { anterior, proximo }
}
