/**
 * Visão Geral. Bateu o olho, entendeu o geral.
 *
 * Esta é agora a ÚNICA aba de panorama: o Portfólio Jurídico e os Destinatários
 * deixaram de ser páginas próprias e todo o conteúdo dos dois vive aqui, em
 * blocos (`blocos/portfolio.tsx` e `blocos/destinatarios.tsx`). As rotas antigas
 * continuam respondendo e redirecionam para cá.
 *
 * A ordem de leitura é: quanto existe -> em que situação está -> quando foi
 * produzido -> sobre o quê -> para quem -> o que aconteceu por último.
 *
 * O que saiu nesta rodada, a pedido da usuária: a legenda cinza dos KPIs (só a
 * de "Produção em 2026" ficou), a faixa de mini-KPIs por ano em cima do gráfico,
 * a lista de níveis de "Necessidade de resposta" — que virou uma rosca —, a
 * composição do acervo em treemap e a concentração temática, que repetiam o que
 * a tabela de naturezas e os temas do portfólio já dizem com mais detalhe.
 *
 * Todo elemento navega: RESUMO -> EXPLORAÇÃO -> EVIDÊNCIA DOCUMENTAL.
 */

import { ArrowRight, ArrowUpRight, FileText, Users } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ProductionChart } from '@/charts/charts'
import {
  BlocoMateriaJuridica,
  BlocoNaturezas,
  BlocoTemas,
} from '@/features/overview/blocos/portfolio'
import {
  IndicadorAcervo,
  IndicadorNaturezas,
  IndicadorProducao,
  IndicadorSancionatorio,
} from '@/features/overview/blocos/indicadores'
import {
  BlocoDestinatarios,
  BlocoNaturezasEmDetalhe,
} from '@/features/overview/blocos/relacoes'
import { BlocoPartesEmDetalhe } from '@/features/overview/blocos/destinatarios'
import { useCruzamento } from '@/features/overview/cruzamento'
import { ApiError, type DocumentoResumo } from '@/lib/api'
import { date, truncate } from '@/lib/format'
import { drillToSearch, useFilters } from '@/lib/filters'
import { useOverview } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@/ui/primitives'
import { VideoDeAmbiente } from '@/ui/ambiente'
import { Gaveta } from '@/ui/gaveta'
import { SectionTitle } from '@/ui/kpi'
import { Reveal, RevealItem, RevealList } from '@/ui/motion'

