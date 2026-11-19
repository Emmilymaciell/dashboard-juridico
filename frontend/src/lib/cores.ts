/**
 * Mapa semântico de cor. UM lugar só, para a página inteira.
 *
 * A regra é simples e vale para todo gráfico: **cor significa categoria, nunca
 * posição**. Se Sancionatório é âmbar, ele é âmbar no treemap, na produção
 * mensal, no Sankey, no calendário, no chip de filtro e no tooltip — inclusive
 * quando deixa de ser a maior matéria do recorte.
 *
 * O mapa anterior (`coresPorMateria`) atribuía a cor pela ORDEM de chegada, e a
 * ordem vinha do volume: bastava um filtro mudar o ranking para Contratual
 * herdar a cor que era do Sancionatório um segundo antes. Aqui as chaves são
 * fixas por nome.
 *
 * Duas cores carregam semântica e não são negociáveis:
 *   - Sancionatório -> âmbar, a cor de atenção do produto. Não é vermelho:
 *     vermelho é erro, e matéria sancionatória não é erro, é assunto que pede
 *     acompanhamento.
 *   - Não classificado -> aço, neutro. Ausência de classificação não é uma
 *     categoria a mais disputando atenção.
 */

export const MATERIA_NAO_CLASSIFICADA = 'Não classificado'

/**
 * Índice na paleta `--data-N` (1-based no CSS, 0-based aqui).
 *
 * As sete matérias são um conjunto pequeno, estável e conhecido — vêm de
 * `config/regras_negocio.json` como camada analítica derivada, não da fonte.
 * Fixá-las por nome é possível justamente porque são poucas e não mudam a cada
 * varredura.
 */
const INDICE_POR_MATERIA: Record<string, number> = {
  'Sancionatório': 3, // âmbar
  'Contratual': 0, // ciano Programa
  'Consultivo': 1, // azul petróleo
  'Conformidade': 4, // índigo ardósia
  'Licitatório': 2, // verde do Parceiro
  'Administrativo': 6, // sálvia
  [MATERIA_NAO_CLASSIFICADA]: 7, // aço — neutro
}

/**
 * Matéria fora do mapa cai na terracota — a única cor quente que sobrou.
 * Serve de aviso: apareceu categoria nova e este arquivo ficou para trás.
 */
const INDICE_RESERVA = 5

export function indiceDaMateria(materia: string | null | undefined): number {
  if (!materia) return INDICE_POR_MATERIA[MATERIA_NAO_CLASSIFICADA]!
  return INDICE_POR_MATERIA[materia] ?? INDICE_RESERVA
}

/**
 * Cor CSS da matéria para o DOM — `style`, SVG, chip, ponto de legenda.
 *
 * NÃO serve para o ECharts: o canvas não resolve `var(--x)`, e a cor sai
 * transparente sem erro nenhum no console. Dentro de gráfico, use
 * `useCorDaMateria()` em `charts/painel.tsx`, que lê o token já resolvido.
 */
export function corDaMateria(materia: string | null | undefined, alfa = 1): string {
  const token = `var(--data-${indiceDaMateria(materia) + 1})`
  return alfa === 1 ? `hsl(${token})` : `hsl(${token} / ${alfa})`
}

/**
 * Índice estável de uma categoria SEM mapa fixo — temas, hoje 20 e crescendo
 * com o acervo.
 *
 * Manter 20 nomes à mão viraria dívida a cada tema novo que o Escritório Jurídico usar; e
 * distribuir por posição faria o tema trocar de cor sempre que um filtro
 * mudasse o ranking. O índice sai de um hash do PRÓPRIO NOME: não é semântico,
 * mas é estável — "Contrato" tem a mesma cor em todo recorte, para sempre.
 */
export function indiceEstavel(chave: string, cores = 7): number {
  let h = 0
  for (let i = 0; i < chave.length; i += 1) h = (h * 31 + chave.charCodeAt(i)) % 100003
  return h % cores
}

/**
 * Compatibilidade com quem já consumia `coresPorMateria`: mesma assinatura,
 * mesmo tipo de retorno — só que agora o índice não depende mais da ordem da
 * lista que entrou.
 */
export function coresPorMateria(chaves: string[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const chave of chaves) mapa.set(chave, indiceDaMateria(chave))
  return mapa
}

/**
 * Naturezas são 21 e crescem com o acervo: cor fixa por nome ali seria uma
 * lista para manter à mão toda vez que o Escritório Jurídico usar um tipo novo. A natureza
 * herda a cor da MATÉRIA à qual pertence — que é o que o olho precisa cruzar
 * entre o Sankey, o scatter e a tabela.
 */
export function corDaNatureza(macrogrupo: string | null | undefined, alfa = 1): string {
  return corDaMateria(macrogrupo, alfa)
}

/**
 * Atenuação de quem não está selecionado.
 *
 * Quando existe seleção, o não selecionado não some — recua. Sumir apagaria a
 * proporção, que é justamente o que o gráfico existe para mostrar.
 */
export const OPACIDADE_ATENUADA = 0.24
