/**
 * Rótulos de confiança e proveniência (DEC-005). A regra é estrutural: a UI lê
 * `meta.categoria` / `meta.proveniencia` da API, nunca decide por conta própria.
 *
 * `confirmed_business_rule` NÃO é badge de alerta: é selo de regra confirmada.
 */

import { CheckCircle2, CircleDashed, HelpCircle, MinusCircle } from 'lucide-react'

import type { Categoria, Cobertura, Meta, Proveniencia } from '@/lib/api'
import { pct } from '@/lib/format'
import { Badge, Tooltip } from '@/ui/primitives'

const CATEGORY_HINT: Record<Categoria, string> = {
  'DADO EXISTENTE': 'Vem literalmente da fonte estruturada (00 Indice.xlsx).',
  'DADO DERIVADO': 'Calculado de forma determinística a partir da fonte.',
  INFERÊNCIA: 'Extraído por regra sobre o texto. Confiança menor que 100%.',
  HIPÓTESE: 'Interpretação de negócio ainda não confirmada.',
  'NÃO DISPONÍVEL': 'A fonte não sustenta esta informação.',
}

const PROVENANCE_LABEL: Record<Proveniencia, string> = {
  source: 'da fonte',
  derived: 'derivado',
  confirmed_business_rule: 'regra confirmada',
  inferred: 'inferido',
  taxonomy_pending: 'taxonomia pendente',
  missing: 'ausente na fonte',
}

export function CategoryBadge({
  categoria,
  proveniencia,
}: {
  categoria: Categoria
  proveniencia?: Proveniencia
}) {
  if (proveniencia === 'confirmed_business_rule') {
    return (
      <Tooltip content="Regra de negócio confirmada pela usuária em 10/09/2026. Não é inferência.">
        <Badge variant="positive" className="cursor-help">
          <CheckCircle2 className="size-3" />
          regra confirmada
        </Badge>
      </Tooltip>
    )
  }
  if (categoria === 'DADO EXISTENTE') return null
  const variant =
    categoria === 'INFERÊNCIA'
      ? 'inferred'
      : categoria === 'HIPÓTESE'
        ? 'warning'
        : categoria === 'NÃO DISPONÍVEL'
          ? 'outline'
          : 'neutral'
  const icon =
    categoria === 'INFERÊNCIA' ? (
      <CircleDashed className="size-3" />
    ) : categoria === 'HIPÓTESE' ? (
      <HelpCircle className="size-3" />
    ) : categoria === 'NÃO DISPONÍVEL' ? (
      <MinusCircle className="size-3" />
    ) : null
  return (
    <Tooltip content={CATEGORY_HINT[categoria]}>
      <Badge variant={variant} className="cursor-help">
        {icon}
        {categoria === 'DADO DERIVADO' ? 'derivado' : categoria.toLowerCase()}
      </Badge>
    </Tooltip>
  )
}

export function ProvenanceTag({ proveniencia }: { proveniencia: Proveniencia }) {
  return (
    <span className="text-2xs text-ink-faint">{PROVENANCE_LABEL[proveniencia]}</span>
  )
}

/** Aviso de cobertura: obrigatório sempre que a métrica não cobre 100% do acervo. */
export function CoverageNote({ cobertura }: { cobertura: Cobertura | null | undefined }) {
  if (!cobertura || cobertura.percentual >= 99.95) return null
  return (
    <Tooltip
      content={`${cobertura.cobertos} de ${cobertura.documentos} documentos entram nesta métrica. Os demais não têm o dado e NÃO recebem atribuição por inferência.`}
    >
      <Badge variant="warning" className="cursor-help">
        cobertura {pct(cobertura.percentual)}
      </Badge>
    </Tooltip>
  )
}

/** Rodapé de proveniência de um card. Fonte, snapshot, horário. */
export function ProvenanceFooter({ meta }: { meta: Meta | undefined }) {
  if (!meta) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-4 py-2 text-2xs text-ink-faint">
      <span>grão: {meta.grao}</span>
      <span aria-hidden>·</span>
      <span>{PROVENANCE_LABEL[meta.proveniencia]}</span>
      {meta.ciclo_id ? (
        <>
          <span aria-hidden>·</span>
          <span className="font-mono">ciclo {meta.ciclo_id}</span>
        </>
      ) : null}
      {meta.nota ? (
        <>
          <span aria-hidden>·</span>
          <Tooltip content={meta.nota}>
            <span className="cursor-help underline decoration-dotted underline-offset-2">
              nota
            </span>
          </Tooltip>
        </>
      ) : null}
    </div>
  )
}
