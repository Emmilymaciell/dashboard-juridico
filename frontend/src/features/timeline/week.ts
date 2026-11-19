/**
 * Aritmética e rótulos de DATA — o alicerce de todas as escalas.
 *
 * O recorte do tempo em colunas mora em `escalas.ts`; aqui ficam só as
 * operações que não dependem de estar olhando semana, mês ou ano.
 *
 * Datas aqui são sempre `AAAA-MM-DD` em string, nunca `Date` com fuso — o
 * backend devolve string e converter para `Date` no navegador introduz
 * deslocamento de um dia dependendo do fuso. Toda aritmética usa UTC.
 */

export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

/** `AAAA-MM-DD` -> Date em UTC, sem surpresa de fuso. */
export function paraData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1))
}

export function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function somarDias(iso: string, dias: number): string {
  const d = paraData(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraIso(d)
}

/** Segunda-feira da semana que contém `iso`. Semana pt-BR começa na segunda. */
export function inicioDaSemana(iso: string): string {
  const d = paraData(iso)
  // getUTCDay(): 0 = domingo. Queremos segunda como dia 0 da nossa semana.
  const desloc = (d.getUTCDay() + 6) % 7
  return somarDias(iso, -desloc)
}

export function diasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
}

/** "14 abr" */
export function rotuloDiaMes(iso: string): string {
  const d = paraData(iso)
  const mes = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
  return `${d.getUTCDate()} ${mes}`
}

/** "14 de abril de 2025" */
export function rotuloDataLongo(iso: string): string {
  return paraData(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "14 – 20 de abril de 2025" — cabeçalho da semana. */
export function rotuloIntervaloSemana(inicio: string): string {
  const fim = somarDias(inicio, 6)
  const a = paraData(inicio)
  const b = paraData(fim)
  const mesA = a.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const mesB = b.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const anoA = a.getUTCFullYear()
  const anoB = b.getUTCFullYear()
  if (anoA !== anoB) {
    return `${a.getUTCDate()} de ${mesA} de ${anoA} – ${b.getUTCDate()} de ${mesB} de ${anoB}`
  }
  if (mesA !== mesB) {
    return `${a.getUTCDate()} de ${mesA} – ${b.getUTCDate()} de ${mesB} de ${anoB}`
  }
  return `${a.getUTCDate()} – ${b.getUTCDate()} de ${mesB} de ${anoB}`
}
