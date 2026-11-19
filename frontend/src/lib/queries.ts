/**
 * Hooks de estado de servidor (TanStack Query). Cache, revalidação e estados de
 * loading/erro/vazio saem daqui — são requisito de UI, não enfeite.
 */

import { useQuery } from '@tanstack/react-query'

import { api, type DocumentFilterValues } from './api'

const FIVE_MINUTES = 5 * 60 * 1000

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: async () => (await api.meta()).data,
    staleTime: FIVE_MINUTES,
  })
}

export function useOverview(filters: DocumentFilterValues) {
  return useQuery({
    queryKey: ['overview', filters],
    queryFn: () => api.overview(filters),
    staleTime: FIVE_MINUTES,
  })
}

export function useDocuments(
  filters: DocumentFilterValues,
  opts: { limite: number; offset: number; ordenar_por: string; ordem: string },
) {
  return useQuery({
    queryKey: ['documents', filters, opts],
    queryFn: () => api.documents(filters, opts),
    staleTime: FIVE_MINUTES,
    placeholderData: (previous) => previous,
  })
}

export function useDocument(id: number | null) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => api.document(id as number),
    enabled: id !== null,
    staleTime: FIVE_MINUTES,
  })
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: api.filterOptions,
    staleTime: FIVE_MINUTES,
  })
}

export function usePortfolio(filters: DocumentFilterValues) {
  return useQuery({
    queryKey: ['portfolio', filters],
    queryFn: () => api.portfolio(filters),
    staleTime: FIVE_MINUTES,
  })
}

/**
 * Série na granularidade pedida. A Linha do Tempo usa `'dia'`, que exclui de
 * propósito os documentos sem dia definido na fonte — ver a nota em `meta`.
 */
export function useTimeline(filters: DocumentFilterValues, granularidade = 'mes') {
  return useQuery({
    queryKey: ['timeline', filters, granularidade],
    queryFn: () => api.timeline(filters, granularidade),
    staleTime: FIVE_MINUTES,
  })
}

export function useTimelineDetail(filters: DocumentFilterValues) {
  return useQuery({
    queryKey: ['timeline-detail', filters],
    queryFn: () => api.timelineDetail(filters),
    staleTime: FIVE_MINUTES,
  })
}

export function useStakeholdersDetail(filters: DocumentFilterValues) {
  return useQuery({
    queryKey: ['stakeholders-detail', filters],
    queryFn: () => api.stakeholdersDetail(filters),
    staleTime: FIVE_MINUTES,
  })
}

export function useRoadsDetail(filters: DocumentFilterValues) {
  return useQuery({
    queryKey: ['roads-detail', filters],
    queryFn: () => api.roadsDetail(filters),
    staleTime: FIVE_MINUTES,
  })
}

export function useMatrix(filters: DocumentFilterValues, linhas: string, colunas: string) {
  return useQuery({
    queryKey: ['matrix', filters, linhas, colunas],
    queryFn: () => api.matrix(filters, linhas, colunas),
    staleTime: FIVE_MINUTES,
  })
}

export function useGovernance() {
  return useQuery({
    queryKey: ['governance'],
    queryFn: async () => (await api.governance()).data,
    staleTime: FIVE_MINUTES,
  })
}
