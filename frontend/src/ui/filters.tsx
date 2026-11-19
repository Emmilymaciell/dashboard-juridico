/**
 * Filtros globais. Barra enxuta: período + quatro dimensões principais, e o
 * resto atrás de "Mais filtros".
 *
 * O período é explícito — "Período de análise (data do documento)" — porque na
 * versão anterior ficava ambíguo qual das quatro datas do índice estava sendo
 * filtrada. É a data do DOCUMENTO, nunca de upload nem de modificação.
 */

import { Calendar, Check, ChevronDown, Filter, SlidersHorizontal, X } from 'lucide-react'
import * as React from 'react'

import { FILTER_LABELS, type MultiKey, useFilters } from '@/lib/filters'
import { useFilterOptions } from '@/lib/queries'
import { cn, fold } from '@/lib/utils'
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
} from '@/ui/primitives'

/* ------------------------------------------------------------------ período */

interface Preset {
  chave: string
  rotulo: string
  inicio: string | null
  fim: string | null
}

function buildPresets(): Preset[] {
  const hoje = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const doze = new Date(hoje)
  doze.setMonth(doze.getMonth() - 12)
  const anoAtual = hoje.getFullYear()
  return [
    { chave: 'todo', rotulo: 'Todo o período', inicio: null, fim: null },
    {
      chave: 'ano-atual',
      rotulo: String(anoAtual),
      inicio: `${anoAtual}-01-01`,
      fim: `${anoAtual}-12-31`,
    },
    {
      chave: 'ano-anterior',
      rotulo: String(anoAtual - 1),
      inicio: `${anoAtual - 1}-01-01`,
      fim: `${anoAtual - 1}-12-31`,
    },
    { chave: '12m', rotulo: 'Últimos 12 meses', inicio: iso(doze), fim: iso(hoje) },
  ]
}

