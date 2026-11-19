/**
 * Vídeo de ambiente atrás de uma página longa.
 *
 * A Linha do Tempo já tem o seu, e o dela pode ser `absolute inset-0`: aquela
 * tela cabe em uma dobra. A Visão Geral tem quase três mil pixels de altura, e
 * ali `absolute inset-0` esticaria o quadro até deformar o enquadramento.
 *
 * A camada é **sticky com margem negativa**, não `fixed`. `fixed` parece a
 * escolha óbvia e não funciona aqui: `PageTransition` envolve a página numa
 * animação de entrada, e qualquer ancestral com `transform` vira bloco de
 * contenção — o `fixed` passaria a se medir por ele em vez da janela. O
 * `sticky top-0 h-screen` com `-mb-[100vh]` prende a camada à viewport,
 * sobrevive a ancestral transformado e não ocupa altura no fluxo.
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

export const VIDEO_PAINEL = '/media/ambiente-painel.mp4'

export function VideoDeAmbiente({
  src = VIDEO_PAINEL,
  className,
}: {
  src?: string
  className?: string
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [falhou, setFalhou] = React.useState(false)

  /**
   * Sem portão de opacidade esperando `canPlay`.
   *
   * A Linha do Tempo aprendeu isso: com o arquivo em cache o evento dispara
   * antes de o React anexar o handler, e o vídeo fica decodificado, tocando, e
   * preso em `opacity: 0`. O fundo escuro atrás já cobre o carregamento.
   *
   * `prefers-reduced-motion` pausa — fundo em movimento contínuo é exatamente
   * o que a preferência pede para desligar.
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
      void v.play().catch(() => undefined)
    }

    aplicar()
    v.addEventListener('loadeddata', aplicar)
    v.addEventListener('canplay', aplicar)
    consulta.addEventListener('change', aplicar)
    return () => {
      v.removeEventListener('loadeddata', aplicar)
      v.removeEventListener('canplay', aplicar)
      consulta.removeEventListener('change', aplicar)
    }
  }, [])

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none sticky top-0 z-0 -mb-[100vh] h-screen overflow-hidden',
        // As margens negativas levam o ambiente até as bordas da área de
        // conteúdo: o padding do `main` deixaria duas faixas do fundo liso nas
        // laterais, e faixa lisa ao lado de vídeo denuncia a emenda.
        '-mx-6 lg:-mx-9',
        className,
      )}
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
            // Rebaixado o bastante para o texto de cartão ganhar sempre, e
            // ainda assim com cor suficiente para não virar cinza morto.
            filter: 'saturate(110%) brightness(0.72) contrast(103%)',
            transform: 'scale(1.02)',
            willChange: 'transform',
          }}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : null}

      {/* Véu graduado: mais denso em cima, onde ficam os indicadores, e
          aberto no miolo para o ambiente continuar perceptível entre os
          cartões. Chapado uniforme mataria o vídeo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(3,14,22,0.74) 0%, rgba(3,14,22,0.54) 26%,' +
            ' rgba(3,14,22,0.50) 60%, rgba(3,14,22,0.70) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 85% at 50% 42%, transparent 50%, rgba(2,10,16,0.42) 100%)',
        }}
      />
    </div>
  )
}
