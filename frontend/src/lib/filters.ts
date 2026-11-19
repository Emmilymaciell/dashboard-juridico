/**
 * Estado de filtro vive na URL (DEC-011). Consequências de graça: link
 * compartilhável, botão voltar funcionando e visão reproduzível.
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { DocumentFilterValues } from './api'

export const MULTI_KEYS = [
  'natureza',
  'tema',
  'destinatario',
  'rodovia',
  'contrato',
  'status',
  'estagio',
  'macrogrupo',
] as const

export type MultiKey = (typeof MULTI_KEYS)[number]

export const FILTER_LABELS: Record<string, string> = {
  natureza: 'Natureza',
  tema: 'Tema',
  destinatario: 'Destinatário',
  rodovia: 'Rodovia',
  contrato: 'Contrato',
  status: 'Status',
  estagio: 'Estágio',
  macrogrupo: 'Macrogrupo',
  busca: 'Busca',
  data_inicio: 'De',
  data_fim: 'Até',
  somente_ativos: 'Somente ativos',
}

export function readFilters(params: URLSearchParams): DocumentFilterValues {
  const filters: DocumentFilterValues = {}
  for (const key of MULTI_KEYS) {
    const values = params.getAll(key).filter(Boolean)
    if (values.length) filters[key] = values
  }
  const busca = params.get('busca')
  if (busca) filters.busca = busca
  const inicio = params.get('data_inicio')
  if (inicio) filters.data_inicio = inicio
  const fim = params.get('data_fim')
  if (fim) filters.data_fim = fim
  if (params.get('somente_ativos') === '1') filters.somente_ativos = true
  return filters
}

export function countActive(filters: DocumentFilterValues): number {
  let total = 0
  for (const key of MULTI_KEYS) total += filters[key]?.length ?? 0
  if (filters.busca) total += 1
  if (filters.data_inicio) total += 1
  if (filters.data_fim) total += 1
  if (filters.somente_ativos) total += 1
  return total
}

export interface Chip {
  key: string
  value: string
  label: string
}

export function toChips(filters: DocumentFilterValues): Chip[] {
  const chips: Chip[] = []
  for (const key of MULTI_KEYS) {
    for (const value of filters[key] ?? []) {
      chips.push({ key, value, label: FILTER_LABELS[key] ?? key })
    }
  }
  if (filters.busca) chips.push({ key: 'busca', value: filters.busca, label: 'Busca' })
  if (filters.data_inicio)
    chips.push({ key: 'data_inicio', value: filters.data_inicio, label: 'De' })
  if (filters.data_fim) chips.push({ key: 'data_fim', value: filters.data_fim, label: 'Até' })
  if (filters.somente_ativos)
    chips.push({ key: 'somente_ativos', value: '1', label: 'Somente ativos' })
  return chips
}

export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])

  const toggle = useCallback(
    (key: MultiKey, value: string) => {
      const next = new URLSearchParams(params)
      const current = next.getAll(key)
      next.delete(key)
      const remaining = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      for (const item of remaining) next.append(key, item)
      setParams(next, { replace: false })
    },
    [params, setParams],
  )

  const setValue = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params)
      next.delete(key)
      if (value) next.set(key, value)
      setParams(next, { replace: key === 'busca' })
    },
    [params, setParams],
  )

  const setMany = useCallback(
    (values: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(params)
      for (const [key, value] of Object.entries(values)) {
        next.delete(key)
        if (Array.isArray(value)) {
          for (const item of value) if (item) next.append(key, item)
        } else if (value) {
          next.set(key, value)
        }
      }
      setParams(next, { replace: false })
    },
    [params, setParams],
  )

  const removeChip = useCallback(
    (chip: Chip) => {
      const next = new URLSearchParams(params)
      if ((MULTI_KEYS as readonly string[]).includes(chip.key)) {
        const remaining = next.getAll(chip.key).filter((v) => v !== chip.value)
        next.delete(chip.key)
        for (const item of remaining) next.append(chip.key, item)
      } else {
        next.delete(chip.key)
      }
      setParams(next, { replace: false })
    },
    [params, setParams],
  )

  const clear = useCallback(() => {
    const next = new URLSearchParams(params)
    for (const key of [...MULTI_KEYS, 'busca', 'data_inicio', 'data_fim', 'somente_ativos'])
      next.delete(key)
    setParams(next, { replace: false })
  }, [params, setParams])

  return {
    filters,
    chips: toChips(filters),
    activeCount: countActive(filters),
    toggle,
    setValue,
    setMany,
    removeChip,
    clear,
    params,
  }
}

/** Converte o `drill` de um KPI em query string do Document Explorer. */
export function drillToSearch(
  drill: Record<string, unknown> | DocumentFilterValues | null | undefined,
): string {
  if (!drill) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(drill)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item))
    } else if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