export function PeriodFilter({ compact = false }: { compact?: boolean }) {
  const { filters, setMany } = useFilters()
  const presets = React.useMemo(buildPresets, [])
  const [open, setOpen] = React.useState(false)

  const ativo =
    presets.find(
      (p) => (p.inicio ?? '') === (filters.data_inicio ?? '') && (p.fim ?? '') === (filters.data_fim ?? ''),
    ) ?? null
  const personalizado = !ativo && (filters.data_inicio || filters.data_fim)
  const rotulo = ativo
    ? ativo.rotulo
    : personalizado
      ? `${filters.data_inicio ?? '…'} → ${filters.data_fim ?? '…'}`
      : 'Todo o período'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={personalizado || (ativo && ativo.chave !== 'todo') ? 'subtle' : 'secondary'}
          size={compact ? 'sm' : 'md'}
          className="gap-2"
        >
          <Calendar className="size-3.5" />
          <span className="hidden sm:inline text-ink-muted">Período:</span>
          <span className="font-semibold">{rotulo}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[19rem] p-0">
        <div className="border-b border-line px-3 py-2.5">
          <p className="text-xs font-semibold text-ink">Período de análise</p>
          <p className="mt-0.5 text-2xs leading-snug text-ink-muted">
            Filtra pela <b>data do documento</b> — não pela data de envio ao repositório
            nem pela de última modificação.
          </p>
        </div>
        <div className="p-1.5">
          {presets.map((preset) => {
            const selecionado = ativo?.chave === preset.chave
            return (
              <button
                key={preset.chave}
                type="button"
                onClick={() => {
                  setMany({ data_inicio: preset.inicio, data_fim: preset.fim })
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs',
                  'transition-colors hover:bg-subtle',
                  selecionado && 'bg-accent-soft font-semibold text-accent-ink',
                )}
              >
                {preset.rotulo}
                {selecionado ? <Check className="size-3.5" /> : null}
              </button>
            )
          })}
        </div>
        <Separator />
        <div className="space-y-2 p-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Personalizado
          </p>
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-2xs text-ink-muted">De</span>
              <Input
                type="date"
                value={filters.data_inicio ?? ''}
                onChange={(e) => setMany({ data_inicio: e.target.value || null })}
                className="h-8 text-xs"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-2xs text-ink-muted">Até</span>
              <Input
                type="date"
                value={filters.data_fim ?? ''}
                onChange={(e) => setMany({ data_fim: e.target.value || null })}
                className="h-8 text-xs"
              />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------- filtro de dimensão */

export function DimensionFilter({
  label,
  filterKey,
  values,
  labels,
  compact = false,
}: {
  label: string
  filterKey: MultiKey
  values: string[]
  labels?: Record<string, string>
  compact?: boolean
}) {
  const { filters, toggle } = useFilters()
  const selected = filters[filterKey] ?? []
  const [busca, setBusca] = React.useState('')

  const filtrados = React.useMemo(() => {
    if (!busca) return values
    const needle = fold(busca)
    return values.filter((v) => fold(labels?.[v] ?? v).includes(needle))
  }, [values, busca, labels])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length ? 'subtle' : 'secondary'}
          size={compact ? 'sm' : 'md'}
          className="gap-1.5"
        >
          {label}
          {selected.length ? (
            <span className="tabular rounded bg-accent px-1.5 text-2xs font-bold text-accent-contrast">
              {selected.length}
            </span>
          ) : (
            <ChevronDown className="size-3 opacity-55" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[17rem] p-0">
        <div className="border-b border-line p-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Filtrar ${(FILTER_LABELS[filterKey] ?? label).toLowerCase()}…`}
            className="h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-[19rem] overflow-y-auto p-1.5">
          {filtrados.length === 0 ? (
            <p className="px-2 py-5 text-center text-xs text-ink-faint">nenhum valor</p>
          ) : (
            filtrados.map((value) => {
              const marcado = selected.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggle(filterKey, value)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs',
                    'transition-colors hover:bg-subtle',
                    marcado && 'bg-accent-soft/60',
                  )}
                >
                  <Checkbox checked={marcado} tabIndex={-1} aria-hidden />
                  <span className="flex-1 truncate text-ink">{labels?.[value] ?? value}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------------------------------------------- barra global */

export function GlobalFilterBar({
  /**
   * Modo discreto: a barra continua inteira e com o MESMO comportamento, mas
   * recua visualmente. Existe para a Linha do Tempo, onde a experiência é a
   * timeline e uma toolbar de peso igual logo acima dela disputa a atenção.
   *
   * O recuo é de presença, não de contraste permanente: ao passar o mouse ou
   * ao receber foco por teclado a barra volta a 100%, então quem vai usar o
   * filtro nunca lê texto apagado.
   */
  discreto = false,
}: {
  discreto?: boolean
} = {}) {
  const { chips, removeChip, clear, activeCount } = useFilters()
  const { data: options } = useFilterOptions()
  const [maisFiltros, setMaisFiltros] = React.useState(false)

  return (
    <div
      className={cn(
        'border-t border-line',
        discreto
          ? 'bg-surface/35 opacity-[0.72] transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100'
          : 'bg-surface/60',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-content flex-wrap items-center gap-2 px-6 lg:px-9',
          discreto ? 'gap-1.5 py-1.5' : 'py-2.5',
        )}
      >
        {options ? (
          <>
          <PeriodFilter compact />
          <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
          <DimensionFilter label="Natureza" filterKey="natureza" values={options.natureza} compact />
          <DimensionFilter
            label="Destinatário"
            filterKey="destinatario"
            values={options.destinatario}
            compact
          />
          <DimensionFilter label="Rodovia" filterKey="rodovia" values={options.rodovia} compact />
          <DimensionFilter label="Contrato" filterKey="contrato" values={options.contrato} compact />

          <Button
            variant={maisFiltros ? 'subtle' : 'ghost'}
            size="sm"
            onClick={() => setMaisFiltros((v) => !v)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="size-3.5" />
            Mais filtros
            <ChevronDown
              className={cn('size-3 transition-transform duration-200', maisFiltros && 'rotate-180')}
            />
          </Button>

          {maisFiltros ? (
            <>
              <DimensionFilter label="Tema" filterKey="tema" values={options.tema} compact />
              <DimensionFilter label="Status" filterKey="status" values={options.status} compact />
              <DimensionFilter
                label="Matéria"
                filterKey="macrogrupo"
                values={options.macrogrupo}
                compact
              />
            </>
          ) : null}
          </>
        ) : (
          // Reserva a altura da fileira enquanto as opcoes nao chegam. O
          // conteudo pisca; a barra, nao.
          <span aria-hidden className="block h-8" />
        )}

        <div className="flex-1" />

        {activeCount > 0 ? (
          <Tooltip content="Remover todos os filtros">
            <Button variant="ghost" size="sm" onClick={clear} className="gap-1.5 text-accent">
              <Filter className="size-3.5" />
              {activeCount} filtro{activeCount > 1 ? 's' : ''} ativo{activeCount > 1 ? 's' : ''}
              <X className="size-3" />
            </Button>
          </Tooltip>
        ) : null}

        {/* Encaixe da pagina.
            A Linha do Tempo monta aqui dentro, por portal, o seu "ir para uma
            data" - ver `TimelinePage`. Fica no extremo direito, debaixo do
            carimbo de atualizacao dos dados, porque e a mesma familia de
            pergunta dos filtros ao lado: um recorte do acervo. Em qualquer
            outra pagina o encaixe existe e fica vazio, sem ocupar espaco. */}
        <div data-encaixe-barra-filtros className="flex shrink-0 items-center" />
      </div>

      {chips.length > 0 ? (
        <div
          className={cn(
            'mx-auto flex max-w-content flex-wrap items-center gap-1.5 px-6 lg:px-9',
            discreto ? 'pb-1.5' : 'pb-2.5',
          )}
        >
          {chips.map((chip) => (
            <FilterChip key={`${chip.key}:${chip.value}`} chip={chip} onRemove={removeChip} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function FilterChip({
  chip,
  onRemove,
}: {
  chip: { key: string; value: string; label: string }
  onRemove: (chip: { key: string; value: string; label: string }) => void
}) {
  const derivado = chip.key === 'rodovia' || chip.key === 'macrogrupo'
  return (
    <button
      type="button"
      onClick={() => onRemove(chip)}
      title={`Remover filtro ${chip.label}: ${chip.value}`}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5 text-2xs',
        'transition-all duration-150 hover:border-danger/45 hover:bg-danger/[0.07]',
        derivado
          ? 'border-dashed border-accent/45 bg-accent-soft/40 text-accent-ink'
          : 'border-line bg-subtle text-ink-muted',
      )}
    >
      <span className="font-semibold uppercase tracking-wide opacity-70">{chip.label}</span>
      <span className="font-medium text-ink">{chip.value}</span>
      <X className="size-3 opacity-45 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

/** Aviso de recorte ativo para cabeçalho de página. */
export function ActiveFilterNote() {
  const { activeCount, clear } = useFilters()
  if (activeCount === 0) return null
  return (
    <Badge variant="accent" className="gap-1.5">
      recorte filtrado
      <button type="button" onClick={clear} className="underline decoration-dotted">
        limpar
      </button>
    </Badge>
  )
}
