/**
 * O gráfico que sai da própria Linha do Tempo.
 *
 * Não é um card, não é um painel e não é uma segunda visualização: é a mesma
 * faixa temporal continuada para baixo. Por isso não tem fundo, não tem
 * título, não tem eixo e — principalmente — não repete os rótulos. Os nomes
 * dos períodos já estão lá em cima; escrevê-los de novo aqui embaixo seria
 * dizer duas vezes a mesma coisa e transformar a composição em dois blocos.
 *
 * ALINHAMENTO. O ponto de cada slot não é aproximado por padding: o gráfico
 * recebe a MESMA `larguraDia` que o trilho usa e se move pelos MESMOS valores
 * de movimento (arraste e travel). O x do ponto `i` é
 * `i * larguraDia + larguraDia / 2`, que é exatamente o centro da coluna `i`,
 * porque a coluna é um item de largura fixa numa fileira sem espaçamento. Em
 * qualquer viewport, em qualquer escala, arrastado ou não, o centro coincide
 * por construção — não por ajuste.
 *
 * DUAS RÉGUAS, e isto é decisão consciente. A linha de documentos usa a escala
 * do maior slot; a acumulada usa a escala do próprio acumulado. Numa régua só,
 * a acumulada do ano (247) achataria a série de documentos (55) em 22% da
 * altura e a protagonista viraria um risco no rodapé. A acumulada aqui não é
 * magnitude para comparar com a outra linha: é a FORMA da progressão, e o
 * número exato dela aparece no tooltip. Ela é ROXA e visível o bastante para
 * se achar sem procurar — e fina, sem halo forte, para o olho continuar indo
 * primeiro na cyan.
 *
 * ANIMAÇÃO EM CSS, nunca em JS. Keyframe com estado de repouso visível: se a
 * animação não rodar — aba oculta, captura, `html.no-reveal`, movimento
 * reduzido — a linha aparece inteira em vez de ficar presa invisível. É a
 * armadilha que já custou caro neste projeto três vezes.
 */

import type { MotionValue } from 'motion/react'
import { motion } from 'motion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import type { Coluna } from '../escalas'

/** Respiro no topo: linha encostada na borda de cima parece cortada. */
const FOLGA_DO_TOPO = 1.14
/** Onde a linha de base do gráfico se apoia, contado do rodapé da faixa. */
const PISO = 14
/** Raio do nó de documentos em repouso e sob atenção. */
const RAIO = 4.2
const RAIO_ATIVO = 6.4
/** O nó do acumulado é sempre menor: é contexto, não protagonista. */
const RAIO_ACUMULADO = 2.8

export interface PontoDoGrafico {
  iso: string
  x: number
  documentos: number
  acumulado: number
  yDocumentos: number
  yAcumulado: number
  coluna: Coluna
}

