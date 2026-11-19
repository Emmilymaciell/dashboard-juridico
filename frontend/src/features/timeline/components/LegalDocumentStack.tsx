/**
 * Folha e pilha jurídicas.
 *
 * Cada faixa de magnitude tem seu PRÓPRIO render: cinco imagens da mesma peça,
 * na mesma câmera e na mesma luz, variando só quanto papel há embaixo. Não é a
 * mesma imagem repetida nem escalada — 2 documentos e 51 documentos são
 * fotografias diferentes.
 *
 * Substituiu a montagem anterior (papel sintético B3 + conteúdo em SVG +
 * folhas em CSS). Aquela existia para resolver um problema que estes renders
 * simplesmente não têm: como fazer papel parecer papel. Aqui a textura, a
 * espessura, a irregularidade da borda da resma e a sombra entre as folhas são
 * reais, e nenhuma delas se desenha convincentemente em vetor.
 *
 * Duas coisas foram preservadas da versão anterior porque continuam certas:
 *
 *   - **a silhueta é o alfa do PNG**, não a caixa do `div`. Sem `background`,
 *     sem `overflow-hidden`, sem borda — foi o que tirou a chapa branca.
 *   - **a sombra de realce é `drop-shadow`**, que acompanha o recorte. Os
 *     renders já trazem sombra de contato embutida; a que somamos no hover é a
 *     sombra LONGA, a de um objeto que levantou.
 *
 * `unico` é a pilha mais fina com a lombada aparada — mesma câmera, zero
 * espessura. Usar o render da folha avulsa ali daria duas câmeras na mesma
 * semana, e a folha ficaria mais ALTA que a pilha de 51 documentos, invertendo
 * a leitura de magnitude. Ver `output/asset-exploration/preparar_parecer.py`.
 */

import * as React from 'react'

import { cn } from '@/lib/utils'
import type { Armario, Magnitude, MagnitudeTier } from '../magnitude'
import { RAZAO_POR_GAVETAS, RAZAO_POR_TIER } from '../magnitude'

interface Arte {
  src: string
  /** altura / largura do render, para reservar a caixa sem medir a imagem. */
  razao: number
}

export const ARTE_POR_TIER: Record<Exclude<MagnitudeTier, 'vazio'>, Arte> = {
  unico: { src: '/brand/parecer-folha.png', razao: RAZAO_POR_TIER.unico },
  xs: { src: '/brand/parecer-pilha-xs.png', razao: RAZAO_POR_TIER.xs },
  s: { src: '/brand/parecer-pilha-xs.png', razao: RAZAO_POR_TIER.s },
  m: { src: '/brand/parecer-pilha-m.png', razao: RAZAO_POR_TIER.m },
  l: { src: '/brand/parecer-pilha-l.png', razao: RAZAO_POR_TIER.l },
  xl: { src: '/brand/parecer-pilha-xl.png', razao: RAZAO_POR_TIER.xl },
}

/** A folha avulsa, usada nas prévias e no drawer. */
export const FOLHA_BASE = ARTE_POR_TIER.unico.src

function Papel({
  arte,
  largura,
  realce,
  luz = 'neutra',
  className,
  style,
}: {
  arte: Arte
  largura: number
  realce: boolean
  /** No realce, o móvel do ano acende em acento; o papel continua neutro. */
  luz?: 'neutra' | 'accent'
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{
        width: largura,
        height: Math.round(largura * arte.razao),
        // No realce a sombra longa cresce: é assim que um objeto que SOBE se
        // comporta com a luz. A curta já vem embutida no render.
        filter: realce
          ? luz === 'accent'
            ? 'drop-shadow(0 16px 24px rgba(0,0,0,0.55)) drop-shadow(0 0 10px hsl(var(--accent) / 0.30))'
            : 'drop-shadow(0 16px 24px rgba(0,0,0,0.55))'
          : 'drop-shadow(0 6px 12px rgba(0,0,0,0.38))',
        transition: 'filter 180ms ease-out',
        ...style,
      }}
    >
      <img
        src={arte.src}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 size-full select-none"
      />
    </div>
  )
}

export function SingleLegalDocument({
  largura = 112,
  className,
  style,
  realce = false,
}: {
  largura?: number
  className?: string
  style?: React.CSSProperties
  /** Sob atenção: a sombra se abre e o papel descola do fundo. */
  realce?: boolean
}) {
  return (
    <Papel
      arte={ARTE_POR_TIER.unico}
      largura={largura}
      realce={realce}
      className={className}
      style={style}
    />
  )
}

export function LegalDocumentStack({
  m,
  className,
  style,
  realce = false,
}: {
  m: Magnitude
  className?: string
  style?: React.CSSProperties
  realce?: boolean
}) {
  const arte = ARTE_POR_TIER[m.tier === 'vazio' ? 'unico' : m.tier]
  return (
    <Papel
      arte={arte}
      largura={m.largura}
      realce={realce}
      className={className}
      style={style}
    />
  )
}

/**
 * O armário do mês, na visão anual.
 *
 * Mesma gramática da pilha: a silhueta é o alfa do PNG, a sombra de realce é
 * `drop-shadow` e nada de caixa por baixo. O que muda é o objeto — um mês do
 * acervo não é uma pilha em cima da mesa, é o arquivo onde ele foi guardado.
 */
export function ArmarioDoPeriodo({
  a,
  realce = false,
  luz = 'neutra',
  className,
  style,
}: {
  a: Armario
  realce?: boolean
  luz?: 'neutra' | 'accent'
  className?: string
  style?: React.CSSProperties
}) {
  if (a.gavetas === 0) return null
  return (
    <Papel
      arte={{ src: `/brand/armario-${a.gavetas}.png`, razao: RAZAO_POR_GAVETAS[a.gavetas] }}
      largura={a.largura}
      realce={realce}
      luz={luz}
      className={className}
      style={style}
    />
  )
}
