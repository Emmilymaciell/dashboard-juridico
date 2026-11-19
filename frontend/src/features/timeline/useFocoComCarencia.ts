/**
 * Qual popover está aberto, com carência no fechamento.
 *
 * O problema que isto resolve: os cards nascem num portal, a 12 px do gatilho.
 * Fechar no `mouseleave` do gatilho significava que o cursor nunca CHEGAVA no
 * card — ao cruzar o vão o popover já tinha sumido, e nada dentro dele era
 * clicável. Na prática "Abrir documento" e "Ver mais" só funcionavam por
 * teclado.
 *
 * A regra: sair do gatilho apenas AGENDA o fechamento; entrar no card cancela
 * o agendamento. Enquanto o cursor estiver no gatilho ou no card, fica aberto.
 *
 * `foco` é um valor só, com três estados excludentes — é o que torna
 * impossível os dois popovers do dia abrirem ao mesmo tempo.
 *
 * Vive fora do componente porque é máquina de estado, não apresentação: tem
 * temporizador, tem limpeza no desmonte, e é exatamente o tipo de coisa que
 * quebra em silêncio quando alguém mexe no componente sem perceber.
 */

import * as React from 'react'

export type Foco = 'nenhum' | 'documentos' | 'node'

/**
 * Tempo do trajeto do cursor entre o gatilho e o card, não uma pausa
 * perceptível: curto o bastante para o card não ficar grudado quando o cursor
 * sai de vez, longo o bastante para atravessar os 12 px sem pressa.
 */
export const CARENCIA_MS = 160

export interface FocoComCarencia {
  foco: Foco
  /** Cursor entrou no gatilho: abre e cancela qualquer fechamento pendente. */
  abrir: (qual: Exclude<Foco, 'nenhum'>) => void
  /** Cursor saiu do gatilho ou do card: agenda o fechamento. */
  agendarFechamento: () => void
  /** Cursor entrou no card: o fechamento agendado é cancelado. */
  cancelarFechamento: () => void
  /** Esc, clique fora, seleção — fecha na hora, sem carência. */
  fecharAgora: () => void
}

export function useFocoComCarencia(carencia = CARENCIA_MS): FocoComCarencia {
  const [foco, setFoco] = React.useState<Foco>('nenhum')
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelarFechamento = React.useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  const agendarFechamento = React.useCallback(() => {
    cancelarFechamento()
    timer.current = setTimeout(() => {
      timer.current = null
      setFoco('nenhum')
    }, carencia)
  }, [cancelarFechamento, carencia])

  const abrir = React.useCallback(
    (qual: Exclude<Foco, 'nenhum'>) => {
      cancelarFechamento()
      setFoco(qual)
    },
    [cancelarFechamento],
  )

  const fecharAgora = React.useCallback(() => {
    cancelarFechamento()
    setFoco('nenhum')
  }, [cancelarFechamento])

  // Desmontar com um fechamento agendado deixaria o `setState` órfão.
  React.useEffect(() => cancelarFechamento, [cancelarFechamento])

  return { foco, abrir, agendarFechamento, cancelarFechamento, fecharAgora }
}
