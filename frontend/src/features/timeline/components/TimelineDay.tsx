/**
 * Uma coluna de dia: contagem, magnitude documental, haste, node e data.
 *
 * A coluna é lida de cima para baixo como uma frase:
 *
 *     10 docs          <- contagem, em linha própria e altura FIXA
 *     [pilha]          <- magnitude, apoiada numa base comum
 *        │             <- haste: é ela que amarra o documento ao tempo
 *     ───●───          <- node sobre o trilho
 *      Ter 23 set      <- o ponto no calendário
 *
 * Três alvos de interação distintos e deliberadamente diferentes:
 *   - a pilha/folha  -> prévia dos documentos
 *   - o node         -> card analítico do dia
 *   - a data         -> seleciona o dia
 *
 * Hover é temporário; seleção é persistente. Passar o mouse em outro dia não
 * tira a seleção de quem está selecionado — por isso os dois estados vivem em
 * props separadas e nunca são derivados um do outro. `foco` é um estado só,
 * com três valores excludentes, o que torna impossível os dois popovers
 * abrirem ao mesmo tempo.
 *
 * Os dois popovers usam Radix com Portal. Não é preciosismo: o trilho e o
 * painel de vidro têm `overflow-hidden` (o primeiro para recortar o arraste, o
 * segundo pelo canto arredondado), e sem o portal a prévia era **recortada**.
 * De quebra vêm o reposicionamento automático nas bordas — o primeiro e o
 * último dia da semana — mais Esc e gestão de foco.
 */

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'

import type { DocumentoResumo } from '@/lib/api'
import { cn } from '@/lib/utils'
import { armario, magnitude } from '../magnitude'
import type { Coluna } from '../escalas'
import type { Foco } from '../useFocoComCarencia'
import { useFocoComCarencia } from '../useFocoComCarencia'
import { ArmarioDoPeriodo, LegalDocumentStack, SingleLegalDocument } from './LegalDocumentStack'
import {
  DocumentPreviewCard,
  MultiDocumentPreviewCard,
  vidroDoPopover,
} from './DocumentPreviewPopover'
import { PeriodInfoCard } from './PeriodInfoPopover'

export const LARGURA_DIA = 244

/** Altura fixa da faixa da contagem. Ver `ALTURA_CONTAGEM` no uso. */
export const ALTURA_CONTAGEM = 26

export type { Foco } from '../useFocoComCarencia'

/** De onde veio a atenção: do próprio trilho ou do gráfico lá embaixo. */
export type Origem = 'timeline' | 'grafico'

/**
 * Onde o popover NÃO pode chegar. Os quatro lados, em coordenadas de viewport,
 * porque é essa a referência do `collisionPadding` do Radix.
 *
 * TOPO — o elemento `data-zona-segura` é o bloco de controles; tudo dele para
 * cima (título, subtítulo, barra de filtros, período, escala e "ir para uma
 * data") é território proibido. Quando a prévia não cabe acima do documento, o
 * Radix vira para baixo sozinho em vez de cobrir o cabeçalho.
 *
 * LATERAIS — vêm de `data-limite-popover`, a área da própria página. Sem isso
 * o primeiro dia da semana empurrava a prévia para a esquerda até ela pousar
 * SOBRE A BARRA LATERAL: o padrão do Radix mede a janela, e a janela inclui o
 * menu. E a barra lateral recolhe, então o valor não pode ser constante.
 *
 * Tudo medido na abertura, nunca fixado: a zona muda de altura quando a barra
 * de filtros ganha a linha de chips, e de largura quando o menu recolhe.
 */
const LIMITES_PADRAO = { top: 300, right: 24, bottom: 20, left: 24 }

