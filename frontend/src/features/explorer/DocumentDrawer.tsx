/**
 * Ficha documental executiva. Selecionar um documento nunca troca de página.
 *
 * Redesenho: cabeçalho com identidade da matéria, ação primária em destaque,
 * campos em ficha (inclusive os vazios — omitir campo vazio esconde problema de
 * dado), os quatro tempos separados e documentos relacionados.
 *
 * O botão ABRIR DOCUMENTO usa o hyperlink original do SharePoint, literal, e
 * nunca é reconstruído. Nenhum caminho de disco aparece na interface.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Building2,
  Clock,
  ExternalLink,
  FileText,
  Link2Off,
  Route,
  Tag,
  User,
  X,
} from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { ApiError } from '@/lib/api'
import { date, dateTime, num, truncate } from '@/lib/format'
import { useDocument } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Badge, Button, ErrorState, Skeleton, Tooltip } from '@/ui/primitives'

const TAXONOMIA: Record<string, { rotulo: string; variante: 'neutral' | 'positive' | 'warning' }> = {
  ok: { rotulo: 'na taxonomia', variante: 'neutral' },
  confirmado_por_regra: { rotulo: 'válido por regra confirmada', variante: 'positive' },
  pendente_de_validacao: { rotulo: 'taxonomia pendente de validação', variante: 'warning' },
}

export function DocumentDrawer({
  documentoId,
  onClose,
}: {
  documentoId: number | null
  onClose: () => void
}) {
  const { data, isPending, isError, error } = useDocument(documentoId)
  const [, setParams] = useSearchParams()
  const doc = data?.data

  const abrirRelacionado = (id: number) => {
    setParams(
      (anterior) => {
        const next = new URLSearchParams(anterior)
        next.set('doc', String(id))
        return next
      },
      { replace: true },
    )
  }

  return (
    <DialogPrimitive.Root open={documentoId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 bg-brand-deep/45 backdrop-blur-[2px]
                     data-[state=open]:animate-fade-in"
        />
        <DialogPrimitive.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-line
                     bg-surface shadow-overlay data-[state=open]:animate-slide-in-right
                     sm:w-[35rem]"
        >
          {/* ------------------------------------------------------ cabeçalho */}
          <div className="relative shrink-0 overflow-hidden border-b border-line">
            <div className="brand-gradient absolute inset-0 opacity-[0.07]" />
            <div className="relative flex items-start justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <p className="eyebrow">
                  {doc?.macrogrupo_juridico && doc.macrogrupo_origem !== 'sem_evidencia'
                    ? doc.macrogrupo_juridico
                    : 'Ficha documental'}
                </p>
                <DialogPrimitive.Title className="mt-1.5 text-lg font-semibold leading-snug text-ink">
                  {isPending ? 'Carregando…' : (doc?.assunto ?? `Documento ${documentoId}`)}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-faint">
                  {doc ? (
                    <>
                      <span className="font-mono">ID {doc.documento_id}</span>
                      <span aria-hidden>·</span>
                      <span>{doc.pasta}</span>
                      {doc.natureza ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{doc.natureza}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    'detalhe do documento'
                  )}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Fechar ficha">
                  <X className="size-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isError ? (
              <div className="p-6">
                <ErrorState
                  message={
                    error instanceof ApiError ? error.message : 'Erro ao carregar o documento.'
                  }
                />
              </div>
            ) : isPending || !doc ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-12" />
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-4 w-52" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* ---------------------------------------------- ação primária */}
                <div className="border-b border-line px-6 py-4">
                  {doc.link_disponivel && doc.link_url ? (
                    <a href={doc.link_url} target="_blank" rel="noreferrer noopener">
                      <Button
                        variant="primary"
                        className="h-12 w-full text-sm font-semibold tracking-wide"
                      >
                        <ExternalLink className="size-4" />
                        ABRIR DOCUMENTO
                      </Button>
                    </a>
                  ) : (
                    <Tooltip content="Este documento está marcado como Excluído e não tem hyperlink na fonte. O link não é reconstruído para não abrir uma página de erro.">
                      <Button variant="secondary" className="h-12 w-full" disabled>
                        <Link2Off className="size-4" />
                        Sem link disponível
                      </Button>
                    </Tooltip>
                  )}
                  <p className="mt-2.5 text-center text-2xs text-ink-faint">
                    Abre o original no repositório. O documento não é copiado nem armazenado aqui.
                  </p>
                </div>

                {/* ----------------------------------------------- status e tags */}
                <div className="flex flex-wrap gap-1.5 border-b border-line px-6 py-3.5">
                  <Badge variant={doc.ativo ? 'positive' : 'danger'}>{doc.status}</Badge>
                  {doc.contrato ? (
                    <Tooltip
                      content={
                        doc.contrato_origem === 'destinatario'
                          ? 'Contrato identificado pela coluna Destinatários — confiança alta, regra confirmada pela coordenação.'
                          : 'Contrato identificado pela rodovia extraída do texto — derivado, confiança média.'
                      }
                    >
                      <Badge
                        variant={doc.contrato_origem === 'destinatario' ? 'positive' : 'inferred'}
                        className="cursor-help"
                      >
                        Contrato {doc.contrato}
                      </Badge>
                    </Tooltip>
                  ) : null}
                  {doc.executora ? <Badge variant="neutral">{doc.executora}</Badge> : null}
                  {!doc.nome_conforme_padrao ? (
                    <Tooltip content="O nome do arquivo não segue a regra da aba NOMENCLATURA, então os campos derivados do nome ficam indisponíveis para este documento.">
                      <Badge variant="warning" className="cursor-help">
                        nome fora do padrão
                      </Badge>
                    </Tooltip>
                  ) : null}
                  {doc.macrogrupo_origem === 'sem_evidencia' ? (
                    <Tooltip content="Sem evidência suficiente na natureza nem nos temas para determinar a matéria jurídica. Preferimos não classificar a inventar.">
                      <Badge variant="outline" className="cursor-help">
                        matéria não classificada
                      </Badge>
                    </Tooltip>
                  ) : null}
                </div>

                {/* ----------------------------------------------- destaque visual */}
                <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                  <Destaque
                    icone={Tag}
                    label="Temas"
                    valor={num(doc.temas.length)}
                    detalhe={doc.temas.length ? 'vínculos' : 'sem tema'}
                  />
                  <Destaque
                    icone={Route}
                    label="Rodovia"
                    valor={doc.rodovia_principal ?? '—'}
                    detalhe={
                      doc.rodovia_principal
                        ? doc.rodovias.length > 1
                          ? `+${doc.rodovias.length - 1} outra(s)`
                          : undefined
                        : 'não identificada'
                    }
                    mono={Boolean(doc.rodovia_principal)}
                  />
                  <Destaque
                    icone={FileText}
                    label="Formato"
                    valor={(doc.arquivo_extensao ?? '—').toUpperCase()}
                    mono
                  />
                </div>

                {/* --------------------------------------------------- conteúdo */}
                <Secao titulo="Identificação">
                  <Campo label="Natureza" valor={doc.natureza} />
                  <Campo label="Assunto" valor={doc.assunto} quebrar />
                  <Campo
                    label="Destinatário"
                    valor={doc.destinatario}
                    nota={
                      doc.destinatario_status_taxonomia &&
                      doc.destinatario_status_taxonomia !== 'ok'
                        ? TAXONOMIA[doc.destinatario_status_taxonomia]?.rotulo
                        : undefined
                    }
                    notaVariante={TAXONOMIA[doc.destinatario_status_taxonomia ?? 'ok']?.variante}
                  />
                  <Campo label="Pasta no repositório" valor={doc.pasta} />
                  <Campo label="Nome do arquivo" valor={doc.arquivo_nome} mono quebrar />
                </Secao>

                {doc.temas.length > 0 ? (
                  <Secao titulo="Temas" apoio={`${doc.temas.length} vínculo(s)`}>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.temas.map((tema) => (
                        <span
                          key={tema.tema}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-2xs font-medium',
                            tema.status_taxonomia === 'pendente_de_validacao'
                              ? 'border border-warning/40 bg-warning/10 text-warning'
                              : 'bg-accent-soft text-accent-ink',
                          )}
                        >
                          {tema.tema}
                        </span>
                      ))}
                    </div>
                  </Secao>
                ) : null}

                {doc.rodovias.length > 0 ? (
                  <Secao titulo="Rodovias" apoio="extraído do texto, com o campo de origem">
                    <ul className="space-y-2">
                      {doc.rodovias.map((rodovia) => (
                        <li key={rodovia.rodovia} className="flex items-center gap-2.5 text-xs">
                          <span className="font-mono text-sm font-semibold text-ink">
                            {rodovia.rodovia}
                          </span>
                          <Badge variant={rodovia.confianca === 'alta' ? 'positive' : 'inferred'}>
                            confiança {rodovia.confianca}
                          </Badge>
                          <span className="text-2xs text-ink-faint">via {rodovia.campo_origem}</span>
                        </li>
                      ))}
                    </ul>
                  </Secao>
                ) : (
                  <Secao titulo="Rodovias" apoio="nenhuma menção identificável">
                    <p className="text-xs italic leading-relaxed text-ink-faint">
                      Documento sem referência a rodovia no destinatário, no assunto ou no nome do
                      arquivo. Não atribuímos rodovia por inferência.
                    </p>
                  </Secao>
                )}

                {/* Quatro tempos, quatro linhas. Nunca misturados. */}
                <Secao titulo="Tempos" apoio="quatro conceitos distintos, nunca equivalentes">
                  <Campo
                    icone={Clock}
                    label="Data do documento"
                    valor={date(doc.data_documento, doc.data_documento_precisao)}
                    nota={
                      doc.data_documento_precisao === 'mes'
                        ? 'periodicidade mensal — dia não informado na fonte'
                        : undefined
                    }
                    destaque
                  />
                  <Campo
                    label="Entrada no índice"
                    valor={dateTime(doc.data_indexacao)}
                    nota={
                      doc.data_indexacao_aproximada
                        ? 'aproximada — instante do inventário inicial, não upload real'
                        : undefined
                    }
                    notaVariante="warning"
                  />
                  <Campo
                    label="Última modificação no repositório"
                    valor={dateTime(doc.data_ultima_modificacao)}
                  />
                </Secao>

                <Secao
                  titulo="Operação de repositório"
                  apoio="quem subiu ou editou o arquivo — não é autoria jurídica"
                >
                  <Campo icone={User} label="Subido por" valor={doc.pessoa_upload} />
                  <Campo label="Modificado por" valor={doc.pessoa_modificacao} />
                </Secao>

                <Secao titulo="Derivado do nome do arquivo">
                  <Campo label="Assunto no nome" valor={doc.nome_assunto} />
                  <Campo
                    icone={Building2}
                    label="Destinatário curto"
                    valor={doc.nome_destinatario_curto}
                  />
                  <Campo
                    label="Necessidade de resposta"
                    valor={
                      doc.necessidade_resposta !== null ? String(doc.necessidade_resposta) : null
                    }
                    nota="campo previsto na taxonomia, sem variância no acervo — sem poder analítico"
                  />
                </Secao>

                {doc.relacionados.length > 0 ? (
                  <Secao
                    titulo="Documentos relacionados"
                    apoio="mesmo assunto, mesma data ou mesmo destinatário e natureza"
                  >
                    <ul className="-mx-2 divide-y divide-line">
                      {doc.relacionados.map((rel) => (
                        <li key={rel.documento_id}>
                          <button
                            type="button"
                            onClick={() => abrirRelacionado(rel.documento_id)}
                            className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left
                                       transition-colors hover:bg-subtle"
                          >
                            <span className="tabular w-[4.25rem] shrink-0 text-2xs text-ink-faint">
                              {date(rel.data_documento)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-ink group-hover:text-accent-ink">
                                {truncate(rel.assunto, 46)}
                              </span>
                              <span className="mt-0.5 block truncate text-2xs text-ink-faint">
                                {rel.relacao} · {rel.natureza ?? '—'}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Secao>
                ) : null}

                <div className="px-6 py-5">
                  <p className="border-t border-line pt-4 text-2xs leading-relaxed text-ink-faint">
                    Todos os campos vêm de <span className="font-mono">00 Indice.xlsx</span> ou são
                    derivados dele. A fonte é somente leitura: nada nesta tela pode alterar o
                    documento ou o índice.
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* --------------------------------------------------------------- primitivos */

function Destaque({
  icone: Icone,
  label,
  valor,
  detalhe,
  mono = false,
}: {
  icone: React.ComponentType<{ className?: string }>
  label: string
  valor: string
  detalhe?: string
  mono?: boolean
}) {
  return (
    <div className="px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
        <Icone className="size-3" />
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 truncate text-lg font-semibold leading-none text-ink',
          mono && 'font-mono text-base',
        )}
      >
        {valor}
      </p>
      {detalhe ? <p className="mt-1 text-2xs text-ink-faint">{detalhe}</p> : null}
    </div>
  )
}

function Secao({
  titulo,
  apoio,
  children,
}: {
  titulo: string
  apoio?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-line px-6 py-4">
      <h4 className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-muted">{titulo}</h4>
      {apoio ? <p className="mt-0.5 text-2xs text-ink-faint">{apoio}</p> : null}
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  )
}

function Campo({
  label,
  valor,
  nota,
  notaVariante = 'neutral',
  mono = false,
  quebrar = false,
  destaque = false,
  icone: Icone,
}: {
  label: string
  valor: string | null | undefined
  nota?: string | undefined
  notaVariante?: 'neutral' | 'positive' | 'warning'
  mono?: boolean
  quebrar?: boolean
  destaque?: boolean
  icone?: React.ComponentType<{ className?: string }>
}) {
  const vazio = valor === null || valor === undefined || valor === '' || valor === '—'
  return (
    <div className="grid grid-cols-[10.5rem_1fr] items-start gap-3">
      <span className="flex items-center gap-1.5 pt-0.5 text-2xs text-ink-faint">
        {Icone ? <Icone className="size-3 shrink-0" /> : null}
        {label}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block',
            destaque ? 'text-sm font-semibold' : 'text-xs',
            vazio ? 'italic text-ink-faint' : 'text-ink',
            mono && 'font-mono',
            quebrar ? 'break-words' : 'truncate',
          )}
        >
          {vazio ? 'não informado' : valor}
        </span>
        {nota ? (
          // `whitespace-normal`: a nota de proveniência é uma frase, não um
          // rótulo. Em `nowrap` ela era cortada na borda do painel.
          <Badge
            variant={notaVariante}
            className="mt-1.5 whitespace-normal text-left leading-snug"
          >
            {nota}
          </Badge>
        ) : null}
      </span>
    </div>
  )
}
