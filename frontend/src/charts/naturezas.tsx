/**
 * Naturezas em detalhe: barra de participação, ponto de alcance, contagem.
 *
 * Substituiu a dispersão (participação × alcance, área = documentos). O scatter
 * respondia bem "quais naturezas são estruturais", mas exigia ler dois eixos e
 * um tamanho ao mesmo tempo, e o nome da natureza só cabia nos pontos grandes.
 * Aqui cada natureza tem uma linha, e as três métricas se leem descendo a
 * coluna.
 *
 * DUAS MÉTRICAS, DUAS ESCALAS, DUAS FAIXAS — e isso não é detalhe de layout.
 *
 *   participação = % do recorte      -> 0 a 100, barra
 *   alcance      = destinatários     -> CONTAGEM ABSOLUTA, ponto
 *
 * `alcance` é `count(DISTINCT d.destinatario)` no backend. Não é percentual, e
 * a referência visual que mostrava "16%" ao lado do ponto estava mostrando um
 * número que não existe. Pôr os dois na mesma régua faria 27% e 16
 * destinatários parecerem comparáveis — por isso o ponto tem a própria faixa,
 * com o próprio máximo declarado no cabeçalho da coluna.
 *
 * Não usa ECharts de propósito: é uma tabela com marcas gráficas. Em DOM o
 * alinhamento entre as linhas é exato, o rótulo longo não é descartado quando
 * não cabe, e cada linha é um `button` de verdade — foco, teclado e leitor de
 * tela saem de graça.
 */

import * as React from 'react'

import { corDaMateria } from '@/lib/cores'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface LinhaDeNatureza {
  natureza: string
  documentos: number
  /** Percentual do recorte atual. */
  participacao: number
  /** Destinatários distintos. Contagem absoluta, não percentual. */
  destinatarios: number
  materia: string | null
}

/** Rótulo da linha que agrega a cauda longa. */
const OUTRAS = 'Outras naturezas'

