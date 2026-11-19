/**
 * Acervo Documental. Ferramenta profissional de busca documental — não uma
 * tabela dentro de um card.
 *
 * Redesenho: busca em destaque real, chips de recorte, cabeçalho de tabela
 * refinado com densidade ajustável, linhas com estado de hover e seleção,
 * melhor aproveitamento da largura, e o drawer como ficha documental executiva.
 */

import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { api, ApiError, type DocumentoResumo } from '@/lib/api'
import { date, num, truncate } from '@/lib/format'
import { useFilters } from '@/lib/filters'
import { useDocuments, useFilterOptions } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { DimensionFilter, FilterChip } from '@/ui/filters'
import { Reveal } from '@/ui/motion'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  Tooltip,
} from '@/ui/primitives'
import { DocumentDrawer } from '@/features/explorer/DocumentDrawer'

const TAMANHOS = [25, 50, 100, 200]

interface Coluna {
  key: string
  label: string
  sortable: boolean
  className?: string
  render: (doc: DocumentoResumo) => React.ReactNode
}

export function ExplorerPage() {
  const { filters, chips, removeChip, clear, activeCount } = useFilters()
  const [params, setParams] = useSearchParams()
  const { data: options } = useFilterOptions()

  const selecionado = params.get('doc') ? Number(params.get('doc')) : null
  const porPagina = Number(params.get('limite') ?? 50)
  const pagina = Number(params.get('pagina') ?? 1)
  const ordenarPor = params.get('ordenar_por') ?? 'data_documento'
  const ordem = params.get('ordem') ?? 'desc'
  const densa = params.get('densa') === '1'

  const [rascunho, setRascunho] = React.useState(filters.busca ?? '')
  const buscaRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    setRascunho(filters.busca ?? '')
  }, [filters.busca])

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      if ((filters.busca ?? '') !== rascunho) {
        const next = new URLSearchParams(params)
        if (rascunho) next.set('busca', rascunho)
        else next.delete('busca')
        next.delete('pagina')
        setParams(next, { replace: true })
      }
    }, 220)
    return () => window.clearTimeout(handle)
  }, [rascunho, filters.busca, params, setParams])

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null
      const digitando = alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
      if (event.key === '/' && !digitando) {
        event.preventDefault()
        buscaRef.current?.focus()
      }
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        buscaRef.current?.focus()
        buscaRef.current?.select()
      }
      if (event.key === 'Escape' && alvo === buscaRef.current) setRascunho('')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useDocuments(filters, {
    limite: porPagina,
    offset: (pagina - 1) * porPagina,
    ordenar_por: ordenarPor,
    ordem,
  })

  const total = data?.data.total ?? 0
  const itens = data?.data.itens ?? []
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))

  const atualizar = (mudancas: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) next.delete(chave)
      else next.set(chave, valor)
    }
    setParams(next)
  }

  const ordenarPorColuna = (key: string) => {
    if (ordenarPor === key) atualizar({ ordem: ordem === 'asc' ? 'desc' : 'asc', pagina: null })
    else atualizar({ ordenar_por: key, ordem: 'desc', pagina: null })
  }

  const abrirDoc = (id: number) => {
    const next = new URLSearchParams(params)
    next.set('doc', String(id))
    setParams(next, { replace: true })
  }

  const colunas: Coluna[] = [
    {
      key: 'data_documento',
      label: 'Data',
      sortable: true,
      className: 'w-[6.5rem]',
      render: (doc) => (
        <span className="tabular whitespace-nowrap text-xs font-medium text-ink">
          {date(doc.data_documento, doc.data_documento_precisao)}
          {doc.data_documento_precisao === 'mes' ? (
            <Tooltip content="Documento de periodicidade mensal — o dia não é informado na fonte.">
              <span className="ml-1 cursor-help text-ink-faint">*</span>
            </Tooltip>
          ) : null}
        </span>
      ),
    },
    {
      key: 'natureza',
      label: 'Natureza',
      sortable: true,
      className: 'w-[11.5rem]',
      render: (doc) =>
        doc.natureza ? (
          <Badge variant="neutral" className="max-w-full truncate">
            {doc.natureza}
          </Badge>
        ) : (
          <span className="text-2xs italic text-ink-faint">sem natureza</span>
        ),
    },
    {
      key: 'assunto',
      label: 'Assunto',
      sortable: true,
      className: 'min-w-[20rem]',
      render: (doc) => (
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {doc.assunto ?? '—'}
          </span>
          {!doc.ativo ? <Badge variant="danger">excluído</Badge> : null}
        </span>
      ),
    },
    {
      key: 'destinatario',
      label: 'Destinatário',
      sortable: true,
      className: 'w-[13rem]',
      render: (doc) => (
        <span className="truncate text-xs text-ink-muted">{doc.destinatario ?? '—'}</span>
      ),
    },
    {
      key: 'temas',
      label: 'Temas',
      sortable: false,
      className: 'w-[14rem]',
      render: (doc) => {
        const lista = (doc.temas_texto ?? '')
          .split(';')
          .map((t) => t.trim())
          .filter(Boolean)
        if (lista.length === 0) return <span className="text-2xs text-ink-faint">—</span>
        const [primeiro, ...resto] = lista
        return (
          <span className="flex items-center gap-1">
            <span className="truncate rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent-ink">
              {truncate(primeiro ?? '', 22)}
            </span>
            {resto.length > 0 ? (
              <Tooltip content={resto.join(' · ')}>
                <span className="shrink-0 cursor-help rounded-full border border-line px-1.5 py-0.5 text-2xs text-ink-faint">
                  +{resto.length}
                </span>
              </Tooltip>
            ) : null}
          </span>
        )
      },
    },
    {
      key: 'rodovia_principal',
      label: 'Rodovia',
      sortable: true,
      className: 'w-[6.5rem]',
      render: (doc) =>
        doc.rodovia_principal ? (
          <span className="font-mono text-xs font-semibold text-accent-ink">
            {doc.rodovia_principal}
          </span>
        ) : (
          // Não rotular a ausência como "Geral": o documento não traz rodovia
          // identificável, e isso é diferente de ser de alcance geral. O
          // agrupamento honesto existe na página Rodovias, com nome completo.
          <Tooltip content="Nenhuma rodovia identificada no assunto, no destinatário ou no nome do arquivo deste documento.">
            <span className="cursor-help text-2xs text-ink-faint">—</span>
          </Tooltip>
        ),
    },
    {
      key: 'contrato',
      label: 'Contrato',
      sortable: true,
      className: 'w-[6.5rem]',
      render: (doc) =>
        doc.contrato ? (
          // `nº` na frente porque "14/2025" numa tabela cheia de datas lê como
          // data. Variante neutra: o número do contrato não é um semáforo.
          <Badge variant="neutral" className="font-mono">
            nº {doc.contrato}
          </Badge>
        ) : (
          <span className="text-2xs text-ink-faint">—</span>
        ),
    },
    {
      key: 'arquivo_extensao',
      label: 'Fmt',
      sortable: false,
      className: 'w-14',
      render: (doc) => (
        <span className="font-mono text-2xs font-semibold uppercase text-ink-faint">
          {doc.arquivo_extensao ?? '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Sem título: o cabeçalho do shell já escreve "Acervo Documental" uma
          dobra acima. Ficam a frase de apoio e a ação de exportar. */}
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
            Busca textual, filtros combinados e acesso direto ao documento original no
            repositório.
          </p>
          <a href={api.exportCsvUrl(filters)} download>
            <Button variant="secondary" size="md">
              <Download className="size-3.5" />
              Exportar CSV
            </Button>
          </a>
        </div>
      </Reveal>

      {/* ---------------------------------------------------- busca em destaque */}
      <Reveal delay={0.044}>
        <Card className="hairline-top overflow-hidden">
          <div className="p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-faint" />
              <input
                ref={buscaRef}
                value={rascunho}
                onChange={(event) => setRascunho(event.target.value)}
                placeholder="Buscar por assunto, nome do arquivo, tema, destinatário ou ID do documento…"
                aria-label="Busca textual no acervo"
                className="h-14 w-full rounded-xl border border-line bg-subtle/50 pl-12 pr-28 text-base
                           text-ink placeholder:text-ink-faint transition-all duration-200
                           hover:border-line-strong focus:border-accent focus:bg-surface
                           focus:outline-none focus:ring-4 focus:ring-accent/12"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {rascunho ? (
                  <button
                    type="button"
                    onClick={() => setRascunho('')}
                    aria-label="Limpar busca"
                    className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-subtle hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs text-ink-faint sm:block">
                    /
                  </kbd>
                )}
              </div>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                <SlidersHorizontal className="size-3.5" />
                Refinar
              </span>
              {options ? (
                <>
                  <DimensionFilter
                    label="Natureza"
                    filterKey="natureza"
                    values={options.natureza}
                    compact
                  />
                  <DimensionFilter label="Tema" filterKey="tema" values={options.tema} compact />
                  <DimensionFilter
                    label="Destinatário"
                    filterKey="destinatario"
                    values={options.destinatario}
                    compact
                  />
                  <DimensionFilter
                    label="Rodovia"
                    filterKey="rodovia"
                    values={options.rodovia}
                    compact
                  />
                  <DimensionFilter
                    label="Contrato"
                    filterKey="contrato"
                    values={options.contrato}
                    compact
                  />
                  <DimensionFilter
                    label="Status"
                    filterKey="status"
                    values={options.status}
                    compact
                  />
                  <DimensionFilter
                    label="Matéria"
                    filterKey="macrogrupo"
                    values={options.macrogrupo}
                    compact
                  />
                </>
              ) : (
                <Skeleton className="h-8 w-72" />
              )}
            </div>

            {chips.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                  Recorte
                </span>
                {chips.map((chip) => (
                  <FilterChip
                    key={`${chip.key}:${chip.value}`}
                    chip={chip}
                    onRemove={removeChip}
                  />
                ))}
                <Button variant="ghost" size="sm" onClick={clear} className="h-6 text-accent">
                  limpar tudo
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </Reveal>

      {/* ---------------------------------------------------------- resultados */}
      <Reveal delay={0.066}>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <p aria-live="polite" className="text-sm text-ink-muted">
              {isPending ? (
                'carregando…'
              ) : (
                <>
                  <span className="tabular text-lg font-semibold text-ink">{num(total)}</span>{' '}
                  documento{total === 1 ? '' : 's'}
                  {activeCount > 0 ? ' no recorte' : ' no acervo'}
                  {total > 0 ? (
                    <span className="text-ink-faint">
                      {' · '}
                      {num((pagina - 1) * porPagina + 1)}–{num(Math.min(pagina * porPagina, total))}
                    </span>
                  ) : null}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Tooltip content={densa ? 'Densidade confortável' : 'Densidade compacta'}>
                <Button
                  variant={densa ? 'subtle' : 'ghost'}
                  size="icon-sm"
                  onClick={() => atualizar({ densa: densa ? null : '1' })}
                  aria-label="Alternar densidade da tabela"
                >
                  <Rows3 className="size-4" />
                </Button>
              </Tooltip>
              <label className="flex items-center gap-1.5 text-2xs text-ink-faint">
                por página
                <Select
                  value={String(porPagina)}
                  onChange={(event) => atualizar({ limite: event.target.value, pagina: null })}
                  className="h-7 text-xs"
                >
                  {TAMANHOS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          {isError ? (
            <div className="p-5">
              <ErrorState
                message={
                  error instanceof ApiError ? error.message : 'Erro inesperado ao consultar a API.'
                }
                hint={error instanceof ApiError ? error.acao : undefined}
                action={
                  <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            </div>
          ) : isPending ? (
            <div className="space-y-1.5 p-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : itens.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-8" />}
              title={
                activeCount > 0
                  ? 'Nenhum documento atende a esse recorte'
                  : 'Nenhum documento no acervo'
              }
              description={
                activeCount > 0
                  ? 'O recorte está restritivo demais. Remova um filtro ou limpe todos.'
                  : 'Rode a atualização de dados para construir o modelo a partir da fonte.'
              }
              action={
                activeCount > 0 ? (
                  <Button variant="secondary" size="sm" onClick={clear}>
                    Limpar filtros
                  </Button>
                ) : null
              }
            />
          ) : (
            <div
              className={cn(
                'table-scroll',
                isPlaceholderData && 'opacity-55 transition-opacity duration-200',
              )}
            >
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-subtle">
                  <tr>
                    {colunas.map((coluna) => (
                      <th
                        key={coluna.key}
                        scope="col"
                        className={cn(
                          'border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase',
                          'tracking-[0.08em] text-ink-muted',
                          coluna.className,
                        )}
                      >
                        {coluna.sortable ? (
                          <button
                            type="button"
                            onClick={() => ordenarPorColuna(coluna.key)}
                            className={cn(
                              // `uppercase` repetido de propósito: o preflight do
                              // Tailwind aplica `text-transform: none` em <button>,
                              // então o uppercase do <th> não é herdado aqui.
                              'inline-flex items-center gap-1 uppercase transition-colors hover:text-ink',
                              ordenarPor === coluna.key && 'text-accent-ink',
                            )}
                          >
                            {coluna.label}
                            {ordenarPor === coluna.key ? (
                              ordem === 'asc' ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )
                            ) : null}
                          </button>
                        ) : (
                          coluna.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itens.map((doc, index) => {
                    const ativo = selecionado === doc.documento_id
                    return (
                      <tr
                        key={doc.documento_id}
                        onClick={() => abrirDoc(doc.documento_id)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') abrirDoc(doc.documento_id)
                        }}
                        className={cn(
                          'group cursor-pointer border-b border-line transition-colors last:border-0',
                          index % 2 === 1 && 'bg-subtle/25',
                          'hover:bg-accent-soft/45 focus-visible:bg-accent-soft/45',
                          ativo && 'bg-accent-soft',
                        )}
                      >
                        {colunas.map((coluna, colIndex) => (
                          <td
                            key={coluna.key}
                            className={cn(
                              'px-4 align-middle',
                              densa ? 'py-1.5' : 'py-2.5',
                              colIndex === 0 &&
                                'relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:transition-colors',
                              colIndex === 0 && ativo && 'before:bg-accent',
                              colIndex === 0 && !ativo && !doc.ativo && 'before:bg-danger/70',
                            )}
                          >
                            {coluna.render(doc)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPaginas > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => atualizar({ pagina: pagina <= 2 ? null : String(pagina - 1) })}
              >
                anterior
              </Button>
              <span className="tabular text-xs text-ink-muted">
                página {pagina} de {totalPaginas}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => atualizar({ pagina: String(pagina + 1) })}
              >
                próxima
              </Button>
            </div>
          ) : null}
        </Card>
      </Reveal>

      <DocumentDrawer
        documentoId={selecionado}
        onClose={() => {
          const next = new URLSearchParams(params)
          next.delete('doc')
          setParams(next, { replace: true })
        }}
      />
    </div>
  )
}
