/**
 * Magnitude documental — quantos documentos viram que representação física.
 *
 * A regra é determinística e vive aqui, fora de qualquer componente, porque
 * precisa valer igual na semana, no mês e no ano. Quando derivarmos as outras
 * escalas, a pilha de uma semana com 14 documentos tem de ser a MESMA pilha.
 *
 * O ponto central: a pilha é **montada** com N folhas reais. Nunca o mesmo
 * ícone com `scale` diferente — 3 documentos e 40 documentos não podem ser a
 * mesma forma esticada, senão a quantidade deixa de ser legível antes do número.
 */

export type MagnitudeTier = 'vazio' | 'unico' | 'xs' | 's' | 'm' | 'l' | 'xl'

/**
 * Proporção (altura / largura) de cada render do parecer.
 *
 * Não é uma constante só, e a razão é o próprio conceito: cada faixa tem sua
 * FOTOGRAFIA, e uma resma alta ocupa mais altura que uma folha avulsa na mesma
 * largura. Os valores vêm medidos dos arquivos exportados por
 * `output/asset-exploration/preparar_parecer.py` — mudar o export sem atualizar
 * aqui faria a coluna reservar a altura errada e a semana saltar ao carregar.
 *
 * `s` compartilha o render de `xs`: o acervo real ainda não produziu a diferença
 * de espessura que justificaria um sexto render, e inventar um seria fingir
 * precisão que a foto não tem.
 */
export const RAZAO_POR_TIER = {
  // A folha avulsa é retrato — vem de outra câmera, por escolha da usuária.
  // É por isso que a faixa `unico` tem largura bem menor que as demais: sem
  // isso, 1 documento ficaria MAIS ALTO que a pilha de 51 e a magnitude leria
  // ao contrário. Aqui a compensação é de largura, não de recorte.
  unico: 1.1524,
  xs: 0.6738,
  s: 0.6738,
  m: 0.6667,
  l: 0.6762,
  xl: 0.6786,
} as const

/** Compatibilidade: a folha avulsa é a referência quando não há faixa. */
export const RAZAO_FOLHA = RAZAO_POR_TIER.unico

export interface Magnitude {
  /** Faixa em que a contagem caiu. */
  tier: MagnitudeTier
  /** Quantas folhas desenhar. É o que dá a leitura de volume. */
  folhas: number
  /**
   * Deslocamento VERTICAL entre folhas, em px.
   *
   * Sobrou da montagem em CSS, quando a pilha era desenhada folha a folha. Com
   * os renders do parecer quem dá a altura é a própria fotografia; o campo
   * continua aqui porque `folhas`/`passo` descrevem a REGRA de magnitude, que
   * vale igual para mês e ano, e porque os testes a verificam.
   */
  passo: number
  /**
   * Deslocamento HORIZONTAL entre folhas, em px. Pequeno de propósito.
   *
   * A pilha cresce para CIMA, não para o lado: uma resma vista de frente ganha
   * altura, não largura. Além de ser o que se vê de verdade, é o que cabe — com
   * deslocamento lateral de 4 px a faixa `xl` ocupava 190 px e invadia a coluna
   * do dia vizinho, que tem 146 px no mínimo.
   */
  desvio: number
  /** Largura da folha do topo, em px. */
  largura: number
  /** Rótulo textual — a quantidade SEMPRE tem número, nunca só a forma. */
  rotulo: string
}

interface Faixa {
  tier: MagnitudeTier
  /** Menor contagem que cai nesta faixa. */
  min: number
  /** Maior contagem considerada para interpolar dentro da faixa. */
  max: number
  /** Folhas desenhadas em `min` e em `max` — o meio é interpolado. */
  folhasMin: number
  folhasMax: number
  passo: number
  desvio: number
  largura: number
}

/**
 * Faixas em ordem decrescente: a primeira cujo `min` couber vence.
 *
 * `folhasMin`/`folhasMax` são os extremos da faixa; a contagem exata interpola
 * entre eles. Largura e passo NÃO interpolam — são da faixa, para que a leitura
 * de "ordem de grandeza" continue estável e só a altura da pilha responda à
 * contagem fina.
 *
 * O acervo real hoje chega a 18 documentos num único dia, então na semana só as
 * quatro primeiras faixas aparecem. As faixas grandes existem porque o mesmo
 * componente vai servir mês e ano, onde 192 documentos são rotina.
 */
const FAIXAS: Faixa[] = [
  { tier: 'xl', min: 51, max: 200, folhasMin: 20, folhasMax: 26, passo: 3.2, desvio: 0.6, largura: 128 },
  { tier: 'l', min: 26, max: 50, folhasMin: 15, folhasMax: 19, passo: 3.4, desvio: 0.7, largura: 125 },
  { tier: 'm', min: 11, max: 25, folhasMin: 10, folhasMax: 14, passo: 3.6, desvio: 0.8, largura: 122 },
  { tier: 's', min: 5, max: 10, folhasMin: 6, folhasMax: 9, passo: 3.8, desvio: 0.9, largura: 119 },
  { tier: 'xs', min: 2, max: 4, folhasMin: 3, folhasMax: 5, passo: 4.0, desvio: 1.1, largura: 116 },
  { tier: 'unico', min: 1, max: 1, folhasMin: 1, folhasMax: 1, passo: 0, desvio: 0, largura: 68 },
]

