/**
 * Prévia de documento — a que nasce do próprio papel.
 *
 * Duas variantes, porque as perguntas são diferentes:
 *   - um documento  -> prévia grande, com miniatura de verdade e metadados;
 *   - vários        -> até três folhas saindo da pilha, com badge +N.
 *
 * O papel ocupa ~40% da largura útil do card. Não é medida solta: com menos que
 * isso o card lia como ficha administrativa com ícone ao lado, e a frase que
 * ele precisa dizer é "estou vendo o documento".
 *
 * O `link_url` real do SharePoint vem de `/documents/{id}` — o mesmo que a ficha
 * do Acervo Documental já usava. Nenhuma URL é inventada aqui.
 */

import { ArrowUpRight, Layers } from 'lucide-react'
import { motion } from 'motion/react'
import * as React from 'react'

import type { DocumentoResumo } from '@/lib/api'
import { date } from '@/lib/format'
import { useDocument } from '@/lib/queries'
import { SingleLegalDocument } from './LegalDocumentStack'

/**
 * Entrada escalonada — estrutura, depois conteúdo, e o CTA por último — via a
 * classe `.stagger-in` com atraso próprio em cada bloco.
 *
 * Em CSS, não em Motion: animação de entrada em JS deixa o elemento preso em
 * `initial` quando não roda (aba oculta, captura headless, movimento reduzido),
 * e metade do card ficava invisível. O keyframe tem estado final garantido e
 * `html.no-reveal` o desliga por inteiro.
 */

function Metadado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-[4.25rem] shrink-0 text-[10px] uppercase tracking-wider text-white/40">
        {rotulo}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/80">{valor}</span>
    </div>
  )
}

