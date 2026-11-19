/**
 * Cliente tipado da API. O frontend NUNCA lê Excel, nunca toca disco, nunca
 * recalcula agregação: tudo vem daqui.
 */

const BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1'

// ---------------------------------------------------------------- contratos
export type Categoria =
  | 'DADO EXISTENTE'
  | 'DADO DERIVADO'
  | 'INFERÊNCIA'
  | 'HIPÓTESE'
  | 'NÃO DISPONÍVEL'

export type Proveniencia =
  | 'source'
  | 'derived'
  | 'confirmed_business_rule'
  | 'inferred'
  | 'taxonomy_pending'
  | 'missing'

export type Severidade = 'high' | 'medium' | 'low' | 'info'

export interface Cobertura {
  documentos: number
  cobertos: number
  percentual: number
}

export interface Meta {
  categoria: Categoria
  proveniencia: Proveniencia
  grao: string
  cobertura: Cobertura | null
  ciclo_id: string | null
  indexed_as_of: string | null
  physical_scan_as_of: string | null
  regras_negocio_versao: number | null
  filtros_aplicados: Record<string, unknown>
  nota: string | null
}

export interface MetaSnapshot {
  ciclo_id: string
  schema_version: string
  regras_negocio_versao: number
  regras_confirmadas_em: string | null
  indexed_as_of: string | null
  physical_scan_as_of: string
  pending_reconciliation_count: number
  indexing_gap_count: number
  documentos_indexados: number
  documentos_ativos: number
  documentos_excluidos: number
  acervo_fisico: number
  arquivos_controle: number
  vinculos_tema: number
  docs_com_rodovia: number
  docs_com_contrato: number
  indice_sha256: string | null
  inventario_digest: string | null
  achados_por_severidade: Record<string, number>
  rotulos_reconciliacao: Record<string, string>
  relogios_divergentes: boolean
}

export interface Kpi {
  chave: string
  rotulo: string
  valor: number
  unidade: 'contagem' | 'percentual'
  delta: number | null
  delta_rotulo: string | null
  detalhe: string | null
  categoria: Categoria
  proveniencia: Proveniencia
  drill: Record<string, unknown> | null
  tom: 'neutro' | 'positivo' | 'atencao'
}

export interface ContagemItem {
  chave: string
  documentos: number
  ativos: number | null
  vinculos: number | null
  extra: Record<string, unknown>
}

export interface PontoTemporal {
  periodo: string
  documentos: number
  ativos: number
  naturezas: number | null
  precisao_mensal: number | null
  sancionatorios: number | null
}

export interface DocumentoResumo {
  documento_id: number
  data_documento: string | null
  data_documento_precisao: string | null
  natureza: string | null
  assunto: string | null
  destinatario: string | null
  temas_texto: string | null
  temas_count: number
  rodovia_principal: string | null
  contrato: string | null
  estagio_documental: string | null
  macrogrupo_juridico: string | null
  status: string
  ativo: boolean
  arquivo_extensao: string | null
  arquivo_nome: string
  pasta: string | null
  link_disponivel: boolean
}

export interface DocumentoDetalhe extends DocumentoResumo {
  link_url: string | null
  necessidade_resposta: number | null
  data_indexacao: string | null
  data_indexacao_aproximada: boolean
  data_ultima_modificacao: string | null
  pessoa_upload: string | null
  pessoa_modificacao: string | null
  nome_conforme_padrao: boolean
  nome_assunto: string | null
  nome_destinatario_curto: string | null
  destinatario_status_taxonomia: string | null
  contrato_origem: string | null
  executora: string | null
  macrogrupo_status: string | null
  macrogrupo_origem: string | null
  estagio_proveniencia: string | null
  contrato_proveniencia: string | null
  rodovia_proveniencia: string | null
  temas: Array<{ tema: string; ordem: number; status_taxonomia: string; proveniencia: string }>
  rodovias: Array<{ rodovia: string; campo_origem: string; confianca: string; proveniencia: string }>
  relacionados: Array<{
    documento_id: number
    data_documento: string | null
    natureza: string | null
    assunto: string | null
    destinatario: string | null
    status: string
    relacao: string
  }>
}

/* ---------------------------------------------- páginas (endpoints novos) */

export interface NivelPrioridade {
  nivel: number
  rotulo: string
  rotulo_completo: string
  documentos: number
  percentual: number
  previsto_nao_utilizado: boolean
}

export interface PrioridadePayload {
  niveis: NivelPrioridade[]
  sem_classificacao: number
  total: number
  niveis_previstos: number
  niveis_em_uso: number
  diferencia_registros: boolean
  aviso: string | null
  materias_de_atencao: Array<{ chave: string; documentos: number }>
}