/** Plural em português, para o rótulo textual. */
export function rotuloDocumentos(total: number): string {
  if (total === 0) return 'sem documentos'
  return total === 1 ? '1 doc' : `${total} docs`
}

export function magnitude(total: number): Magnitude {
  const rotulo = rotuloDocumentos(total)
  if (total <= 0) {
    return { tier: 'vazio', folhas: 0, passo: 0, desvio: 0, largura: 66, rotulo }
  }
  const faixa = FAIXAS.find((f) => total >= f.min) ?? FAIXAS[FAIXAS.length - 1]!
  /**
   * A faixa define largura, passo e rótulo; a contagem define quantas folhas,
   * interpolando DENTRO da faixa.
   *
   * Sem isto, 5, 7 e 10 documentos desenhavam exatamente a mesma pilha — e o
   * acervo real concentra a semana justamente nessa faixa, então a linha do
   * tempo inteira ficava com a mesma forma sete vezes. Continua determinístico:
   * a mesma contagem sempre desenha a mesma pilha, aqui, no mês e no ano.
   */
  const vao = Math.max(1, faixa.max - faixa.min)
  const posicao = Math.min(1, Math.max(0, (total - faixa.min) / vao))
  const folhas = Math.round(faixa.folhasMin + (faixa.folhasMax - faixa.folhasMin) * posicao)

  return {
    tier: faixa.tier,
    folhas,
    passo: faixa.passo,
    desvio: faixa.desvio,
    largura: faixa.largura,
    rotulo,
  }
}

/* ------------------------------------------------------------ armários */

/**
 * A magnitude do ANO não é papel: é móvel.
 *
 * Um mês não se lê como uma pilha na mesa — se lê como o arquivo onde aquele
 * mês foi guardado. A família tem quatro peças, do armário de uma gaveta ao de
 * quatro, e o que cresce é a ALTURA: a largura é a mesma nos quatro, porque é
 * o mesmo móvel. As razões vêm medidas dos PNGs exportados por
 * `output/asset-exploration/preparar_armarios.py`; mudar o export sem
 * atualizar aqui faria a coluna reservar a altura errada.
 */
export type Gavetas = 1 | 2 | 3 | 4

export const RAZAO_POR_GAVETAS: Record<Gavetas, number> = {
  1: 0.7083,
  2: 0.9735,
  3: 1.322,
  4: 1.8712,
}

export interface Armario {
  gavetas: Gavetas | 0
  /** Largura do móvel — constante na família, como na vida. */
  largura: number
  rotulo: string
}

/**
 * Largura base do armário, na coluna de referência de 146 px.
 *
 * Menor que a pilha de papel (128) de propósito: o móvel é mais alto, e dois
 * objetos de peso visual igual na mesma largura fariam o ano parecer mais
 * carregado que a semana sem que o acervo tivesse mudado.
 */
const LARGURA_ARMARIO = 108

/**
 * Faixas do ano, em documentos por MÊS.
 *
 * Não são as faixas do papel, e não deveriam ser: lá a coluna é um dia, aqui é
 * um mês inteiro. No acervo real os meses vão de 1 a 55, e estas quatro faixas
 * distribuem esse intervalo em vez de empilhar todo mundo na última.
 */
const FAIXAS_DE_GAVETA: Array<{ min: number; gavetas: Gavetas }> = [
  { min: 51, gavetas: 4 },
  { min: 31, gavetas: 3 },
  { min: 11, gavetas: 2 },
  { min: 1, gavetas: 1 },
]

export function armario(total: number): Armario {
  const rotulo = rotuloDocumentos(total)
  if (total <= 0) return { gavetas: 0, largura: LARGURA_ARMARIO, rotulo }
  const faixa = FAIXAS_DE_GAVETA.find((f) => total >= f.min) ?? FAIXAS_DE_GAVETA[3]!
  return { gavetas: faixa.gavetas, largura: LARGURA_ARMARIO, rotulo }
}

/** Altura que o móvel vai ocupar, para a coluna reservar espaço antes. */
export function alturaDoArmario(a: Armario): number {
  if (a.gavetas === 0) return 0
  return Math.round(a.largura * RAZAO_POR_GAVETAS[a.gavetas])
}

/**
 * Altura total que a pilha vai ocupar, para a coluna do dia reservar espaço
 * antes de renderizar e não causar deslocamento de layout.
 */
export function alturaDaPilha(m: Magnitude): number {
  const razao = m.tier === 'vazio' ? RAZAO_POR_TIER.unico : RAZAO_POR_TIER[m.tier]
  return Math.round(m.largura * razao)
}

/**
 * Largura total ocupada pela pilha.
 *
 * Com os renders, a espessura cresce em ALTURA e a largura fica constante
 * dentro da faixa — antes o desvio lateral acumulado precisava entrar aqui.
 */
export function larguraDaPilha(m: Magnitude): number {
  return m.largura
}
