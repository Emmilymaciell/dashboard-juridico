/**
 * Para quem o Escritório Jurídico escreve, e o que ela escreve.
 *
 * O Sankey de fluxo do acervo, que morava aqui, saiu a pedido da usuária; a
 * dispersão de naturezas virou barra + ponto, em `charts/naturezas.tsx`.
 */

import * as React from 'react'

import { BarrasDeNatureza } from '@/charts/naturezas'
import { BarrasRadiais } from '@/charts/relacoes'
import { useCruzamento } from '@/features/overview/cruzamento'
import { useFilters } from '@/lib/filters'
import { useOverview, usePortfolio } from '@/lib/queries'
import { SectionTitle } from '@/ui/kpi'
import { Card, EmptyState, Skeleton } from '@/ui/primitives'

/* --------------------------------------------------------- destinatários */

export function BlocoDestinatarios({ altura = 330 }: { altura?: number } = {}) {
  const { filters } = useFilters()
  const { data, isPending } = useOverview(filters)
  const { aplicar, ativo, dimensaoAtiva } = useCruzamento()

  const destinatarios = data?.data.destinatarios ?? []

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <SectionTitle
        title="Para quem o Escritório Jurídico escreve"
        subtitle="documentos por destinatário"
      />
      <div className="flex-1 p-2">
        {isPending ? (
          <Skeleton className="h-[320px] w-full" />
        ) : destinatarios.length === 0 ? (
          <EmptyState title="Nenhum destinatário neste recorte" />
        ) : (
          <BarrasRadiais
            itens={destinatarios}
            altura={altura}
            ativa={(chave) => ativo('destinatario', chave)}
            haSelecao={dimensaoAtiva('destinatario')}
            onSelect={(chave) => aplicar('destinatario', chave)}
          />
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------- dispersão */

export function BlocoNaturezasEmDetalhe({ acoes }: { acoes?: React.ReactNode }) {
  const { filters } = useFilters()
  const { data, isPending } = usePortfolio(filters)
  const { aplicar, ativo, dimensaoAtiva } = useCruzamento()

  const linhas = React.useMemo(
    () =>
      (data?.data.naturezas ?? []).map((n) => ({
        natureza: n.natureza,
        documentos: n.documentos,
        participacao: n.participacao,
        destinatarios: n.destinatarios,
        materia: n.macrogrupo,
      })),
    [data],
  )

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Sem subtítulo e sem "o que é isto?": o cabeçalho das colunas e a
          legenda do gráfico já nomeiam as três métricas, e o tooltip de cada
          linha dá a definição de alcance onde ela é lida. */}
      <SectionTitle title="Naturezas em detalhe" actions={acoes} />
      <div className="flex-1 px-4 py-3.5">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : linhas.length === 0 ? (
          <EmptyState title="Nenhuma natureza neste recorte" />
        ) : (
          <BarrasDeNatureza
            linhas={linhas}
            ativa={(chave) => ativo('natureza', chave)}
            haSelecao={dimensaoAtiva('natureza')}
            onSelect={(chave) => aplicar('natureza', chave)}
          />
        )}
      </div>
    </Card>
  )
}
