/**
 * O trilho: a linha, os sete dias, o arraste e a navegação pelas bordas.
 *
 * A linha base fica na viewport (parada) e os dias deslizam sobre ela — assim
 * ela é contínua de ponta a ponta, inclusive sob os hotspots laterais. O brilho
 * local de hover, ao contrário, mora dentro do container que se move, para
 * acompanhar o dia sem precisar recalcular posição a cada frame.
 */

import { animate, motion, useMotionValue, useSpring } from 'motion/react'
import * as React from 'react'

import type { DocumentoResumo } from '@/lib/api'
import { cn } from '@/lib/utils'
import { alturaDaPilha, alturaDoArmario, armario, magnitude } from '../magnitude'
import type { Escala, PeriodoAgrupado } from '../escalas'
import type { Origem } from './TimelineDay'
import type { Foco } from './TimelineDay'
import { ALTURA_CONTAGEM, LARGURA_DIA, TimelineDay } from './TimelineDay'

import { TimelineChart } from './TimelineChart'
import { TimelineEdgeNavigation } from './TimelineEdgeNavigation'
import { DicaDeArraste } from './TimelineDragHint'

/** Altura da haste que liga a pilha ao node, em `TimelineDay`. */
const ALTURA_HASTE = 16
/** Altura da faixa do node (`h-8`), em `TimelineDay`. */
const ALTURA_NODE = 32

/**
 * A altura reservada vem da PRÓPRIA semana, não de uma constante.
 *
 * Reservar sempre a altura da maior pilha possível deixaria uma semana de dois
 * documentos com um vão enorme acima — foi o que aconteceu na primeira
 * renderização. O piso existe para a linha não subir demais em semanas magras.
 */
// Caiu de 168 para 104 com os renders do parecer: a resma e vista de uma
// camera baixa, entao ela e mais LARGA que alta. Manter o piso antigo deixava
// um vao de 100 px acima de toda pilha.
const PISO_MAGNITUDE = 104
/**
 * Folga acima da pilha mais alta da semana.
 *
 * Caiu de 34 para 10 quando a contagem ganhou linha própria: antes o rótulo
 * morava DENTRO desta faixa e precisava de espaço reservado aqui.
 */
const FOLGA_SUPERIOR = 10

function alturaDaFaixa(maior: number, arte: 'papel' | 'armario', escala: number): number {
  const base =
    arte === 'armario' ? alturaDoArmario(armario(maior)) : alturaDaPilha(magnitude(maior))
  return Math.round(Math.max(PISO_MAGNITUDE, base + FOLGA_SUPERIOR) * escala)
}

/**
 * Limites do tamanho da arte.
 *
 * A pilha acompanha a largura da coluna para manter a MESMA proporção
 * pilha/coluna em qualquer tela e em qualquer escala — é o que faz o mês
 * parecer a semana vista de mais longe, e não outro desenho.
 *
 * O teto existe porque um monitor ultralargo transformaria a semana em sete
 * pôsteres de papel; o piso, porque abaixo de 0,5x a espessura da resma deixa
 * de se ler e todas as magnitudes viram a mesma mancha.
 */
/**
 * A composição da metade de baixo.
 *
 * O gráfico não encosta nos rótulos dos dias nem no pé da tela: sobra um
 * respiro em cima e uma margem embaixo, e o que fica no meio é o desenho. Sem
 * o respiro ele lê como continuação da coluna; sem a margem, como se a página
 * tivesse sido cortada.
 */
const RESPIRO_ACIMA = 22
const MARGEM_ABAIXO = 34
/** Abaixo disto não há amplitude que valha a pena: melhor não desenhar. */
const ALTURA_MINIMA = 80
/** Acima disto a linha vira paisagem e rouba a cena dos documentos. */
const ALTURA_MAXIMA = 280

