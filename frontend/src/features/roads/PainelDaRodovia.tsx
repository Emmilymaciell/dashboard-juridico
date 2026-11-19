/**
 * O painel de UMA rodovia. Um componente, quatro rodovias — e quantas mais o
 * programa tiver.
 *
 * Antes eram quatro cartões lado a lado numa grade 2x2: a mesma estrutura
 * repetida quatro vezes, cada uma em metade da largura e com o conteúdo
 * comprimido. Agora é uma ficha só, do tamanho da página, e a régua de abas
 * troca o conteúdo dela.
 *
 * Nada aqui é escrito por rodovia. Tudo vem de `RodoviaDetalhe`.
 */

import { ArrowRight, Building2, CalendarRange, FileText, Route, ShieldAlert, Users } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { acentoDaRodovia } from '@/features/roads/rodovias'
import type { RodoviaDetalhe } from '@/lib/api'
import { date, monthLabel, num, truncate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge, Card, EmptyState } from '@/ui/primitives'

export function PainelDaRodovia({
  rodovia,
  onAbrirDocumentos,
}: {
  rodovia: RodoviaDetalhe
  onAbrirDocumentos: (drill: Record<string, unknown>) => void
}) {
  const cor = acentoDaRodovia(rodovia.rodovia)
  const nome = rodovia.rodovia

  return (
    <Card
      id="painel-da-rodovia"
      role="tabpanel"
      aria-labelledby={`aba-${nome}`}
      tabIndex={-1}
      /**
       * `key` na rodovia: trocar de aba remonta o painel, e a animação de
       * entrada roda de novo. É o "trocar de ficha" que a troca precisa
       * parecer — sem isso os números mudariam no lugar, sem gesto nenhum.
       *
       * A animação é CSS com estado de repouso VISÍVEL (`reveal-in`): se não
       * rodar, o painel aparece inteiro em vez de ficar preso invisível.
       */
      key={nome}
      className="reveal-in flex w-full flex-col overflow-hidden"
    >
      {/* ------------------------------------------------------------ header */}
      <header
        className="relative flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-6"
        style={{ background: `linear-gradient(100deg, ${acentoDaRodovia(nome, 0.13)}, transparent 62%)` }}
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: cor }} />

        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-2xl border"
          style={{ borderColor: acentoDaRodovia(nome, 0.3), background: acentoDaRodovia(nome, 0.1), color: cor }}
        >
          <Route className="size-7" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-4xl font-semibold leading-none tracking-tight text-ink">
              {nome}
            </h2>
            {rodovia.contrato ? (
              <Badge variant="positive">Contrato {rodovia.contrato}</Badge>
            ) : (
              <Badge variant="outline">em contratação</Badge>
            )}
          </div>
          {rodovia.executora ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm uppercase tracking-wide text-ink-muted">
              <Building2 className="size-4 shrink-0" />
              <span className="truncate font-medium">{rodovia.executora}</span>
            </p>
          ) : null}
        </div>

        {/* A contagem é a composição editorial do header, não um quinto KPI. */}
        <div className="shrink-0 text-right">
          <p className="tabular text-6xl font-semibold leading-none tracking-tight text-ink">
            {num(rodovia.documentos)}
          </p>
          <p className="mt-1.5 text-2xs uppercase tracking-[0.18em] text-ink-faint">documentos</p>
        </div>
      </header>

      {/* --------------------------------------------------- faixa de apoio */}
      <div className="grid gap-4 border-y border-line bg-subtle/25 px-6 py-4 sm:grid-cols-3">
        <Indicador
          icone={ShieldAlert}
          rotulo="Sancionatórios"
          tom={rodovia.sancionatorios > 0 ? 'atencao' : 'neutro'}
          onClick={() => onAbrirDocumentos({ rodovia: [nome], macrogrupo: ['Sancionatório'] })}
        >
          <span className="tabular text-3xl font-semibold leading-none text-warning">
            {num(rodovia.sancionatorios)}
          </span>
        </Indicador>

        <Indicador icone={Users} rotulo="Endereçados">
          <span className="tabular text-3xl font-semibold leading-none text-ink">
            {num(rodovia.documentos_confianca_alta)}
          </span>
          <span className="mt-1 block text-2xs text-ink-faint">direto à executora</span>
        </Indicador>

        <Indicador icone={CalendarRange} rotulo="Período">
          <span className="tabular text-base font-medium leading-tight text-ink">
            {date(rodovia.primeiro)} <span className="text-ink-faint">→</span> {date(rodovia.ultimo)}
          </span>
        </Indicador>
      </div>

      {/* ------------------------------------------- naturezas + evolução */}
      <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)]">
        <section>
          <h3 className="label-caps mb-3">Naturezas predominantes</h3>
          {rodovia.naturezas.length === 0 ? (
            <p className="text-xs text-ink-faint">Nenhuma natureza neste recorte.</p>
          ) : (
            <BarrasDeNatureza
              itens={rodovia.naturezas.slice(0, 4)}
              cor={cor}
              onSelect={(natureza) => onAbrirDocumentos({ rodovia: [nome], natureza: [natureza] })}
            />
          )}
        </section>

        <section className="min-w-0">
          <h3 className="label-caps mb-3">Evolução mensal</h3>
          {rodovia.serie.length === 0 ? (
            <p className="text-xs text-ink-faint">Nenhum documento no período.</p>
          ) : (
            <ColunasMensais serie={rodovia.serie} cor={cor} corSuave={acentoDaRodovia(nome, 0.5)} />
          )}
        </section>
      </div>

      {/* --------------------------------------------------- atividade */}
      <section className="border-t border-line">
        <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-4">
          <h3 className="label-caps">Atividade recente</h3>
          {rodovia.recentes.length > 3 ? (
            <button
              type="button"
              onClick={() => onAbrirDocumentos({ rodovia: [nome] })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
            >
              Ver todas
              <ArrowRight className="size-3.5" />
            </button>
          ) : null}
        </div>
        {rodovia.recentes.length === 0 ? (
          <div className="px-6 pb-5">
            <EmptyState title="Nenhuma atividade neste recorte" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rodovia.recentes.slice(0, 3).map((doc) => (
              <li key={doc.documento_id}>
                <Link
                  to={`/documentos?doc=${doc.documento_id}`}
                  className="group flex items-center gap-4 px-6 py-3 transition-colors hover:bg-subtle/60"
                >
                  <span className="tabular w-[5.5rem] shrink-0 text-xs text-ink-faint">
                    {date(doc.data_documento)}
                  </span>
                  <FileText className="size-4 shrink-0 text-ink-faint" style={{ color: cor }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:text-accent-ink">
                    {truncate(doc.assunto, 78)}
                  </span>
                  {doc.natureza ? <Badge variant="neutral">{doc.natureza}</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------------- CTA */}
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => onAbrirDocumentos({ rodovia: [nome] })}
          className="group flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors"
          style={{ borderColor: acentoDaRodovia(nome, 0.28), background: acentoDaRodovia(nome, 0.07) }}
        >
          <FileText className="size-5 shrink-0" style={{ color: cor }} />
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
            Ver os {num(rodovia.documentos)} documentos da {nome}
          </span>
          <ArrowRight
            className="size-4 shrink-0 transition-transform group-hover:translate-x-1"
            style={{ color: cor }}
          />
        </button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------- indicador */

function Indicador({
  icone: Icone,
  rotulo,
  tom = 'neutro',
  onClick,
  children,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  tom?: 'neutro' | 'atencao'
  onClick?: () => void
  children: React.ReactNode
}) {
  const corpo = (
    <>
      <div className="flex items-center gap-2">
        <Icone className={cn('size-4 shrink-0', tom === 'atencao' ? 'text-warning' : 'text-ink-faint')} />
        <span className="label-caps">{rotulo}</span>
      </div>
      <div className="mt-2">{children}</div>
    </>
  )
  const classes = 'rounded-lg px-3 py-2 text-left transition-colors'
  if (!onClick) return <div className={classes}>{corpo}</div>
  return (
    <button type="button" onClick={onClick} className={cn(classes, 'hover:bg-subtle')}>
      {corpo}
    </button>
  )
}

/* -------------------------------------------------------------- naturezas */

function BarrasDeNatureza({
  itens,
  cor,
  onSelect,
}: {
  itens: Array<{ chave: string; documentos: number }>
  cor: string
  onSelect: (chave: string) => void
}) {
  const maior = Math.max(1, ...itens.map((i) => i.documentos))
  return (
    <ul className="space-y-2.5">
      {itens.map((item) => (
        <li key={item.chave}>
          <button
            type="button"
            onClick={() => onSelect(item.chave)}
            className="group flex w-full items-center gap-3 text-left"
          >
            <span className="w-[9rem] shrink-0 truncate text-sm text-ink group-hover:text-accent-ink">
              {item.chave}
            </span>
            <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-subtle">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-swift"
                style={{ width: `${(item.documentos / maior) * 100}%`, background: cor }}
              />
            </span>
            <span className="tabular w-7 shrink-0 text-right text-sm font-semibold text-ink">
              {num(item.documentos)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------------------------------------- evolução */

/**
 * Colunas finas por mês. Em DOM, não em ECharts: são doze barras e um rótulo,
 * e uma instância de gráfico por troca de aba custaria mais do que entrega.
 */
function ColunasMensais({
  serie,
  cor,
  corSuave,
}: {
  serie: Array<{ periodo: string; documentos: number }>
  cor: string
  /**
   * A mesma cor com alfa, recebida pronta.
   *
   * Derivá-la aqui por string seria quebrar: o acento chega como
   * `hsl(var(--data-1))`, e injetar alfa antes do parêntese errado produz
   * `hsl(var(--data-1 / 0.5))`, que o navegador descarta em silêncio.
   */
  corSuave: string
}) {
  const maior = Math.max(1, ...serie.map((p) => p.documentos))
  return (
    <div className="flex h-[132px] items-end gap-1.5">
      {serie.map((ponto) => {
        const altura = (ponto.documentos / maior) * 100
        return (
          <div
            key={ponto.periodo}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
            title={`${monthLabel(ponto.periodo)}: ${ponto.documentos} documento(s)`}
          >
            <span className="relative flex h-[104px] w-full items-end justify-center">
              <span
                className="w-full max-w-[22px] rounded-t-[3px] transition-[height,filter] duration-300 ease-swift group-hover:brightness-125"
                style={{
                  // Piso de 3%: mês com um documento precisa existir na tela.
                  height: `${Math.max(3, altura)}%`,
                  background: `linear-gradient(180deg, ${cor}, ${corSuave})`,
                }}
              />
            </span>
            <span className="w-full truncate text-center text-[9.5px] uppercase text-ink-faint">
              {monthLabel(ponto.periodo).slice(0, 3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
