/**
 * Como as dimensões se relacionam.
 *
 *   para quem -> com que tipo -> sobre o quê   -> FluxoDoAcervo (Sankey)
 *   quem concentra a interlocução              -> BarrasRadiais
 *   que naturezas são estruturais              -> DispersaoDeNaturezas
 *
 * O SANKEY É HONESTO POR CONSTRUÇÃO, e isso exigiu cuidado. Ele NÃO afirma o
 * cruzamento triplo destinatário × natureza × matéria: afirma duas travessias
 * independentes, cada uma vinda de uma contagem real do `/matrix`. A distinção
 * importa porque `Minuta` sozinha se espalha por sete matérias e
 * `Ofício / Carta` por cinco — natureza NÃO determina matéria, e compor as duas
 * travessias para afirmar "Parceiro mandou uma minuta sancionatória" seria inventar
 * um número que ninguém contou. Cada fita é um par que existe; clicar numa fita
 * filtra por esse par, e só por ele.
 */

import * as React from 'react'

import { baseOption, EChart, tooltipStyle, useChartTokens, withAlpha } from '@/charts/EChart'
import { num, pct } from '@/lib/format'

const TITULO = (texto: string) =>
  `<div style="font-weight:650;margin-bottom:5px;font-size:12px">${texto}</div>`

const LINHA = (rotulo: string, valor: string, cor: string) =>
  `<div style="display:flex;justify-content:space-between;gap:20px;line-height:1.5">
     <span style="color:${cor}">${rotulo}</span><b style="font-variant-numeric:tabular-nums">${valor}</b>
   </div>`

/* ========================================================= barras radiais */

/**
 * Destinatários em barras radiais.
 *
 * O lollipop anterior lia bem e não tinha defeito — o que ele não fazia era
 * caber. Em um terço da faixa, treze hastes horizontais com rótulo à esquerda
 * consomem largura que o painel não tem. A barra radial resolve o mesmo ranking
 * num quadrado, e mantém o comprimento como codificação do valor: o ângulo é
 * só o lugar de cada um, e todos têm o mesmo ângulo.
 */
export function BarrasRadiais({
  itens,
  altura = 330,
  maximo = 9,
  ativa,
  haSelecao = false,
  onSelect,
}: {
  itens: Array<{ chave: string; documentos: number }>
  altura?: number
  maximo?: number
  ativa?: (chave: string) => boolean
  haSelecao?: boolean
  onSelect?: (chave: string) => void
}) {
  const tokens = useChartTokens()

  const option = React.useMemo(() => {
    const ordenados = [...itens].sort((a, b) => b.documentos - a.documentos).slice(0, maximo)
    const total = itens.reduce((a, i) => a + i.documentos, 0) || 1
    const maiorValor = Math.max(1, ...ordenados.map((i) => i.documentos))
    // Categorias de trás para frente: o ECharts começa o eixo angular embaixo,
    // e o maior deve abrir a leitura no topo.
    const categorias = [...ordenados].reverse()

    return {
      ...baseOption(tokens),
      animationDuration: 700,
      grid: undefined,
      tooltip: {
        ...tooltipStyle(tokens),
        trigger: 'item',
        formatter: (params: unknown) => {
          const it = params as { name: string; value: number }
          return `<div style="min-width:186px">${TITULO(it.name)}${LINHA(
            'documentos',
            num(it.value),
            tokens.inkMuted,
          )}${LINHA('do recorte', pct((it.value / total) * 100), tokens.inkMuted)}
          <div style="margin-top:6px;color:${tokens.accent};font-size:10.5px">clique para filtrar</div></div>`
        },
      },
      polar: { center: ['50%', '52%'], radius: ['20%', '88%'] },
      angleAxis: {
        type: 'category',
        data: categorias.map((i) => i.chave),
        startAngle: 90,
        axisLine: { show: false },
        axisTick: { show: false },
        /**
         * O nome fica NO ANEL, do lado de fora das barras.
         *
         * Dentro da barra ele só cabe enquanto a barra é longa: com nove
         * destinatários e uma queda rápida do primeiro para o nono, metade dos
         * rótulos ficava espremida contra o centro, girada e ilegível. Fora,
         * todos ocupam o mesmo arco e leem igual.
         */
        axisLabel: {
          show: true,
          color: tokens.inkMuted,
          fontSize: 12,
          margin: 12,
          formatter: (nome: string) => (nome.length > 22 ? `${nome.slice(0, 21)}…` : nome),
        },
        splitLine: { show: false },
        z: 10,
      },
      radiusAxis: {
        max: maiorValor * 1.02,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          coordinateSystem: 'polar',
          data: categorias.map((item) => {
            const selecionada = ativa?.(item.chave) ?? false
            return {
              name: item.chave,
              value: item.documentos,
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 1,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: withAlpha(tokens.accent, 0.42) },
                    { offset: 1, color: selecionada ? tokens.cyan : tokens.accent },
                  ],
                },
                opacity: haSelecao && !selecionada ? 0.26 : 1,
                borderRadius: [0, 6, 6, 0],
              },
            }
          }),
          roundCap: true,
          barWidth: '86%',
          label: {
            show: true,
            position: 'middle',
            formatter: (p: { value: number }) => num(p.value),
            color: tokens.ink,
            fontSize: 16,
            fontWeight: 700,
          },
          emphasis: { itemStyle: { opacity: 1 } },
        },
      ],
    }
  }, [itens, maximo, tokens, ativa, haSelecao])

  return (
    <EChart
      option={option}
      height={altura}
      ariaLabel="Documentos por destinatário"
      onEvent={{ click: (p) => p.name && onSelect?.(String(p.name)) }}
    />
  )
}
