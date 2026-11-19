import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * `cn` com o tailwind-merge ciente da nossa escala tipográfica customizada.
 *
 * Sem isto, o tailwind-merge não reconhece `text-kpi` como tamanho de fonte —
 * cai no palpite de que é cor — e uma classe de cor posterior o elimina do
 * resultado. Foi exatamente o que aconteceu: `cn('text-kpi', 'text-ink')`
 * devolvia só `text-ink`, e os KPIs da Visão Geral renderizavam em 14px em vez
 * de 48px. Registrar as chaves aqui é o que faz a escala executiva valer.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['kpi', 'kpi-lg', 'kpi-sm', 'display'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Marcas diacríticas combinantes (U+0300–U+036F). Escrito com escapes para não
// depender de o arquivo carregar os caracteres literais.
const COMBINING_MARKS = /[̀-ͯ]/g

/** minúsculas sem acento — mesma regra do backend, para busca local coerente. */
export function fold(value: string): string {
  return value.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase().trim()
}

/** Paleta categórica de dados: 8 cores, atribuídas por posição no ranking. */
export function dataColor(index: number): string {
  return `hsl(var(--data-${(index % 8) + 1}))`
}

/**
 * O mapa de cor por matéria mudou de casa: agora é semântico e mora em
 * `lib/cores.ts`. Aqui fica só o reexporte, para não quebrar quem importava
 * daqui — e para deixar registrado que a versão antiga atribuía a cor pela
 * POSIÇÃO na lista ordenada por volume, o que fazia a mesma matéria trocar de
 * cor quando um filtro mudava o ranking.
 */
export { MATERIA_NAO_CLASSIFICADA, coresPorMateria } from '@/lib/cores'

