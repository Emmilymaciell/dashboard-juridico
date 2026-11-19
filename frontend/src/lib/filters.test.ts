import { describe, expect, it } from 'vitest'

import { buildQuery } from '@/lib/api'
import { countActive, drillToSearch, readFilters, toChips } from '@/lib/filters'
import { fold } from '@/lib/utils'
import { date, monthLabel, num, pct, signed } from '@/lib/format'

describe('estado de filtro na URL (DEC-011)', () => {
  it('lê filtros multivalorados da query string', () => {
    const params = new URLSearchParams('natureza=Edital&natureza=Errata&tema=Contrato')
    const filters = readFilters(params)
    expect(filters.natureza).toEqual(['Edital', 'Errata'])
    expect(filters.tema).toEqual(['Contrato'])
  })

  it('lê busca, período e somente_ativos', () => {
    const params = new URLSearchParams(
      'busca=eventograma&data_inicio=2026-01-01&data_fim=2026-06-30&somente_ativos=1',
    )
    const filters = readFilters(params)
    expect(filters.busca).toBe('eventograma')
    expect(filters.data_inicio).toBe('2026-01-01')
    expect(filters.data_fim).toBe('2026-06-30')
    expect(filters.somente_ativos).toBe(true)
  })

  it('ignora valores vazios', () => {
    const filters = readFilters(new URLSearchParams('natureza=&busca='))
    expect(filters.natureza).toBeUndefined()
    expect(filters.busca).toBeUndefined()
  })

  it('conta filtros ativos somando cada valor', () => {
    const filters = readFilters(
      new URLSearchParams('natureza=Edital&natureza=Errata&tema=Contrato&busca=x'),
    )
    expect(countActive(filters)).toBe(4)
  })

  it('gera um chip por valor, não por dimensão', () => {
    const chips = toChips(readFilters(new URLSearchParams('natureza=Edital&natureza=Errata')))
    expect(chips).toHaveLength(2)
    expect(chips.map((c) => c.value)).toEqual(['Edital', 'Errata'])
    expect(chips[0]!.label).toBe('Natureza')
  })

  it('a visão é reproduzível: ler e reescrever não perde filtro', () => {
    const original = 'natureza=Edital&tema=Contrato&tema=Aditivo&busca=rd+101'
    const filters = readFilters(new URLSearchParams(original))
    const rebuilt = new URLSearchParams(buildQuery(filters as never))
    expect(rebuilt.getAll('tema')).toEqual(['Contrato', 'Aditivo'])
    expect(rebuilt.get('busca')).toBe('rd 101')
  })
})

describe('drill-down de KPI para o Document Explorer', () => {
  it('converte o drill em query string', () => {
    expect(drillToSearch({ natureza: ['Advertência'] })).toBe('?natureza=Advert%C3%AAncia')
  })

  it('preserva múltiplos valores', () => {
    const search = new URLSearchParams(drillToSearch({ tema: ['A', 'B'], status: ['Na pasta'] }))
    expect(search.getAll('tema')).toEqual(['A', 'B'])
    expect(search.get('status')).toBe('Na pasta')
  })

  it('drill vazio não gera query', () => {
    expect(drillToSearch(null)).toBe('')
    expect(drillToSearch({})).toBe('')
  })
})

describe('buildQuery', () => {
  it('descarta null, undefined, string vazia e false', () => {
    expect(buildQuery({ a: null, b: undefined, c: '', d: false, e: 'ok' })).toBe('?e=ok')
  })

  it('mantém zero, que é valor legítimo', () => {
    expect(buildQuery({ offset: 0 })).toBe('?offset=0')
  })

  it('expande array em repetição da chave', () => {
    expect(buildQuery({ natureza: ['A', 'B'] })).toBe('?natureza=A&natureza=B')
  })
})

describe('fold — mesma regra do backend', () => {
  it('remove acento e caixa', () => {
    expect(fold('Advertência')).toBe('advertencia')
    expect(fold('Sanções / Advertência')).toBe('sancoes / advertencia')
    expect(fold('Alfa')).toBe('alfa')
  })

  it('permite comparar pasta independente da caixa', () => {
    expect(fold('consulta')).toBe(fold('Consulta'))
  })
})

describe('formatação', () => {
  it('números em pt-BR', () => {
    expect(num(1234)).toBe('1.234')
    expect(num(0)).toBe('0')
  })

  it('ausência de valor não vira zero', () => {
    expect(num(null)).toBe('—')
    expect(num(undefined)).toBe('—')
    expect(pct(null)).toBe('—')
  })

  it('percentual e delta com sinal', () => {
    expect(pct(49)).toBe('49,0%')
    expect(signed(12.5)).toBe('+12,5%')
    expect(signed(-3)).toBe('-3,0%')
  })

  it('data com precisão mensal não inventa dia', () => {
    expect(date('2026-03-01', 'dia')).toBe('01/03/2026')
    expect(date('2026-03-01', 'mes')).toMatch(/mar.*2026/)
  })

  it('data ausente é travessão, não data falsa', () => {
    expect(date(null)).toBe('—')
  })

  it('rótulo curto de mês para o eixo do gráfico', () => {
    expect(monthLabel('2026-03')).toBe('mar/26')
    expect(monthLabel('2025-11')).toBe('nov/25')
    expect(monthLabel('invalido')).toBe('invalido')
  })
})
