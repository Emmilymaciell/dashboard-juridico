/**
 * Rodovias & Contratos — uma rodovia por vez.
 *
 * Antes: quatro cartões simultâneos numa grade 2x2. A mesma estrutura repetida
 * quatro vezes, cada uma em metade da largura, e a leitura virava comparação
 * mesmo quando a pergunta era sobre uma obra só.
 *
 * Agora: uma régua de abas e UM painel do tamanho da página. Trocar de aba
 * troca o conteúdo do painel — não navega, não recarrega, não empilha.
 *
 * A DECISÃO ESTRUTURAL desta tela, e a única que precisa ser entendida antes de
 * mexer aqui: **a aba não tem estado próprio, ela É o filtro `rodovia` da URL**.
 * Por isso não existe como a aba e o filtro global discordarem — não há segundo
 * lugar onde a seleção possa morar. A consequência é que a consulta desta
 * página ignora a dimensão rodovia: se não ignorasse, escolher uma aba apagaria
 * as outras da própria régua. Ver `rodovias.ts`.
 */

import { ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { PainelDaRodovia } from '@/features/roads/PainelDaRodovia'
import { RodoviaTabs } from '@/features/roads/RodoviaTabs'
import {
  filtrosDaConsulta,
  ordemDasAbas,
  rodoviaAtiva,
  selecaoDaAba,
} from '@/features/roads/rodovias'
import { ApiError } from '@/lib/api'
import { drillToSearch, useFilters } from '@/lib/filters'
import { useRoadsDetail } from '@/lib/queries'
import { ActiveFilterNote } from '@/ui/filters'
import { KpiTile } from '@/ui/kpi'
import { Reveal, RevealItem, RevealList } from '@/ui/motion'
import { Button, Card, EmptyState, ErrorState, Skeleton } from '@/ui/primitives'

export function RoadsPage() {
  const { filters, setMany } = useFilters()
  const navigate = useNavigate()

  // A consulta não leva `rodovia`: nesta página essa dimensão seleciona, não
  // recorta. Período, natureza, destinatário e contrato seguem recortando.
  const consulta = React.useMemo(() => filtrosDaConsulta(filters), [filters])
  const { data, isPending, isError, error, refetch } = useRoadsDetail(consulta)

  const abrir = (drill: Record<string, unknown>) =>
    navigate(`/documentos${drillToSearch({ ...filters, ...drill })}`)

  const payload = data?.data
  const todas = payload?.rodovias ?? []
  const contratadas = todas.filter((r) => r.contrato)
  const emContratacao = todas.filter((r) => !r.contrato)
  const totalSancoes = todas.reduce((a, r) => a + r.sancionatorios, 0)

  // A régua é alfabética e não se mexe; o padrão de abertura é a obra de maior
  // volume, que é a que quase sempre se quer ver primeiro.
  const abas = ordemDasAbas(contratadas)
  const maisVolumosa = contratadas[0]?.rodovia ?? null
  const ativa = rodoviaAtiva(
    abas.map((r) => r.rodovia),
    filters.rodovia,
    maisVolumosa,
  )
  const rodovia = contratadas.find((r) => r.rodovia === ativa) ?? null

  if (isError) {
    return (
      <div className="space-y-6">
        <Cabecalho />
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Erro ao carregar rodovias.'}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <Cabecalho />

      {/* Indicadores do PROGRAMA. Continuam gerais mesmo com uma aba escolhida,
          porque a aba não recorta os dados desta página — ela escolhe qual
          rodovia o painel detalha. */}
      <RevealList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" step={0.042}>
        <RevealItem>
          <KpiTile
            label="Contratos de obra"
            value={contratadas.length || null}
            tone="destaque"
            hint="mapa contrato → rodovia → executora confirmado"
          />
        </RevealItem>
        <RevealItem>
          <KpiTile
            label="Documentos vinculados a rodovia"
            value={todas.reduce((a, r) => a + r.documentos, 0) || null}
            hint="em todas as rodovias do programa"
          />
        </RevealItem>
        <RevealItem>
          <KpiTile
            label="Matéria sancionatória nas obras"
            value={totalSancoes || null}
            tone={totalSancoes > 0 ? 'atencao' : 'neutro'}
            hint="advertências, notificações e sanções vinculadas às rodovias"
            onClick={() => abrir({ macrogrupo: ['Sancionatório'] })}
            badge={<ShieldAlert className="size-4 text-warning" />}
          />
        </RevealItem>
        <RevealItem>
          <KpiTile
            label="Rodovias em contratação"
            value={emContratacao.length || null}
            hint="aparecem em editais, minutas e declarações"
          />
        </RevealItem>
      </RevealList>

      {/* ------------------------------------------------- régua + painel */}
      <Reveal delay={0.066}>
        <div className="space-y-5">
          {isPending ? (
            <>
              <Skeleton className="h-11 w-full max-w-lg" />
              <Skeleton className="h-[560px] w-full" />
            </>
          ) : contratadas.length === 0 ? (
            <Card>
              <EmptyState
                title="Nenhuma rodovia contratada no recorte"
                description="Remova filtros para ver o programa completo."
              />
            </Card>
          ) : (
            <>
              <RodoviaTabs
                rodovias={abas.map((r) => ({
                  rodovia: r.rodovia,
                  documentos: r.documentos,
                }))}
                ativa={ativa}
                onSelecionar={(nome) => setMany(selecaoDaAba(nome))}
              />
              {rodovia ? (
                <PainelDaRodovia rodovia={rodovia} onAbrirDocumentos={abrir} />
              ) : null}
            </>
          )}
        </div>
      </Reveal>
    </div>
  )
}

/**
 * Sem título: o cabeçalho do shell já escreve "Rodovias & Contratos" uma dobra
 * acima, e agora em corpo grande. Fica só a frase que diz do que a página
 * trata, que o título sozinho não diz.
 */
function Cabecalho() {
  return (
    <Reveal>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
          A atuação jurídica organizada pela cadeia do programa: contrato de obra, rodovia
          e empresa executora.
        </p>
        <ActiveFilterNote />
      </div>
    </Reveal>
  )
}
