/**
 * Formas de gráfico, cada uma para uma pergunta diferente.
 *
 * A versão anterior usava barra horizontal para natureza, tema E destinatário —
 * três gráficos idênticos lado a lado. Agora:
 *
 *   composição do acervo        -> NatureTreemap (área = volume)
 *   ranking de interlocutores   -> Lollipop (haste + bolha, leitura de posição)
 *   concentração temática       -> ThemeBars (barra com trilha, share explícito)
 *   produção no tempo           -> ProductionChart (colunas grandes, sem média móvel)
 *   proporção entre matérias    -> ProportionBar (barra única segmentada)
 *   cruzamento de dimensões     -> Heatmap
 *   série compacta em linha     -> MiniSeries
 *   duas ou três situações      -> Donut (parte/todo, com o total no centro)
 *
 * Pizza, 3D e gauge decorativo continuam fora, de propósito. A rosca entrou
 * com escopo estreito — ver a nota em `EChart.tsx`.
 */

import * as React from 'react'

import {
  axisStyle,
  baseOption,
  EChart,
  tooltipStyle,
  useChartTokens,
  withAlpha,
} from '@/charts/EChart'
import type { ContagemItem, PontoTemporal } from '@/lib/api'
import { monthLabel, num } from '@/lib/format'
import { coresPorMateria } from '@/lib/utils'

const ROW = (label: string, value: string, muted: string) =>
  `<div style="display:flex;justify-content:space-between;gap:22px;line-height:1.5">
     <span style="color:${muted}">${label}</span>
     <b style="font-variant-numeric:tabular-nums">${value}</b>
   </div>`

const TITLE = (text: string) =>
  `<div style="font-weight:650;margin-bottom:5px;font-size:12px">${text}</div>`

/* ============================================================ produção mensal */

export type ProductionPoint = PontoTemporal

/**
 * Colunas grandes por mês. Sem média móvel (removida a pedido). Todos os meses
 * rotulados, com marcação de virada de ano no eixo.
 */
