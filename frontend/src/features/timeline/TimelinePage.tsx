/**
 * Linha do Tempo — a tela principal do produto.
 *
 * Não é "um dashboard com uma timeline": é um repositório jurídico temporal.
 * A interface flutua sobre um ambiente institucional real (vídeo), em vidro
 * escuro, e a timeline ocupa o centro da experiência.
 *
 * As três escalas — semana, mês e ano — são a MESMA tela. O que muda é o que
 * uma coluna representa: um dia na semana e no mês, um mês inteiro no ano. O
 * recorte do tempo e os rótulos vivem em `escalas.ts`; daqui para baixo nenhum
 * componente sabe em que escala está.
 *
 * Dados: uma requisição a `/documents` recortada pelo período em leitura. O
 * acervo inteiro tem menos de 500 documentos e o ano mais cheio não chega a
 * 250, então um período cabe sempre numa página só — não há paginação a
 * resolver aqui. Nenhum contrato de API foi alterado para esta tela.
 */

import { AlertCircle, CalendarClock } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '@/lib/api'
import type { DocumentoResumo } from '@/lib/api'
import { drillToSearch, useFilters } from '@/lib/filters'
import { useDocuments, useTimeline, useTimelineDetail } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Button, ErrorState, Skeleton } from '@/ui/primitives'

import { DayDocumentsDrawer } from './components/DayDocumentsDrawer'
import { LegalTimeline } from './components/LegalTimeline'
import { TimelineEmptyWeek } from './components/TimelineEmptyWeek'
import type { Foco } from './components/TimelineDay'
import { LegalVideoBackground } from './components/LegalVideoBackground'
import type { EscalaTemporal } from './components/TimelineToolbar'
import { SaltoDeData, TimelineToolbar } from './components/TimelineToolbar'
import { escolherAterrissagem } from './aterrissagem'
import { registrosVizinhos } from './vizinhos'
import {
  agruparPeriodo,
  chaveDaColuna,
  distanciaEmPeriodos,
  fimDoPeriodo,
  inicioDoPeriodo,
  passoDePeriodo,
  unidadeDaEscala,
} from './escalas'
import { paraIso } from './week'
import { useMovimentoReduzido } from './useMovimentoReduzido'

