/**
 * Capa executiva. Primeira tela do produto — não se entra direto em cards.
 *
 * Composição institucional Programa: fotografia de rodovia com véu petróleo, malha
 * de linhas discreta, logotipo, título, três portas de entrada e faixa de
 * indicadores reais. A referência é a capa do "Centro de Monitoramento" do
 * próprio Programa (ver docs/VISUAL_REDESIGN.md).
 *
 * Números aqui são reais, de /meta e /overview. Capa com número inventado seria
 * pior que capa sem número.
 *
 * Entradas animadas em CSS: o estado de repouso é visível, então a capa nunca
 * aparece pela metade se a animação não rodar.
 */

import { ArrowRight, FileSearch, Gauge, Route, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { BRAND_ASSETS, PRODUCT } from '@/brand/product'
import { num } from '@/lib/format'
import { useMeta, useOverview } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { CountUp } from '@/ui/motion'

/** Marca que a capa já foi vista nesta sessão, para poder pulá-la depois. */
export const COVER_SEEN_KEY = 'prog-cover-seen'

export function CoverPage() {
  const navigate = useNavigate()
  const { data: meta } = useMeta()
  const { data: overview } = useOverview({})
  const [saindo, setSaindo] = React.useState(false)

  const kpis = overview?.data.kpis ?? []
  const kpi = (chave: string) => kpis.find((k) => k.chave === chave)?.valor ?? null

  const entrar = React.useCallback(
    (to = '/painel') => {
      try {
        sessionStorage.setItem(COVER_SEEN_KEY, '1')
      } catch {
        /* sessionStorage pode estar bloqueado; a capa só não será pulada */
      }
      setSaindo(true)
      window.setTimeout(() => navigate(to), 240)
    },
    [navigate],
  )

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(alvo.tagName)) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        entrar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [entrar])

  const portas = [
    {
      to: '/painel',
      icon: Gauge,
      titulo: 'Visão Geral',
      texto: 'Panorama executivo: volume, naturezas, temas e destinatários do acervo.',
    },
    {
      to: '/rodovias',
      icon: Route,
      titulo: 'Rodovias & Contratos',
      texto: 'Atuação por rodovia, contrato e executora, com o mapa confirmado do programa.',
    },
    {
      to: '/documentos',
      icon: FileSearch,
      titulo: 'Acervo Documental',
      texto: 'Busca, filtros combinados e acesso ao documento original no repositório.',
    },
  ]

  return (
    <div
      className={cn(
        'relative flex h-screen flex-col overflow-hidden bg-brand-deep text-white',
        'transition-opacity duration-300 ease-swift',
        saindo && 'opacity-0',
      )}
    >
      {/* ---------------------------------------------------------- fundo */}
      <div className="absolute inset-0">
        <img
          src={BRAND_ASSETS.cover}
          alt=""
          aria-hidden
          className="size-full object-cover object-center opacity-45"
        />
        {/* Véu petróleo: a foto é contexto, não protagonista. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(100deg, hsl(199 92% 6% / 0.97) 0%, hsl(199 88% 9% / 0.94) 32%, hsl(194 62% 12% / 0.8) 62%, hsl(191 55% 16% / 0.62) 100%)',
          }}
        />
        <div className="brand-mesh absolute inset-0 opacity-50" />
        {/* Reforço no alto: o céu da foto é a área mais clara e competia com os
            logotipos institucionais. */}
        <div
          className="absolute inset-x-0 top-0 h-48"
          style={{ background: 'linear-gradient(to bottom, hsl(199 92% 6% / 0.72), transparent)' }}
        />
        <div
          className="absolute -left-52 top-1/4 size-[44rem] rounded-full blur-[140px]"
          style={{ background: 'hsl(187 82% 50% / 0.14)' }}
        />
      </div>

      {/* --------------------------------------------------------- marca */}
      <header className="reveal-in relative flex shrink-0 items-center justify-between gap-6 px-8 py-6 lg:px-14">
        <span className="text-lg font-semibold uppercase tracking-[0.22em] text-white/90">
          {PRODUCT.name}
        </span>
        <span className="text-2xs font-semibold uppercase tracking-[0.2em] text-white/60">
          Dados fictícios
        </span>
      </header>

      {/* ------------------------------------------------------- conteúdo */}
      <div className="relative flex min-h-0 flex-1 items-center px-8 py-4 lg:px-14">
        <div className="mx-auto grid w-full max-w-content items-center gap-10 lg:grid-cols-[1.15fr_minmax(22rem,27rem)] xl:gap-20">
          {/* título */}
          <div>
            <p
              className="reveal-left text-2xs font-semibold uppercase tracking-[0.26em] text-cyan"
              style={{ animationDelay: '0.06s' }}
            >
              Escritório Jurídico · Programa
            </p>

            <h1
              className="reveal-up mt-5 text-[2.75rem] font-semibold leading-[1.03] tracking-tight text-white sm:text-[3.5rem] lg:text-[4.25rem] xl:text-[4.75rem]"
              style={{ animationDelay: '0.1s' }}
            >
              Inteligência
              <br />
              <span className="text-cyan">Jurídica</span>
            </h1>

            <div
              className="reveal-scale-x mt-6 h-px w-32"
              style={{
                background: 'linear-gradient(to right, hsl(187 82% 58%), transparent)',
                animationDelay: '0.22s',
              }}
            />

            <p
              className="reveal-up mt-6 max-w-xl text-base leading-relaxed text-white/70 lg:text-[1.0625rem]"
              style={{ animationDelay: '0.18s' }}
            >
              {PRODUCT.description}
            </p>

            <div
              className="reveal-up mt-9 flex flex-wrap items-center gap-x-6 gap-y-3"
              style={{ animationDelay: '0.26s' }}
            >
              <button
                type="button"
                onClick={() => entrar()}
                className="group inline-flex h-[3.25rem] items-center gap-2.5 rounded-xl bg-cyan px-8
                           text-sm font-bold uppercase tracking-wider text-brand-deep
                           shadow-[0_10px_34px_-12px_hsl(187_82%_50%/0.7)]
                           transition-all duration-200 ease-swift
                           hover:-translate-y-0.5 hover:brightness-110
                           focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Entrar no painel
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <span className="text-2xs text-white/40">
                ou pressione{' '}
                <kbd className="rounded border border-white/20 px-1.5 py-0.5 font-mono text-white/65">
                  Enter
                </kbd>
              </span>
            </div>
          </div>

          {/* portas de entrada */}
          <div>
            <p
              className="reveal-in mb-3.5 text-2xs font-semibold uppercase tracking-[0.18em] text-white/35"
              style={{ animationDelay: '0.26s' }}
            >
              Acesso rápido
            </p>
            <div className="grid gap-3.5">
            {portas.map((porta, index) => (
              <button
                key={porta.to}
                type="button"
                onClick={() => entrar(porta.to)}
                className="reveal-up group relative flex items-start gap-4 overflow-hidden rounded-xl
                           border border-white/12 bg-white/[0.05] p-5 text-left backdrop-blur-[3px]
                           transition-all duration-200 ease-swift
                           hover:-translate-y-0.5 hover:border-cyan/50 hover:bg-white/[0.09]
                           focus-visible:ring-2 focus-visible:ring-cyan/60"
                style={{ animationDelay: `${0.3 + index * 0.06}s` }}
              >
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-lg border border-cyan/25
                             bg-cyan/10 text-cyan transition-colors duration-200 group-hover:bg-cyan/20"
                >
                  <porta.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white">
                    {porta.titulo}
                    <ArrowRight className="size-3.5 -translate-x-1 text-cyan opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/55">
                    {porta.texto}
                  </span>
                </span>
              </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- faixa de indicadores */}
      <footer
        className="reveal-up relative shrink-0 border-t border-white/10 bg-brand-deep/60 backdrop-blur-[8px]"
        style={{ animationDelay: '0.36s' }}
      >
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-y-4 px-8 py-5 lg:px-14">
          <CoverStat label="Documentos no acervo" value={kpi('documentos_indexados')} destaque />
          <CoverDivider />
          <CoverStat label="Naturezas documentais" value={kpi('naturezas')} />
          <CoverDivider />
          <CoverStat
            label="Matéria sancionatória"
            value={kpi('exposicao_sancionatoria')}
            icon={ShieldAlert}
          />
          <CoverDivider />
          <CoverStat label="Rodovias do programa" value={kpi('rodovias')} icon={Route} />
          <div className="hidden flex-1 lg:block" />
          {meta ? (
            <div className="lg:text-right">
              <p className="text-2xs uppercase tracking-[0.14em] text-white/40">
                Dados atualizados em
              </p>
              <p className="tabular text-sm font-medium text-white/80">
                {new Date(meta.indexed_as_of ?? meta.physical_scan_as_of).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

function CoverStat({
  label,
  value,
  destaque = false,
  icon: Icon,
}: {
  label: string
  value: number | null
  destaque?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center gap-3 pr-9">
      {Icon ? <Icon className="size-4 shrink-0 text-cyan/70" /> : null}
      <div>
        <p
          className={cn(
            'tabular font-semibold leading-none',
            destaque ? 'text-[2rem] text-white' : 'text-[1.625rem] text-white/92',
          )}
        >
          {value === null ? '—' : <CountUp value={value} format={num} />}
        </p>
        <p className="mt-1.5 text-2xs uppercase tracking-[0.1em] text-white/45">{label}</p>
      </div>
    </div>
  )
}

function CoverDivider() {
  return <span aria-hidden className="mr-9 hidden h-10 w-px bg-white/12 lg:block" />
}