export function ProductionChart({
  points,
  height = 380,
  onSelectPeriod,
  highlightSanctions = false,
}: {
  points: ProductionPoint[]
  height?: number
  onSelectPeriod?: (periodo: string) => void
  highlightSanctions?: boolean
}) {
  const tokens = useChartTokens()

  const option = React.useMemo(() => {
    const labels = points.map((p) => monthLabel(p.periodo))
    const maxValue = Math.max(1, ...points.map((p) => p.documentos))
    // Marca a troca de ano com uma linha vertical discreta.
    const yearBreaks = points
      .map((p, i) => ({ i, ano: p.periodo.slice(0, 4) }))
      .filter((x, i, arr) => i > 0 && arr[i - 1]!.ano !== x.ano)

    // Empilhamento de verdade, não sobreposição.
    //
    // Antes as duas séries eram barras sobrepostas com `barGap: '-100%'`: a
    // coluna cheia era o TOTAL e a âmbar ficava por cima dela. Lia-se bem, mas
    // impedia a pergunta "quanto do mês NÃO é sancionatório" — a parte de baixo
    // da coluna azul continuava valendo o total, não a diferença. Agora a
    // âmbar é a base, a ciano é o resto, e a soma das duas é a altura.
    const sancionatorios = points.map((p) => p.sancionatorios ?? 0)
    const demais = points.map((p, i) => Math.max(0, p.documentos - sancionatorios[i]!))
    const empilha = highlightSanctions && sancionatorios.some((v) => v > 0)

    const series: Record<string, unknown>[] = [
      {
        name: empilha ? 'Demais matérias' : 'Documentos',
        type: 'bar',
        stack: empilha ? 'mes' : undefined,
        data: empilha ? demais : points.map((p) => p.documentos),
        barMaxWidth: 44,
        barMinWidth: 8,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          /**
           * Degradê vertical de um matiz só, com o topo mais luminoso que a
           * base: dá volume à coluna sem parecer 3D. A leitura do valor
           * continua sendo a ALTURA — o brilho é acabamento, não codificação.
           */
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: tokens.cyan },
              { offset: 0.55, color: tokens.accent },
              { offset: 1, color: withAlpha(tokens.accent, 0.72) },
            ],
          },
          // Halo permanente e curto. Cada coluna ganha o próprio ar em volta em
          // vez de encostar no fundo como um retângulo recortado.
          shadowBlur: 14,
          shadowColor: withAlpha(tokens.accent, 0.3),
          shadowOffsetY: -1,
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: tokens.cyan,
            shadowBlur: 26,
            shadowColor: withAlpha(tokens.cyan, 0.55),
          },
        },
        /**
         * Entrada em cascata da esquerda para a direita: a série cresce do chão
         * na ordem do tempo, que é como ela se lê. `animationDelay` só vale na
         * primeira renderização; `animationDelayUpdate` é o que mantém o mesmo
         * gesto quando o ano selecionado muda.
         */
        animationDelay: (idx: number) => idx * 42,
        animationDelayUpdate: (idx: number) => idx * 22,
        markLine: yearBreaks.length
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: tokens.line, type: 'solid', width: 1 },
              label: {
                show: true,
                position: 'insideEndTop',
                color: tokens.inkFaint,
                fontSize: 10,
                formatter: (p: { data: { xAxis: number } }) =>
                  points[p.data.xAxis]?.periodo.slice(0, 4) ?? '',
              },
              data: yearBreaks.map((b) => ({ xAxis: b.i - 0.5 })),
            }
          : undefined,
      },
    ]

    if (empilha) {
      series.push({
        name: 'Sancionatório',
        type: 'bar',
        stack: 'mes',
        data: sancionatorios,
        barMaxWidth: 44,
        barMinWidth: 8,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: tokens.warning },
              { offset: 1, color: withAlpha(tokens.warning, 0.82) },
            ],
          },
          shadowBlur: 12,
          shadowColor: withAlpha(tokens.warning, 0.34),
        },
        emphasis: {
          itemStyle: { color: tokens.warning, shadowBlur: 22, shadowColor: withAlpha(tokens.warning, 0.5) },
        },
        animationDelay: (idx: number) => 260 + idx * 42,
        animationDelayUpdate: (idx: number) => 120 + idx * 22,
        z: 3,
      })

      // A linha do TOTAL por cima da pilha. A pilha responde "de que é feito o
      // mês"; a linha responde "como o mês se compara com os vizinhos" — e sem
      // ela o olho teria de somar duas alturas para achar o topo.
      series.push({
        name: 'Total',
        type: 'line',
        data: points.map((p) => p.documentos),
        smooth: false,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: tokens.ink, width: 1.6, opacity: 0.75 },
        itemStyle: { color: tokens.ink, borderColor: tokens.surface, borderWidth: 1.5 },
        emphasis: { scale: 1.6 },
        z: 5,
        animationDelay: 520,
      })
    }

    return {
      ...baseOption(tokens),
      animationDuration: 780,
      animationDurationUpdate: 520,
      animationEasing: 'cubicOut' as const,
      animationEasingUpdate: 'cubicOut' as const,
      grid: { left: 6, right: 14, top: highlightSanctions ? 34 : 18, bottom: 6, containLabel: true },
      legend: highlightSanctions
        ? {
            show: true,
            top: 0,
            right: 0,
            itemWidth: 11,
            itemHeight: 11,
            itemGap: 18,
            icon: 'roundRect',
            textStyle: { color: tokens.inkMuted, fontSize: 11 },
          }
        : { show: false },
      tooltip: {
        ...tooltipStyle(tokens),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(tokens.accent, 0.08) } },
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number; seriesName: string; value: number }>
          const first = list[0]
          if (!first) return ''
          const p = points[first.dataIndex]
          if (!p) return ''
          const [ano, mes] = p.periodo.split('-')
          const nomeMes = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })
          const share = ((p.documentos / points.reduce((a, x) => a + x.documentos, 0)) * 100).toFixed(1)
          // A pilha já mostra as partes; o tooltip declara o TOTAL primeiro,
          // que é o número que o leitor procura, e só então a decomposição.
          const sancionatorio = p.sancionatorios ?? 0
          const linhas = highlightSanctions
            ? [
                ROW('total', num(p.documentos), tokens.inkMuted),
                ROW('sancionatório', num(sancionatorio), tokens.inkMuted),
                ROW('demais matérias', num(p.documentos - sancionatorio), tokens.inkMuted),
              ].join('')
            : list.map((item) => ROW(item.seriesName, num(item.value), tokens.inkMuted)).join('')
          const extra = [
            ROW('participação no período', `${share}%`, tokens.inkMuted),
            p.naturezas ? ROW('naturezas distintas', num(p.naturezas), tokens.inkMuted) : '',
          ].join('')
          const aviso = p.precisao_mensal
            ? `<div style="margin-top:7px;padding-top:6px;border-top:1px solid ${tokens.line};color:${tokens.inkFaint};font-size:10.5px">
                 ${p.precisao_mensal} documento(s) com precisão apenas mensal
               </div>`
            : ''
          const acao = onSelectPeriod
            ? `<div style="margin-top:7px;color:${tokens.accent};font-size:10.5px">clique para ver os documentos</div>`
            : ''
          return `<div style="min-width:212px">${TITLE(
            nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
          )}${linhas}${extra}${aviso}${acao}</div>`
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        ...axisStyle(tokens),
        splitLine: { show: false },
        axisLabel: {
          ...axisStyle(tokens).axisLabel,
          // O eixo de mês é legenda de leitura, não decoração: precisa de mais
          // contraste do que um rótulo de eixo comum.
          color: tokens.inkMuted,
          fontSize: 11,
          interval: 0,
          rotate: labels.length > 16 ? 42 : 0,
          margin: 12,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil((maxValue * 1.12) / 10) * 10,
        ...axisStyle(tokens),
        axisLabel: { ...axisStyle(tokens).axisLabel, fontSize: 11 },
        splitLine: { lineStyle: { color: tokens.line, type: [3, 4] as never } },
      },
      series,
    }
  }, [points, tokens, highlightSanctions, onSelectPeriod])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel="Produção jurídica por mês"
      onEvent={{
        click: (params) => {
          if (!onSelectPeriod || !params.name) return
          const p = points.find((x) => monthLabel(x.periodo) === params.name)
          if (p) onSelectPeriod(p.periodo)
        },
      }}
    />
  )
}

