/**
 * Gráficos da Visão Geral. Cada um responde a UMA pergunta.
 *
 *   que tipos de documento existem   -> RadialCategorias (anel + legenda)
 *   quanto de cada matéria           -> TreemapMateria (área = volume)
 *   quais assuntos dominam           -> BolhasDeTema (área = volume, sem ranking)
 *
 * Três regras valem para os três, e são o que os torna parte de um painel em
 * vez de três gráficos soltos:
 *
 *   1. COR É CATEGORIA, nunca posição. Vem de `lib/cores.ts`.
 *   2. SELEÇÃO É VISÍVEL. Com filtro ativo, o selecionado mantém a cor cheia e
 *      o resto RECUA — não some, porque sumir apagaria a proporção.
 *   3. CLICAR FILTRA A PÁGINA. O componente não sabe o que é um filtro: chama
 *      `onSelect` e acabou. Quem traduz é `features/overview/cruzamento.ts`.
 */

import * as React from 'react'

import { empacotar } from '@/charts/empacotamento'
import { baseOption, EChart, tooltipStyle, useChartTokens, withAlpha } from '@/charts/EChart'
import { indiceDaMateria, indiceEstavel, OPACIDADE_ATENUADA } from '@/lib/cores'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Linha de tooltip: rótulo à esquerda, valor tabular à direita. */
const LINHA = (rotulo: string, valor: string, cor: string) =>
  `<div style="display:flex;justify-content:space-between;gap:20px;line-height:1.5">
     <span style="color:${cor}">${rotulo}</span><b style="font-variant-numeric:tabular-nums">${valor}</b>
   </div>`

const TITULO = (texto: string) =>
  `<div style="font-weight:650;margin-bottom:5px;font-size:12px">${texto}</div>`

/**
 * Cor da matéria JÁ RESOLVIDA, para uso dentro de gráfico.
 *
 * O canvas do ECharts não entende `var(--data-4)` — e o pior é que não
 * reclama: a cor simplesmente não aparece. `useChartTokens` lê os tokens do
 * documento e devolve `hsl(...)` de verdade, então é dali que a cor sai.
 */
export function useCorDaMateria() {
  const tokens = useChartTokens()
  return React.useCallback(
    (materia: string | null | undefined) =>
      tokens.palette[indiceDaMateria(materia)] ?? tokens.accent,
    [tokens],
  )
}

export interface ItemCategoria {
  chave: string
  documentos: number
  /** Matéria a que pertence, quando a cor deve vir dela. */
  materia?: string | null
}

/* ========================================================== anel + legenda */

/**
 * Quantas naturezas existem e como se repartem.
 *
 * O número no centro é a CONTAGEM DE TIPOS, não de documentos: a pergunta é
 * "de quantas formas diferentes o Escritório Jurídico escreve", e o anel mostra o peso de
 * cada uma. A cauda longa vira um segmento único — vinte e uma fatias num anel
 * de 150px seriam vinte e uma fatias ilegíveis.
 */
