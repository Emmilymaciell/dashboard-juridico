/**
 * Indicador de atualização dos dados — discreto, na topbar.
 *
 * A defasagem entre a fonte estruturada e o inventário físico saiu do destaque
 * executivo por decisão da usuária. A informação continua existindo: fica num
 * ponto de status com tooltip, não como cartão na primeira dobra.
 */

import { CircleDot } from 'lucide-react'

import { dateTime } from '@/lib/format'
import { useMeta } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/ui/primitives'

export function DataFreshness() {
  const { data: meta } = useMeta()
  if (!meta) return null

  const divergente = meta.relogios_divergentes && meta.pending_reconciliation_count > 0
  const atualizado = meta.indexed_as_of ?? meta.physical_scan_as_of

  return (
    <Tooltip
      side="bottom"
      align="end"
      content={
        <div className="space-y-1.5">
          <p>
            <b>Fonte estruturada</b> atualizada em {dateTime(meta.indexed_as_of)}.
          </p>
          {divergente ? (
            <>
              <p>
                Inventário físico observado em {dateTime(meta.physical_scan_as_of)}:{' '}
                {meta.pending_reconciliation_count} documento(s) chegaram depois da última
                varredura do indexador.
              </p>
              <p className="text-ink-faint">
                É defasagem normal entre dois sistemas, não falha de qualidade. A
                atualização roda no projeto repositorio_juridico.
              </p>
            </>
          ) : (
            <p className="text-ink-faint">
              Índice e inventário físico sincronizados. {meta.documentos_indexados} documentos
              no modelo · ciclo {meta.ciclo_id}.
            </p>
          )}
        </div>
      }
    >
      <button
        type="button"
        className="hidden shrink-0 items-center gap-2 rounded-lg border border-line px-2.5 py-1.5
                   text-left transition-colors hover:bg-subtle md:flex"
      >
        <CircleDot
          className={cn(
            'size-3 shrink-0',
            divergente ? 'text-warning' : 'text-positive',
          )}
        />
        <span>
          <span className="block text-2xs leading-none text-ink-faint">Dados de</span>
          <span className="tabular block text-xs font-medium leading-tight text-ink">
            {dateTime(atualizado).replace(', ', ' · ')}
          </span>
        </span>
      </button>
    </Tooltip>
  )
}