/* ================================================================= treemap */

/** Composição do acervo: área proporcional ao volume. Lê melhor que 20 barras. */
export function NatureTreemap({
  items,
  height = 360,
  onSelect,
}: {
  items: Array<{ chave: string; documentos: number; extra?: Record<string, unknown> }>
  height?: number
  onSelect?: (chave: string) => void
}) {
  const tokens = useChartTokens()
  const option = React.useMemo(() => {
    const total = items.reduce((a, i) => a + i.documentos, 0) || 1
    return {
      ...baseOption(tokens),
      animationDuration: 700,
      tooltip: {
        ...tooltipStyle(tokens),
        formatter: (params: unknown) => {
          const it = params as { name: string; value: number }
          const share = ((it.value / total) * 100).toFixed(1)
          return `<div style="min-width:180px">${TITLE(it.name)}${ROW(
            'documentos',
            num(it.value),
            tokens.inkMuted,
          )}${ROW('participação', `${share}%`, tokens.inkMuted)}
          <div style="margin-top:6px;color:${tokens.accent};font-size:10.5px">clique para filtrar</div></div>`
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          itemStyle: { borderColor: tokens.surface, borderWidth: 3, gapWidth: 3, borderRadius: 6 },
          label: {
            show: true,
            position: 'insideTopLeft',
            formatter: (p: { name: string; value: number }) => {
              // O nome é encurtado conforme a área do tile. Confiar em `width`
              // + `overflow` no bloco rich não resolve: quando o texto não
              // cabe, o ECharts descarta o rótulo inteiro.
              const share = p.value / total
              // Tile minúsculo não recebe rótulo nenhum: um número de 22px
              // dentro de 30px não informa, só suja. Fica no tooltip.
              if (share <= 0.012) return ''
              if (share <= 0.035) return `{pequeno|${num(p.value)}}`
              const limite = share > 0.1 ? 26 : share > 0.05 ? 22 : 12
              const nome = p.name.length > limite ? `${p.name.slice(0, limite - 1)}…` : p.name
              return `{nome|${nome}}\n{valor|${num(p.value)}}`
            },
            rich: {
              nome: {
                fontSize: 11,
                fontWeight: 600,
                color: '#fff',
                lineHeight: 14,
              },
              valor: {
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 27,
                fontFamily: 'Inter',
              },
              pequeno: {
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 14,
                fontFamily: 'Inter',
              },
            },
            padding: [8, 9],
          },
          upperLabel: { show: false },
          emphasis: {
            itemStyle: { borderColor: tokens.accent, borderWidth: 3 },
            label: { show: true },
          },
          levels: [
            {
              itemStyle: { borderWidth: 0, gapWidth: 3 },
            },
          ],
          // Rampa de UMA cor, do petróleo ao ciano, ordenada por volume.
          // A área já codifica o volume; a cor reforça o ranking em vez de
          // introduzir 8 matizes sem significado — e mantém a identidade Programa.
          data: items.map((i, idx) => {
            const t = items.length > 1 ? idx / (items.length - 1) : 0
            const luz = 30 + t * 40
            return {
              name: i.chave,
              value: i.documentos,
              itemStyle: {
                color: `hsl(${191 - t * 6}, ${58 - t * 26}%, ${luz}%)`,
              },
              // Tile claro com texto branco não tem contraste: acima de ~54% de
              // luminosidade o rótulo inverte para petróleo escuro.
              label: {
                show: true,
                rich:
                  luz > 54
                    ? {
                        nome: { color: '#04212b' },
                        valor: { color: '#04212b' },
                        pequeno: { color: '#04212b' },
                      }
                    : undefined,
              },
            }
          }),
        },
      ],
    }
  }, [items, tokens])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel="Composição do acervo por natureza"
      onEvent={{ click: (p) => p.name && onSelect?.(String(p.name)) }}
    />
  )
}

