/**
 * Identidade do produto, em UM lugar só.
 *
 * Nome, subtítulos, navegação e marcas ficam centralizados aqui de propósito:
 * mudar o nome do produto é editar este arquivo, não caçar strings pela árvore.
 *
 * A paleta vive em `src/index.css` como tokens CSS — derivada da identidade
 * institucional Programa (ver docs/VISUAL_REDESIGN.md).
 */

export const PRODUCT = {
  /** Nome principal, em caixa alta na capa e na sidebar. */
  name: 'Repositório Jurídico',
  /** Assinatura institucional. */
  org: 'Escritório Jurídico',
  consortium: 'Programa',
  /**
   * Composição curta para a sidebar e o breadcrumb.
   *
   * A marca da barra lateral é o nome do produto (versão pública, sem logotipo) —
   * o selo "IJ" e a assinatura "Escritório Jurídico · Programa" saíram a pedido da usuária. O
   * subtítulo continua existindo para o cabeçalho da página, mas agora nomeia o
   * consórcio, não o escritório.
   */
  lockup: 'Repositório Jurídico',
  lockupSub: 'Programa · Fundo',
  /** Linha de apoio da capa. */
  tagline: 'Painel executivo do acervo jurídico',
  description:
    'Visão executiva da atuação e do acervo jurídico produzido pelo Escritório Jurídico no âmbito do Programa (dados fictícios).',
  /**
   * Nota de fonte. Não é mais exibida: o rodapé da aplicação saiu a pedido da
   * usuária. Fica aqui porque a frase é a redação aprovada da regra, e volta a
   * ser útil se algum dia precisar aparecer em impressão ou exportação.
   */
  footnote:
    'Fonte documental em modo somente leitura. Nenhum documento sai desta máquina.',
} as const

export const BRAND_ASSETS = {
  /**
   * Versão pública: os logotipos institucionais do contrato foram removidos.
   * A marca passa a ser tipográfica (ver `PRODUCT.lockup`); só a foto de capa,
   * genérica, continua como arquivo.
   */
  cover: '/brand/capa-rodovia.png',
} as const

/** Rótulo do bucket de documentos sem rodovia — mesma formulação do backend. */
/** Verde institucional do Parceiro, amostrado do material oficial. */
export const PARCEIRO_VERDE = '#015346'

export const ROTULO_GERAL = 'Geral / não vinculado a rodovia'

export interface NavItem {
  to: string
  label: string
  short: string
  icon: string
  description: string
}

/**
 * Navegação em lista única, sem cabeçalhos de seção.
 *
 * Os grupos "Visão / Análises / Documentos" saíram a pedido da usuária: com
 * quatro destinos, três títulos de seção eram mais texto do que navegação.
 *
 * Portfólio e Destinatários deixaram de ser páginas próprias — todo o conteúdo
 * dos dois vive agora dentro de Visão Geral. As rotas antigas continuam
 * respondendo e redirecionam para lá, para não quebrar link salvo.
 *
 * Governança e Atividade do Repositório saíram do menu por decisão anterior da
 * usuária — os endpoints, validações e testes continuam ativos no backend.
 */
export const NAV: NavItem[] = [
  {
    to: '/painel',
    label: 'Visão Geral',
    short: 'Visão Geral',
    icon: 'gauge',
    description: 'Panorama executivo do acervo, do portfólio e dos destinatários',
  },
  {
    to: '/linha-do-tempo',
    label: 'Linha do Tempo',
    short: 'Linha do Tempo',
    icon: 'activity',
    description: 'Evolução da produção jurídica no tempo',
  },
  {
    to: '/rodovias',
    label: 'Rodovias & Contratos',
    short: 'Rodovias',
    icon: 'route',
    description: 'Atuação por rodovia, contrato e executora',
  },
  {
    to: '/documentos',
    label: 'Acervo Documental',
    short: 'Documentos',
    icon: 'search',
    description: 'Busca, filtros e acesso ao documento original',
  },
]

export const ALL_NAV_ITEMS = NAV

/** Título da página a partir do pathname, para breadcrumb e <title>. */
export function pageTitle(pathname: string): string {
  const found = ALL_NAV_ITEMS.find((item) => item.to === pathname)
  if (found) return found.label
  if (pathname === '/') return 'Capa'
  return PRODUCT.lockup
}