const ESCALA_MIN = 0.5
/**
 * O teto é por FAMÍLIA, não único.
 *
 * O armário tem quase o dobro da altura da pilha na mesma largura: deixá-lo
 * crescer 1,3x num monitor largo faria o ano reservar 260 px de faixa e a
 * timeline inteira descer. 1,0x já o entrega grande o bastante para as gavetas
 * se contarem.
 */
const ESCALA_MAX: Record<'papel' | 'armario', number> = { papel: 1.3, armario: 1 }

/**
 * Largura mínima de uma coluna de dia.
 *
 * Em desktop os SETE dias precisam estar visíveis ao mesmo tempo: exigir
 * arraste para chegar em sábado e domingo é esconder dois dias da semana.
 * Com `LARGURA_DIA` fixa em 212 px a semana pedia 1.484 px + folga, e em
 * 1440x900 sobram ~1.116 px na área útil — faltavam justamente dois dias.
 *
 * Então a coluna encolhe até caber, e só para de encolher aqui. 146 px ainda
 * acomodam a pilha mais larga (122 px na faixa `xl`) com respiro lateral; abaixo
 * disso as pilhas de dias vizinhos começariam a se tocar. Em telas menores que
 * isso o excedente volta a ser arrastável, como antes.
 */
const LARGURA_DIA_MIN = 146

/**
 * Largura mínima da coluna em cada escala.
 *
 * A semana tem uma promessa a cumprir: os SETE dias visíveis ao mesmo tempo em
 * 1440x900. O mês não tem como ter — 31 colunas de 146 px são 4.500 px, e
 * espremer o mês inteiro na tela daria 34 px por dia, onde nenhuma pilha de
 * papel se lê. Então o mês encolhe até 96 px e o excedente vira arraste, que é
 * o gesto que a própria faixa já ensina.
 *
 * O ano é o contrário: doze colunas CABEM, e ver o ano inteiro de uma vez é
 * exatamente o que se quer dele. 88 px é o piso que permite isso em 1440x900
 * sem que as pilhas dos meses vizinhos se toquem.
 */
const LARGURA_MIN_POR_ESCALA: Record<Escala, number> = {
  semana: LARGURA_DIA_MIN,
  // O mês é contado em semanas: são quatro a seis colunas, e todas cabem.
  mes: LARGURA_DIA_MIN,
  ano: 88,
}

/** `px-2` do trilho: 8 px de cada lado. */
const PADDING_TRILHO = 16