function useLimitesSeguros(aberto: boolean) {
  const [limites, setLimites] = React.useState(LIMITES_PADRAO)
  React.useEffect(() => {
    if (!aberto) return
    const cabecalho = document.querySelector('[data-zona-segura]')
    const pagina = document.querySelector('[data-limite-popover]')
    const caixa = pagina?.getBoundingClientRect()
    setLimites({
      top: cabecalho
        ? Math.round(cabecalho.getBoundingClientRect().bottom) + 14
        : LIMITES_PADRAO.top,
      right: caixa ? Math.max(16, Math.round(window.innerWidth - caixa.right) + 8) : 24,
      // 24, não 20: o card do node encostava a ~4 px do rodapé em 1440x900, e
      // 4 px de folga lê como corte, não como respiro.
      bottom: 24,
      left: caixa ? Math.max(16, Math.round(caixa.left) + 8) : 24,
    })
  }, [aberto])
  return limites
}

/** Casca comum: portal, posicionamento, zona segura e o vidro local mais denso. */
function PopoverFlutuante({
  aberto,
  aoFechar,
  lado,
  gatilho,
  children,
  conector,
  aoEntrar,
  aoSair,
}: {
  aberto: boolean
  aoFechar: () => void
  /** Lado PREFERIDO. O Radix vira quando nao cabe; o CSS acompanha. */
  lado: 'top' | 'bottom'
  gatilho: React.ReactNode
  children: React.ReactNode
  conector?: boolean
  /** O cursor entrou no card: cancela o fechamento agendado pelo gatilho. */
  aoEntrar?: () => void
  /** O cursor saiu do card: agenda o fechamento. */
  aoSair?: () => void
}) {
  const limites = useLimitesSeguros(aberto)

  return (
    <PopoverPrimitive.Root open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <PopoverPrimitive.Trigger asChild>{gatilho}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal forceMount>
        <PopoverPrimitive.Content
          forceMount
          side={lado}
          align="center"
          sideOffset={conector ? 0 : 12}
          // `collisionPadding` assimétrico e MEDIDO: o topo protege o
          // cabeçalho, as laterais mantêm a prévia dentro da área da página
          // (fora da barra lateral) e a base dá folga para a nota de rodapé.
          collisionPadding={limites}
          // Sem isto, Radix só tenta o lado oposto. Com as quatro opções, um
          // dia na ponta esquerda abre para a direita em vez de espremer.
          avoidCollisions
          sticky="always"
          // Hover não deve roubar o foco do teclado.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="group pointer-events-none z-[60]"
        >
          {/* Entrada por keyframe CSS, não por Motion.
              Com `initial={{opacity:0}}` em JS o popover fica preso invisível
              sempre que a animação não roda — foi o que aconteceu em
              `?static=1` e na captura headless. O keyframe tem estado final
              garantido; o preço é não ter animação de saída, e 120 ms de fade
              de saída não valem o risco de a prévia sumir. */}
          {/* A classe de entrada e a ordem da haste seguem o lado RESOLVIDO pelo
              Radix (`data-side`), não o lado pedido. Quando a prévia não cabe
              acima da pilha e vira para baixo, sem isto ela animava para o lado
              errado e a haste saía do topo do card em vez da base. */}
          {aberto ? (
            <div
              onMouseEnter={aoEntrar}
              onMouseLeave={aoSair}
              className="pointer-events-auto flex flex-col items-center
                         group-data-[side=top]:flex-col-reverse
                         group-data-[side=top]:pop-de-baixo
                         group-data-[side=bottom]:pop-de-cima"
            >
              {conector ? (
                /* A haste que sai do node e encosta no card. É o que faz o
                   card pertencer ao ponto em vez de flutuar perto dele. */
                <span
                  aria-hidden
                  className="h-[18px] w-px shrink-0"
                  style={{
                    background:
                      'linear-gradient(180deg, hsl(var(--accent) / 0.9) 0%,' +
                      ' hsl(var(--accent) / 0.22) 100%)',
                  }}
                />
              ) : null}
              <div
                className="overflow-hidden rounded-xl border border-white/10
                           shadow-[0_28px_70px_-18px_rgba(0,0,0,0.92)]"
                style={vidroDoPopover}
              >
                {children}
              </div>
            </div>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export function TimelineDay({
  coluna,
  selecionado,
  mediaSemanal,
  reduzido,
  alturaMagnitude,
  largura = LARGURA_DIA,
  escala = 1,
  focoForcado,
  ativa = false,
  atenuada = false,
  ordem = 0,
  onAtiva,
  onSelecionar,
  onAbrirDia,
}: {
  /**
   * A coluna. Um dia na semana e no mes; um mes inteiro no ano — e nada aqui
   * precisa saber qual dos tres, porque a diferenca ja foi resolvida em
   * `escalas.ts`: chegam rotulos prontos e documentos ja distribuidos.
   */
  coluna: Coluna
  selecionado: boolean
  mediaSemanal: number
  reduzido: boolean
  /** Reservada pela semana inteira, para as colunas alinharem sem salto. */
  alturaMagnitude: number
  /**
   * Largura da coluna, medida pelo trilho. `LARGURA_DIA` e o teto; em telas
   * onde os sete dias nao caberiam, a coluna encolhe ate caber em vez de
   * empurrar sabado e domingo para fora da viewport.
   */
  largura?: number
  /**
   * Quanto a ARTE cresce alem do tamanho base, medido pelo trilho.
   *
   * A tipografia subiu por valor fixo - letra maior custa alguns pixels e cabe
   * em qualquer largura. O papel nao: a pilha `xl` tem 128 px de base numa
   * coluna de 146, e crescer por valor fixo faria as pilhas de dias vizinhos
   * se tocarem exatamente onde a tela e mais estreita. Entao ela cresce com a
   * COLUNA: em 1440x900, onde os sete dias mal cabem, fica praticamente no
   * tamanho de hoje; num monitor largo chega a 1,3x. A proporcao pilha/coluna
   * e a mesma nos dois casos.
   */
  escala?: number
  /**
   * Abre um popover sem hover. Só existe em desenvolvimento, alimentado por
   * `?qa=` — é o que permite capturar os estados de hover em resolução cheia,
   * já que captura headless não tem cursor. Some do bundle de produção.
   */
  focoForcado?: Foco
  /**
   * Atencao vinda de FORA - hoje, do grafico la embaixo. Acende a coluna sem
   * abrir popover nenhum: quem esta com o cursor no grafico nao pediu para ver
   * o card daqui de cima.
   */
  ativa?: boolean
  /** Outra coluna esta em foco: esta recua um pouco, sem sumir do contexto. */
  atenuada?: boolean
  /** Posição na fileira: define o atraso da entrada em cascata. */
  ordem?: number
  /** Avisa quem coordena que o cursor entrou ou saiu desta coluna. */
  onAtiva?: (iso: string, ligado: boolean, origem: Origem) => void
  onSelecionar: () => void
  onAbrirDia: (docs: DocumentoResumo[]) => void
}) {
  /**
   * Fechamento com carência: sair do gatilho agenda, entrar no card cancela.
   * A máquina de estado e o porquê dela vivem em `useFocoComCarencia`.
   */
  const { foco: focoLocal, abrir, agendarFechamento, cancelarFechamento, fecharAgora } =
    useFocoComCarencia()
  const foco: Foco = focoForcado ?? focoLocal
  const nodeRef = React.useRef<HTMLButtonElement>(null)
  /**
   * Espaço real abaixo do node, medido quando o card abre.
   *
   * O card não tem para onde virar — acima dele está a zona segura do
   * cabeçalho —, então em janela baixa a saída é ele encolher, não transbordar.
   * Medir é melhor que escolher um ponto de corte por largura: o que aperta
   * aqui é ALTURA, e altura não se deduz da largura.
   */
  const [compacto, setCompacto] = React.useState(false)
  const base = React.useMemo(() => magnitude(coluna.total), [coluna.total])
  const m = React.useMemo(
    () => (escala === 1 ? base : { ...base, largura: Math.round(base.largura * escala) }),
    [base, escala],
  )
  /**
   * O móvel do ano. Mesma regra de escala do papel: a largura acompanha a
   * coluna, e a altura vem da razão do próprio render.
   */
  const arm = React.useMemo(() => {
    const a = armario(coluna.total)
    return escala === 1 ? a : { ...a, largura: Math.round(a.largura * escala) }
  }, [coluna.total, escala])
  const vazio = coluna.total === 0
  const mola = reduzido
    ? ({ duration: 0.12 } as const)
    : ({ type: 'spring', stiffness: 380, damping: 26 } as const)

  const emDocumento = foco === 'documentos'
  const emNode = foco === 'node'

  /** Tamanho de repouso do ponto. Ver o comentário no `span` do node. */
  const tamanhoDoPonto = selecionado ? 15 : emNode ? 14 : vazio ? 7 : 11

  React.useEffect(() => {
    if (!emNode) return
    const r = nodeRef.current?.getBoundingClientRect()
    if (!r) return
    setCompacto(window.innerHeight - r.bottom < 300)
  }, [emNode])
  /** Qualquer atenção sobre a coluna acende a haste e o trecho de trilho. */
  const aceso = emDocumento || emNode || selecionado || ativa

  /**
   * O hover desta coluna vira estado compartilhado.
   *
   * Compara com o valor anterior antes de avisar: sem isso, toda coluna
   * dispararia um aviso na montagem e o grafico acenderia sozinho.
   */
  const focoAnterior = React.useRef<Foco>('nenhum')
  React.useEffect(() => {
    if (foco === focoAnterior.current) return
    focoAnterior.current = foco
    onAtiva?.(coluna.iso, foco !== 'nenhum', 'timeline')
  }, [coluna.iso, foco, onAtiva])

  return (
    <div
      /**
       * Entrada em cascata, da esquerda para a direita.
       *
       * 42 ms entre colunas: o bastante para o olho ler uma direção, pouco o
       * bastante para não virar slide de apresentação. Keyframe em CSS com
       * estado de repouso visível — se a animação não rodar, a coluna aparece
       * inteira, que é a regra que este projeto aprendeu a duras penas.
       */
      className={cn(
        'relative flex shrink-0 flex-col items-center transition-opacity duration-200',
        !reduzido && 'coluna-entrando',
      )}
      style={{
        width: largura,
        opacity: atenuada ? 0.74 : 1,
        animationDelay: reduzido ? undefined : `${ordem * 42}ms`,
      }}
      data-dia={coluna.iso}
    >
      {/* ------------------------------------------------ luz da seleção
          Um gradiente vertical sem borda e sem canto — NÃO uma caixa. A
          versão anterior desenhava um retângulo arredondado de 1 px de borda
          em volta da coluna inteira, e o dia selecionado lia como card
          destacado dentro de uma lista de cards. O que se quer é o oposto:
          a coluna continua sendo coluna, só recebe luz. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-300"
        style={{
          bottom: 0,
          opacity: selecionado ? 1 : 0,
          background:
            'linear-gradient(180deg, transparent 0%, hsl(var(--accent) / 0.035) 46%,' +
            ' hsl(var(--accent) / 0.085) 78%, transparent 100%)',
        }}
      />

      {/* ------------------------------------------------------- contagem
          Linha própria, altura fixa. Enquanto o rótulo dividia a faixa com a
          pilha, cada dia punha o seu numa altura diferente — pilha alta
          empurrava o número para cima — e sete números desalinhados destroem
          a leitura horizontal da semana.

          Dia vazio não repete "sem documentos" sete vezes; o leitor de tela
          continua informado pelo `aria-label` do node. */}
      <div
        className="flex w-full shrink-0 items-end justify-center"
        style={{ height: ALTURA_CONTAGEM }}
      >
        {/* Mesma regra do ponto: a cor de repouso é CSS. Aqui o risco era
            menor — cor não some, herda —, mas duas gramáticas diferentes para
            a mesma coisa é como um defeito volta. */}
        <span
          className="text-[15px] font-semibold tabular-nums leading-none transition-colors duration-150"
          style={{
            color: selecionado
              ? 'hsl(var(--accent))'
              : emDocumento
                ? 'rgba(255,255,255,0.96)'
                : vazio
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(255,255,255,0.66)',
          }}
        >
          {vazio ? '—' : m.rotulo}
        </span>
      </div>

      {/* --------------------------------------------- magnitude documental */}
      <div
        className="relative flex w-full flex-col items-center justify-end"
        style={{ height: alturaMagnitude }}
      >
        {vazio ? (
          <span
            aria-hidden
            className="mb-1 h-px w-12 rounded-full transition-colors duration-200"
            style={{ background: aceso ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)' }}
          />
        ) : (
          <PopoverFlutuante
            aberto={emDocumento}
            aoFechar={fecharAgora}
            aoEntrar={cancelarFechamento}
            aoSair={agendarFechamento}
            lado="top"
            gatilho={
              <motion.button
                type="button"
                onMouseEnter={() => abrir('documentos')}
                onMouseLeave={agendarFechamento}
                onFocus={() => abrir('documentos')}
                onBlur={agendarFechamento}
                onClick={() => onAbrirDia(coluna.documentos)}
                aria-label={`${coluna.total === 1 ? '1 documento' : `${coluna.total} documentos`} em ${coluna.rotuloLongo}`}
                animate={{
                  // Selecionado também sobe, mas menos: é estado de repouso,
                  // não de atenção. Hover em cima de selecionado soma.
                  y: emDocumento ? -9 : ativa ? -6 : selecionado ? -3 : 0,
                  scale: emDocumento ? 1.045 : ativa ? 1.03 : 1,
                }}
                transition={mola}
                className="mb-0.5 cursor-pointer rounded-md outline-none
                           focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4
                           focus-visible:ring-offset-transparent"
              >
                {coluna.arte === 'armario' ? (
                  <ArmarioDoPeriodo a={arm} realce={emDocumento || ativa} luz="accent" />
                ) : coluna.total === 1 ? (
                  <SingleLegalDocument largura={m.largura} realce={emDocumento || ativa} />
                ) : (
                  <LegalDocumentStack m={m} realce={emDocumento || ativa} />
                )}
              </motion.button>
            }
          >
            {coluna.total === 1 && coluna.documentos[0] ? (
              <DocumentPreviewCard doc={coluna.documentos[0]} />
            ) : (
              <MultiDocumentPreviewCard
                docs={coluna.documentos}
                total={coluna.total}
                onVerTodos={() => onAbrirDia(coluna.documentos)}
              />
            )}
          </PopoverFlutuante>
        )}
      </div>

      {/* ------------------------------------------------------------ haste
          A conexão documento -> tempo. Quase invisível em repouso: ela não é
          informação, é gramática. Só existe para o olho não ter de adivinhar
          a qual ponto do trilho aquela pilha pertence. */}
      <span
        aria-hidden
        className="w-px shrink-0 transition-all duration-200"
        style={{
          height: 16,
          background: selecionado
            ? 'linear-gradient(180deg, hsl(var(--accent) / 0.10) 0%, hsl(var(--accent) / 0.75) 100%)'
            : aceso
              ? 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.40) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.13) 100%)',
        }}
      />

      {/* -------------------------------------------------------------- node */}
      <div className="relative z-20 flex h-8 w-full items-center justify-center">
        {/* Trecho local do trilho. A linha de base atravessa a semana inteira
            lá no `LegalTimeline`; este segmento acende só em volta do dia em
            atenção, e é o que faz o eixo reagir em vez de ser um divisor. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2
                     transition-opacity duration-250"
          style={{
            opacity: aceso ? 1 : 0,
            background: selecionado
              ? 'linear-gradient(90deg, transparent 4%, hsl(var(--accent) / 0.55) 50%, transparent 96%)'
              : 'linear-gradient(90deg, transparent 6%, rgba(255,255,255,0.50) 50%, transparent 94%)',
          }}
        />

        <PopoverFlutuante
          aberto={emNode}
          aoFechar={fecharAgora}
          aoEntrar={cancelarFechamento}
          aoSair={agendarFechamento}
          lado="bottom"
          conector
          gatilho={
            <button
              ref={nodeRef}
              type="button"
              onMouseEnter={() => abrir('node')}
              onMouseLeave={agendarFechamento}
              onFocus={() => abrir('node')}
              onBlur={agendarFechamento}
              onClick={onSelecionar}
              aria-label={`Resumo de ${coluna.rotuloLongo}: ${
                coluna.total === 0
                  ? 'nenhum documento'
                  : coluna.total === 1
                    ? '1 documento'
                    : `${coluna.total} documentos`
              }`}
              aria-pressed={selecionado}
              className="relative grid size-8 cursor-pointer place-items-center rounded-full outline-none
                         focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2
                         focus-visible:ring-offset-[#070d16]"
            >
              {/* Halo. Hover e selected usam ESCALAS e COR diferentes de
                  propósito: com o mesmo halo accent nos dois, não havia como
                  saber se o dia estava escolhido ou só sob o cursor. */}
              <AnimatePresence>
                {emNode || selecionado ? (
                  <motion.span
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.55 }}
                    animate={{ opacity: 1, scale: selecionado ? 1 : 0.82 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: reduzido ? 0.1 : 0.22 }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: selecionado
                        ? 'radial-gradient(circle, hsl(var(--accent) / 0.34) 0%, hsl(var(--accent) / 0) 72%)'
                        : 'radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 72%)',
                    }}
                  />
                ) : null}
              </AnimatePresence>

              {/* O TAMANHO é CSS, não animação.
                  Com `animate={{ width, height }}` no Motion e sem tamanho de
                  repouso, o ponto nasce em 0x0 e só cresce quando a animação de
                  montagem roda — em aba oculta, captura headless e movimento
                  reduzido ela não roda, e os sete nodes ficavam em 0x0. O que
                  aparecia na tela era só o anel escuro de 3 px: um ponto PRETO
                  nos dias com documento. É a mesma armadilha do §9 deste
                  documento, agora em geometria em vez de opacidade.
                  A transição continua existindo — em CSS, que tem estado de
                  repouso garantido. */}
              <span
                aria-hidden
                className="rounded-full"
                style={{
                  width: tamanhoDoPonto,
                  height: tamanhoDoPonto,
                  background: selecionado
                    ? 'hsl(var(--accent))'
                    : emNode
                      ? 'rgba(255,255,255,0.96)'
                      : vazio
                        ? 'rgba(255,255,255,0.30)'
                        : 'rgba(255,255,255,0.66)',
                  // O anel escuro isola o ponto do trilho que passa por trás.
                  boxShadow: selecionado
                    ? '0 0 0 3.5px rgba(7,13,22,0.95), 0 0 0 5px hsl(var(--accent) / 0.30)'
                    : '0 0 0 3px rgba(7,13,22,0.95)',
                  transition: reduzido
                    ? 'none'
                    : 'width 180ms cubic-bezier(0.16,1,0.3,1), height 180ms cubic-bezier(0.16,1,0.3,1), background 180ms ease-out, box-shadow 180ms ease-out',
                }}
              />
            </button>
          }
        >
          <PeriodInfoCard coluna={coluna} mediaSemanal={mediaSemanal} compacto={compacto} />
        </PopoverFlutuante>
      </div>

      {/* --------------------------------------------------------- rótulos
          Fim de semana sem documento continua sendo uma data válida: o peso
          cai um ponto, mas não vira componente desabilitado — nada de opacidade
          de `disabled`, nada de cinza morto. O que muda é a ÊNFASE. */}
      <button
        type="button"
        onClick={onSelecionar}
        className="z-20 mt-2 flex cursor-pointer flex-col items-center rounded-lg px-5 py-2
                   outline-none transition-colors duration-150 hover:bg-white/[0.05]
                   focus-visible:ring-2 focus-visible:ring-white
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[#070d16]"
      >
        <span
          className={cn(
            'text-[1.0625rem] transition-colors duration-150',
            selecionado
              ? 'font-semibold text-accent'
              : coluna.atenuado
                ? 'font-medium text-white/62'
                : 'font-semibold text-white/[0.88]',
          )}
        >
          {coluna.rotuloCurto}
        </span>
        {/* No ano a segunda linha nao existe: o ano ja esta no titulo da
            faixa, e repeti-lo doze vezes seria ruido com cara de informacao. */}
        {coluna.rotuloData ? (
          <span
            className={cn(
              'mt-1 text-[13px] tabular-nums transition-colors duration-150',
              selecionado ? 'text-accent/80' : coluna.atenuado ? 'text-white/32' : 'text-white/45',
            )}
          >
            {coluna.rotuloData}
          </span>
        ) : null}
      </button>
    </div>
  )
}
