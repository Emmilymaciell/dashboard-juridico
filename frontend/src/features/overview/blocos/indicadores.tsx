/**
 * Primeira dobra da Visão Geral: quatro indicadores que respondem perguntas
 * diferentes, e não quatro números iguais em quatro caixas iguais.
 *
 *   quanto existe          -> contagem + forma da série
 *   de quantos tipos       -> anel de naturezas
 *   quanto saiu no ano     -> parte dentro do todo
 *   quanto pede atenção    -> parte dentro do todo, em âmbar
 *
 * Os dois últimos usam BARRA DE PARTE em vez de número solto porque "147" e
 * "75" não significam nada sem o todo do recorte — e o todo muda a cada filtro.
 *
 * Nenhum deles inventa variação contra período anterior. A comparação exigiria
 * um período anterior comparável, e o acervo não tem histórico estável para
 * isso: a fonte é viva e cresceu 215 → 291 documentos numa única tarde. Um
 * "+12%" ali seria decoração com cara de fato.
 */

import { FileText, Layers, ShieldAlert, TrendingUp } from 'lucide-react'
import * as React from 'react'

import { BarraDeParte, RadialCategorias } from '@/charts/painel'
import { Sparkline } from '@/charts/charts'
import { useCruzamento } from '@/features/overview/cruzamento'
import { num } from '@/lib/format'
import { useFilters } from '@/lib/filters'
import { useOverview, usePortfolio } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { CountUp } from '@/ui/motion'
import { Card, Skeleton, Tooltip } from '@/ui/primitives'

/* ------------------------------------------------------------- moldura */

/**
 * Moldura comum dos quatro. O ícone em selo à esquerda do rótulo é o que dá
 * identidade ao cartão sem precisar de borda colorida em volta.
 */
function Cartao({
  rotulo,
  icone: Icone,
  tom = 'neutro',
  onClick,
  titulo,
  children,
}: {
  rotulo: string
  icone: React.ComponentType<{ className?: string }>
  tom?: 'neutro' | 'destaque' | 'atencao'
  onClick?: () => void
  titulo?: string
  children: React.ReactNode
}) {
  const corpo = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-xl border',
            tom === 'atencao'
              ? 'border-warning/25 bg-warning/10 text-warning'
              : tom === 'destaque'
                ? 'border-accent/25 bg-accent/10 text-accent'
                : 'border-line bg-subtle text-ink-muted',
          )}
        >
          <Icone className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{rotulo}</span>
      </div>
      {children}
    </>
  )

  /**
   * `w-full` NAO e decoracao, e o conserto de um buraco de 195 px na faixa.
   *
   * Quando o cartao tem clique ele vira `<button>`, e controle de formulario
   * dimensiona por `fit-content` mesmo com `display: flex` — `w-full` e o unico
   * jeito de ele ocupar a coluna. Os dois cartoes SEM clique sao `<div>`, que e
   * bloco e preenche sozinho: por isso o defeito aparecia so em dois dos quatro,
   * e parecia espacamento errado do grid quando era dimensionamento do filho.
   */
  const classes = cn(
    'card flex h-full w-full flex-col p-4',
    onClick && 'card-hover cursor-pointer text-left',
  )
  if (!onClick) return <div className={classes}>{corpo}</div>
  return (
    <button type="button" onClick={onClick} className={classes} title={titulo}>
      {corpo}
    </button>
  )
}

/**
 * O número e a sobra de altura.
 *
 * Os quatro cartões têm a altura do mais alto — o do anel de naturezas, que
 * carrega gráfico e legenda. Antes o número ficava colado no topo e a barra
 * colada na base, e a sobra virava um buraco no meio de três dos quatro. Agora
 * o número mora numa faixa `flex-1` e se centraliza nela: a folga se divide em
 * cima e embaixo dele, em vez de se acumular num lugar só.
 */
function Numero({ valor, tom = 'ink' }: { valor: number | null; tom?: 'ink' | 'warning' }) {
  return (
    <p
      className={cn(
        'tabular text-[3.5rem] font-semibold leading-none tracking-tight',
        tom === 'warning' ? 'text-warning' : 'text-ink',
      )}
    >
      {valor === null ? '—' : <CountUp value={valor} format={num} />}
    </p>
  )
}

