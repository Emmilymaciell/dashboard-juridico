/**
 * Cross-filter da Visão Geral.
 *
 * O que se testa aqui é o contrato que os gráficos assinam: clicar acumula,
 * clicar de novo desfaz, e tempo troca em vez de acumular. O estado em si é a
 * URL, e ela já tem teste próprio em `lib/filters.test.ts` — o que se mede
 * abaixo é a TRADUÇÃO entre a dimensão que o gráfico enxerga e a chave que a
 * API entende.
 */

import { act, renderHook } from '@testing-library/react'
import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { intervaloDe, useCruzamento } from '@/features/overview/cruzamento'
import { useFilters } from '@/lib/filters'

function montar(inicial = '/painel') {
  return renderHook(
    () => ({ cruzamento: useCruzamento(), filtros: useFilters() }),
    {
      wrapper: ({ children }) =>
        React.createElement(MemoryRouter, { initialEntries: [inicial] }, children),
    },
  )
}

describe('intervalo de um período selecionado', () => {
  it('ano vira o ano inteiro', () => {
    expect(intervaloDe('ano', '2026')).toEqual({ inicio: '2026-01-01', fim: '2026-12-31' })
  })

  it('mês vai até o último dia real, não até o dia 30', () => {
    expect(intervaloDe('mes', '2026-02')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(intervaloDe('mes', '2024-02')).toEqual({ inicio: '2024-02-01', fim: '2024-02-29' })
    expect(intervaloDe('mes', '2026-01')).toEqual({ inicio: '2026-01-01', fim: '2026-01-31' })
  })

  it('dia é ele mesmo nas duas pontas', () => {
    expect(intervaloDe('dia', '2026-03-17')).toEqual({ inicio: '2026-03-17', fim: '2026-03-17' })
  })
})

describe('cross-filter: um gráfico filtra a página inteira', () => {
  it('clicar numa matéria escreve macrogrupo na URL', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('materia', 'Sancionatório'))
    expect(result.current.filtros.filters.macrogrupo).toEqual(['Sancionatório'])
    expect(result.current.cruzamento.ativo('materia', 'Sancionatório')).toBe(true)
  })

  it('dimensões diferentes se acumulam', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('materia', 'Sancionatório'))
    act(() => result.current.cruzamento.aplicar('destinatario', 'Parceiro'))
    act(() => result.current.cruzamento.aplicar('ano', '2026'))

    const { filters } = result.current.filtros
    expect(filters.macrogrupo).toEqual(['Sancionatório'])
    expect(filters.destinatario).toEqual(['Parceiro'])
    expect(filters.data_inicio).toBe('2026-01-01')
    expect(filters.data_fim).toBe('2026-12-31')
    expect(result.current.cruzamento.total).toBe(3)
  })

  it('valores da MESMA dimensão também se acumulam', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('tema', 'Contrato'))
    act(() => result.current.cruzamento.aplicar('tema', 'Governança'))
    expect(result.current.filtros.filters.tema).toEqual(['Contrato', 'Governança'])
  })

  it('clicar no mesmo valor de novo desfaz só aquele filtro', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('materia', 'Sancionatório'))
    act(() => result.current.cruzamento.aplicar('natureza', 'Minuta'))
    act(() => result.current.cruzamento.aplicar('materia', 'Sancionatório'))

    expect(result.current.filtros.filters.macrogrupo).toBeUndefined()
    expect(result.current.filtros.filters.natureza).toEqual(['Minuta'])
    expect(result.current.cruzamento.total).toBe(1)
  })

  it('tempo TROCA em vez de acumular: dois períodos não viram união', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('ano', '2025'))
    act(() => result.current.cruzamento.aplicar('mes', '2026-03'))

    expect(result.current.filtros.filters.data_inicio).toBe('2026-03-01')
    expect(result.current.filtros.filters.data_fim).toBe('2026-03-31')
    expect(result.current.cruzamento.ativo('ano', '2025')).toBe(false)
    expect(result.current.cruzamento.total).toBe(1)
  })

  it('clicar no mesmo período de novo remove o recorte temporal', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('mes', '2026-03'))
    act(() => result.current.cruzamento.aplicar('mes', '2026-03'))
    expect(result.current.filtros.filters.data_inicio).toBeUndefined()
    expect(result.current.filtros.filters.data_fim).toBeUndefined()
    expect(result.current.cruzamento.dimensaoAtiva('mes')).toBe(false)
  })

  it('remover um chip tira só aquela dimensão', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('materia', 'Sancionatório'))
    act(() => result.current.cruzamento.aplicar('destinatario', 'Parceiro'))
    act(() =>
      result.current.filtros.removeChip({
        key: 'macrogrupo',
        value: 'Sancionatório',
        label: 'Macrogrupo',
      }),
    )
    expect(result.current.filtros.filters.macrogrupo).toBeUndefined()
    expect(result.current.filtros.filters.destinatario).toEqual(['Parceiro'])
  })

  it('limpar tudo zera qualquer dimensão, inclusive a temporal', () => {
    const { result } = montar()
    act(() => result.current.cruzamento.aplicar('materia', 'Sancionatório'))
    act(() => result.current.cruzamento.aplicar('ano', '2026'))
    act(() => result.current.filtros.clear())
    expect(result.current.cruzamento.total).toBe(0)
  })

  it('o estado vem da URL: link colado reabre no mesmo recorte', () => {
    const { result } = montar('/painel?macrogrupo=Sancionat%C3%B3rio&destinatario=Parceiro')
    expect(result.current.cruzamento.ativo('materia', 'Sancionatório')).toBe(true)
    expect(result.current.cruzamento.ativo('destinatario', 'Parceiro')).toBe(true)
    expect(result.current.cruzamento.total).toBe(2)
  })
})
