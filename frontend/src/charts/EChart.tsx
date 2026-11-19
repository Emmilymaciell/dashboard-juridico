/**
 * Wrapper único do ECharts. Nenhuma página monta `option` cru: tema, paleta,
 * tooltip, grid e responsividade ficam em um lugar só.
 *
 * Sem 3D. Sem gauge decorativo. Eixo de valor começa em zero.
 *
 * A pizza continua fora; a ROSCA entrou, com escopo estreito: parte/todo de
 * duas ou três fatias, onde a pergunta é "quanto do acervo está em cada
 * situação" e não "ordene estas categorias". Em qualquer ranking, a barra e o
 * lollipop continuam sendo a resposta certa.
 */

import * as echarts from 'echarts/core'
import {
  BarChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts'
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  PolarComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import * as React from 'react'

import { useTheme } from '@/app/ThemeProvider'
import { cn } from '@/lib/utils'

echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  TreemapChart,
  ScatterChart,
  PieChart,
  GridComponent,
  // O total no centro da rosca é um `graphic`, não um rótulo de série: sem este
  // componente registrado ele simplesmente não desenha, sem erro no console.
  GraphicComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  MarkLineComponent,
  // Coordenada polar: as barras radiais de destinatário se apoiam nela.
  PolarComponent,
  CanvasRenderer,
])

/**
 * Lê um design token e devolve a cor numa sintaxe que o ECharts consegue *parsear*.
 *
 * Os tokens são guardados no formato Tailwind — `196 82% 55%`, separado por
 * espaço (CSS Color 4). O canvas entende isso num preenchimento sólido, mas o
 * parser de cor do zrender só entende `hsl(h, s%, l%)` com vírgula. Onde o
 * ECharts precisa *interpolar* cor — `visualMap.inRange`, gradientes — a
 * sintaxe por espaço falha silenciosamente e o resultado sai preto. Foi
 * exatamente o que aconteceu com o heatmap de destinatário × matéria: todas as
 * células e a própria legenda renderizavam em preto sólido.
 */
function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!value) return fallback
  // `196 82% 55%` e também `196 82% 55% / 0.5`
  const [canal, alfa] = value.split('/')
  const partes = (canal ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length < 3) return value.startsWith('#') ? value : fallback
  const triple = partes.slice(0, 3).join(', ')
  return alfa ? `hsla(${triple}, ${alfa.trim()})` : `hsl(${triple})`
}

/**
 * Mesma cor com opacidade. Existe porque concatenar alfa hexadecimal numa cor
 * `hsl()` — `${tokens.accent}55` — produz string inválida, não cor translúcida.
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('hsl(')) return `hsla(${color.slice(4, -1)}, ${alpha})`
  if (color.startsWith('hsla(')) {
    const partes = color.slice(5, -1).split(',')
    return `hsla(${partes.slice(0, 3).join(',')}, ${alpha})`
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const n = Number.parseInt(color.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  return color
}

export interface ChartTokens {
  ink: string
  inkMuted: string
  inkFaint: string
  line: string
  subtle: string
  surface: string
  elevated: string
  accent: string
  /** Realce claro do acento: topo de coluna, bolha em foco. */
  cyan: string
  warning: string
  palette: string[]
}

export function useChartTokens(): ChartTokens {
  const { resolved } = useTheme()
  return React.useMemo(() => {
    void resolved // recalcula quando o tema muda
    return {
      ink: readToken('--ink', '#18181b'),
      inkMuted: readToken('--ink-muted', '#52525b'),
      inkFaint: readToken('--ink-faint', '#a1a1aa'),
      line: readToken('--line', '#e4e4e7'),
      subtle: readToken('--subtle', '#f4f4f5'),
      surface: readToken('--surface', '#ffffff'),
      elevated: readToken('--elevated', '#ffffff'),
      accent: readToken('--accent', '#2563eb'),
      cyan: readToken('--cyan', '#22d3ee'),
      warning: readToken('--warning', '#b45309'),
      palette: Array.from({ length: 8 }, (_, i) => readToken(`--data-${i + 1}`, '#2563eb')),
    }
  }, [resolved])
}

/** Tooltip premium, compartilhado. Tipado como objeto para poder ser espalhado. */
export function tooltipStyle(tokens: ChartTokens) {
  return {
    backgroundColor: tokens.elevated,
    borderColor: tokens.line,
    borderWidth: 1,
    padding: [8, 10] as [number, number],
    extraCssText:
      'border-radius:8px;box-shadow:0 10px 34px -12px rgba(0,0,0,.22);backdrop-filter:none;',
    textStyle: { color: tokens.ink, fontSize: 11.5 },
  }
}

/** Base compartilhada: tipografia, grid discreto, paleta e tooltip. */
export function baseOption(tokens: ChartTokens) {
  return {
    animation: true,
    animationDuration: 420,
    animationEasing: 'cubicOut' as const,
    color: tokens.palette,
    textStyle: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
      color: tokens.inkMuted,
    },
    grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
    tooltip: tooltipStyle(tokens),
  }
}

export function axisStyle(tokens: ChartTokens) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: tokens.inkFaint, fontSize: 10.5, margin: 10 },
    splitLine: { lineStyle: { color: tokens.line, width: 1, type: 'solid' as const } },
  }
}

export interface EChartProps {
  option: echarts.EChartsCoreOption
  height?: number | string
  className?: string
  onEvent?: {
    click?: (params: { name?: string; value?: unknown; data?: unknown }) => void
  }
  ariaLabel?: string
}

export function EChart({ option, height = 260, className, onEvent, ariaLabel }: EChartProps) {
  const container = React.useRef<HTMLDivElement | null>(null)
  const instance = React.useRef<echarts.ECharts | null>(null)
  const handler = React.useRef(onEvent)
  handler.current = onEvent

  React.useEffect(() => {
    if (!container.current) return
    const chart = echarts.init(container.current, undefined, { renderer: 'canvas' })
    instance.current = chart
    chart.on('click', (params) => {
      handler.current?.click?.(params as { name?: string; value?: unknown; data?: unknown })
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      instance.current = null
    }
  }, [])

  React.useEffect(() => {
    // notMerge: false mantém a animação de transição entre atualizações.
    instance.current?.setOption(option, { notMerge: true, lazyUpdate: true })
  }, [option])

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      className={cn('w-full', className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    />
  )
}
