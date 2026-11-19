/**
 * Shell da aplicação. Navegação em português, marca Programa, filtros globais na
 * topbar.
 *
 * Governança e Atividade do Repositório saíram do menu por decisão da usuária.
 * Os endpoints, validações e testes seguem ativos — a qualidade continua sendo
 * requisito de backend, só não é módulo executivo nesta fase.
 */

import {
  Activity,
  ChevronLeft,
  Gauge,
  Moon,
  PanelLeftOpen,
  Route,
  Search,
  Sun,
} from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { NAV, PRODUCT, pageTitle } from '@/brand/product'
import { useTheme } from '@/app/ThemeProvider'
import { GlobalFilterBar } from '@/ui/filters'
import { useMeta } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Button, Tooltip, TooltipProvider } from '@/ui/primitives'
import { PageTransition } from '@/ui/motion'
import { DataFreshness } from '@/ui/freshness'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  activity: Activity,
  route: Route,
  search: Search,
}

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(false)
  const { resolved, cycle } = useTheme()
  const location = useLocation()
  useMeta() // pré-carrega o contexto do ciclo para toda a aplicação

  const title = pageTitle(location.pathname)

  React.useEffect(() => {
    document.title = `${title} · ${PRODUCT.lockup}`
  }, [title])

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-canvas">
        {/* ----------------------------------------------------------- sidebar */}
        <aside
          className={cn(
            'sticky top-0 z-40 flex h-screen shrink-0 flex-col border-r border-line',
            'bg-surface transition-[width] duration-250 ease-swift',
            collapsed ? 'w-[62px]' : 'w-[248px]',
          )}
        >
          {/* marca */}
          <Link
            to="/"
            className={cn(
              'group flex h-16 items-center border-b border-line transition-colors hover:bg-subtle',
              collapsed ? 'justify-center px-2' : 'gap-3 px-4',
            )}
            title="Voltar à capa"
          >
            {/*
              O selo "IJ" saiu: a marca daqui é a do Programa. O logotipo é
              horizontal (363x195) e existe em duas versões do MESMO desenho —
              teal institucional e branco. Em fundo escuro o teal desaparece,
              então a versão acompanha o tema resolvido, sem inverter nem
              recolorir o arquivo.
            */}
            <span
              aria-label={PRODUCT.consortium}
              className={cn(
                'shrink-0 font-semibold uppercase tracking-[0.18em] text-accent',
                collapsed ? 'text-[0.625rem]' : 'text-xs',
              )}
            >
              {collapsed ? 'DJ' : 'Dashboard'}
            </span>
            {!collapsed ? (
              <span className="min-w-0 border-l border-line pl-3">
                <span className="block truncate text-[0.8125rem] font-semibold leading-tight text-ink">
                  {PRODUCT.lockup}
                </span>
              </span>
            ) : null}
          </Link>

          {/* Navegação em lista única, sem títulos de seção: com quatro
              destinos, três cabeçalhos eram mais texto do que navegação. */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-4">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const Icon = ICONS[item.icon] ?? Gauge
                return (
                  <li key={item.to}>
                    <Tooltip content={collapsed ? item.label : ''} side="right">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-lg py-2.5 text-sm',
                            'transition-all duration-150 ease-swift',
                            collapsed ? 'justify-center px-0' : 'px-2.5',
                            isActive
                              ? 'bg-accent-soft font-semibold text-accent-ink'
                              : 'text-ink-muted hover:bg-subtle hover:text-ink',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              <span className="absolute -left-2.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
                            ) : null}
                            <Icon className="size-[17px] shrink-0" />
                            {!collapsed ? <span className="truncate">{item.short}</span> : null}
                          </>
                        )}
                      </NavLink>
                    </Tooltip>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Pé: só o recolher. As marcas do Parceiro e do Fundo saíram a
              pedido da usuária — as duas continuam na capa, que é onde a
              assinatura institucional tem função. */}
          <div className="border-t border-line p-2.5">
            <Button
              variant="ghost"
              size={collapsed ? 'icon-sm' : 'sm'}
              onClick={() => setCollapsed((v) => !v)}
              className={cn('w-full justify-center', collapsed && 'w-7')}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <>
                  <ChevronLeft className="size-4" />
                  <span>Recolher</span>
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* -------------------------------------------------------------- main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/88 backdrop-blur-[10px]">
            <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-6 lg:px-9">
              {/* Só o título. O sobretítulo "Programa · Fundo" saiu a pedido
                  da usuária: a assinatura institucional já está na marca ao
                  lado, e repeti-la em cada página empurrava o nome da tela para
                  baixo e para um corpo menor do que ele merece. */}
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight text-ink">
                  {title}
                </h1>
              </div>
              <div className="flex-1" />
              <DataFreshness />
              <Tooltip content={resolved === 'dark' ? 'Tema claro' : 'Tema escuro'}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cycle}
                  aria-label="Alternar tema"
                  className="shrink-0"
                >
                  {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              </Tooltip>
            </div>
            {/* Na Linha do Tempo a barra recua: a timeline é a experiência, e
                duas faixas de controle de mesmo peso, uma colada na outra,
                faziam a página ler como "dashboard com timeline dentro".
                Nada muda no comportamento dos filtros. */}
            <GlobalFilterBar discreto={location.pathname.startsWith('/linha-do-tempo')} />
          </header>

          <main className="mx-auto w-full max-w-content flex-1 px-6 py-7 lg:px-9">
            <PageTransition keyed={location.pathname}>
              <Outlet />
            </PageTransition>
          </main>

          {/* O rodapé "Fonte documental em modo somente leitura" saiu a pedido
              da usuária. A regra continua valendo e continua escrita onde ela
              obriga: `CLAUDE.md` seção 3 e `DEC-002`. */}
        </div>
      </div>
    </TooltipProvider>
  )
}
