/**
 * KPI executivo. Escala pensada para 1920x1080 a distância de reunião.
 *
 * Contraste de escala, não "tudo grande": valor em 3rem, rótulo em 0.6875rem,
 * metadado em 0.6875rem com menos contraste. A hierarquia é o que faz o número
 * ser lido primeiro.
 */

import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import * as React from 'react'

import { num, pct, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CountUp } from '@/ui/motion'
import { Tooltip } from '@/ui/primitives'

export type KpiTone = 'neutro' | 'destaque' | 'atencao' | 'positivo'

export function KpiTile({
  label,
  value,
  valueText,
  unit = 'contagem',
  hint,
  delta,
  deltaLabel,
  tone = 'neutro',
  onClick,
  chart,
  size = 'md',
  badge,
}: {
  label: string
  value: number | null
  valueText?: string | null
  unit?: 'contagem' | 'percentual'
  hint?: React.ReactNode
  delta?: number | null
  deltaLabel?: string | null
  tone?: KpiTone
  onClick?: () => void
  chart?: React.ReactNode
  size?: 'md' | 'lg'
  badge?: React.ReactNode
}) {
  const Trend = (delta ?? 0) >= 0 ? TrendingUp : TrendingDown
  const interactive = Boolean(onClick)
  const formatted =
    value === null ? '—' : unit === 'percentual' ? pct(value) : undefined

  const body = (
    <>
      {/* Fio superior de cor: identifica o cartão sem encher de moldura. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-[3px] rounded-t-xl transition-opacity duration-200',
          tone === 'destaque' && 'bg-gradient-to-r from-accent via-cyan to-accent/30',
          tone === 'atencao' && 'bg-gradient-to-r from-warning via-warning/60 to-transparent',
          tone === 'positivo' && 'bg-gradient-to-r from-positive via-positive/60 to-transparent',
          tone === 'neutro' && 'bg-line',
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <span className="label-caps leading-tight">{label}</span>
        {badge}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        {/* Quando o fato relevante é um nome, e não uma contagem, o nome é o
            título do cartão — em escala menor, porque texto longo em 64px não
            cabe nem se lê melhor. */}
        <span
          className={cn(
            'font-semibold leading-none',
            valueText
              ? 'text-2xl tracking-tight'
              : cn('tabular', size === 'lg' ? 'text-kpi-lg' : 'text-kpi'),
            tone === 'atencao' ? 'text-warning' : 'text-ink',
          )}
        >
          {valueText ? (
            valueText
          ) : value === null ? (
            '—'
          ) : formatted ? (
            formatted
          ) : (
            <CountUp value={value} format={num} />
          )}
        </span>
        {delta !== null && delta !== undefined ? (
          <span
            className={cn(
              'mb-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
              delta >= 0
                ? 'bg-positive/10 text-positive'
                : 'bg-danger/10 text-danger',
            )}
          >
            <Trend className="size-3.5" />
            {signed(delta)}
          </span>
        ) : null}
      </div>

      {chart ? <div className="mt-3 -mx-1">{chart}</div> : null}

      {hint ? (
        <p className="mt-auto pt-3 text-2xs leading-relaxed text-ink-faint">
          {hint}
          {deltaLabel ? <span className="text-ink-muted"> · {deltaLabel}</span> : null}
        </p>
      ) : null}

      {interactive ? (
        <span className="mt-3 inline-flex items-center gap-1 text-2xs font-semibold text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          ver documentos <ArrowUpRight className="size-3" />
        </span>
      ) : null}
    </>
  )

  // Sem min-height: cartao alto com pouco conteudo virava espaco morto.
  // A altura vem do conteudo, e o grid iguala as alturas da linha.
  const classes = cn(
    'card relative flex h-full flex-col overflow-hidden p-5',
    interactive && 'card-hover group cursor-pointer text-left',
  )

  if (!interactive) return <div className={classes}>{body}</div>

  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  )
}

/** Métrica secundária em linha, para a faixa de apoio. */
export function KpiInline({
  label,
  value,
  unit = 'contagem',
  hint,
  onClick,
  icon: Icon,
}: {
  label: string
  value: number | null
  unit?: 'contagem' | 'percentual'
  hint?: string
  onClick?: () => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-3.5 shrink-0 text-accent/75" /> : null}
        <span className="label-caps">{label}</span>
      </div>
      <p className="tabular mt-2 text-kpi-sm font-semibold leading-none text-ink">
        {value === null ? '—' : unit === 'percentual' ? pct(value) : num(value)}
      </p>
      {hint ? <p className="mt-1.5 text-2xs leading-snug text-ink-faint">{hint}</p> : null}
    </>
  )
  if (!onClick) return <div className="px-5 py-4">{content}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className="group px-5 py-4 text-left transition-colors hover:bg-subtle"
    >
      {content}
    </button>
  )
}

/** Cabeçalho de página: eyebrow + título grande + apoio + ações. */
export function PageHeading({
  eyebrow,
  title,
  lead,
  actions,
  meta,
}: {
  eyebrow?: string
  title: string
  lead?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1.5 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
        {lead ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">{lead}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Título de bloco dentro da página, com número de apoio. */
export function SectionTitle({
  title,
  subtitle,
  count,
  actions,
  tooltip,
}: {
  title: string
  subtitle?: string
  count?: React.ReactNode
  actions?: React.ReactNode
  tooltip?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          {count !== undefined ? (
            <span className="tabular rounded bg-subtle px-1.5 py-0.5 text-2xs font-semibold text-ink-muted">
              {count}
            </span>
          ) : null}
          {tooltip ? (
            <Tooltip content={tooltip}>
              <span className="cursor-help text-2xs text-ink-faint underline decoration-dotted underline-offset-2">
                o que é isto?
              </span>
            </Tooltip>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-snug text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}