export function BarrasDeNatureza({
  linhas,
  maximo = 11,
  ativa,
  haSelecao = false,
  onSelect,
}: {
  linhas: LinhaDeNatureza[]
  maximo?: number
  ativa?: (natureza: string) => boolean
  haSelecao?: boolean
  onSelect?: (natureza: string) => void
}) {
  const [sobre, setSobre] = React.useState<string | null>(null)

  const { visiveis, maxParticipacao, maxAlcance } = React.useMemo(() => {
    const ordenadas = [...linhas].sort((a, b) => b.participacao - a.participacao)
    const cabeca = ordenadas.slice(0, maximo)
    const cauda = ordenadas.slice(maximo)

    const visiveis: Array<LinhaDeNatureza & { agregada?: boolean }> = [...cabeca]
    if (cauda.length > 0) {
      visiveis.push({
        natureza: OUTRAS,
        documentos: cauda.reduce((a, n) => a + n.documentos, 0),
        participacao: cauda.reduce((a, n) => a + n.participacao, 0),
        /**
         * -1 significa "não há alcance para esta linha", e é deliberado.
         *
         * Destinatários distintos NÃO se somam: a mesma parte recebe minuta,
         * ofício e advertência, e somar as três contagens a contaria três
         * vezes. Documento e participação somam; alcance não. A linha agregada
         * fica sem ponto, e o tooltip diz por quê.
         */
        destinatarios: -1,
        materia: null,
        agregada: true,
      })
    }

    return {
      visiveis,
      maxParticipacao: Math.max(1, ...visiveis.map((n) => n.participacao)),
      maxAlcance: Math.max(1, ...visiveis.map((n) => n.destinatarios)),
    }
  }, [linhas, maximo])

  if (visiveis.length === 0) return null

  // Teto com folga: a barra mais longa não encosta no fim da faixa, e sobra
  // lugar para o número que vem logo depois dela.
  const tetoParticipacao = maxParticipacao * 1.06

  return (
    <div className="w-full">
      {/* legenda: qual marca é qual métrica */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-1.5 px-1">
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <span
            aria-hidden
            className="h-3 w-7 rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(var(--data-4)), hsl(var(--data-1)))' }}
          />
          barra = participação no recorte
        </span>
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <span aria-hidden className="size-3.5 rounded-full bg-accent" />
          ponto = destinatários distintos
        </span>
      </div>

      {/* cabeçalho das colunas */}
      <div className="flex items-end gap-4 border-b border-line px-1 pb-2.5">
        <span className="label-caps w-[11rem] shrink-0 text-xs">Natureza</span>
        <span className="label-caps min-w-0 flex-1 text-xs">Participação</span>
        <span className="label-caps w-[13rem] shrink-0 text-xs">
          Alcance{' '}
          <span className="normal-case text-ink-faint">· máx. {num(maxAlcance)} destinatários</span>
        </span>
        <span className="label-caps w-[5.5rem] shrink-0 text-right text-xs">Documentos</span>
      </div>

      <ul className="divide-y divide-line/60">
        {visiveis.map((linha) => {
          const selecionada = ativa?.(linha.natureza) ?? false
          const atenuada = haSelecao && !selecionada
          const emFoco = sobre === linha.natureza
          const cor = corDaMateria(linha.materia)
          const largura = (linha.participacao / tetoParticipacao) * 100
          const temAlcance = linha.destinatarios >= 0
          const posicao = temAlcance ? (linha.destinatarios / maxAlcance) * 100 : 0
          const clicavel = Boolean(onSelect) && !linha.agregada

          return (
            <li key={linha.natureza} className="relative">
              <button
                type="button"
                disabled={!clicavel}
                onClick={() => clicavel && onSelect?.(linha.natureza)}
                onMouseEnter={() => setSobre(linha.natureza)}
                onMouseLeave={() => setSobre((s) => (s === linha.natureza ? null : s))}
                onFocus={() => setSobre(linha.natureza)}
                onBlur={() => setSobre((s) => (s === linha.natureza ? null : s))}
                aria-pressed={clicavel ? selecionada : undefined}
                aria-label={`${linha.natureza}: ${pct(linha.participacao)} do recorte, ${
                  temAlcance ? `${linha.destinatarios} destinatários, ` : ''
                }${linha.documentos} documentos`}
                className={cn(
                  'flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left transition-colors duration-150',
                  clicavel && 'hover:bg-subtle/60',
                  selecionada && 'bg-subtle/80',
                )}
                style={{ opacity: atenuada ? 0.42 : 1 }}
              >
                {/* nome */}
                <span
                  className={cn(
                    'w-[11rem] shrink-0 truncate text-[15px]',
                    selecionada ? 'font-semibold text-ink' : 'font-medium text-ink',
                    linha.agregada && 'italic font-normal text-ink-faint',
                  )}
                  title={linha.natureza}
                >
                  {linha.natureza}
                </span>

                {/* barra de participação */}
                <span className="relative flex min-w-0 flex-1 items-center gap-3">
                  <span className="relative h-[24px] min-w-0 flex-1">
                    {/* trilho e grade: quatro fios discretos, sem eixo numérico
                        — o número de cada barra vem logo ao lado dela. */}
                    <span aria-hidden className="absolute inset-0 rounded-md bg-subtle/70" />
                    {[25, 50, 75].map((marca) => (
                      <span
                        key={marca}
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-line/70"
                        style={{ left: `${marca}%` }}
                      />
                    ))}
                    <span
                      className="absolute inset-y-0 left-0 rounded-md transition-[width,filter] duration-300 ease-swift"
                      style={{
                        width: `${Math.max(largura, linha.participacao > 0 ? 1.5 : 0)}%`,
                        background: `linear-gradient(90deg, ${corDaMateria(linha.materia, 0.66)}, ${cor})`,
                        filter: selecionada || emFoco ? `drop-shadow(0 0 7px ${corDaMateria(linha.materia, 0.5)})` : undefined,
                      }}
                    />
                  </span>
                  <span
                    className={cn(
                      'tabular w-14 shrink-0 text-right text-sm',
                      selecionada ? 'font-bold text-ink' : 'font-semibold text-ink',
                    )}
                  >
                    {pct(linha.participacao)}
                  </span>
                </span>

                {/* ponto de alcance, na própria faixa e na própria escala */}
                {/* Alcance: HASTE + BOLHA, e nunca uma segunda barra.
                    A haste fina em accent e a bolha grande leem como outra
                    marca; uma barra cheia aqui faria parecer que as duas
                    faixas compartilham régua, e elas não compartilham. */}
                <span className="relative flex w-[13rem] shrink-0 items-center gap-3">
                  <span className="relative h-[24px] min-w-0 flex-1">
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-subtle/55"
                    />
                    {[0, 25, 50, 75, 100].map((marca) => (
                      <span
                        key={marca}
                        aria-hidden
                        className="absolute top-1/2 h-[9px] w-px -translate-y-1/2 bg-line/70"
                        style={{ left: `${marca}%` }}
                      />
                    ))}
                    {temAlcance ? (
                      <>
                        <span
                          aria-hidden
                          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-300 ease-swift"
                          style={{
                            left: 0,
                            width: `${Math.max(2, Math.min(100, posicao))}%`,
                            background:
                              'linear-gradient(90deg, hsl(var(--accent) / 0.16), hsl(var(--accent) / 0.72))',
                          }}
                        />
                        <span
                          aria-hidden
                          className="absolute top-1/2 size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-[left,transform] duration-300 ease-swift"
                          style={{
                            left: `${Math.max(3, Math.min(97, posicao))}%`,
                            background: 'hsl(var(--accent))',
                            borderColor: 'hsl(var(--surface))',
                            transform:
                              selecionada || emFoco
                                ? 'translate(-50%, -50%) scale(1.28)'
                                : 'translate(-50%, -50%)',
                            boxShadow:
                              selecionada || emFoco
                                ? '0 0 16px hsl(var(--accent) / 0.85)'
                                : '0 0 9px hsl(var(--accent) / 0.5)',
                          }}
                        />
                      </>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'tabular w-8 shrink-0 text-right text-sm',
                      selecionada ? 'font-bold text-accent-ink' : 'font-semibold text-accent-ink',
                    )}
                  >
                    {temAlcance ? num(linha.destinatarios) : '—'}
                  </span>
                </span>

                {/* documentos */}
                <span className="w-[5.5rem] shrink-0 text-right">
                  <span
                    className={cn(
                      'tabular inline-block min-w-[3.25rem] rounded-lg border px-2.5 py-1 text-[15px] font-bold',
                      selecionada
                        ? 'border-accent/40 bg-accent-soft text-accent-ink'
                        : 'border-line bg-subtle/60 text-ink',
                    )}
                  >
                    {num(linha.documentos)}
                  </span>
                </span>
              </button>

              {emFoco ? (
                <Dica linha={linha} maxAlcance={maxAlcance} />
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Tooltip curto: as três métricas da linha, e nada mais. */
function Dica({
  linha,
  maxAlcance,
}: {
  linha: LinhaDeNatureza & { agregada?: boolean }
  maxAlcance: number
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute right-2 top-full z-20 -mt-1 w-[232px] rounded-lg border border-line bg-elevated px-3 py-2.5 shadow-pop"
    >
      <p className="truncate text-[11.5px] font-semibold text-ink">{linha.natureza}</p>
      <dl className="mt-1.5 space-y-1">
        <Par rotulo="participação" valor={pct(linha.participacao)} />
        <Par
          rotulo="alcance"
          valor={
            linha.destinatarios >= 0
              ? `${num(linha.destinatarios)} de ${num(maxAlcance)} destinatários`
              : 'não somável'
          }
        />
        <Par rotulo="documentos" valor={num(linha.documentos)} />
        {linha.materia ? <Par rotulo="matéria" valor={linha.materia} /> : null}
      </dl>
      {linha.agregada ? (
        <p className="mt-2 border-t border-line pt-2 text-[10.5px] leading-snug text-ink-faint">
          Destinatários distintos não se somam: a mesma parte recebe naturezas diferentes.
        </p>
      ) : (
        <p className="mt-2 text-[10.5px] text-accent">clique para filtrar a página</p>
      )}
    </div>
  )
}

function Par({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-2xs text-ink-muted">{rotulo}</dt>
      <dd className="tabular truncate text-2xs font-semibold text-ink">{valor}</dd>
    </div>
  )
}
