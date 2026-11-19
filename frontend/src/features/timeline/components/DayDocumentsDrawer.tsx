/**
 * Drawer contextual do dia.
 *
 * "Ver mais" deixou de navegar para o Acervo Documental. Trocar de página para
 * ver dez documentos custa o contexto inteiro: a semana, a posição do trilho, o
 * dia selecionado e a própria noção de onde se estava no tempo. O drawer
 * preserva tudo isso — a Linha do Tempo continua atrás, intacta, e fechar
 * devolve exatamente o estado anterior.
 *
 * NÃO é a página do Acervo dentro de uma gaveta. É exploração contextual: a
 * lista do dia, uma busca local sobre o que já está em memória, e a saída para
 * o Acervo quando a pergunta for maior que o dia.
 *
 * O link de cada documento é o `link_url` real do SharePoint, buscado em
 * `/documents/{id}` — o mesmo que a ficha do Acervo usa. Nenhuma URL é montada
 * aqui.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowUpRight, Search, X } from 'lucide-react'
import * as React from 'react'

import type { DocumentoResumo } from '@/lib/api'
import { date } from '@/lib/format'
import { fold } from '@/lib/utils'
import { useDocument } from '@/lib/queries'
import { SingleLegalDocument } from './LegalDocumentStack'

/** Filtro local sobre o que já está em memória — sem ida ao servidor. */
export function filtrarDocumentos(docs: DocumentoResumo[], termo: string): DocumentoResumo[] {
  const t = fold(termo.trim())
  if (!t) return docs
  return docs.filter((d) =>
    [d.assunto, d.natureza, d.destinatario, d.rodovia_principal]
      .filter(Boolean)
      .some((campo) => fold(String(campo)).includes(t)),
  )
}

function LinkDoDocumento({ id }: { id: number }) {
  const { data } = useDocument(id)
  const url = data?.data?.link_url ?? null

  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-white/30">
        Link indisponível
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group/link inline-flex items-center gap-1.5 rounded text-[11.5px] font-semibold
                 text-accent outline-none transition-colors duration-150 hover:text-accent/80
                 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                 focus-visible:ring-offset-[#070d16]"
    >
      Abrir documento
      <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
    </a>
  )
}

function ItemDocumento({ doc }: { doc: DocumentoResumo }) {
  return (
    <li className="flex gap-3.5 border-b border-white/[0.06] py-3.5 last:border-b-0">
      <div className="shrink-0 pt-0.5">
        <SingleLegalDocument largura={52} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-accent/85">
          {doc.natureza ?? 'Sem natureza'}
        </p>
        <p className="mt-1 text-[13px] font-medium leading-snug text-white/[0.92]">
          {doc.assunto ?? 'Sem assunto'}
        </p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/45">
          {doc.destinatario ?? '—'}
          {doc.rodovia_principal ? (
            <>
              {' · '}
              <span className="font-mono">{doc.rodovia_principal}</span>
            </>
          ) : null}
          {' · '}
          {date(doc.data_documento)}
          {doc.arquivo_extensao ? (
            <>
              {' · '}
              <span className="font-mono uppercase">{doc.arquivo_extensao}</span>
            </>
          ) : null}
        </p>
        <div className="mt-2">
          <LinkDoDocumento id={doc.documento_id} />
        </div>
      </div>
    </li>
  )
}