export interface AnoItem {
  ano: number
  documentos: number
  participacao: number
}

export interface RodoviaItem {
  chave: string
  documentos: number
  documentos_confianca_alta: number | null
  contrato: string | null
  executora: string | null
}

export interface RodoviasPayload {
  rodovias: RodoviaItem[]
  geral: { chave: string; documentos: number; nota?: string }
  total: number
}

export interface NaturezaPortfolio {
  natureza: string
  documentos: number
  ativos: number
  primeiro: string | null
  ultimo: string | null
  macrogrupo: string | null
  destinatarios: number
  participacao: number
  temas: Array<{ chave: string; documentos: number }>
  serie: Array<{ periodo: string; documentos: number }>
}

export interface PortfolioPayload {
  naturezas: NaturezaPortfolio[]
  macrogrupos: Array<{ chave: string; documentos: number }>
  temas: ContagemItem[]
  total: number
}

export interface MesTimeline {
  periodo: string
  documentos: number
  sancionatorios: number
  naturezas: number
  destinatarios: number
  precisao_mensal: number
  destaques?: Array<{
    documento_id: number
    assunto: string | null
    natureza: string | null
    destinatario: string | null
    data_documento: string | null
  }>
}

export interface TimelinePayload {
  meses: MesTimeline[]
  anos: AnoItem[]
  por_natureza_mes: Array<{ periodo: string; natureza: string; documentos: number }>
  picos: MesTimeline[]
  total: number
}

export interface DestinatarioDetalhe {
  destinatario: string
  documentos: number
  naturezas: number
  primeiro: string | null
  ultimo: string | null
  participacao: number
  generico: boolean
  naturezas_top: Array<{ chave: string; documentos: number }>
  temas_top: Array<{ chave: string; documentos: number }>
}

export interface StakeholdersPayload {
  destinatarios: DestinatarioDetalhe[]
  total: number
  matriz: Array<{ linha: string; coluna: string; documentos: number }>
}

export interface RodoviaDetalhe {
  rodovia: string
  documentos: number
  documentos_confianca_alta: number
  contrato: string | null
  executora: string | null
  primeiro: string | null
  ultimo: string | null
  sancionatorios: number
  naturezas: Array<{ chave: string; documentos: number }>
  temas: Array<{ chave: string; documentos: number }>
  recentes: Array<{
    documento_id: number
    data_documento: string | null
    natureza: string | null
    assunto: string | null
    destinatario: string | null
  }>
  serie: Array<{ periodo: string; documentos: number }>
}

export interface RoadsDetailPayload {
  rodovias: RodoviaDetalhe[]
  contratos: Array<Record<string, unknown>>
  geral: { chave: string; documentos: number }
  total: number
}

export interface OverviewPayload {
  kpis: Kpi[]
  serie_mensal: PontoTemporal[]
  naturezas: ContagemItem[]
  temas: ContagemItem[]
  destinatarios: ContagemItem[]
  rodovias: RodoviasPayload
  prioridade: PrioridadePayload
  anos: AnoItem[]
  recentes: DocumentoResumo[]
}

export interface Achado {
  regra_key: string
  severidade: Severidade
  entidade_tipo: string
  entidade_id: string
  descricao: string
  proveniencia: string
}

export interface BlocoGovernanca {
  chave: string
  titulo: string
  descricao: string
  itens: Array<Record<string, unknown>>
}

export interface GovernancePayload {
  resumo: {
    achados_total: number
    por_severidade: Record<Severidade, number>
    documentos: number
    acervo_fisico: number
    pendentes_reconciliacao: number
    lacunas_indexacao: number
    score_completude: number
    formula_score: string
  }
  blocos: BlocoGovernanca[]
  achados: Achado[]
}

export interface FilterOptions {
  natureza: string[]
  tema: string[]
  destinatario: string[]
  rodovia: string[]
  contrato: string[]
  status: string[]
  estagio: Array<{ chave: string; rotulo: string }>
  macrogrupo: string[]
}

export interface HealthPayload {
  status: string
  modelo_construido: boolean
  duckdb_path: string
  ciclo_id?: string
  documentos?: number
  acao?: string
}

// ------------------------------------------------------------------- cliente
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo?: string,
    readonly acao?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | string[] | null | undefined