/** Faixa elástica onde o número fica centrado verticalmente. */
function Corpo({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center pt-2">{children}</div>
}

/* ----------------------------------------------------- 1. acervo no recorte */

export function IndicadorAcervo() {
  const { filters, clear, activeCount } = useFilters()
  const { data, isPending } = useOverview(filters)

  const payload = data?.data
  const total = payload?.kpis.find((k) => k.chave === 'documentos_indexados')?.valor ?? null
  const serie = payload?.serie_mensal ?? []

  if (isPending) return <Esqueleto />

  return (
    <Cartao
      rotulo="Documentos no acervo"
      icone={FileText}
      tom="destaque"
      onClick={activeCount > 0 ? clear : undefined}
      titulo={activeCount > 0 ? 'Voltar ao acervo completo' : undefined}
    >
      <Corpo>
        <Numero valor={total} />
      </Corpo>
      {serie.length > 3 ? (
        // A silhueta da série ganha altura em vez de ficar um fio no rodapé:
        // é conteúdo real ocupando a sobra, não enchimento.
        <div className="-mx-1 mt-auto pt-3">
          <Sparkline points={serie.map((p) => p.documentos)} height={76} />
        </div>
      ) : null}
      {activeCount > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-2xs text-accent">
          <TrendingUp className="size-3" />
          no recorte atual · clique para ver tudo
        </p>
      ) : null}
    </Cartao>
  )
}

/* -------------------------------------------------------- 2. naturezas */

export function IndicadorNaturezas() {
  const { filters } = useFilters()
  const { data: overview, isPending } = useOverview(filters)
  const { data: portfolio } = usePortfolio(filters)
  const { aplicar, ativo, dimensaoAtiva } = useCruzamento()

  const quantas = overview?.data.kpis.find((k) => k.chave === 'naturezas')?.valor ?? 0
  const naturezas = portfolio?.data.naturezas ?? []

  if (isPending) return <Esqueleto />

  return (
    <Cartao rotulo="Naturezas documentais" icone={Layers}>
      <div className="mt-1 flex flex-1 items-center">
        {naturezas.length === 0 ? (
          <p className="pt-6 text-center text-xs text-ink-faint">Nenhuma natureza no recorte</p>
        ) : (
          <RadialCategorias
            itens={naturezas.map((n) => ({
              chave: n.natureza,
              documentos: n.documentos,
              materia: n.macrogrupo,
            }))}
            centroValor={quantas}
            centroRotulo={quantas === 1 ? 'natureza' : 'naturezas'}
            altura={148}
            ativa={(chave) => ativo('natureza', chave)}
            haSelecao={dimensaoAtiva('natureza')}
            onSelect={(chave) => aplicar('natureza', chave)}
          />
        )}
      </div>
    </Cartao>
  )
}

/* ---------------------------------------------------- 3. produção no ano */

export function IndicadorProducao() {
  const { filters } = useFilters()
  const { data, isPending } = useOverview(filters)
  const { aplicar } = useCruzamento()

  const payload = data?.data
  const anos = payload?.anos ?? []
  const ano = anos.length ? anos[anos.length - 1] : null
  const total = payload?.kpis.find((k) => k.chave === 'documentos_indexados')?.valor ?? 0

  if (isPending) return <Esqueleto />

  return (
    <Cartao
      rotulo={ano ? `Produção em ${ano.ano}` : 'Produção no período'}
      icone={FileText}
      onClick={ano ? () => aplicar('ano', String(ano.ano)) : undefined}
      titulo={ano ? `Filtrar a página por ${ano.ano}` : undefined}
    >
      <Corpo>
        <Numero valor={ano?.documentos ?? null} />
      </Corpo>
      {ano ? <BarraDeParte valor={ano.documentos} total={total} /> : null}
    </Cartao>
  )
}

/* ------------------------------------------------- 4. matéria sancionatória */

export function IndicadorSancionatorio() {
  const { filters } = useFilters()
  const { data, isPending } = useOverview(filters)
  const { aplicar } = useCruzamento()

  const payload = data?.data
  const sancionatorio =
    payload?.kpis.find((k) => k.chave === 'exposicao_sancionatoria')?.valor ?? null
  const total = payload?.kpis.find((k) => k.chave === 'documentos_indexados')?.valor ?? 0

  if (isPending) return <Esqueleto />

  return (
    <Cartao
      rotulo="Matéria sancionatória"
      icone={ShieldAlert}
      tom="atencao"
      onClick={() => aplicar('materia', 'Sancionatório')}
      titulo="Filtrar a página por matéria sancionatória"
    >
      <Corpo>
        <div className="flex items-baseline gap-2.5">
          <Numero valor={sancionatorio} tom="warning" />
          <Tooltip content="Advertências, notificações e sanções. É a matéria que pede acompanhamento — âmbar, não vermelho: não é erro, é assunto que não pode passar batido.">
            <span className="cursor-help text-2xs text-ink-faint underline decoration-dotted underline-offset-2">
              o que é isto?
            </span>
          </Tooltip>
        </div>
      </Corpo>
      <BarraDeParte
        valor={sancionatorio ?? 0}
        total={total}
        cor="hsl(var(--warning))"
      />
    </Cartao>
  )
}

function Esqueleto() {
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="my-auto h-14 w-32" />
      <Skeleton className="mt-auto h-10 w-full" />
    </Card>
  )
}
