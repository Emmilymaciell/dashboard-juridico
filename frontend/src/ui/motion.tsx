/**
 * Helpers de animação.
 *
 * DECISÃO IMPORTANTE: as animações de *entrada* são CSS, não JS.
 *
 * A primeira versão usava Motion para revelar blocos com `initial={{opacity:0}}`.
 * Quando a animação não rodava — aba em segundo plano, captura headless, tela
 * com `prefers-reduced-motion` — o elemento ficava preso em opacidade zero e o
 * conteúdo simplesmente não aparecia. Aconteceu com o rodapé da capa.
 *
 * Com CSS + `animation-fill-mode: both`, o estado de repouso é visível: se a
 * animação não roda, o conteúdo aparece do mesmo jeito. Motion continua sendo
 * usado onde ficar preso é inofensivo e o ganho é real: drawer, troca de página
 * e interações.
 */

import * as React from 'react'

export { motion, AnimatePresence, useReducedMotion } from 'motion/react'

type Variant = 'up' | 'in' | 'left'

const CLASSES: Record<Variant, string> = {
  up: 'reveal-up',
  in: 'reveal-in',
  left: 'reveal-left',
}

/** Bloco que entra suavemente. Visível mesmo se a animação não rodar. */
export function Reveal({
  children,
  delay = 0,
  className,
  variant = 'up',
  as: Component = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  variant?: Variant
  as?: 'div' | 'section' | 'header' | 'li' | 'span'
}) {
  return (
    <Component
      className={[CLASSES[variant], className].filter(Boolean).join(' ')}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </Component>
  )
}

const RevealContext = React.createContext<{ delay: number; step: number; next: () => number }>({
  delay: 0,
  step: 0,
  next: () => 0,
})

/** Container que escalona a entrada dos filhos, via delay de CSS. */
export function RevealList({
  children,
  delay = 0,
  step = 0.055,
  className,
}: {
  children: React.ReactNode
  delay?: number
  step?: number
  className?: string
}) {
  const counter = React.useRef(0)
  counter.current = 0
  const value = React.useMemo(
    () => ({
      delay,
      step,
      next: () => delay + counter.current++ * step,
    }),
    [delay, step],
  )
  return (
    <RevealContext.Provider value={value}>
      <div className={className}>{children}</div>
    </RevealContext.Provider>
  )
}

export function RevealItem({
  children,
  className,
  variant = 'up',
}: {
  children: React.ReactNode
  className?: string
  variant?: Variant
}) {
  const ctx = React.useContext(RevealContext)
  const delay = React.useMemo(() => ctx.next(), [ctx])
  return (
    <div
      className={[CLASSES[variant], className].filter(Boolean).join(' ')}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  )
}

/** Transição entre páginas. Fade curto em CSS — não prende conteúdo. */
export function PageTransition({
  children,
  keyed,
}: {
  children: React.ReactNode
  keyed: string
}) {
  return (
    <div key={keyed} className="reveal-in">
      {children}
    </div>
  )
}

/**
 * Número que conta até o valor, só na primeira aparição.
 *
 * Se o `requestAnimationFrame` não rodar (aba em segundo plano, captura
 * headless), um timer de segurança cravado em 900ms escreve o valor final —
 * KPI mostrando zero por causa de animação seria pior que KPI sem animação.
 */
export function CountUp({
  value,
  duration = 0.85,
  format,
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [display, setDisplay] = React.useState(prefersReduced ? value : 0)
  const finished = React.useRef(prefersReduced)

  React.useEffect(() => {
    if (prefersReduced) {
      setDisplay(value)
      return
    }
    // Sem isto, a rede de segurança abaixo só protege a PRIMEIRA contagem: a
    // partir da segunda `finished` já estava `true`, e numa aba que não pinta
    // (rAF não dispara) o número congelava no valor anterior — vi 68 onde o
    // dado era 75, depois de remover um filtro.
    finished.current = false
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000))
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else finished.current = true
    }
    raf = requestAnimationFrame(tick)

    // Rede de segurança: garante o valor final mesmo sem frames.
    const fallback = window.setTimeout(() => {
      if (!finished.current) {
        finished.current = true
        setDisplay(value)
      }
    }, Math.max(900, duration * 1000 + 120))

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(fallback)
    }
  }, [value, duration, prefersReduced])

  const shown = Math.round(display)
  return <span className={className}>{format ? format(shown) : shown}</span>
}