>

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || value === false) continue
    if (Array.isArray(value)) {
      for (const item of value) if (item) search.append(key, item)
    } else {
      search.append(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function request<T>(path: string, params?: QueryParams): Promise<T> {
  const url = `${BASE}${path}${params ? buildQuery(params) : ''}`
  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ApiError(
      'Não foi possível falar com a API. O backend está rodando na porta 8000?',
      0,
      'REDE',
      'python -m uvicorn backend.app.main:app --port 8000',
    )
  }
  if (!response.ok) {
    let codigo: string | undefined
    let mensagem = `Falha na requisição (${response.status})`
    let acao: string | undefined
    try {
      const body = (await response.json()) as { erro?: { codigo: string; mensagem: string; detalhe?: { acao?: string } }; detail?: string }
      if (body.erro) {
        codigo = body.erro.codigo
        mensagem = body.erro.mensagem
        acao = body.erro.detalhe?.acao
      } else if (body.detail) {
        mensagem = body.detail
      }
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(mensagem, response.status, codigo, acao)
  }
  return (await response.json()) as T
}

export interface DocumentFilterValues {
  data_inicio?: string
  data_fim?: string
  natureza?: string[]
  tema?: string[]
  destinatario?: string[]
  rodovia?: string[]
  contrato?: string[]
  status?: string[]
  estagio?: string[]
  macrogrupo?: string[]
  busca?: string
  somente_ativos?: boolean
}

export const api = {
  health: () => request<HealthPayload>('/health'),
  meta: () => request<{ data: MetaSnapshot; meta: Meta }>('/meta'),
  rules: () => request<Record<string, unknown>>('/meta/rules'),
  overview: (filters: DocumentFilterValues) =>
    request<{ data: OverviewPayload; meta: Meta }>('/overview', filters as QueryParams),
  timeline: (filters: DocumentFilterValues, granularidade = 'mes') =>
    request<{ data: PontoTemporal[]; meta: Meta }>('/timeline', {
      ...(filters as QueryParams),
      granularidade,
    }),
  natures: (filters: DocumentFilterValues) =>
    request<{ data: ContagemItem[]; meta: Meta }>('/natures', filters as QueryParams),
  themes: (filters: DocumentFilterValues) =>
    request<{ data: ContagemItem[]; meta: Meta }>('/themes', filters as QueryParams),
  stakeholders: (filters: DocumentFilterValues) =>
    request<{ data: ContagemItem[]; meta: Meta }>('/stakeholders', filters as QueryParams),
  roads: (filters: DocumentFilterValues) =>
    request<{ data: ContagemItem[]; meta: Meta }>('/roads', filters as QueryParams),
  contracts: (filters: DocumentFilterValues) =>
    request<{ data: ContagemItem[]; meta: Meta }>('/contracts', filters as QueryParams),
  documents: (
    filters: DocumentFilterValues,
    opts: { limite?: number; offset?: number; ordenar_por?: string; ordem?: string } = {},
  ) =>
    request<{
      data: {
        itens: DocumentoResumo[]
        total: number
        limite: number
        offset: number
        ordenar_por: string
        ordem: string
      }
      meta: Meta
    }>('/documents', { ...(filters as QueryParams), ...opts }),
  document: (id: number) =>
    request<{ data: DocumentoDetalhe; meta: Meta }>(`/documents/${id}`),
  governance: () => request<{ data: GovernancePayload; meta: Meta }>('/governance'),
  repositoryActivity: () =>
    request<{ data: Record<string, unknown>; meta: Meta }>('/repository-activity'),
  filterOptions: () => request<FilterOptions>('/filters/options'),
  responsePriority: (filters: DocumentFilterValues) =>
    request<{ data: PrioridadePayload; meta: Meta }>(
      '/response-priority',
      filters as QueryParams,
    ),
  years: (filters: DocumentFilterValues) =>
    request<{ data: AnoItem[]; meta: Meta }>('/years', filters as QueryParams),
  portfolio: (filters: DocumentFilterValues) =>
    request<{ data: PortfolioPayload; meta: Meta }>('/portfolio', filters as QueryParams),
  timelineDetail: (filters: DocumentFilterValues) =>
    request<{ data: TimelinePayload; meta: Meta }>('/timeline-detail', filters as QueryParams),
  stakeholdersDetail: (filters: DocumentFilterValues) =>
    request<{ data: StakeholdersPayload; meta: Meta }>(
      '/stakeholders-detail',
      filters as QueryParams,
    ),
  roadsDetail: (filters: DocumentFilterValues) =>
    request<{ data: RoadsDetailPayload; meta: Meta }>('/roads-detail', filters as QueryParams),
  matrix: (filters: DocumentFilterValues, linhas: string, colunas: string) =>
    request<{ data: Array<{ linha: string; coluna: string; documentos: number }>; meta: Meta }>(
      '/matrix',
      { ...(filters as QueryParams), linhas, colunas },
    ),
  exportCsvUrl: (filters: DocumentFilterValues) =>
    `${BASE}/documents/export/csv${buildQuery(filters as QueryParams)}`,
}