export function LegalTimeline({
  periodo,
  selecionado,
  reduzido,
  onSelecionar,
  onAbrirDia,
  onNavegarSemana,
  alvoDeTravel,
  pulso,
  vazia = false,
  qa,
  children,
}: {
  /** O período em leitura, já recortado em colunas por `escalas.ts`. */
  periodo: PeriodoAgrupado
  selecionado: string | null
  reduzido: boolean
  onSelecionar: (iso: string) => void
  onAbrirDia: (iso: string, docs: DocumentoResumo[]) => void
  onNavegarSemana: (direcao: -1 | 1) => void
  /** Dia que deve ser centralizado após um "ir para a data". */
  alvoDeTravel: string | null
  /**
   * Um passo de travel acabou de acontecer. `n` muda a cada passo; `sentido`
   * diz para onde. É o que faz o EIXO se mover, não só o conteúdo trocar.
   */
  pulso: { n: number; sentido: -1 | 0 | 1 }
  /** Período sem nenhum documento: o trilho continua, as pilhas não. */
  vazia?: boolean
  /** Gancho de QA, só em desenvolvimento. */
  qa?: { iso: string; foco: Foco } | null
  /** Empty state, desenhado sobre a faixa das pilhas. */
  children?: React.ReactNode
}) {
  const raizRef = React.useRef<HTMLDivElement>(null)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const trilhoRef = React.useRef<HTMLDivElement>(null)
  const [limites, setLimites] = React.useState({ left: 0, right: 0 })
  const larguraMinima = LARGURA_MIN_POR_ESCALA[periodo.escala]
  const [larguraDia, setLarguraDia] = React.useState(LARGURA_DIA)

  const x = useMotionValue(0)
  // A mola dá o peso: ao soltar a borda, o trilho ainda percorre alguns pixels.
  //
  // Com movimento reduzido a mola sai de cena por completo e o valor cru é
  // usado. Não é firula: uma mola de duração ~zero produz transform inválido e
  // o painel inteiro deixava de pintar em `?static=1`.
  const molaX = useSpring(x, { stiffness: 120, damping: 26, mass: 0.7 })
  const xSuave = reduzido ? x : molaX

  /**
   * Deslocamento do TRAVEL, separado do deslocamento do ARRASTE.
   *
   * Os dois não podem dividir o mesmo valor: o arraste guarda a posição em que
   * o usuário largou o trilho, e o travel precisa voltar a zero ao fim de cada
   * passo. Misturados, uma semana visitada durante o percurso herdava o offset
   * da anterior e o trilho ia embora para o lado.
   */
  const xTravel = useMotionValue(0)
  const primeiroPulso = React.useRef(true)
  React.useEffect(() => {
    if (primeiroPulso.current) {
      primeiroPulso.current = false
      return
    }
    if (reduzido || pulso.sentido === 0) return
    // Entra deslocado no sentido da viagem e assenta. Curto de propósito: são
    // até sete passos em sequência, e cada um precisa caber no ritmo do todo.
    xTravel.set(pulso.sentido * 64)
    const controle = animate(xTravel, 0, { duration: 0.26, ease: [0.16, 1, 0.3, 1] })
    return () => controle.stop()
  }, [pulso.n, pulso.sentido, reduzido, xTravel])

  const colunasComDocumento = periodo.colunas.filter((c) => c.total > 0).length
  const mediaSemanal = colunasComDocumento > 0 ? periodo.total / colunasComDocumento : 0
  const maiorDia = Math.max(0, ...periodo.colunas.map((c) => c.total))
  /**
   * Sobra de largura convertida em tamanho de papel.
   *
   * `LARGURA_DIA_MIN` e a coluna mais estreita que ainda acomoda a pilha mais
   * larga com respiro, na semana. Toda largura acima disso e folga, e a folga
   * vira arte maior em vez de vao vazio entre as colunas; toda largura ABAIXO
   * — que e o caso do mes e do ano — encolhe a arte na mesma proporcao, em vez
   * de deixar as pilhas se tocarem.
   */
  const arte = periodo.colunas[0]?.arte ?? 'papel'
  const escalaArte = Math.min(
    ESCALA_MAX[arte],
    Math.max(ESCALA_MIN, larguraDia / LARGURA_DIA_MIN),
  )
  const alturaMagnitude = alturaDaFaixa(maiorDia, arte, escalaArte)
  /**
   * Onde a linha de base cruza a coluna: contagem + magnitude + haste + metade
   * da faixa do node. Se esta conta sair errada, a linha passa acima ou abaixo
   * dos pontos e a semana inteira parece desalinhada.
   */
  const offsetTrilho = ALTURA_CONTAGEM + alturaMagnitude + ALTURA_HASTE + ALTURA_NODE / 2

  /**
   * Largura da coluna e limites do arraste, na mesma medição.
   *
   * O excedente é calculado ARITMETICAMENTE a partir da largura que acabou de
   * ser escolhida, e não lido de `scrollWidth`. Ler o DOM aqui criaria um laço:
   * o `ResizeObserver` dispara, a largura muda, o trilho redimensiona, o
   * observer dispara de novo — e o primeiro quadro ainda usaria a largura
   * antiga.
   */
  const quantidadeDeDias = periodo.colunas.length
  const medir = React.useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const disponivel = vp.clientWidth - PADDING_TRILHO
    const largura = Math.max(
      larguraMinima,
      Math.min(LARGURA_DIA, Math.floor(disponivel / Math.max(1, quantidadeDeDias))),
    )
    setLarguraDia(largura)

    const larguraDoTrilho = quantidadeDeDias * largura + PADDING_TRILHO
    const excedente = Math.max(0, larguraDoTrilho - vp.clientWidth)
    setLimites({ left: -excedente, right: 0 })
    if (x.get() < -excedente) x.set(-excedente)
  }, [larguraMinima, quantidadeDeDias, x])

  React.useEffect(() => {
    medir()
    const ro = new ResizeObserver(medir)
    if (viewportRef.current) ro.observe(viewportRef.current)
    if (trilhoRef.current) ro.observe(trilhoRef.current)
    return () => ro.disconnect()
  }, [medir, periodo.inicio])

  // Ao trocar de período, volta ao início sem salto visível.
  React.useEffect(() => {
    x.set(0)
  }, [periodo.inicio, x])

  // Travel: centraliza o dia de destino depois que a semana trocou.
  React.useEffect(() => {
    if (!alvoDeTravel) return
    const vp = viewportRef.current
    const alvo = trilhoRef.current?.querySelector<HTMLElement>(`[data-dia="${alvoDeTravel}"]`)
    if (!vp || !alvo) return
    const centroAlvo = alvo.offsetLeft + alvo.offsetWidth / 2
    const destino = Math.min(0, Math.max(limites.left, vp.clientWidth / 2 - centroAlvo))
    x.set(destino)
  }, [alvoDeTravel, limites.left, x])

  const arrastavel = limites.left < 0
  const [arrastando, setArrastando] = React.useState(false)

  /**
   * Qual coluna está sob atenção — do cursor na pilha, no ponto, ou no gráfico
   * lá embaixo. Mora AQUI, e não dentro de cada coluna, porque é estado
   * compartilhado: é ele que faz o gráfico acender a coluna e a coluna acender
   * o ponto do gráfico sem duplicar lógica de hover em três lugares.
   */
  const [ativa, setAtiva] = React.useState<{ iso: string; origem: Origem } | null>(null)
  const marcarAtiva = React.useCallback((iso: string, ligado: boolean, origem: Origem) => {
    // Sair de uma coluna não pode apagar a que acabou de entrar: ao atravessar
    // de uma para a vizinha, o `enter` da nova chega antes do `leave` da velha.
    setAtiva((atual) => (ligado ? { iso, origem } : atual?.iso === iso ? null : atual))
  }, [])
  const isoAtivo = ativa?.iso ?? null

  /**
   * A chave que dispara o redesenho, atrasada de propósito.
   *
   * Uma viagem no tempo atravessa até sete períodos em menos de um segundo. Se
   * cada um deles remontasse a entrada, a tela piscaria sete vezes e nenhuma
   * das animações chegaria ao fim. Só o período que ASSENTA dispara a
   * revelação.
   */
  const chaveDoPeriodo = `${periodo.escala}:${periodo.inicio}`
  const [chaveEstavel, setChaveEstavel] = React.useState(chaveDoPeriodo)
  React.useEffect(() => {
    const t = window.setTimeout(() => setChaveEstavel(chaveDoPeriodo), 140)
    return () => window.clearTimeout(t)
  }, [chaveDoPeriodo])

  /**
   * Altura do gráfico: a metade de baixo da tela, medida.
   *
   * A timeline não se mexe para abrir espaço — o gráfico ocupa a folga que já
   * existia embaixo dela, que é MUITO maior do que a primeira versão supunha:
   * medindo até o rodapé da seção ele ficava com 108 px e deixava ~150 px de
   * tela morta por baixo. Agora a região vai do fim do trilho até o pé da
   * página, e dentro dela o gráfico fica composto: um respiro em cima, a
   * margem embaixo, e ele no meio.
   *
   * Em janela baixa encolhe antes de qualquer outra coisa e, se nem assim
   * couber, não aparece: melhor não existir do que espremer a timeline ou
   * criar rolagem nova.
   */
  const [alturaDoGrafico, setAlturaDoGrafico] = React.useState(0)
  /**
   * Quando a região é mais alta do que o gráfico precisa, a sobra não fica
   * toda embaixo: ela se divide, e o desenho fica composto no meio da metade
   * inferior. Em 1920x1080 a diferença é de 220 px de vazio no pé da tela para
   * pouco mais de 100 px em cada lado.
   */
  const [respiroDoGrafico, setRespiroDoGrafico] = React.useState(RESPIRO_ACIMA)
  React.useEffect(() => {
    const medirFolga = () => {
      const raiz = raizRef.current
      const area = raiz?.closest<HTMLElement>('[data-area-grafico]')
      if (!raiz || !area) return
      const folga = area.getBoundingClientRect().bottom - raiz.getBoundingClientRect().bottom
      // Em tela baixa as margens cedem antes do desenho: 12 px de respiro valem
      // menos que 12 px de amplitude quando a régua inteira tem 190.
      const apertado = folga < 240
      const respiroAcima = apertado ? 18 : RESPIRO_ACIMA
      const margemAbaixo = apertado ? 26 : MARGEM_ABAIXO
      const util = Math.round(folga - respiroAcima - margemAbaixo)
      const altura = util < ALTURA_MINIMA ? 0 : Math.min(ALTURA_MAXIMA, util)
      setAlturaDoGrafico(altura)
      setRespiroDoGrafico(respiroAcima + Math.max(0, Math.round((util - altura) / 2)))
    }
    medirFolga()
    const ro = new ResizeObserver(medirFolga)
    if (raizRef.current) ro.observe(raizRef.current)
    const area = raizRef.current?.closest<HTMLElement>('[data-area-grafico]')
    if (area) ro.observe(area)
    // O `resize` da janela entra junto: o ResizeObserver depende do ciclo de
    // renderização, e em aba que não está desenhando ele simplesmente não é
    // entregue — a folga ficaria congelada no valor da janela anterior.
    window.addEventListener('resize', medirFolga)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', medirFolga)
    }
  }, [periodo.inicio, periodo.escala, alturaMagnitude])

  /**
   * Ao soltar, encosta na coluna mais próxima.
   *
   * Sem isto o trilho parava no meio de um dia e a semana ficava desalinhada
   * com o eixo. O snap é curto e sem mola: mola aqui brigaria com a inércia do
   * próprio arraste e produziria o efeito elástico que não queremos.
   */
  const encaixar = React.useCallback(() => {
    setArrastando(false)
    if (reduzido || !arrastavel) return
    const atual = x.get()
    const alvo = Math.min(
      limites.right,
      Math.max(limites.left, Math.round(atual / larguraDia) * larguraDia),
    )
    if (Math.abs(alvo - atual) < 1) return
    animate(x, alvo, { duration: 0.22, ease: [0.16, 1, 0.3, 1] })
  }, [arrastavel, larguraDia, limites.left, limites.right, reduzido, x])

  return (
    <div ref={raizRef} className="relative">
      {/* -------------------------------------------------- linha base */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-0"
        style={{ top: offsetTrilho }}
      >
        {/* Duas camadas. O fio de 1 px dá a linha; o halo de 3 px logo abaixo
            dá a ela espessura ótica sem engrossar o traço. Sozinho, o fio
            sumia contra o vídeo e o eixo virava um divisor esquecido. */}
        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 7%,' +
              ' rgba(255,255,255,0.38) 50%, rgba(255,255,255,0.22) 93%, transparent 100%)',
          }}
        />
        <div
          className="h-[3px] w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 20%,' +
              ' rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.05) 80%, transparent 100%)',
            filter: 'blur(2px)',
          }}
        />
      </div>

      {/* ------------------------------------------------------ viewport */}
      <div
        ref={viewportRef}
        className={cn(
          'relative overflow-hidden',
          arrastavel && (arrastando ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        {/* Camada do TRAVEL. Envolve o trilho arrastável e tem valor próprio:
            é o eixo inteiro que se desloca a cada passo da viagem. */}
        <motion.div style={{ x: xTravel }}>
        <motion.div
          ref={trilhoRef}
          drag={arrastavel && !reduzido ? 'x' : false}
          dragConstraints={limites}
          dragElastic={0.035}
          dragMomentum={!reduzido}
          // `power` mais baixo e `timeConstant` mais curto que o padrão: a
          // inércia existe para dar peso, não para o trilho sair viajando.
          dragTransition={{ power: 0.2, timeConstant: 240, bounceStiffness: 300, bounceDamping: 36 }}
          onDragStart={() => setArrastando(true)}
          onDragEnd={encaixar}
          style={{ x: xSuave }}
          // `mx-auto` só quando cabe tudo: com `w-max` o trilho é do tamanho do
          // conteúdo, e sem isto a semana inteira ficava encostada à esquerda
          // num painel largo, com o vão todo à direita.
          className={cn('flex w-max items-start gap-0 px-2', !arrastavel && 'mx-auto')}
        >
          {periodo.colunas.map((coluna, i) => (
            <TimelineDay
              key={`${chaveEstavel}:${coluna.iso}`}
              ordem={i}
              coluna={coluna}
              selecionado={selecionado === coluna.iso}
              mediaSemanal={mediaSemanal}
              reduzido={reduzido}
              alturaMagnitude={alturaMagnitude}
              largura={larguraDia}
              escala={escalaArte}
              focoForcado={qa?.iso === coluna.iso ? qa.foco : undefined}
              ativa={isoAtivo === coluna.iso}
              atenuada={isoAtivo !== null && isoAtivo !== coluna.iso}
              onAtiva={marcarAtiva}
              onSelecionar={() => onSelecionar(coluna.iso)}
              onAbrirDia={(docs) => onAbrirDia(coluna.iso, docs)}
            />
          ))}
        </motion.div>
        </motion.div>

        {/* Empty state: mora sobre a faixa das pilhas, com o eixo visível
            atrás. Não é modal e não substitui a semana. */}
        {vazia && children ? (
          <div
            className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
            // Começa DEPOIS da faixa das contagens: centrado no conjunto, o
            // texto caía exatamente sobre os sete traços de "dia sem
            // documento" e os dois se atrapalhavam.
            style={{ top: ALTURA_CONTAGEM, height: alturaMagnitude }}
          >
            {children}
          </div>
        ) : null}

        {/* hotspots laterais: aceleração progressiva conforme a proximidade */}
        <TimelineEdgeNavigation
          x={x}
          limites={limites}
          alvoRef={viewportRef}
          reduzido={reduzido}
          onFimDaBorda={onNavegarSemana}
          larguraDia={larguraDia}
        />

        <DicaDeArraste ativa={arrastavel && !reduzido} jaArrastou={arrastando} />
      </div>

      {/* O gráfico: mesma grade, mesmos valores de movimento, nenhuma caixa.
          Fica FORA do fluxo — a timeline acima não se move um pixel por causa
          dele. */}
      {/* Período vazio também desenha: a linha no chão diz "nada aconteceu"
          com a mesma voz do resto. Some-la a cada semana sem documento faria a
          composição piscar enquanto se navega. */}
      {alturaDoGrafico > 0 ? (
        <TimelineChart
          colunas={periodo.colunas}
          larguraDia={larguraDia}
          altura={alturaDoGrafico}
          respiro={respiroDoGrafico}
          x={xSuave}
          xTravel={xTravel}
          arrastavel={arrastavel}
          ativa={isoAtivo}
          // O tooltip pequeno só existe quando a atenção nasceu NO gráfico.
          // Vinda da timeline, quem informa é o card de contexto — dois cards
          // dizendo a mesma coisa, um sobre o outro, é o que se quer evitar.
          mostrarTooltip={ativa?.origem === 'grafico'}
          onAtiva={marcarAtiva}
          reduzido={reduzido}
          chave={chaveEstavel}
        />
      ) : null}
    </div>
  )
}