export function DayDocumentsDrawer({
  iso,
  titulo,
  documentos,
  aberto,
  onFechar,
  onVerNoAcervo,
}: {
  iso: string | null
  /**
   * Como a coluna se chama por extenso. Vem pronto de `escalas.ts` porque o
   * drawer não sabe — nem precisa saber — se aquela coluna era um dia ou um
   * mês inteiro.
   */
  titulo: string
  documentos: DocumentoResumo[]
  aberto: boolean
  onFechar: () => void
  onVerNoAcervo: () => void
}) {
  const [termo, setTermo] = React.useState('')
  const visiveis = React.useMemo(() => filtrarDocumentos(documentos, termo), [documentos, termo])

  // O termo não sobrevive ao fechamento: reabrir o mesmo dia deve mostrar o dia
  // inteiro, não o resto de uma busca esquecida.
  React.useEffect(() => {
    if (!aberto) setTermo('')
  }, [aberto])

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogPrimitive.Portal>
        {/* O véu é leve de propósito: a timeline PRECISA continuar legível
            atrás, senão o drawer deixa de ser contextual e vira página. */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 bg-[#040a12]/55 backdrop-blur-[2px]
                     data-[state=open]:animate-fade-in"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-drawer-dia={iso ?? undefined}
          /**
           * Ao fechar, o foco volta para a PILHA daquele dia — não para o
           * `body`.
           *
           * O padrão do Radix é devolver o foco ao gatilho, e aqui o gatilho é
           * o "Ver mais" de dentro de um popover de hover: quando o drawer
           * abre, o hover acaba e o botão deixa de existir. Sem este desvio o
           * foco caía no começo da página e quem navega por teclado voltava
           * para a barra lateral, a três dezenas de Tabs do ponto onde estava.
           */
          onCloseAutoFocus={(e) => {
            if (!iso) return
            const pilha = document.querySelector<HTMLElement>(`[data-dia="${iso}"] button`)
            if (!pilha) return
            e.preventDefault()
            pilha.focus()
          }}
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[30rem] flex-col
                     border-l border-white/10 shadow-[-24px_0_70px_-20px_rgba(0,0,0,0.9)]
                     outline-none data-[state=open]:animate-slide-in-right"
          style={{
            background: 'rgba(7, 13, 22, 0.94)',
            backdropFilter: 'blur(24px) saturate(120%)',
            WebkitBackdropFilter: 'blur(24px) saturate(120%)',
          }}
        >
          {/* -------------------------------------------------- cabeçalho */}
          <div className="shrink-0 border-b border-white/[0.08] px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  Documentos do período
                </p>
                <DialogPrimitive.Title className="mt-1 text-[17px] font-semibold leading-tight tracking-tight text-white">
                  {titulo}
                </DialogPrimitive.Title>
                <p className="mt-1 text-[12.5px] text-white/45">
                  <span className="font-semibold tabular-nums text-accent">
                    {documentos.length}
                  </span>{' '}
                  {documentos.length === 1 ? 'documento' : 'documentos'}
                  {termo && visiveis.length !== documentos.length
                    ? ` · ${visiveis.length} no filtro`
                    : null}
                </p>
              </div>

              <DialogPrimitive.Close
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg
                           text-white/50 outline-none transition-colors duration-150
                           hover:bg-white/[0.08] hover:text-white
                           focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>

            {/* Busca local. Só aparece quando há o que filtrar: um campo de
                busca sobre três itens é ruído. */}
            {documentos.length > 3 ? (
              <div
                className="mt-3.5 flex items-center gap-2 rounded-lg border border-white/[0.09]
                           bg-white/[0.035] px-3 py-2 transition-colors duration-150
                           focus-within:border-accent/35"
              >
                <Search className="size-3.5 shrink-0 text-white/35" />
                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Filtrar por assunto, natureza, destinatário…"
                  className="w-full bg-transparent text-[12.5px] text-white/90 outline-none
                             placeholder:text-white/30"
                />
              </div>
            ) : null}
          </div>

          {/* ------------------------------------------------------- lista */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {visiveis.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-white/40">
                Nenhum documento deste dia corresponde ao filtro.
              </p>
            ) : (
              <ul>
                {visiveis.map((doc) => (
                  <ItemDocumento key={doc.documento_id} doc={doc} />
                ))}
              </ul>
            )}
          </div>

          {/* -------------------------------------------------------- pé */}
          <div className="shrink-0 border-t border-white/[0.08] px-5 py-3.5">
            <button
              type="button"
              onClick={onVerNoAcervo}
              className="group/acervo inline-flex cursor-pointer items-center gap-2 rounded-md
                         border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold
                         text-white/75 outline-none transition-all duration-150
                         hover:border-white/20 hover:bg-white/[0.08] hover:text-white
                         focus-visible:ring-2 focus-visible:ring-accent"
            >
              Ver no Acervo Documental
              <ArrowUpRight className="size-3.5 transition-transform duration-150 group-hover/acervo:translate-x-0.5 group-hover/acervo:-translate-y-0.5" />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
