/**
 * O que sobrou da página Destinatários: a lista de cada parte em detalhe.
 *
 * O ranking em lollipop não foi duplicado — "Para quem o Escritório Jurídico escreve", na
 * Visão Geral, é o mesmo gráfico com os mesmos dados, e ficou com o lugar de
 * destaque.
 *
 * Saíram a pedido da usuária, depois de vistos na tela: os quatro KPIs de
 * interlocução e o cruzamento destinatário × matéria em heatmap. Os números dos
 * KPIs continuam legíveis na lista abaixo, parte por parte.
 */

import { ArrowUpRight, Users } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { date, num, pct } from '@/lib/format'
import { drillToSearch, useFilters } from '@/lib/filters'
import { useStakeholdersDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { SectionTitle } from '@/ui/kpi'
import { Badge, Button, Card, EmptyState, Skeleton } from '@/ui/primitives'

function useAbrirDocumentos() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  return React.useCallback(
    (drill: Record<string, unknown>) =>
      navigate(`/documentos${drillToSearch({ ...filters, ...drill })}`),
    [filters, navigate],
  )
}

/* ------------------------------------------------------ cada parte em detalhe */

export function BlocoPartesEmDetalhe() {
  const { filters } = useFilters()
  const { data, isPending } = useStakeholdersDetail(filters)
  const abrir = useAbrirDocumentos()
  const [expandido, setExpandido] = React.useState<string | null>(null)

  const destinatarios = data?.data.destinatarios ?? []

  return (
    <Card className="overflow-hidden">
      <SectionTitle
        title="Cada parte em detalhe"
        subtitle="clique para ver as naturezas e os temas que compõem a interlocução"
        count={destinatarios.length}
      />
      {isPending ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : destinatarios.length === 0 ? (
        <EmptyState icon={<Users className="size-7" />} title="Nenhum destinatário no recorte" />
      ) : (
        <ul className="divide-y divide-line">
          {destinatarios.map((parte, index) => {
            const aberto = expandido === parte.destinatario
            return (
              <li key={parte.destinatario}>
                <button
                  type="button"
                  onClick={() => setExpandido(aberto ? null : parte.destinatario)}
                  className={cn(
                    'flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-subtle',
                    aberto && 'bg-subtle',
                  )}
                  aria-expanded={aberto}
                >
                  <span className="tabular w-6 shrink-0 text-2xs font-bold text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{ background: `hsl(var(--data-${(index % 8) + 1}))` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {parte.destinatario}
                      </span>
                      {parte.generico ? <Badge variant="outline">genérico</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-2xs text-ink-faint">
                      {num(parte.naturezas)} naturezas · {date(parte.primeiro)} →{' '}
                      {date(parte.ultimo)}
                    </span>
                  </span>
                  <span className="hidden w-40 shrink-0 sm:block">
                    <span className="relative block h-1.5 overflow-hidden rounded-full bg-line">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${parte.participacao}%`,
                          background: `hsl(var(--data-${(index % 8) + 1}))`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="tabular w-11 shrink-0 text-right text-xs text-ink-muted">
                    {pct(parte.participacao)}
                  </span>
                  <span className="tabular w-12 shrink-0 text-right text-lg font-semibold text-ink">
                    {num(parte.documentos)}
                  </span>
                </button>

                {aberto ? (
                  <div className="grid gap-5 border-t border-line bg-subtle/35 px-5 py-4 sm:grid-cols-2">
                    <DetalheLista
                      titulo="Naturezas mais frequentes"
                      itens={parte.naturezas_top}
                      onSelect={(chave) =>
                        abrir({ destinatario: [parte.destinatario], natureza: [chave] })
                      }
                    />
                    <DetalheLista
                      titulo="Temas mais frequentes"
                      itens={parte.temas_top}
                      onSelect={(chave) =>
                        abrir({ destinatario: [parte.destinatario], tema: [chave] })
                      }
                    />
                    <div className="sm:col-span-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => abrir({ destinatario: [parte.destinatario] })}
                      >
                        Ver os {num(parte.documentos)} documentos
                        <ArrowUpRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function DetalheLista({
  titulo,
  itens,
  onSelect,
}: {
  titulo: string
  itens: Array<{ chave: string; documentos: number }>
  onSelect: (chave: string) => void
}) {
  const maior = Math.max(1, ...itens.map((i) => i.documentos))
  return (
    <div>
      <p className="label-caps mb-2">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-2xs italic text-ink-faint">sem dados</p>
      ) : (
        <ul className="space-y-1">
          {itens.map((item, index) => (
            <li key={item.chave}>
              <button
                type="button"
                onClick={() => onSelect(item.chave)}
                className="group flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface"
              >
                <span className="w-32 shrink-0 truncate text-xs text-ink">{item.chave}</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${(item.documentos / maior) * 100}%`,
                      background: `hsl(var(--data-${(index % 8) + 1}))`,
                    }}
                  />
                </span>
                <span className="tabular w-8 shrink-0 text-right text-xs font-semibold text-ink">
                  {num(item.documentos)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
