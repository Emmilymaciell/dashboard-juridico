/**
 * O que era a página Portfólio Jurídico, agora como blocos da Visão Geral.
 *
 * A usuária pediu uma aba só. Em vez de empilhar as três telas antigas uma
 * embaixo da outra, cada bloco virou um componente próprio para que a Visão
 * Geral possa INTERCALÁ-LOS com os seus — é isso que permite, por exemplo, a
 * rosca de resposta e a barra de matéria dividirem a mesma faixa.
 *
 * Cada bloco chama `usePortfolio` por conta própria. Não há requisição
 * repetida: a chave da query é a mesma e o TanStack Query serve todos do mesmo
 * cache. Em troca, nenhum deles precisa receber payload por prop.
 */

import { ArrowUpRight, Layers } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { MiniSeries } from '@/charts/charts'
import { BolhasDeTema, TreemapMateria } from '@/charts/painel'
import { date, num, pct } from '@/lib/format'
import { drillToSearch, useFilters } from '@/lib/filters'
import { useCruzamento } from '@/features/overview/cruzamento'
import { usePortfolio } from '@/lib/queries'
import { cn, coresPorMateria } from '@/lib/utils'
import { SectionTitle } from '@/ui/kpi'
import { Badge, Button, Card, EmptyState, Skeleton } from '@/ui/primitives'

/** Atalho compartilhado pelos blocos: filtro atual + recorte do clique. */
function useAbrirDocumentos() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  return React.useCallback(
    (drill: Record<string, unknown>) =>
      navigate(`/documentos${drillToSearch({ ...filters, ...drill })}`),
    [filters, navigate],
  )
}

/* ----------------------------------------------------------- matéria jurídica */

