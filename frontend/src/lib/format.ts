const NUM = new Intl.NumberFormat('pt-BR')
const PCT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function num(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return NUM.format(value)
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${PCT.format(value)}%`
}

export function signed(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${PCT.format(value)}%`
}

/** Data ISO -> pt-BR. Precisão mensal mostra mês/ano, nunca um dia inventado. */
export function date(iso: string | null | undefined, precision?: string | null): string {
  if (!iso) return '—'
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  if (precision === 'mes') {
    return parsed
      .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      .replace('.', '')
  }
  return parsed.toLocaleDateString('pt-BR')
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** '2026-03' -> 'mar/26'. Eixo de gráfico precisa de rótulo curto e legível. */
export function monthLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return period
  const month = MONTHS[Number(match[2]) - 1] ?? match[2]
  return `${month}/${match[1]!.slice(2)}`
}

export function truncate(value: string | null | undefined, max = 60): string {
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