export function OverviewPage() {
  const { filters, clear, activeCount } = useFilters()
  const { aplicar } = useCruzamento()
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch } = useOverview(filters)

  const [anoSelecionado, setAnoSelecionado] = React.useState<string>('todos')
  // As tabelas grandes saem da página e passam a morar em gaveta. Nada foi
  // apagado: é a mesma tabela, com os mesmos filtros, a um clique.
  const [gaveta, setGaveta] = React.useState<'naturezas' | 'partes' | null>(null)

  const abrirDocumentos = React.useCallback(
    (drill?: Record<string, unknown>) => {
      navigate(`/documentos${drillToSearch({ ...filters, ...(drill ?? {}) })}`)
    },
    [filters, navigate],
  )

  if (isError) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <div className="space-y-6">
        <ErrorState
          title="Não foi possível carregar a visão geral"
          message={apiError?.message ?? 'Erro inesperado ao consultar a API.'}
          hint={apiError?.acao}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    )
  }

  const payload = data?.data
  const anos = payload?.anos ?? []
  const serie = payload?.serie_mensal ?? []

  const serieFiltrada =
    anoSelecionado === 'todos'
      ? serie
      : serie.filter((p) => p.periodo.startsWith(anoSelecionado))

  // Anos com participação residual (< 2%) são documentos isolados — 2022 e 2024
  // têm 1 documento cada. Continuam no total e no gráfico, mas poluiriam o
  // seletor, então ficam fora dele.
  const anosRelevantes = anos.filter((a) => a.participacao >= 2)

  return (
    /**
     * `com-ambiente` torna os cartões levemente translúcidos e desfoca o que
     * passa atrás deles. Sem isso o vídeo só apareceria nas frestas entre
     * cartões e a página continuaria lendo como fundo liso.
     */
    <div className="relative">
      <VideoDeAmbiente />

      <div className="com-ambiente relative z-10 space-y-7">
      {/* SEM cabeçalho de página: o cabeçalho do shell já escreve "Visão Geral"
          uma dobra acima. */}

      {/* ============================================== LINHA 1 — indicadores
          Quatro perguntas diferentes em quatro formas diferentes: contagem,
          repartição por tipo, parte do ano no todo, parte que pede atenção.
          Cada um filtra a página inteira ao ser clicado. */}
      {/*
        A largura de cada coluna acompanha a QUANTIDADE DE CONTEUDO, nao uma
        divisao igual: o anel de naturezas carrega grafico mais legenda com seis
        linhas e precisa da maior fatia; producao e materia sancionatoria tem a
        mesma estrutura — numero, participacao, barra — e ficam com colunas
        iguais, para lerem como par.

        O `minmax` existe para 1366: sem piso, a coluna dos dois compactos
        encolhia ate o titulo "Materia sancionatoria" truncar.
      */}
      <RevealList
        className="grid gap-4 sm:grid-cols-2
                   xl:grid-cols-[minmax(220px,1.05fr)_minmax(320px,1.5fr)_minmax(224px,0.82fr)_minmax(224px,0.82fr)]"
        step={0.049}
      >
        <RevealItem>
          <IndicadorAcervo />
        </RevealItem>
        <RevealItem>
          <IndicadorNaturezas />
        </RevealItem>
        <RevealItem>
          <IndicadorProducao />
        </RevealItem>
        <RevealItem>
          <IndicadorSancionatorio />
        </RevealItem>
      </RevealList>

      {/* ================================================ LINHA 2 — composição
          O que o acervo É e sobre o que ele FALA, em metade da faixa cada um.
          Eram três colunas com a produção mensal junto; a série no tempo tinha
          vinte colunas espremidas num terço e as duas composições ficavam
          pequenas demais para o que mostram. */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Reveal delay={0.066}>
          <BlocoMateriaJuridica altura={352} />
        </Reveal>
        <Reveal delay={0.077}>
          <BlocoTemas altura={352} />
        </Reveal>
      </div>

      {/* ============================================= LINHA 3 — produção mensal
          Sozinha na faixa: com vinte meses no eixo, largura é legibilidade. */}
      <Reveal delay={0.088}>
        <Card className="flex h-full flex-col overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink">
                Produção jurídica por mês
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                eixo pela <b>data do documento</b>; a faixa em âmbar é a matéria
                sancionatória do mês, e a linha é o total
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-subtle p-0.5">
              {['todos', ...anosRelevantes.map((a) => String(a.ano))].map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setAnoSelecionado(opcao)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-2xs font-semibold transition-all duration-200',
                    anoSelecionado === opcao
                      ? 'bg-surface text-ink shadow-card'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {opcao === 'todos' ? 'Todos' : opcao}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 px-2 pb-2 pt-3">
            {isPending ? (
              <div className="flex h-[240px] items-end gap-2 px-3">
                {[38, 62, 45, 88, 70, 95, 52, 80, 44, 66, 30, 58].map((h, i) => (
                  <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : serieFiltrada.length === 0 ? (
              <EmptyState
                title="Nenhum documento neste recorte"
                description="Ajuste o período ou remova filtros para ver a série completa."
                action={
                  activeCount > 0 ? (
                    <Button variant="secondary" size="sm" onClick={clear}>
                      Limpar filtros
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ProductionChart
                points={serieFiltrada}
                height={330}
                highlightSanctions
                onSelectPeriod={(periodo) => aplicar('mes', periodo)}
              />
            )}
          </div>
        </Card>
      </Reveal>

      {/* ========================== LINHA 4 — para quem, e o último acontecido
          O destinatário fica com dois terços para o anel ter tamanho; a
          atividade recente segue com um terço. */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Reveal delay={0.143}>
          <BlocoDestinatarios altura={430} />
        </Reveal>
        <Reveal delay={0.154}>
          <FeedAtividade
            documentos={payload?.recentes ?? []}
            loading={isPending}
            onVerTodos={() => abrirDocumentos()}
            onVerPartes={() => setGaveta('partes')}
          />
        </Reveal>
      </div>

      {/* ================================================ LINHA 5 — naturezas */}
      <Reveal delay={0.176}>
        <BlocoNaturezasEmDetalhe
          acoes={
            <Button variant="ghost" size="sm" onClick={() => setGaveta('naturezas')}>
              Ver detalhamento
              <ArrowUpRight className="size-3.5" />
            </Button>
          }
        />
      </Reveal>

      <Gaveta
        aberta={gaveta === 'naturezas'}
        onFechar={() => setGaveta(null)}
        titulo="Cada natureza em detalhe"
        descricao="volume, participação, período coberto, temas dominantes e evolução — no recorte atual"
      >
        <BlocoNaturezas />
      </Gaveta>

      <Gaveta
        aberta={gaveta === 'partes'}
        onFechar={() => setGaveta(null)}
        titulo="Cada parte em detalhe"
        descricao="as naturezas e os temas que compõem a interlocução — no recorte atual"
        largura="max-w-3xl"
      >
        <BlocoPartesEmDetalhe />
      </Gaveta>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ feed de atividade */

/** Feed editorial, não tabela. Data à esquerda, assunto em destaque, tags abaixo. */
function FeedAtividade({
  documentos,
  loading,
  onVerTodos,
  onVerPartes,
}: {
  documentos: DocumentoResumo[]
  loading: boolean
  onVerTodos: () => void
  onVerPartes?: () => void
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <SectionTitle
        title="Atividade recente"
        subtitle="últimos documentos pela data do documento"
        actions={
          <div className="flex items-center gap-1">
            {onVerPartes ? (
              <Button variant="ghost" size="sm" onClick={onVerPartes} title="Cada parte em detalhe">
                <Users className="size-3.5" />
                partes
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onVerTodos}>
              ver todos
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        }
      />
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : documentos.length === 0 ? (
        <EmptyState icon={<FileText className="size-7" />} title="Nenhum documento no recorte" />
      ) : (
        <ol className="flex-1 divide-y divide-line">
          {documentos.map((doc) => (
            <li key={doc.documento_id}>
              <Link
                to={`/documentos?doc=${doc.documento_id}`}
                className="group flex gap-3 px-4 py-3 transition-colors hover:bg-subtle"
              >
                {/* Em um terço da largura o trilho de data vira coluna estreita
                    e o assunto quebra em duas linhas, em vez de truncar cedo. */}
                <span className="relative flex w-[3.75rem] shrink-0 flex-col items-start">
                  <span className="tabular text-2xs font-semibold text-ink">
                    {date(doc.data_documento, doc.data_documento_precisao)}
                  </span>
                  <span className="mt-1 h-full w-px bg-line group-hover:bg-accent/40" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-ink group-hover:text-accent-ink">
                      {truncate(doc.assunto, 58)}
                    </span>
                    {!doc.ativo ? <Badge variant="danger">excluído</Badge> : null}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {doc.natureza ? <Badge variant="neutral">{doc.natureza}</Badge> : null}
                    {doc.rodovia_principal ? (
                      <span className="font-mono text-2xs font-semibold text-accent">
                        {doc.rodovia_principal}
                      </span>
                    ) : null}
                  </span>
                </span>

                <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