export function RadialCategorias({
  itens,
  centroValor,
  centroRotulo,
  maximo = 6,
  altura = 170,
  ativa,
  haSelecao = false,
  onSelect,
}: {
  itens: ItemCategoria[]
  centroValor: number
  centroRotulo: string
  maximo?: number
  altura?: number
  ativa?: (chave: string) => boolean
  haSelecao?: boolean
  onSelect?: (chave: string) => void
}) {
  const tokens = useChartTokens()

  const { fatias, total } = React.useMemo(() => {
    const ordenados = [...itens].sort((a, b) => b.documentos - a.documentos)
    const total = ordenados.reduce((a, i) => a + i.documentos, 0) || 1
    if (ordenados.length <= maximo) return { fatias: ordenados, total }
    const cabeca = ordenados.slice(0, maximo - 1)
    const cauda = ordenados.slice(maximo - 1)
    return {
      fatias: [
        ...cabeca,
        {
          chave: 'Outras',
          documentos: cauda.reduce((a, i) => a + i.documentos, 0),
          materia: null,
        },
      ],
      total,
    }
  }, [itens, maximo])

  const corDaMateria = useCorDaMateria()
  const corDe = React.useCallback(
    (item: ItemCategoria) =>
      item.chave === 'Outras'
        ? (tokens.palette[7] ?? tokens.inkFaint)
        : item.materia !== undefined
          ? corDaMateria(item.materia)
          : (tokens.palette[indiceEstavel(item.chave)] ?? tokens.accent),
    [corDaMateria, tokens],
  )

  const option = React.useMemo(
    () => ({
      ...baseOption(tokens),
      animationDuration: 700,
      grid: undefined,
      tooltip: {
        ...tooltipStyle(tokens),
        trigger: 'item',
        formatter: (params: unknown) => {
          const it = params as { name: string; value: number }
          return `<div style="min-width:170px">${TITULO(it.name)}${LINHA(
            'documentos',
            num(it.value),
            tokens.inkMuted,
          )}${LINHA('participação', pct((it.value / total) * 100), tokens.inkMuted)}</div>`
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['62%', '92%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderColor: tokens.surface, borderWidth: 2.5, borderRadius: 3 },
          emphasis: { scale: true, scaleSize: 5 },
          data: fatias.map((item) => {
            const selecionada = ativa?.(item.chave) ?? false
            return {
              name: item.chave,
              value: item.documentos,
              itemStyle: {
                color: corDe(item),
                opacity: haSelecao && !selecionada ? OPACIDADE_ATENUADA : 1,
              },
            }
          }),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '40%',
          silent: true,
          style: {
            text: num(centroValor),
            fill: tokens.ink,
            fontSize: 28,
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
            text: centroRotulo,
            fill: tokens.inkFaint,
            fontSize: 10.5,
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          },
        },
      ],
    }),
    [fatias, total, tokens, centroValor, centroRotulo, ativa, haSelecao, corDe],
  )

  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0" style={{ width: altura }}>
        <EChart
          option={option}
          height={altura}
          ariaLabel={`Repartição por ${centroRotulo}`}
          onEvent={{ click: (p) => p.name && p.name !== 'Outras' && onSelect?.(String(p.name)) }}
        />
      </div>
      <ul className="min-w-0 flex-1 space-y-[3px]">
        {fatias.map((item) => {
          const selecionada = ativa?.(item.chave) ?? false
          const clicavel = Boolean(onSelect) && item.chave !== 'Outras'
          return (
            <li key={item.chave}>
              <button
                type="button"
                disabled={!clicavel}
                onClick={() => clicavel && onSelect?.(item.chave)}
                aria-pressed={clicavel ? selecionada : undefined}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-1 py-[3px] text-left transition-colors',
                  clicavel && 'hover:bg-subtle',
                  haSelecao && !selecionada && 'opacity-45',
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: corDe(item) }}
                />
                <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">
                  {item.chave}
                </span>
                <span className="tabular shrink-0 text-2xs font-semibold text-ink">
                  {num(item.documentos)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ================================================================ treemap */

/**
 * Matéria jurídica: área proporcional ao volume, cor semântica.
 *
 * Substituiu a barra única segmentada. A barra empilhava sete matérias numa
 * faixa de nove pixels de altura, e as três menores viravam listras — a área
 * devolve o tamanho de cada uma como tamanho.
 */
export function TreemapMateria({
  itens,
  altura = 260,
  ativa,
  haSelecao = false,
  onSelect,
}: {
  itens: Array<{ chave: string; documentos: number }>
  altura?: number
  ativa?: (chave: string) => boolean
  haSelecao?: boolean
  onSelect?: (chave: string) => void
}) {
  const tokens = useChartTokens()
  const corDaMateria = useCorDaMateria()

  const option = React.useMemo(() => {
    const total = itens.reduce((a, i) => a + i.documentos, 0) || 1
    return {
      ...baseOption(tokens),
      animationDuration: 620,
      animationDurationUpdate: 420,
      tooltip: {
        ...tooltipStyle(tokens),
        formatter: (params: unknown) => {
          const it = params as { name: string; value: number }
          return `<div style="min-width:180px">${TITULO(it.name)}${LINHA(
            'documentos',
            num(it.value),
            tokens.inkMuted,
          )}${LINHA('do recorte', pct((it.value / total) * 100), tokens.inkMuted)}</div>`
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
          itemStyle: { borderColor: tokens.surface, borderWidth: 3, gapWidth: 3, borderRadius: 7 },
          label: {
            show: true,
            position: 'insideTopLeft',
            formatter: (p: { name: string; value: number }) => {
              const parte = p.value / total
              /**
               * O rótulo encolhe conforme o tile, e encolhe NA ORDEM CERTA.
               *
               * O ECharts não avisa quando o texto não cabe: ele corta. Num
               * tile estreito, "17" virava "1" e "4,3%" virava "4," — e número
               * cortado é pior que número ausente, porque mente. Então a
               * porcentagem sai primeiro, depois o nome, e o valor é o último
               * a sair.
               */
              if (parte <= 0.015) return ''
              if (parte <= 0.07) return `{compacto|${num(p.value)}}`
              const limite = parte > 0.14 ? 24 : 14
              const nome = p.name.length > limite ? `${p.name.slice(0, limite - 1)}…` : p.name
              if (parte <= 0.11) return `{nome|${nome}}\n{valor|${num(p.value)}}`
              return `{nome|${nome}}\n{valor|${num(p.value)}}\n{parte|${pct(parte * 100)}}`
            },
            rich: {
              nome: { fontSize: 11.5, fontWeight: 600, color: '#fff', lineHeight: 15 },
              valor: { fontSize: 23, fontWeight: 700, color: '#fff', lineHeight: 27 },
              parte: { fontSize: 10.5, color: 'rgba(255,255,255,.72)', lineHeight: 14 },
              // Tile estreito: o mesmo número em corpo menor. Em 23px, "17"
              // precisa de 36px de tile e saía cortado em "1".
              compacto: { fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 16 },
            },
            padding: [9, 8],
          },
          upperLabel: { show: false },
          emphasis: { itemStyle: { borderColor: tokens.cyan, borderWidth: 3 } },
          levels: [{ itemStyle: { borderWidth: 0, gapWidth: 3 } }],
          data: itens.map((item) => {
            const selecionada = ativa?.(item.chave) ?? false
            return {
              name: item.chave,
              value: item.documentos,
              itemStyle: {
                color: corDaMateria(item.chave),
                opacity: haSelecao && !selecionada ? OPACIDADE_ATENUADA : 1,
                borderColor: selecionada ? tokens.ink : tokens.surface,
                borderWidth: selecionada ? 2 : 3,
              },
            }
          }),
        },
      ],
    }
  }, [itens, tokens, ativa, haSelecao, corDaMateria])

  return (
    <EChart
      option={option}
      height={altura}
      ariaLabel="Composição por matéria jurídica"
      onEvent={{ click: (p) => p.name && onSelect?.(String(p.name)) }}
    />
  )
}

/* ================================================================= bolhas */

/**
 * Temas do acervo. Área = volume, posição = nada.
 *
 * Substituiu o ranking em barras. Barra ordenada convida a ler primeiro,
 * segundo, terceiro — e a diferença entre o primeiro tema (81) e o terceiro
 * (70) não sustenta essa leitura. Bolha diz "estes são os assuntos, e este é o
 * tamanho de cada um", que é a verdade disponível.
 *
 * O layout é calculado, não simulado — ver `empacotamento.ts`.
 */
export function BolhasDeTema({
  itens,
  altura = 300,
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
  const caixa = React.useRef<HTMLDivElement | null>(null)
  const [largura, setLargura] = React.useState(0)

  React.useEffect(() => {
    const alvo = caixa.current
    if (!alvo) return
    const medir = () => setLargura(alvo.clientWidth)
    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(alvo)
    // ResizeObserver não é entregue em aba que não pinta; o resize da janela
    // chega assim mesmo e serve de rede.
    window.addEventListener('resize', medir)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [])

  const { bolhas, total } = React.useMemo(() => {
    const ordenados = [...itens].sort((a, b) => b.documentos - a.documentos).slice(0, maximo)
    const total = itens.reduce((a, i) => a + i.documentos, 0) || 1
    return {
      bolhas: empacotar(
        ordenados.map((i) => ({ chave: i.chave, valor: i.documentos })),
        Math.max(0, largura - 8),
        Math.max(0, altura - 8),
      ),
      total,
    }
  }, [itens, maximo, largura, altura])

  const [sobre, setSobre] = React.useState<string | null>(null)

  return (
    <div ref={caixa} className="relative w-full" style={{ height: altura }}>
      <svg
        width="100%"
        height={altura}
        role="img"
        aria-label="Temas do acervo por volume de vínculos"
        className="overflow-visible"
      >
        {bolhas.map((b) => {
          const selecionada = ativa?.(b.chave) ?? false
          const atenuada = haSelecao && !selecionada
          // Cor estável pelo NOME do tema: um filtro que muda o ranking não
          // troca a cor de ninguém.
          const cor = `hsl(var(--data-${indiceEstavel(b.chave) + 1}))`
          // Rótulo só quando o círculo comporta: caber é condição, não desejo.
          const cabeNome = b.r >= 30
          const cabeValor = b.r >= 19
          return (
            <g
              key={b.chave}
              transform={`translate(${b.x + 4} ${b.y + 4})`}
              tabIndex={onSelect ? 0 : -1}
              role={onSelect ? 'button' : undefined}
              aria-pressed={onSelect ? selecionada : undefined}
              aria-label={`${b.chave}: ${b.valor} vínculos`}
              className={cn('outline-none', onSelect && 'cursor-pointer')}
              onMouseEnter={() => setSobre(b.chave)}
              onMouseLeave={() => setSobre((s) => (s === b.chave ? null : s))}
              onFocus={() => setSobre(b.chave)}
              onBlur={() => setSobre((s) => (s === b.chave ? null : s))}
              onClick={() => onSelect?.(b.chave)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect?.(b.chave)
                }
              }}
            >
              <circle
                r={b.r}
                fill={cor}
                fillOpacity={atenuada ? 0.16 : selecionada ? 0.34 : 0.22}
                stroke={cor}
                strokeWidth={selecionada ? 2.5 : 1.5}
                strokeOpacity={atenuada ? 0.3 : 1}
                style={{
                  transition: 'fill-opacity 200ms ease-out, stroke-opacity 200ms ease-out',
                  filter: selecionada
                    ? `drop-shadow(0 0 14px ${cor})`
                    : sobre === b.chave
                      ? `drop-shadow(0 0 9px ${cor})`
                      : undefined,
                }}
              />
              {cabeNome ? (
                <text
                  y={-4}
                  textAnchor="middle"
                  className="pointer-events-none fill-ink text-[10.5px] font-medium"
                  opacity={atenuada ? 0.45 : 0.92}
                >
                  {b.chave.length > 14 ? `${b.chave.slice(0, 13)}…` : b.chave}
                </text>
              ) : null}
              {cabeValor ? (
                <text
                  y={cabeNome ? 14 : 5}
                  textAnchor="middle"
                  className="pointer-events-none fill-ink font-semibold tabular-nums"
                  style={{ fontSize: Math.min(20, Math.max(11, b.r / 2.1)) }}
                  opacity={atenuada ? 0.5 : 1}
                >
                  {num(b.valor)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      {sobre
        ? (() => {
            const b = bolhas.find((x) => x.chave === sobre)
            if (!b) return null
            const fim = b.x > largura * 0.62
            return (
              <div
                className="pointer-events-none absolute z-10 w-[190px] rounded-lg border border-line px-3 py-2 shadow-pop"
                style={{
                  background: tokens.elevated,
                  left: Math.max(0, Math.min(largura - 190, b.x + (fim ? -196 : 12))),
                  top: Math.max(0, b.y - 24),
                }}
              >
                <p className="truncate text-[11.5px] font-semibold text-ink">{b.chave}</p>
                <p className="mt-1 text-2xs text-ink-muted">
                  <b className="tabular text-ink">{num(b.valor)}</b> vínculos ·{' '}
                  {pct((b.valor / total) * 100)} do recorte
                </p>
              </div>
            )
          })()
        : null}
    </div>
  )
}

/* ================================================================= bullet */

/**
 * Progresso de uma parte dentro do todo.
 *
 * Substituiu o KPI com sparkline no cartão de produção do ano. A sparkline
 * mostrava a forma da série mensal — informação que o gráfico de produção por
 * mês, logo abaixo, dá inteira e com eixo. O que faltava era a PARTE: 147 é
 * muito ou pouco depende de quanto é o todo, e é isso que a barra responde.
 */
export function BarraDeParte({
  valor,
  total,
  cor = 'hsl(var(--accent))',
  rotuloTotal = 'Total',
}: {
  valor: number
  total: number
  cor?: string
  rotuloTotal?: string
}) {
  const parte = total > 0 ? (valor / total) * 100 : 0
  return (
    <div className="mt-auto pt-4">
      <div className="flex items-end justify-between gap-3">
        <span className="text-[13px] text-ink-muted">
          <b className="tabular font-semibold text-ink">{pct(parte)}</b> do recorte
        </span>
        <span className="text-2xs text-ink-faint">
          {rotuloTotal} <b className="tabular font-semibold text-ink-muted">{num(total)}</b>
        </span>
      </div>
      <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-subtle">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(parte, parte > 0 ? 1.5 : 0))}%`,
            background: `linear-gradient(90deg, ${withAlpha(cor, 0.68)}, ${cor})`,
            boxShadow: `0 0 12px ${withAlpha(cor, 0.45)}`,
            transition: 'width 320ms cubic-bezier(.22,1,.36,1)',
          }}
        />
      </div>
    </div>
  )
}