export function TimelinePage() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  const reduzido = useMovimentoReduzido()

  // Série mensal: só para saber onde o acervo começa e termina.
  const { data: serie } = useTimelineDetail(filters)
  const meses = serie?.data?.meses ?? []
  const primeiroMes = meses[0]?.periodo ?? null
  const ultimoMes = meses[meses.length - 1]?.periodo ?? null

  // Série por DIA: é o que permite escolher uma semana de abertura que
  // realmente represente o acervo, em vez de cair numa semana de 1 documento.
  const { data: serieDiaria } = useTimeline(filters, 'dia')
  const dias = React.useMemo(() => serieDiaria?.data ?? [], [serieDiaria?.data])

  /**
   * Dia pré-selecionado pela URL (`?dia=AAAA-MM-DD`). É deep-link de verdade:
   * permite mandar a alguém "olha o dia 23" e cair direto nele.
   *
   * `?qa=documentos|node|drawer` abre um popover ou o drawer sem cursor e
   * existe SÓ em desenvolvimento — captura headless não tem mouse, e sem isso
   * não há como registrar hover e drawer em resolução cheia. Não vai para
   * produção.
   */
  const paramsUrl = React.useMemo(() => new URLSearchParams(window.location.search), [])
  const diaDaUrl = paramsUrl.get('dia')
  const qaParam = import.meta.env.DEV ? paramsUrl.get('qa') : null
  const qa = React.useMemo(() => {
    if (!diaDaUrl || (qaParam !== 'documentos' && qaParam !== 'node')) return null
    return { iso: diaDaUrl, foco: qaParam as Foco }
  }, [diaDaUrl, qaParam])

  /**
   * Uma data âncora, não um "início de semana".
   *
   * O período visível é DERIVADO dela junto com a escala, e é isso que faz
   * trocar de escala parecer zoom em vez de troca de tela: sair da semana de
   * 22/09 para o mês devolve setembro; voltar para a semana devolve a semana de
   * 22/09. Guardar o início de cada escala em estados separados perderia esse
   * ponto de referência na primeira ida e volta.
   */
  const [ancora, setAncora] = React.useState<string | null>(null)
  const [aterrissagem, setAterrissagem] = React.useState<ReturnType<typeof escolherAterrissagem>>(null)
  const [selecionado, setSelecionado] = React.useState<string | null>(null)
  const [alvoDeTravel, setAlvoDeTravel] = React.useState<string | null>(null)
  const [dataAlvo, setDataAlvo] = React.useState<string>(() => paraIso(new Date()))
  const [escala, setEscala] = React.useState<EscalaTemporal>('semana')
  const [viajando, setViajando] = React.useState(false)
  /**
   * Pulso do travel: muda a cada passo e leva o SENTIDO junto.
   *
   * É o que faz o eixo participar fisicamente. Antes, travel trocava o
   * conteúdo da semana e pronto — a sensação era de array sendo substituído,
   * não de trajetória. Agora cada passo também empurra o trilho, e sete passos
   * seguidos leem como percurso.
   */
  const [pulso, setPulso] = React.useState({ n: 0, sentido: 0 as -1 | 0 | 1 })
  /** Dia cujo drawer está aberto. `null` = fechado. */
  const [diaDoDrawer, setDiaDoDrawer] = React.useState<string | null>(null)

  const empurrar = React.useCallback((sentido: -1 | 1) => {
    setPulso((p) => ({ n: p.n + 1, sentido }))
  }, [])

  // Aterrissagem, uma vez só. A URL manda quando traz um dia.
  React.useEffect(() => {
    if (ancora) return
    if (diaDaUrl) {
      setAncora(diaDaUrl)
      setDataAlvo(diaDaUrl)
      setSelecionado(diaDaUrl)
      return
    }
    if (dias.length === 0) return
    const escolha = escolherAterrissagem(dias, paraIso(new Date()))
    if (!escolha) return
    setAterrissagem(escolha)
    setAncora(escolha.inicio)
    setDataAlvo(escolha.inicio)
  }, [ancora, diaDaUrl, dias])

  /**
   * `?qa=drawer` abre o drawer sem clique — mesmo motivo do `?qa=documentos`:
   * captura headless não tem cursor. Vive atrás de `import.meta.env.DEV` e some
   * do bundle de produção, como o resto do gancho.
   */
  React.useEffect(() => {
    if (qaParam === 'drawer' && diaDaUrl) setDiaDoDrawer(diaDaUrl)
  }, [diaDaUrl, qaParam])

  const hoje = paraIso(new Date())
  const inicio = inicioDoPeriodo(escala, ancora ?? hoje)
  const fim = fimDoPeriodo(escala, inicio)
  const unidade = unidadeDaEscala(escala)

  const { data, isPending, isError, error, refetch } = useDocuments(
    { ...filters, data_inicio: inicio, data_fim: fim },
    // O ano mais cheio do acervo tem 247 documentos; o teto da API é 500. Pedir
    // menos que o período inteiro truncaria a contagem das colunas em silêncio,
    // que é o pior defeito possível numa tela cuja função é contar.
    { limite: escala === 'semana' ? 200 : 500, offset: 0, ordenar_por: 'data', ordem: 'asc' },
  )

  const periodo = React.useMemo(
    () => agruparPeriodo(escala, inicio, data?.data?.itens ?? []),
    [escala, inicio, data?.data?.itens],
  )

  const limiteInferior = primeiroMes ? `${primeiroMes}-01` : null
  const limiteSuperior = ultimoMes ? `${ultimoMes}-31` : null
  // A semana aberta deixa de ser a de pico assim que o usuário navega.
  const naSemanaDePico = Boolean(
    escala === 'semana' && aterrissagem?.ehPico && aterrissagem.inicio === inicio,
  )
  const podeVoltar = !limiteInferior || inicio > limiteInferior
  const podeAvancar = !limiteSuperior || fim < limiteSuperior

  const passoSemana = React.useCallback(
    (direcao: -1 | 1) => {
      setAncora(passoDePeriodo(escala, inicio, direcao))
      setAlvoDeTravel(null)
      empurrar(direcao)
    },
    [empurrar, escala, inicio],
  )

  /**
   * Trocar de escala é ZOOM, não navegação.
   *
   * Sair da semana de 22/09 para o mês abre setembro; voltar para a semana
   * devolve a semana de 22/09, não a primeira do mês.
   *
   * Quando há uma coluna SELECIONADA, é ela que vira a âncora — e aí os botões
   * de escala passam a ser o gesto de aprofundar: escolher setembro no ano e
   * clicar em "Mês" abre setembro, não janeiro. Sem isso, descer do ano sempre
   * cairia no dia 1º e a seleção que a pessoa acabou de fazer seria ignorada.
   *
   * A seleção cai depois da troca porque a coluna deixou de existir: um dia não
   * é coluna do ano, um mês não é coluna da semana.
   */
  const trocarEscala = React.useCallback(
    (nova: EscalaTemporal) => {
      if (nova === escala) return
      setAncora((atual) => selecionado ?? atual ?? hoje)
      setEscala(nova)
      setSelecionado(null)
      setAlvoDeTravel(null)
      setDiaDoDrawer(null)
    },
    [escala, hoje, selecionado],
  )

  /**
   * Travel through time: quando o destino está longe, a interface percorre as
   * semanas intermediárias em vez de teleportar. A duração alvo fica entre
   * 700 e 1000 ms conforme a distância, e os passos são poucos o bastante para
   * não comprometer o frame rate.
   */
  const irParaSemana = React.useCallback(() => {
    if (!dataAlvo) return
    const destino = inicioDoPeriodo(escala, dataAlvo)
    const coluna = chaveDaColuna(escala, dataAlvo)
    if (destino === inicio) {
      setSelecionado(coluna)
      return
    }
    if (reduzido) {
      setAncora(dataAlvo)
      setSelecionado(coluna)
      setAlvoDeTravel(coluna)
      return
    }

    const periodosDeDistancia = distanciaEmPeriodos(escala, inicio, destino)
    const sentido = periodosDeDistancia > 0 ? 1 : -1
    const total = Math.abs(periodosDeDistancia)
    // Poucos passos, com desaceleração: a sensação vem do ritmo, não do número
    // de frames.
    const passos = Math.min(7, Math.max(2, Math.round(Math.log2(total + 1) * 2)))
    /**
     * Três faixas, como combinado: salto curto 300–500 ms, algumas semanas
     * 500–700, longo 700–1000. Nunca acima de 1 s — o usuário não pode esperar
     * pela animação.
     */
    const duracao =
      total <= 2
        ? 300 + total * 80
        : total <= 8
          ? 500 + (total - 2) * 33
          : Math.min(1000, 700 + (total - 8) * 10)

    // Os intervalos crescem (passo curto no começo, longo no fim = desaceleração),
    // mas normalizados: sem isso a soma dos pesos estourava a duração alvo e o
    // percurso levava ~1,4 s em vez dos 700–1000 ms combinados.
    const pesos = Array.from({ length: passos }, (_, i) => 0.55 + ((i + 1) / passos) * 0.9)
    const somaDosPesos = pesos.reduce((a, w) => a + w, 0)
    const intervalo = (i: number) => (pesos[i]! / somaDosPesos) * duracao

    setViajando(true)
    let passo = 0
    const avancar = () => {
      passo += 1
      const t = passo / passos
      // ease-out cúbico: cobre muita distância cedo e chega devagar
      const progresso = 1 - Math.pow(1 - t, 3)
      const periodosAndados = Math.round(total * progresso)
      setAncora(passoDePeriodo(escala, inicio, sentido * periodosAndados))
      empurrar(sentido)
      if (passo < passos) {
        window.setTimeout(avancar, intervalo(passo))
      } else {
        setAncora(dataAlvo)
        setSelecionado(coluna)
        setAlvoDeTravel(coluna)
        setViajando(false)
      }
    }
    window.setTimeout(avancar, intervalo(0))
  }, [dataAlvo, empurrar, escala, inicio, reduzido])

  const irParaHoje = React.useCallback(() => {
    const destino = inicioDoPeriodo(escala, hoje)
    setDataAlvo(hoje)
    setAncora((atual) => {
      const atualInicio = atual ? inicioDoPeriodo(escala, atual) : null
      if (atualInicio && atualInicio !== destino) empurrar(destino > atualInicio ? 1 : -1)
      return hoje
    })
    setSelecionado(null)
    setAlvoDeTravel(null)
  }, [empurrar, escala, hoje])

  /**
   * "Ver mais" NÃO troca de página.
   *
   * Navegar para o Acervo custava o contexto inteiro — semana, posição do
   * trilho, dia selecionado. O drawer mantém a Linha do Tempo atrás e fechar
   * devolve exatamente o estado anterior. A rota do Acervo continua existindo,
   * agora como saída explícita no pé do drawer.
   */
  const abrirDia = React.useCallback((iso: string, _docs: DocumentoResumo[]) => {
    setDiaDoDrawer(iso)
  }, [])

  const colunaDoDrawer = React.useMemo(
    () => (diaDoDrawer ? (periodo.colunas.find((c) => c.iso === diaDoDrawer) ?? null) : null),
    [diaDoDrawer, periodo.colunas],
  )

  const verNoAcervo = React.useCallback(() => {
    if (!colunaDoDrawer) return
    navigate(
      `/documentos${drillToSearch({
        ...filters,
        data_inicio: colunaDoDrawer.inicio,
        data_fim: colunaDoDrawer.fim,
      })}`,
    )
  }, [colunaDoDrawer, filters, navigate])

  /** Viaja até o período de uma data específica, na escala em uso. */
  const irParaDia = React.useCallback(
    (iso: string) => {
      setDataAlvo(iso)
      const destino = inicioDoPeriodo(escala, iso)
      const coluna = chaveDaColuna(escala, iso)
      if (destino === inicio) {
        setSelecionado(coluna)
        return
      }
      setAncora(iso)
      setSelecionado(coluna)
      setAlvoDeTravel(coluna)
      empurrar(destino > inicio ? 1 : -1)
    },
    [empurrar, escala, inicio],
  )

  /**
   * O encaixe do "ir para uma data" na barra de filtros do shell.
   *
   * Uma consulta so, no mount: a barra vive no `AppShell`, que ja esta em pe
   * quando esta pagina monta, e o no do encaixe nunca e desmontado - por isso
   * o retorno antecipado de `GlobalFilterBar` saiu. Sem essa garantia seria
   * preciso observar o DOM inteiro para reencontrar o alvo, e observador
   * permanente em `document.body` e exatamente o tipo de custo silencioso que
   * este projeto evita.
   */
  const [encaixeDaBarra, setEncaixeDaBarra] = React.useState<HTMLElement | null>(null)
  React.useEffect(() => {
    setEncaixeDaBarra(document.querySelector<HTMLElement>('[data-encaixe-barra-filtros]'))
  }, [])

  const vizinhos = React.useMemo(
    () => registrosVizinhos(dias, inicio, fim),
    [dias, fim, inicio],
  )

  return (
    <div
      // `data-limite-popover`: os popovers da timeline não podem sair desta
      // caixa. Sem ela, o Radix mede a JANELA, e a prévia do primeiro dia da
      // semana ia parar em cima da barra lateral.
      data-limite-popover
      className="relative -mx-6 -mb-7 -mt-7 flex min-h-[calc(100vh-7.5rem)] flex-col overflow-hidden
                 px-6 pb-4 pt-2 lg:-mx-9 lg:px-9"
    >
      <LegalVideoBackground />

      {/* --------------------------------------------- painel de vidro */}
      {/* A timeline começa CEDO na viewport. A versão anterior centralizava o
          painel num container `flex-1` com 9rem de reserva embaixo: o resultado
          era a experiência caída na metade inferior da tela, com um vão morto
          entre o título e o painel. Agora o painel nasce logo abaixo do
          cabeçalho e a reserva de baixo é só a que o card do node precisa —
          ele nasce ABAIXO do ponto, e sem espaço o Radix o vira para cima,
          cobrindo a própria pilha. */}
      {/* `data-area-grafico`: o limite de baixo que o gráfico pode ocupar —
          a caixa da página, não a da seção. Medir pela seção era o que
          espremia o gráfico em 108 px e deixava um terço da tela vazio
          embaixo: o teto de 600 px existe para a FAIXA da timeline não virar
          uma caverna, e não tem nada a ver com onde o gráfico pode chegar. */}
      <div data-area-grafico className="relative z-10 flex flex-1 flex-col pb-[5.5rem]">
      {/* Entrada por keyframe CSS (`reveal-up`), não por Motion.
          Animação de entrada em JS deixa o elemento preso em `initial` quando
          não roda — aba oculta, captura headless, `?static=1` — e o painel
          inteiro sumia com `opacity: 0`. O `reveal-up` do projeto tem estado de
          repouso VISÍVEL e já é desligado por `html.no-reveal`. */}
      {/* SEM painel de vidro. Não há mais fundo, desfoque, borda nem sombra
          aqui: a timeline pousa direto no ambiente, e o vídeo atravessa a tela
          inteira sem um retângulo azulado recortando o meio dela.

          O que segurava a legibilidade era o vidro. Agora são três coisas que
          não desenham bloco nenhum: o véu graduado do próprio vídeo, o
          contraste da tipografia (que subiu junto) e `sobre-ambiente` — uma
          sombra curta no texto, herdada por tudo aqui dentro, que separa letra
          de imagem sem pintar nada atrás.

          O teto de altura continua: sem ele a faixa estica até o pé da
          viewport e os dias ficam nadando num vão de 700 px. */}
      {/* Sem `overflow-hidden`: o gráfico é desenhado numa camada fora do
          fluxo que ATRAVESSA o rodapé da seção para alcançar a metade
          inferior da tela. O recorte do arraste continua onde sempre esteve,
          no viewport do trilho. */}
      <section className="reveal-up sobre-ambiente relative flex max-h-[600px] w-full flex-1
                          flex-col">
        {/* ------------------------------------------------- controles */}
        {/* `data-zona-segura` marca o fim do território proibido para os
            popovers. Tudo daqui para cima — título, subtítulo, barra de
            filtros, período, escala e "ir para uma data" — não pode ser
            coberto. `TimelineDay` mede a base deste bloco na abertura e passa
            o valor ao Radix como `collisionPadding.top`; quando a prévia não
            cabe acima do documento, ela vira para baixo em vez de invadir o
            cabeçalho. É medido, não fixado, porque a barra de filtros muda de
            altura quando ganha a linha de chips. */}
        <div
          data-zona-segura
          className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3
                     border-b border-white/[0.06] px-5 pb-3 pt-1"
        >
          {/* ---------------------------- período atual + volume (editorial)
              Um bloco só, não um KPI: o número vive dentro da frase que o
              qualifica. Subiu para a MESMA fileira dos controles quando o
              "ir para uma data" mudou de endereço — a fileira ficou com meia
              dúzia de botões de um lado e vazio do outro, e a semana em
              leitura é justamente o que pertence a esse vazio. Uma linha a
              menos aqui em cima é uma linha a mais de ambiente embaixo. */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="size-5 shrink-0 text-accent/70" />
              {/* O período troca com um deslocamento curto no MESMO sentido do
                  travel. É o detalhe que faz a troca parecer temporal em vez de
                  DOM substituído — e é 14 px, não um contador de cassino.

                  Keyframe CSS em elemento remontado por `key`, e não
                  `AnimatePresence`: com entrada/saída em JS, aba oculta deixava o
                  período ANTERIOR montado para sempre e a tela mostrava dois
                  períodos ao mesmo tempo. Sem saída não há o que travar. */}
              <h3
                key={inicio}
                className={cn(
                  'text-[1.3125rem] font-semibold tracking-tight text-white/92',
                  'transition-opacity duration-200',
                  viajando ? 'opacity-55' : 'opacity-100',
                  pulso.sentido < 0 ? 'periodo-da-esquerda' : 'periodo-da-direita',
                )}
              >
                {periodo.rotulo}
              </h3>
            </div>
            <p className="mt-1 pl-[1.9rem] text-[14.5px] leading-relaxed text-white/50">
              <span
                key={`${inicio}:${periodo.total}`}
                className="contagem-de-baixo inline-block tabular-nums font-semibold text-white/80"
              >
                {periodo.total}
              </span>{' '}
              {periodo.total === 1 ? 'documento' : 'documentos'}
              {naSemanaDePico ? (
                <> · <span className="text-accent/80">maior volume do acervo</span></>
              ) : null}
              {/* Só existe onde a coluna é um DIA. No ano a coluna é o mês, e
                  documento com precisão mensal cai exatamente onde deve. */}
              {periodo.semDiaDefinido.length > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="inline-flex items-baseline gap-1">
                    <AlertCircle className="size-3.5 shrink-0 translate-y-px text-white/35" />
                    {periodo.semDiaDefinido.length} com data só de mês, fora dos dias
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <TimelineToolbar
            escala={escala}
            onEscala={trocarEscala}
            unidade={unidade}
            onHoje={irParaHoje}
            onPassoSemana={passoSemana}
            podeVoltar={podeVoltar}
            podeAvancar={podeAvancar}
          />
        </div>

        {/* A faixa da timeline. O respiro acima não é vazio: é onde a prévia
            do documento nasce, e ela tem 400 px. O respiro abaixo é onde o card
            do node cresce. Com popover fechado a tela ainda precisa parecer
            completa — por isso o painel tem altura natural e não estica com vão
            dentro. */}
        <div className="flex flex-1 flex-col justify-center px-2 pb-6 pt-6">
          {isError ? (
            <div className="px-4 py-10">
              <ErrorState
                message={
                  error instanceof ApiError
                    ? error.message
                    : `Erro ao carregar ${unidade === 'ano' ? 'o ano' : unidade === 'mês' ? 'o mês' : 'a semana'}.`
                }
                action={
                  <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            </div>
          ) : isPending && !data ? (
            // Tantas colunas quantas o período terá: com sete fixas, trocar
            // para o ano mostrava sete blocos e depois saltava para doze.
            <div className="flex justify-center gap-0 overflow-hidden px-2">
              {Array.from({ length: periodo.colunas.length }).map((_, i) => (
                <div
                  key={i}
                  className="flex shrink-0 flex-col items-center gap-3"
                  style={{ width: escala === 'semana' ? 196 : escala === 'ano' ? 96 : 104 }}
                >
                  <Skeleton className="h-[136px] w-[88px]" />
                  <Skeleton className="size-3.5 rounded-full" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <LegalTimeline
              periodo={periodo}
              selecionado={selecionado}
              reduzido={reduzido}
              onSelecionar={(iso) => setSelecionado((a) => (a === iso ? null : iso))}
              onAbrirDia={abrirDia}
              onNavegarSemana={passoSemana}
              alvoDeTravel={alvoDeTravel}
              pulso={pulso}
              vazia={periodo.total === 0}
              qa={qa}
            >
              {periodo.total === 0 ? (
                <TimelineEmptyWeek vizinhos={vizinhos} unidade={unidade} onIr={irParaDia} />
              ) : null}
            </LegalTimeline>
          )}
        </div>
      </section>
      </div>

      <DayDocumentsDrawer
        iso={diaDoDrawer}
        titulo={colunaDoDrawer?.rotuloLongo ?? ''}
        documentos={colunaDoDrawer?.documentos ?? []}
        aberto={diaDoDrawer !== null}
        onFechar={() => setDiaDoDrawer(null)}
        onVerNoAcervo={verNoAcervo}
      />

      {/* O "ir para uma data" é desta página, mas aparece na barra de filtros
          do shell, no canto direito. Portal, e não estado compartilhado: assim
          o controle continua vivendo aqui — com o mesmo `dataAlvo`, o mesmo
          `irParaSemana` e nenhuma prop atravessando a árvore — e só o seu
          lugar no DOM muda. */}
      {encaixeDaBarra
        ? createPortal(
            <SaltoDeData
              dataAlvo={dataAlvo}
              onDataAlvo={setDataAlvo}
              onIrParaSemana={irParaSemana}
            />,
            encaixeDaBarra,
          )
        : null}
    </div>
  )
}