/* ================================================================ lollipop */

/**
 * Ranking por posição: haste + bolha. Bem mais leve que barra cheia.
 *
 * A haste sai de um fio cinza uniforme para um degradê que acende ao chegar na
 * bolha, e a bolha ganha halo: o olho percorre a linha até o valor em vez de
 * pular direto para o rótulo. `destaque` engrossa a escala inteira para quando
 * o gráfico é o assunto da faixa, e não um apoio de canto.
 */
export function Lollipop({
  items,
  height = 340,
  onSelect,
  valueLabel = 'documentos',
  colorIndex = 1,
  destaque = false,
}: {
  items: ContagemItem[]
  height?: number
  onSelect?: (chave: string) => void
  valueLabel?: string
  colorIndex?: number
  destaque?: boolean
}) {
  const tokens = useChartTokens()
  const option = React.useMemo(() => {
    const ordered = [...items].reverse()
    const values = ordered.map((i) => i.documentos)
    const total = items.reduce((a, i) => a + i.documentos, 0) || 1
    const maxV = Math.max(1, ...values)
    const cor = tokens.palette[colorIndex] ?? tokens.accent
    return {
      ...baseOption(tokens),
      animationDuration: 780,
      animationEasing: 'cubicOut' as const,
      grid: {
        left: 6,
        right: destaque ? 62 : 46,
        top: destaque ? 14 : 8,
        bottom: destaque ? 12 : 6,
        containLabel: true,
      },
      tooltip: {
        ...tooltipStyle(tokens),
        trigger: 'item',
        formatter: (params: unknown) => {
          const it = params as { name: string; value: number }
          const share = ((it.value / total) * 100).toFixed(1)
          return `<div style="min-width:180px">${TITLE(it.name)}${ROW(
            valueLabel,
            num(it.value),
            tokens.inkMuted,
          )}${ROW('participação', `${share}%`, tokens.inkMuted)}</div>`
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(maxV * 1.08),
        ...axisStyle(tokens),
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((i) => i.chave),
        ...axisStyle(tokens),
        splitLine: { show: false },
        axisLabel: {
          ...axisStyle(tokens).axisLabel,
          color: tokens.ink,
          fontSize: destaque ? 13 : 11.5,
          fontWeight: destaque ? 500 : 'normal',
          width: destaque ? 210 : 168,
          overflow: 'truncate',
        },
      },
      series: [
        // haste: cinza na origem, acesa na chegada
        {
          type: 'bar',
          data: values,
          barWidth: destaque ? 3 : 2,
          silent: true,
          itemStyle: {
            borderRadius: 3,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: withAlpha(cor, 0.1) },
                { offset: 1, color: withAlpha(cor, 0.55) },
              ],
            },
          },
          z: 1,
          animationDuration: 560,
          animationDelay: (idx: number) => idx * 26,
        },
        // bolha
        {
          type: 'scatter',
          data: values.map((v, i) => [v, i]),
          symbolSize: (val: number[]) =>
            (destaque ? 13 : 10) + (val[0]! / maxV) * (destaque ? 16 : 12),
          itemStyle: {
            color: cor,
            borderColor: tokens.surface,
            borderWidth: 2,
            shadowBlur: destaque ? 16 : 10,
            shadowColor: withAlpha(cor, 0.5),
          },
          emphasis: {
            itemStyle: {
              color: tokens.cyan,
              borderWidth: 3,
              shadowBlur: 26,
              shadowColor: withAlpha(tokens.cyan, 0.7),
            },
            scale: 1.25,
          },
          label: {
            show: true,
            position: 'right',
            distance: destaque ? 13 : 10,
            color: tokens.ink,
            fontSize: destaque ? 14 : 12,
            fontWeight: destaque ? 700 : 600,
            formatter: (p: { value: number[] }) => num(p.value[0]),
          },
          z: 3,
          animationDelay: (idx: number) => 200 + idx * 38,
        },
      ],
    }
  }, [items, tokens, valueLabel, colorIndex, destaque])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel="Ranking de destinatários"
      onEvent={{
        click: (params) => {
          const name = params.name
          if (name) {
            onSelect?.(String(name))
            return
          }
          // no scatter o nome vem pelo índice do eixo
          const v = (params as { value?: number[] }).value
          if (Array.isArray(v) && typeof v[1] === 'number') {
            const ordered = [...items].reverse()
            const found = ordered[v[1]]
            if (found) onSelect?.(found.chave)
          }
        },
      }}
    />
  )
}