function caminho(pontos: PontoDoGrafico[], y: (p: PontoDoGrafico) => number): string {
  // Segmentos RETOS, de propósito: a curva suavizada inventaria valores entre
  // dois dias que o acervo não tem.
  return pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${y(p)}`).join(' ')
}

export function TimelineChart({
  colunas,
  larguraDia,
  altura,
  respiro,
  x,
  xTravel,
  arrastavel,
  ativa,
  mostrarTooltip,
  onAtiva,
  reduzido,
  chave,
}: {
  colunas: Coluna[]
  /** A mesma largura de coluna do trilho. É daqui que vem o alinhamento. */
  larguraDia: number
  altura: number
  /** Distância entre o fim do trilho e o topo do gráfico. */
  respiro: number
  /** Deslocamento do arraste, compartilhado com o trilho. */
  x: MotionValue<number>
  /** Deslocamento do travel, compartilhado com o trilho. */
  xTravel: MotionValue<number>
  /** Quando tudo cabe, o trilho é centralizado — e o gráfico tem de ir junto. */
  arrastavel: boolean
  ativa: string | null
  /** Falso quando quem informa é o card de contexto da timeline. */
  mostrarTooltip: boolean
  onAtiva: (iso: string, ligado: boolean, origem: 'timeline' | 'grafico') => void
  reduzido: boolean
  /** Muda a cada período/escala: força o redesenho da linha. */
  chave: string
}) {
  const hoje = React.useMemo(() => new Date().toISOString().slice(0, 10), [])

  /**
   * Até onde a linha tem o direito de ir.
   *
   * No ano corrente os meses que ainda não aconteceram não valem zero: eles
   * não existem. Desenhar a linha atravessando outubro, novembro e dezembro no
   * chão diria "não se produziu nada", quando o certo é não dizer nada.
   */
  const ultimoValido = React.useMemo(() => {
    let ultimo = -1
    colunas.forEach((c, i) => {
      if (c.inicio <= hoje) ultimo = i
    })
    return ultimo < 0 ? colunas.length - 1 : ultimo
  }, [colunas, hoje])

  const pontos = React.useMemo<PontoDoGrafico[]>(() => {
    const util = Math.max(20, altura - PISO - 8)
    let soma = 0
    const acumulados = colunas.map((c) => (soma += c.total))
    const maiorDoc = Math.max(1, ...colunas.map((c) => c.total))
    const maiorAcc = Math.max(1, acumulados[ultimoValido] ?? 1)
    const base = altura - PISO

    return colunas.slice(0, ultimoValido + 1).map((c, i) => ({
      iso: c.iso,
      coluna: c,
      x: i * larguraDia + larguraDia / 2,
      documentos: c.total,
      acumulado: acumulados[i] ?? 0,
      yDocumentos: base - (c.total / (maiorDoc * FOLGA_DO_TOPO)) * util,
      yAcumulado: base - ((acumulados[i] ?? 0) / (maiorAcc * FOLGA_DO_TOPO)) * util,
    }))
  }, [altura, colunas, larguraDia, ultimoValido])

  const largura = colunas.length * larguraDia
  const total = colunas.reduce((a, c) => a + c.total, 0)
  const indiceAtivo = pontos.findIndex((p) => p.iso === ativa)
  const pontoAtivo = indiceAtivo >= 0 ? pontos[indiceAtivo] : null

  /**
   * Comprimento do traço para o desenho da esquerda para a direita. Vem da
   * geometria, não de um chute: `getTotalLength` na própria polilinha.
   */
  const refDoc = React.useRef<SVGPathElement>(null)
  const refAcc = React.useRef<SVGPathElement>(null)
  const [comprimentos, setComprimentos] = React.useState({ doc: 0, acc: 0 })
  React.useEffect(() => {
    setComprimentos({
      doc: refDoc.current?.getTotalLength() ?? 0,
      acc: refAcc.current?.getTotalLength() ?? 0,
    })
  }, [pontos])

  // 900–1300 ms conforme a quantidade de pontos: sete dias não podem levar o
  // mesmo tempo que doze meses, e nada aqui pode passar de 1,3 s.
  const duracao = Math.round(Math.min(1300, 820 + pontos.length * 38))
  /**
   * O gráfico entra DEPOIS da timeline, não junto.
   *
   * A cascata das colunas leva `ordem * 42 ms`; esperar a primeira metade
   * dela é o que produz a leitura "a timeline gera o gráfico" em vez de dois
   * elementos aparecendo ao mesmo tempo.
   */
  const atrasoDeEntrada = reduzido ? 0 : 160 + Math.min(240, colunas.length * 18)

  if (pontos.length === 0 || largura <= 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-full"
      style={{ height: altura, marginTop: respiro }}
    >
      {/* As duas camadas de movimento do trilho, na mesma ordem e com os
          mesmos valores. É isto que mantém o alinhamento durante o arraste e
          durante a viagem no tempo, sem recalcular nada. */}
      <motion.div style={{ x: xTravel }}>
        <motion.div
          style={{ x }}
          className={cn('w-max px-2', !arrastavel && 'mx-auto')}
        >
          <svg
            key={chave}
            width={largura}
            height={altura}
            viewBox={`0 0 ${largura} ${altura}`}
            className="pointer-events-auto block overflow-visible"
          >
            <defs>
              <linearGradient id="gradiente-documentos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.20" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Guia vertical: só existe durante a interação, e mesmo assim mal
                se vê. Ela é o fio que diz "este objeto lá em cima e este ponto
                aqui embaixo são o mesmo período". */}
            {pontoAtivo ? (
              <line
                x1={pontoAtivo.x}
                y1={-4}
                x2={pontoAtivo.x}
                y2={altura - PISO}
                stroke="hsl(var(--accent))"
                strokeOpacity={0.22}
                strokeWidth={1}
              />
            ) : null}

            {/* Véu sob a linha principal. Não é área empilhada: é só o que
                impede a linha de flutuar solta sobre o vídeo. */}
            <path
              d={`${caminho(pontos, (p) => p.yDocumentos)} L ${pontos[pontos.length - 1]!.x} ${
                altura - PISO
              } L ${pontos[0]!.x} ${altura - PISO} Z`}
              fill="url(#gradiente-documentos)"
              className={reduzido ? undefined : 'veu-do-grafico'}
              style={
                reduzido
                  ? undefined
                  : { animationDuration: `${duracao}ms`, animationDelay: `${atrasoDeEntrada}ms` }
              }
            />

            {/* ACUMULADO — segundo plano. Mais fina, mais apagada, sem brilho,
                e entra depois. Nunca disputa com a cyan. */}
            <path
              ref={refAcc}
              d={caminho(pontos, (p) => p.yAcumulado)}
              fill="none"
              stroke="hsl(272 78% 72%)"
              strokeOpacity={0.62}
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              // Um sopro de brilho, só para o roxo existir sobre o vídeo. Nada
              // perto do halo da cyan: continua sendo a linha de contexto.
              filter="drop-shadow(0 0 3px hsl(272 78% 72% / 0.35))"
              className={reduzido ? undefined : 'linha-do-grafico'}
              style={
                reduzido
                  ? undefined
                  : {
                      ['--traco' as string]: `${comprimentos.acc}`,
                      animationDuration: `${duracao}ms`,
                      animationDelay: `${atrasoDeEntrada + 180}ms`,
                    }
              }
            />

            {/* DOCUMENTOS — a protagonista. */}
            <path
              ref={refDoc}
              d={caminho(pontos, (p) => p.yDocumentos)}
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: 'drop-shadow(0 0 5px hsl(var(--accent) / 0.42))',
                ...(reduzido
                  ? {}
                  : {
                      ['--traco' as string]: `${comprimentos.doc}`,
                      animationDuration: `${duracao}ms`,
                      animationDelay: `${atrasoDeEntrada}ms`,
                    }),
              }}
              className={reduzido ? undefined : 'linha-do-grafico'}
            />

            {pontos.map((p, i) => {
              const ativo = p.iso === ativa
              const atraso = reduzido ? 0 : Math.round((i / Math.max(1, pontos.length - 1)) * duracao)
              return (
                <g key={p.iso}>
                  {/* nó do acumulado: menor e mais apagado */}
                  <circle
                    cx={p.x}
                    cy={p.yAcumulado}
                    r={RAIO_ACUMULADO}
                    fill="hsl(272 78% 74%)"
                    fillOpacity={0.7}
                    className={reduzido ? undefined : 'no-do-grafico'}
                    style={
                      reduzido ? undefined : { animationDelay: `${atrasoDeEntrada + atraso + 180}ms` }
                    }
                  />
                  {/* nó de documentos: mais luminoso que a própria linha */}
                  <circle
                    cx={p.x}
                    cy={p.yDocumentos}
                    r={ativo ? RAIO_ATIVO : RAIO}
                    fill="hsl(var(--accent))"
                    style={{
                      filter: ativo
                        ? 'drop-shadow(0 0 8px hsl(var(--accent) / 0.8))'
                        : 'drop-shadow(0 0 4px hsl(var(--accent) / 0.5))',
                      transition: reduzido ? 'none' : 'r 170ms ease-out, filter 170ms ease-out',
                      ...(reduzido ? {} : { animationDelay: `${atrasoDeEntrada + atraso}ms` }),
                    }}
                    className={reduzido ? undefined : 'no-do-grafico'}
                  />
                  {/* Alvo do cursor: a coluna inteira, para o ponteiro não ter
                      de acertar um círculo de 3 px. */}
                  <rect
                    x={p.x - larguraDia / 2}
                    y={0}
                    width={larguraDia}
                    height={altura}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => onAtiva(p.iso, true, 'grafico')}
                    onMouseLeave={() => onAtiva(p.iso, false, 'grafico')}
                  />
                </g>
              )
            })}
          </svg>
        </motion.div>
      </motion.div>

      {pontoAtivo && mostrarTooltip ? (
        <Tooltip
          ponto={pontoAtivo}
          anterior={indiceAtivo > 0 ? (pontos[indiceAtivo - 1] ?? null) : null}
          total={total}
          altura={altura}
          larguraDia={larguraDia}
          x={x}
          xTravel={xTravel}
          arrastavel={arrastavel}
          colunas={colunas.length}
        />
      ) : null}
    </div>
  )
}

/**
 * Mini-tooltip. Discreto, escuro, e some quando o cursor sai.
 *
 * Não é KPI: é a leitura daquele ponto, com a comparação com o slot anterior
 * quando ela existe de verdade. Slot anterior em zero não vira "+∞%" nem
 * "+900%" inventado — simplesmente não se compara.
 */
function Tooltip({
  ponto,
  anterior,
  total,
  altura,
  larguraDia,
  x,
  xTravel,
  arrastavel,
  colunas,
}: {
  ponto: PontoDoGrafico
  anterior: PontoDoGrafico | null
  total: number
  altura: number
  larguraDia: number
  x: MotionValue<number>
  xTravel: MotionValue<number>
  arrastavel: boolean
  colunas: number
}) {
  const variacao =
    anterior && anterior.documentos > 0
      ? Math.round(((ponto.documentos - anterior.documentos) / anterior.documentos) * 100)
      : null
  const participacao = total > 0 ? Math.round((ponto.documentos / total) * 100) : 0
  // Perto da borda direita o card vira para a esquerda em vez de sair da tela.
  const fim = ponto.x > colunas * larguraDia - 150

  return (
    <motion.div style={{ x: xTravel }} className="pointer-events-none absolute inset-x-0 top-0">
      <motion.div style={{ x }} className={cn('w-max px-2', !arrastavel && 'mx-auto')}>
        <div
          className="absolute w-[206px] rounded-xl border border-white/[0.1] px-3.5 py-3"
          style={{
            left: ponto.x + (fim ? -218 : 16),
            top: Math.min(Math.max(2, ponto.yDocumentos - 30), Math.max(2, altura - 104)),
            background: 'rgba(7, 13, 22, 0.92)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 12px 30px -12px rgba(0,0,0,0.85)',
          }}
        >
          <p className="truncate text-[11.5px] font-medium leading-tight text-white/70">
            {ponto.coluna.rotuloLongo}
          </p>
          <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
            <span className="text-[19px] font-semibold tabular-nums text-accent">
              {ponto.documentos}
            </span>
            <span className="text-[12px] text-white/55">
              {ponto.documentos === 1 ? 'documento' : 'documentos'}
            </span>
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">
            {variacao !== null ? (
              <>
                <span className={variacao >= 0 ? 'text-accent/85' : 'text-white/70'}>
                  {variacao >= 0 ? '+' : ''}
                  {variacao}%
                </span>{' '}
                vs. anterior ·{' '}
              </>
            ) : null}
            {participacao}% do período
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/32">
            {ponto.acumulado} acumulados até aqui
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