function AbrirDocumento({ id }: { id: number }) {
  // Só busca o detalhe quando a prévia abre — o link real mora lá.
  const { data } = useDocument(id)
  const url = data?.data?.link_url ?? null

  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs text-white/35">
        Link indisponível
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group/cta inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-xs font-semibold
                 text-[#04212b] outline-none transition-all duration-150
                 hover:brightness-110 active:translate-y-px
                 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                 focus-visible:ring-offset-[#070d16]"
    >
      Abrir documento
      <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
    </a>
  )
}

/* ------------------------------------------------------------ um documento */

/**
 * Duas medidas mandam aqui, e as duas vieram de defeito observado.
 *
 * A PROPORCAO do papel: ~42% da largura util. Com 34% — 128 px num card de
 * 400 — o card lia como ficha administrativa com um icone ao lado. A frase que
 * ele precisa dizer e "estou vendo o documento".
 *
 * A ALTURA total: <= 300 px. O painel tem pouco espaco acima da pilha, entao em
 * 1440x900 o Radix vira a previa para baixo; um card de 300 px cabe nos ~320 px
 * que sobram ate o pe da janela, e um de 420 px era cortado. Card alto nao e
 * card rico, e card cortado.
 */
const LARGURA_CARD = 384
const LARGURA_PAPEL = 146

export function DocumentPreviewCard({ doc }: { doc: DocumentoResumo }) {
  return (
    <div className="flex gap-4 p-4" style={{ width: LARGURA_CARD }}>
      <div className="stagger-in shrink-0" style={{ animationDelay: '90ms' }}>
        <SingleLegalDocument largura={LARGURA_PAPEL} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p
          className="stagger-in text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
          style={{ animationDelay: '145ms' }}
        >
          {doc.natureza ?? 'Sem natureza'}
        </p>

        <h4
          className="stagger-in mt-1.5 line-clamp-3 text-[14px] font-semibold leading-snug text-white"
          style={{ animationDelay: '200ms' }}
        >
          {doc.assunto ?? 'Sem assunto'}
        </h4>

        <div className="stagger-in mt-3 space-y-1.5" style={{ animationDelay: '255ms' }}>
          <Metadado rotulo="Para" valor={doc.destinatario ?? '\u2014'} />
          <Metadado rotulo="Data" valor={date(doc.data_documento)} />
          <Metadado
            rotulo="Arquivo"
            valor={<span className="font-mono uppercase">{doc.arquivo_extensao ?? '\u2014'}</span>}
          />
          {doc.rodovia_principal ? (
            <Metadado
              rotulo="Rodovia"
              valor={<span className="font-mono">{doc.rodovia_principal}</span>}
            />
          ) : null}
        </div>

        {/* O CTA e o ultimo a aparecer. A ordem do escalonamento e a ordem da
            leitura: o que e, do que trata, a quem pertence, e so entao o que
            fazer a respeito. */}
        <div className="stagger-in mt-3.5" style={{ animationDelay: '310ms' }}>
          <AbrirDocumento id={doc.documento_id} />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- varios documentos */

/**
 * O leque fica AO LADO dos titulos, nao em cima deles.
 *
 * Empilhado — leque, depois lista, depois CTA — o card passava de 420 px de
 * altura e era cortado pelo pe da janela quando o Radix o virava para baixo.
 * Lado a lado ele cabe em ~230 px e o leque fica maior, nao menor.
 *
 * As tres folhas: a do centro primeiro, a segunda para a esquerda, a terceira
 * para a direita — "retirei alguns documentos da pilha". Rotacao limitada a
 * 2 graus; mais que isso vira baralho espalhado. Sao DOCUMENTOS soltos com
 * profundidade, nao tres cards quadrados com miniatura dentro: por isso nao ha
 * moldura, fundo nem borda em volta de nenhum deles.
 */
const POSES = [
  { x: 0, y: 0, rotate: 0, z: 3, delay: 0.1 },
  { x: -42, y: 5, rotate: -2, z: 2, delay: 0.17 },
  { x: 42, y: 5, rotate: 2, z: 1, delay: 0.24 },
] as const

const LARGURA_LEQUE = 196

export function MultiDocumentPreviewCard({
  docs,
  total,
  onVerTodos,
}: {
  docs: DocumentoResumo[]
  total: number
  onVerTodos: () => void
}) {
  const mostrados = docs.slice(0, 3)
  const restante = total - mostrados.length

  return (
    <div className="flex gap-4 p-4" style={{ width: 484 }}>
      {/* ------------------------------------------------------- o leque */}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: LARGURA_LEQUE, height: 186 }}
      >
        {mostrados.map((doc, i) => {
          const pose = POSES[i] ?? POSES[0]
          const ultimo = i === mostrados.length - 1
          return (
            <motion.div
              key={doc.documento_id}
              // Sem `opacity` no initial de proposito: se a animacao nao
              // rodar, as folhas aparecem empilhadas — nunca invisiveis.
              initial={{ x: 0, y: 14, rotate: 0, scale: 0.92 }}
              animate={{ x: pose.x, y: pose.y, rotate: pose.rotate, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30, delay: pose.delay }}
              className="absolute"
              style={{ zIndex: pose.z }}
            >
              <div className="relative">
                <SingleLegalDocument largura={104} />
                {ultimo && restante > 0 ? (
                  <motion.span
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.34, type: 'spring', stiffness: 420, damping: 24 }}
                    className="absolute -bottom-2 -right-2 rounded-lg bg-accent px-2 py-0.5
                               text-[11px] font-bold text-[#04212b] shadow-lg"
                  >
                    +{restante}
                  </motion.span>
                ) : null}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* --------------------------------------------- titulos e o CTA */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="stagger-in flex items-center gap-2" style={{ animationDelay: '90ms' }}>
          <Layers className="size-3.5 shrink-0 text-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {total} documentos
          </span>
        </div>

        <ul className="stagger-in mt-3 space-y-2" style={{ animationDelay: '250ms' }}>
          {mostrados.map((doc) => (
            <li key={doc.documento_id} className="min-w-0">
              <p className="truncate text-[12.5px] leading-snug text-white/[0.86]">
                {doc.assunto ?? 'Sem assunto'}
              </p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-white/35">
                {doc.natureza ?? '\u2014'}
              </p>
            </li>
          ))}
        </ul>

        <div className="stagger-in mt-auto pt-3.5" style={{ animationDelay: '360ms' }}>
          <button
            type="button"
            onClick={onVerTodos}
            className="group/cta inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2
                       text-xs font-semibold text-[#04212b] outline-none transition-all duration-150
                       hover:brightness-110 active:translate-y-px
                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                       focus-visible:ring-offset-[#070d16]"
          >
            Ver mais ({total})
            <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ vidro */

/**
 * Vidro local mais denso que o do painel: aqui há texto pequeno e o vídeo não
 * pode atravessar. É a exceção prevista — a opacidade sobe onde a leitura exige.
 */
export const vidroDoPopover: React.CSSProperties = {
  background: 'rgba(7, 13, 22, 0.90)',
  backdropFilter: 'blur(22px) saturate(120%)',
  WebkitBackdropFilter: 'blur(22px) saturate(120%)',
}