/* ===================================================================== rosca */

export interface FatiaDaRosca {
  chave: string
  documentos: number
  /** Índice na paleta de dados. Sem isso a fatia herda a ordem do ECharts. */
  cor?: string
}

/**
 * Rosca minimalista: parte/todo de duas ou três situações, total no centro.
 *
 * Sem legenda externa, sem rótulo puxado por linha e sem porcentagem escrita
 * sobre a fatia — o anel dá a proporção, o centro dá o tamanho do acervo e o
 * resto é do tooltip. É o formato certo para "quanto do acervo está em cada
 * situação" e o formato errado para qualquer ranking.
 */
export function Donut({
  items,
  height = 240,
  centroRotulo,
  onSelect,
}: {
  items: FatiaDaRosca[]
  height?: number
  centroRotulo?: string
  onSelect?: (chave: string) => void
}) {
  const tokens = useChartTokens()

  const option = React.useMemo(() => {
    const total = items.reduce((a, i) => a + i.documentos, 0)
    const cores = [tokens.accent, tokens.palette[4] ?? tokens.inkFaint, tokens.warning]

    return {
      ...baseOption(tokens),
      animationDuration: 760,
      animationEasing: 'cubicOut' as const,
      grid: undefined,
      tooltip: {
        ...tooltipStyle(tokens),
        trigger: 'item',
        formatter: (params: unknown) => {
          const it = params as { name: string; value: number; percent: number }
          return `<div style="min-width:186px">${TITLE(it.name)}${ROW(
            'documentos',
            num(it.value),
            tokens.inkMuted,
          )}${ROW('do acervo', `${it.percent.toFixed(1)}%`, tokens.inkMuted)}</div>`
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['64%', '86%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          // O anel é o gráfico inteiro: nada de rótulo puxado por linha.
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            borderColor: tokens.surface,
            borderWidth: 3,
            borderRadius: 4,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: { shadowBlur: 24, shadowColor: withAlpha(tokens.accent, 0.45) },
          },
          data: items.map((item, i) => ({
            name: item.chave,
            value: item.documentos,
            itemStyle: { color: item.cor ?? cores[i % cores.length] },
          })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '43%',
          silent: true,
          style: {
            text: num(total),
            fill: tokens.ink,
            fontSize: 34,
            fontWeight: 650,
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '60%',
          silent: true,
          style: {
            text: centroRotulo ?? 'documentos',
            fill: tokens.inkFaint,
            fontSize: 11,
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          },
        },
      ],
    }
  }, [items, tokens, centroRotulo])

  return (
    <EChart
      option={option}
      height={height}
      ariaLabel="Distribuição por necessidade de resposta"
      onEvent={{ click: (params) => params.name && onSelect?.(String(params.name)) }}
    />
  )
}

/* =============================================================== barras tema */

/** Barra com trilha de fundo: mostra o share sem precisar de eixo. */
export function ThemeBars({
  items,
  onSelect,
  valueKey = 'vinculos',
  max = 10,
}: {
  items: ContagemItem[]
  onSelect?: (chave: string) => void
  valueKey?: 'vinculos' | 'documentos'
  max?: number
}) {
  const shown = items.slice(0, max)
  const maior = Math.max(
    1,
    ...shown.map((i) => (valueKey === 'vinculos' ? (i.vinculos ?? i.documentos) : i.documentos)),
  )
  return (
    <ul className="space-y-px">
      {shown.map((item, index) => {
        const valor = valueKey === 'vinculos' ? (item.vinculos ?? item.documentos) : item.documentos
        const pctBar = (valor / maior) * 100
        return (
          <li key={item.chave}>
            <button
              type="button"
              onClick={() => onSelect?.(item.chave)}
              className="group flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-left
                         transition-colors hover:bg-subtle"
            >
              <span className="tabular w-5 shrink-0 text-2xs font-semibold text-ink-faint">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="w-[8.5rem] shrink-0 truncate text-xs font-medium text-ink">
                {item.chave}
              </span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-swift
                             group-hover:brightness-110"
                  style={{
                    width: `${pctBar}%`,
                    // Rampa de uma cor: a posição no ranking modula a
                    // luminosidade, sem inventar matiz por item.
                    background: `hsl(${190 - (index / Math.max(1, shown.length - 1)) * 4} ${62 - (index / Math.max(1, shown.length - 1)) * 26}% ${38 + (index / Math.max(1, shown.length - 1)) * 26}%)`,
                  }}
                />
              </span>
              <span className="tabular w-9 shrink-0 text-right text-sm font-semibold text-ink">
                {num(valor)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ========================================================= barra de proporção */

/** Uma barra única segmentada. Substitui a pizza sem perder a leitura de parte/todo. */
export function ProportionBar({
  items,
  onSelect,
  height = 'h-9',
}: {
  items: Array<{ chave: string; documentos: number }>
  onSelect?: (chave: string) => void
  height?: string
}) {
  const total = items.reduce((a, i) => a + i.documentos, 0) || 1
  const cores = coresPorMateria(items.map((i) => i.chave))
  const cor = (chave: string) => `hsl(var(--data-${(cores.get(chave) ?? 7) + 1}))`
  return (
    <div>
      <div className={`flex ${height} w-full overflow-hidden rounded-lg`}>
        {items.map((item) => {
          const share = (item.documentos / total) * 100
          if (share < 0.4) return null
          return (
            <button
              key={item.chave}
              type="button"
              onClick={() => onSelect?.(item.chave)}
              title={`${item.chave}: ${num(item.documentos)} (${share.toFixed(1)}%)`}
              className="group relative transition-all duration-300 ease-swift first:rounded-l-lg last:rounded-r-lg
                         hover:brightness-115"
              style={{
                width: `${share}%`,
                background: cor(item.chave),
              }}
            >
              {share > 9 ? (
                <span className="tabular text-2xs font-bold text-white/95 drop-shadow">
                  {share.toFixed(0)}%
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((item) => (
          <li key={item.chave}>
            <button
              type="button"
              onClick={() => onSelect?.(item.chave)}
              className="group flex items-center gap-1.5 text-2xs transition-colors hover:text-ink"
            >
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: cor(item.chave) }}
              />
              <span className="text-ink-muted group-hover:text-ink">{item.chave}</span>
              <span className="tabular font-semibold text-ink">{num(item.documentos)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ================================================================= heatmap */

export function Heatmap({
  rows,
  height = 380,
  onSelect,
}: {
  rows: Array<{ linha: string; coluna: string; documentos: number }>
  height?: number
  onSelect?: (linha: string, coluna: string) => void
}) {
  const tokens = useChartTokens()
  const max = Math.max(1, ...rows.map((r) => r.documentos))

  // Rampa de uma só família (petróleo -> ciano). Escala sequencial pede
  // variação de luminosidade, não troca de matiz — matiz diferente sugere
  // categoria diferente, e aqui a diferença é só de intensidade. Fica fora do
  // useMemo porque alimenta também a legenda desenhada em DOM.
  const rampa = React.useMemo(
    () => [
      withAlpha(tokens.palette[0] ?? tokens.accent, 0.16),
      withAlpha(tokens.palette[0] ?? tokens.accent, 0.55),
      tokens.palette[0] ?? tokens.accent,
      tokens.palette[1] ?? tokens.accent,
      tokens.accent,
    ],
    [tokens],
  )

  const option = React.useMemo(() => {
    const rowKeys = Array.from(new Set(rows.map((r) => r.linha)))
    const colKeys = Array.from(new Set(rows.map((r) => r.coluna)))
    return {
      ...baseOption(tokens),
      grid: { left: 6, right: 14, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        ...tooltipStyle(tokens),
        formatter: (params: unknown) => {
          const it = params as { value: [number, number, number] }
          const [c, r, v] = it.value
          return `<div style="min-width:180px">${TITLE(String(rowKeys[r]))}
            <div style="color:${tokens.inkMuted};margin-bottom:5px;font-size:11px">${colKeys[c]}</div>
            ${ROW('documentos', num(v), tokens.inkMuted)}</div>`
        },
      },
      xAxis: {
        type: 'category',
        data: colKeys,
        ...axisStyle(tokens),
        splitArea: { show: false },
        splitLine: { show: false },
        axisLabel: {
          ...axisStyle(tokens).axisLabel,
          rotate: 34,
          fontSize: 10.5,
          formatter: (v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v),
        },
      },
      yAxis: {
        type: 'category',
        data: rowKeys,
        ...axisStyle(tokens),
        splitArea: { show: false },
        splitLine: { show: false },
        axisLabel: {
          ...axisStyle(tokens).axisLabel,
          fontSize: 11,
          width: 150,
          overflow: 'truncate',
        },
      },
      visualMap: {
        // `show: false` de propósito: o ECharts não respeita itemWidth/itemHeight
        // na orientação horizontal e a régua sai como um bloco vertical. A
        // legenda é desenhada em DOM abaixo do gráfico, com a mesma rampa.
        show: false,
        min: 1,
        max,
        calculable: false,
        inRange: { color: rampa },
      },
      series: [
        {
          type: 'heatmap',
          data: rows.map((r) => {
            const forte = r.documentos / max > 0.55
            return {
              value: [colKeys.indexOf(r.coluna), rowKeys.indexOf(r.linha), r.documentos],
              // A cor do rótulo acompanha a intensidade da célula: em célula
              // saturada, texto escuro; em célula fraca, texto do tema.
              label: { color: forte ? '#04212b' : tokens.inkMuted },
            }
          }),
          itemStyle: { borderColor: tokens.surface, borderWidth: 2, borderRadius: 3 },
          emphasis: {
            itemStyle: { borderColor: tokens.accent, borderWidth: 2 },
          },
          label: {
            show: true,
            fontSize: 10.5,
            fontWeight: 600,
            formatter: (p: { value: [number, number, number] }) =>
              p.value[2] > 0 ? String(p.value[2]) : '',
          },
          progressive: 0,
        },
      ],
    }
  }, [rows, tokens, max, rampa])

  return (
    <div>
    <EChart
      option={option}
      height={height}
      ariaLabel="Matriz de duas dimensões"
      onEvent={{
        click: (params) => {
          const v = (params as { value?: [number, number, number] }).value
          if (!v || !onSelect) return
          const rowKeys = Array.from(new Set(rows.map((r) => r.linha)))
          const colKeys = Array.from(new Set(rows.map((r) => r.coluna)))
          const linha = rowKeys[v[1]]
          const coluna = colKeys[v[0]]
          if (linha && coluna) onSelect(linha, coluna)
        },
      }}
    />
      {/* Legenda da intensidade, em DOM: o leitor precisa saber que a cor é
          volume e qual é o topo da escala. */}
      <div className="flex items-center justify-end gap-2 px-3 pb-1 pt-2">
        <span className="text-2xs text-ink-faint">1</span>
        <span
          className="h-1.5 w-24 rounded-full"
          style={{ background: `linear-gradient(to right, ${rampa.join(', ')})` }}
        />
        <span className="tabular text-2xs text-ink-faint">{num(max)}</span>
        <span className="text-2xs text-ink-faint">documentos</span>
      </div>
    </div>
  )
}

/* =============================================================== mini série */

/** Série compacta para dentro de linha de tabela ou card. */
export function MiniSeries({
  points,
  height = 38,
  colorIndex = 0,
  type = 'bar',
}: {
  points: Array<{ periodo: string; documentos: number }>
  height?: number
  colorIndex?: number
  type?: 'bar' | 'line'
}) {
  const tokens = useChartTokens()
  const option = React.useMemo(
    () => ({
      animation: false,
      grid: { left: 1, right: 1, top: 3, bottom: 1 },
      xAxis: { type: 'category', show: false, data: points.map((p) => p.periodo) },
      yAxis: { type: 'value', show: false, min: 0 },
      tooltip: {
        ...tooltipStyle(tokens),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ name: string; value: number }>
          const f = list[0]
          return f ? `${monthLabel(f.name)}: <b>${num(f.value)}</b>` : ''
        },
      },
      series: [
        type === 'bar'
          ? {
              type: 'bar',
              data: points.map((p) => p.documentos),
              itemStyle: { color: tokens.palette[colorIndex], borderRadius: [2, 2, 0, 0] },
              barCategoryGap: '28%',
              // Sem teto, uma série de 2 pontos virava dois blocos enormes e
              // deixava de parecer série temporal.
              barMaxWidth: 9,
            }
          : {
              type: 'line',
              data: points.map((p) => p.documentos),
              smooth: 0.4,
              symbol: 'none',
              lineStyle: { color: tokens.palette[colorIndex], width: 1.6 },
              areaStyle: { color: tokens.palette[colorIndex], opacity: 0.14 },
            },
      ],
    }),
    [points, tokens, colorIndex, type],
  )
  return <EChart option={option} height={height} ariaLabel="Série compacta" />
}

/* =============================================================== sparkline */

export function Sparkline({ points, height = 40 }: { points: number[]; height?: number }) {
  const tokens = useChartTokens()
  const option = React.useMemo(
    () => ({
      animation: false,
      grid: { left: 0, right: 0, top: 3, bottom: 3 },
      xAxis: { type: 'category', show: false, data: points.map((_, i) => i) },
      yAxis: { type: 'value', show: false, min: 0 },
      tooltip: { show: false },
      series: [
        {
          type: 'line',
          data: points,
          smooth: 0.45,
          symbol: 'none',
          lineStyle: { color: tokens.accent, width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: withAlpha(tokens.accent, 0.25) },
                { offset: 1, color: withAlpha(tokens.accent, 0) },
              ],
            },
          },
        },
      ],
    }),
    [points, tokens],
  )
  return <EChart option={option} height={height} ariaLabel="Tendência" />
}

/* ============================================================ calendário-mês */

/**
 * Grade ano × mês. Lê densidade temporal de um jeito que a série linear não
 * mostra: qual mês de qual ano concentrou produção.
 */
export function MonthGrid({
  points,
  onSelectPeriod,
}: {
  points: Array<{ periodo: string; documentos: number }>
  onSelectPeriod?: (periodo: string) => void
}) {
  const anos = Array.from(new Set(points.map((p) => p.periodo.slice(0, 4)))).sort()
  const porChave = new Map(points.map((p) => [p.periodo, p.documentos]))
  const max = Math.max(1, ...points.map((p) => p.documentos))
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pl-12">
        {MESES.map((m) => (
          <span key={m} className="flex-1 text-center text-2xs font-medium text-ink-faint">
            {m}
          </span>
        ))}
      </div>
      {anos.map((ano) => (
        <div key={ano} className="flex items-center gap-2">
          <span className="tabular w-10 shrink-0 text-xs font-semibold text-ink-muted">{ano}</span>
          {MESES.map((_, i) => {
            const chave = `${ano}-${String(i + 1).padStart(2, '0')}`
            const valor = porChave.get(chave) ?? 0
            const intensidade = valor / max
            return (
              <button
                key={chave}
                type="button"
                disabled={valor === 0}
                onClick={() => onSelectPeriod?.(chave)}
                title={`${chave}: ${num(valor)} documento(s)`}
                className={cnGrid(valor)}
                style={
                  valor > 0
                    ? {
                        background: `hsl(var(--accent) / ${0.16 + intensidade * 0.84})`,
                        color: intensidade > 0.45 ? 'white' : undefined,
                      }
                    : undefined
                }
              >
                {valor > 0 ? <span className="tabular">{valor}</span> : null}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function cnGrid(valor: number) {
  return [
    'flex h-11 flex-1 items-center justify-center rounded-md text-xs font-semibold',
    'transition-all duration-200 ease-swift',
    valor > 0
      ? 'cursor-pointer text-ink hover:scale-[1.06] hover:shadow-raised'
      : 'cursor-default border border-dashed border-line bg-transparent text-ink-faint',
  ].join(' ')
}