/** Área proporcional ao volume, cor semântica por matéria. */
export function BlocoMateriaJuridica({ altura = 268 }: { altura?: number } = {}) {
  const { filters } = useFilters()
  const { data, isPending } = usePortfolio(filters)
  const { aplicar, ativo, dimensaoAtiva } = useCruzamento()
  const payload = data?.data

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <SectionTitle
        title="Matéria jurídica"
        tooltip="Camada derivada, não dado da fonte. A natureza diz o tipo do documento (minuta, ofício); a matéria diz o assunto jurídico (contratual, sancionatório). Onde a natureza é só forma — minuta, anexo, ofício — a matéria vem dos temas, e só quando o sinal é inequívoco."
      />
      <div className="flex-1 p-3">
        {isPending || !payload ? (
          <Skeleton className="h-full min-h-[240px] w-full" />
        ) : payload.macrogrupos.length === 0 ? (
          <EmptyState title="Nenhuma matéria neste recorte" />
        ) : (
          <TreemapMateria
            itens={payload.macrogrupos}
            altura={altura}
            ativa={(chave) => ativo('materia', chave)}
            haSelecao={dimensaoAtiva('materia')}
            onSelect={(chave) => aplicar('materia', chave)}
          />
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------- temas */

/**
 * Assuntos por tamanho, sem ranking.
 *
 * Um documento trata de vários temas ao mesmo tempo, então a soma dos vínculos
 * é MAIOR que o número de documentos — é o comportamento esperado de um campo
 * multivalorado, e é por isso que o rótulo diz "vínculos", não "documentos".
 */
export function BlocoTemas({ altura = 268 }: { altura?: number } = {}) {
  const { filters } = useFilters()
  const { data, isPending } = usePortfolio(filters)
  const { aplicar, ativo, dimensaoAtiva } = useCruzamento()
  const payload = data?.data

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <SectionTitle
        title="Temas do acervo"
        subtitle="vínculos documento-tema"
        count={
          payload
            ? num(payload.temas.reduce((a, t) => a + (t.vinculos ?? t.documentos), 0))
            : undefined
        }
      />
      <div className="flex-1 px-3 pb-3 pt-1">
        {isPending || !payload ? (
          <Skeleton className="h-full min-h-[240px] w-full" />
        ) : payload.temas.length === 0 ? (
          <EmptyState title="Nenhum tema neste recorte" />
        ) : (
          <BolhasDeTema
            itens={payload.temas.map((t) => ({
              chave: t.chave,
              documentos: t.vinculos ?? t.documentos,
            }))}
            altura={altura}
            ativa={(chave) => ativo('tema', chave)}
            haSelecao={dimensaoAtiva('tema')}
            onSelect={(chave) => aplicar('tema', chave)}
          />
        )}
      </div>
    </Card>
  )
}

/* --------------------------------------------------- cada natureza em detalhe */

export function BlocoNaturezas() {
  const { filters } = useFilters()
  const { data, isPending } = usePortfolio(filters)
  const abrir = useAbrirDocumentos()
  const [ordenar, setOrdenar] = React.useState<'documentos' | 'recente' | 'alfabetica'>('documentos')

  const payload = data?.data
  const naturezas = React.useMemo(() => {
    const lista = [...(payload?.naturezas ?? [])]
    if (ordenar === 'alfabetica') lista.sort((a, b) => a.natureza.localeCompare(b.natureza, 'pt-BR'))
    if (ordenar === 'recente')
      lista.sort((a, b) => String(b.ultimo ?? '').localeCompare(String(a.ultimo ?? '')))
    return lista
  }, [payload, ordenar])

  // A cor significa *matéria jurídica*, não a posição da linha na tabela. Com
  // isso a régua de cada natureza e a sparkline de evolução falam a mesma
  // língua da barra de matéria acima — e a paleta ganha função em vez de virar
  // arco-íris decorativo.
  const corDaMateria = React.useMemo(
    () => coresPorMateria((payload?.macrogrupos ?? []).map((m) => m.chave)),
    [payload?.macrogrupos],
  )
  const indiceCor = (materia: string | null | undefined) =>
    materia ? (corDaMateria.get(materia) ?? 7) : 7

  return (
    <Card className="overflow-hidden">
      <SectionTitle
        title="Cada natureza em detalhe"
        subtitle="volume, participação, período coberto, temas dominantes e evolução"
        count={payload?.naturezas.length}
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-line bg-subtle p-0.5">
            {(
              [
                ['documentos', 'Volume'],
                ['recente', 'Mais recente'],
                ['alfabetica', 'A–Z'],
              ] as const
            ).map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setOrdenar(chave)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-2xs font-semibold transition-all',
                  ordenar === chave
                    ? 'bg-surface text-ink shadow-card'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        }
      />
      {isPending || !payload ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : naturezas.length === 0 ? (
        <EmptyState icon={<Layers className="size-7" />} title="Nenhuma natureza no recorte" />
      ) : (
        <div className="table-scroll">
          <table className="w-full text-left">
            <thead className="bg-subtle">
              <tr>
                {[
                  ['Natureza', 'min-w-[13rem]'],
                  ['Matéria', 'w-36'],
                  ['Docs', 'w-20 text-right'],
                  ['Participação', 'w-40'],
                  ['Temas dominantes', 'w-64'],
                  ['Período', 'w-40'],
                  ['Evolução', 'w-28'],
                ].map(([rotulo, cls]) => (
                  <th
                    key={rotulo}
                    className={cn(
                      'border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-muted',
                      cls,
                    )}
                  >
                    {rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {naturezas.map((natureza) => (
                <tr
                  key={natureza.natureza}
                  onClick={() => abrir({ natureza: [natureza.natureza] })}
                  className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-subtle"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-7 w-1 shrink-0 rounded-full"
                        style={{
                          background: `hsl(var(--data-${indiceCor(natureza.macrogrupo) + 1}))`,
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {natureza.natureza}
                        </span>
                        <span className="block text-2xs text-ink-faint">
                          {num(natureza.destinatarios)} destinatário(s)
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {natureza.macrogrupo ? (
                      <Badge
                        variant={natureza.macrogrupo === 'Não classificado' ? 'outline' : 'neutral'}
                      >
                        <span
                          aria-hidden
                          className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
                          style={{
                            background: `hsl(var(--data-${indiceCor(natureza.macrogrupo) + 1}))`,
                          }}
                        />
                        {natureza.macrogrupo}
                      </Badge>
                    ) : (
                      <span className="text-2xs text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-base font-semibold text-ink">
                    {num(natureza.documentos)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${natureza.participacao}%`,
                            background: `hsl(var(--data-${indiceCor(natureza.macrogrupo) + 1}))`,
                          }}
                        />
                      </span>
                      <span className="tabular w-11 text-right text-2xs font-semibold text-ink-muted">
                        {pct(natureza.participacao)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {natureza.temas.length === 0 ? (
                        <span className="text-2xs text-ink-faint">—</span>
                      ) : (
                        natureza.temas.map((tema) => (
                          <Badge key={tema.chave} variant="neutral">
                            {tema.chave}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="tabular block text-2xs text-ink-muted">
                      {date(natureza.primeiro)} → {date(natureza.ultimo)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {natureza.serie.length > 1 ? (
                      <MiniSeries
                        points={natureza.serie}
                        colorIndex={indiceCor(natureza.macrogrupo)}
                        height={34}
                      />
                    ) : (
                      <span className="text-2xs text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="text-2xs text-ink-faint">
          Clique em qualquer linha para abrir os documentos daquela natureza.
        </p>
        <Button variant="ghost" size="sm" onClick={() => abrir({})}>
          Acervo completo
          <ArrowUpRight className="size-3.5" />
        </Button>
      </div>
    </Card>
  )
}
