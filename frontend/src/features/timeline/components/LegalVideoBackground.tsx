/**
 * Ambiente jurídico real por trás da interface.
 *
 * O ponto da decisão: o vídeo precisa ser PERCEPTÍVEL. A tentação é cobri-lo
 * com um painel preto e ficar com "um dashboard escuro com um vídeo escondido
 * atrás". O que queremos é o oposto — interface flutuando sobre um ambiente.
 *
 * Por isso o véu é um gradiente, não um chapado: mais denso onde há texto
 * (topo e base), mais aberto no miolo, onde o vídeo respira.
 *
 * Custo: o `blur` fica na camada do vídeo, e só nela. Aplicar filtro pesado na
 * árvore inteira derruba o frame rate; aqui é uma camada isolada, com
 * `will-change: transform` e sem repintura de conteúdo.
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

export const VIDEO_AMBIENTE = '/media/ambiente-juridico.mp4'

export function LegalVideoBackground({
  /**
   * Intensidade do desfoque, em px.
   *
   * Zero, e é decisão, não esquecimento. O caminho foi 22 -> 13 -> 0.
   *
   * O erro era somar dois desfoques: o vídeo já chegava borrado e o painel
   * aplicava `backdrop-filter` por cima. O resultado ficava leitoso — nem
   * ambiente nítido, nem vidro convincente, porque vidro fosco só se percebe
   * quando há algo NÍTIDO ao redor para comparar.
   *
   * Agora a legibilidade vem de onde deve vir: véu escuro graduado, vidro do
   * painel e contraste tipográfico. O desfoque é exclusividade da camada C.
   */
  blur = 0,
  className,
}: {
  blur?: number
  className?: string
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [falhou, setFalhou] = React.useState(false)

  /**
   * Prontidão e reprodução.
   *
   * NÃO existe fade de entrada aqui, de propósito. A versão anterior revelava o
   * vídeo com `opacity` controlada por um estado alimentado por `canPlay`, e o
   * evento já havia disparado antes de o React anexar o handler quando o arquivo
   * vinha do cache: o vídeo tocava, decodificado, preso em `opacity: 0`. O fundo
   * `#040a12` atrás já cobre o carregamento — o gate só criava o defeito.
   *
   * `prefers-reduced-motion` pausa: fundo em movimento contínuo é justamente o
   * que a preferência pede para desligar.
   */
  React.useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
    const aplicar = () => {
      if (consulta.matches) {
        v.pause()
        return
      }
      // O autoplay pode ser recusado antes de haver dado suficiente; tentar de
      // novo a cada `loadeddata` resolve sem laço de retentativa.
      void v.play().catch(() => undefined)
    }
    const aoCarregar = () => aplicar()

    aplicar()
    v.addEventListener('loadeddata', aoCarregar)
    v.addEventListener('canplay', aoCarregar)
    consulta.addEventListener('change', aplicar)
    return () => {
      v.removeEventListener('loadeddata', aoCarregar)
      v.removeEventListener('canplay', aoCarregar)
      consulta.removeEventListener('change', aplicar)
    }
  }, [])

  return (
    <div
      aria-hidden
      /* `absolute` dentro da página, não `fixed` atrás de tudo.
         Com `fixed inset-0 -z-10` o vídeo ficava atrás do `bg-canvas` do shell
         (#011825, opaco) e simplesmente não aparecia. Cobrindo a ÁREA DA PÁGINA
         ele fica acima desse fundo e continua sem invadir a barra lateral nem a
         barra de filtros. */
      className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#040a12]', className)}
    >
      {!falhou ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setFalhou(true)}
          className="absolute inset-0 size-full object-cover"
          style={{
            // A escala cobria a borda que o desfoque comia nas extremidades;
            // sem desfoque ela cai para 1,02, só o suficiente para nenhum
            // arredondamento de subpixel mostrar o fundo.
            //
            // `brightness` caiu de 0,88 para 0,72 quando o painel de vidro
            // saiu. Era o vidro que rebaixava o ambiente atrás da timeline;
            // sem ele o vídeo chega cru, e este é um vídeo CLARO — mesa
            // iluminada, papel branco, livro aberto. Os dias de quinta e sexta
            // caíam justamente sobre o livro, e pilha branca sobre página
            // branca não se lê.
            filter: blur > 0
              ? `blur(${blur}px) saturate(118%) brightness(0.86)`
              : 'saturate(106%) brightness(0.72) contrast(104%)',
            // O painel ocupa a metade de cima da página, e é justamente ali
            // que o enquadramento do vídeo é mais vazio. Descer o ponto de
            // interesse põe a mesa de trabalho ATRÁS do vidro, que é onde o
            // ambiente precisa ser percebido.
            objectPosition: '50% 62%',
            transform: blur > 0 ? 'scale(1.06)' : 'scale(1.02)',
            willChange: 'transform',
          }}
        >
          <source src={VIDEO_AMBIENTE} type="video/mp4" />
        </video>
      ) : null}

      {/* Véu em gradiente, não chapado: denso onde há texto, aberto no miolo
          para o ambiente continuar visível. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            // Denso onde há texto (topo e base), ABERTO no miolo. Se o miolo
            // fechar, some o ambiente e sobra "um dashboard escuro" — que é
            // exatamente o que não se quer.
            //
            // Fase 1 abriu a curva; a Fase 1.1 fechou um ponto no topo e na
            // base. Com o painel de vidro fora, o miolo fechou mais um passo:
            // é ali que a semana inteira mora agora, sem nada entre a letra e
            // o vídeo. Continua sendo um GRADIENTE de página inteira, não um
            // retângulo — de perto ninguém vê onde começa, e o ambiente segue
            // visível de ponta a ponta.
            'linear-gradient(180deg, rgba(4,10,18,0.80) 0%, rgba(4,10,18,0.52) 20%,' +
            ' rgba(4,10,18,0.50) 46%, rgba(4,10,18,0.44) 72%, rgba(4,10,18,0.76) 100%)',
        }}
      />
      {/* Vinheta lateral: segura o olho no centro sem escurecer o miolo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 90% at 50% 44%, transparent 42%, rgba(3,8,14,0.44) 100%)',
        }}
      />
    </div>
  )
}
