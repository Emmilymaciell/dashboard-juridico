/**
 * As três escalas da Linha do Tempo: semana, mês e ano.
 *
 * O que muda entre elas é UMA coisa: o que é uma coluna.
 *
 *   semana -> 7 colunas, uma por dia
 *   mês    -> 4 a 6 colunas, uma por SEMANA do mês
 *   ano    -> 12 colunas, uma por mês
 *
 * O eixo, o ponto, a haste e os cards são os mesmos nas três. O OBJETO muda uma
 * vez: no dia e na semana o volume é papel — folha avulsa ou pilha —, e no ano é
 * o ARMÁRIO onde aquele mês foi guardado, de uma a quatro gavetas. É a
 * referência que a usuária desenhou, e faz sentido físico: ninguém deixa um mês
 * inteiro empilhado na mesa.
 *
 * Qual dos dois desenhar não é decisão do componente: cada coluna chega dizendo
 * de que família ela é (`arte`).
 *
 * Datas são sempre `AAAA-MM-DD` em string, nunca `Date` com fuso. Toda
 * aritmética usa UTC — converter para `Date` local desloca um dia dependendo do
 * fuso, e a Linha do Tempo inteira erraria de coluna.
 *
 * PRECISÃO DA DATA, que é onde a coisa fica sutil: o acervo tem documentos cuja
 * fonte só informa MÊS. No dia eles não existem — o modelo grava `AAAA-MM-01` e
 * colocá-los no dia 1º seria apresentar uma data que a fonte não sustenta. Então
 * na semana e no mês eles ficam de fora das colunas, contados à parte. No ANO,
 * ao contrário, eles pertencem à coluna com certeza total: a coluna É o mês.
 */

import type { DocumentoResumo } from '@/lib/api'

import {
  DIAS_CURTOS,
  inicioDaSemana,
  paraData,
  paraIso,
  rotuloDataLongo,
  rotuloDiaMes,
  rotuloIntervaloSemana,
  somarDias,
} from './week'

export type Escala = 'semana' | 'mes' | 'ano'

/** Uma coluna da timeline: um dia, ou um mês inteiro. */
export interface Coluna {
  /**
   * Chave da coluna e âncora de tudo que a referencia — `data-dia`, foco de
   * teclado, drawer. É `AAAA-MM-DD` no dia e no mês; no ano é o primeiro dia
   * do mês, para que continue sendo uma data navegável.
   */
  iso: string
  /** Primeiro e último dia cobertos por esta coluna. */
  inicio: string
  fim: string
  /** Linha de cima do rótulo: 'Seg', '14', 'Jan'. */
  rotuloCurto: string
  /** Linha de baixo: '22 set', 'seg', ou vazio no ano. */
  rotuloData: string
  /** Como a coluna é lida por extenso — vai para `aria-label` e para os cards. */
  rotuloLongo: string
  documentos: DocumentoResumo[]
  total: number
  /**
   * Peso visual mais baixo: fim de semana. NÃO é "desabilitado" — sábado sem
   * documento continua sendo uma data válida do calendário.
   */
  atenuado: boolean
  /** Papel (dia, semana) ou armário (mês dentro do ano). */
  arte: 'papel' | 'armario'
}

export interface PeriodoAgrupado {
  escala: Escala
  inicio: string
  fim: string
  /** '22 – 28 de setembro de 2025' · 'setembro de 2025' · '2025' */
  rotulo: string
  colunas: Coluna[]
  total: number
  /**
   * Documentos do período cuja fonte só informa mês. Ficam FORA das colunas na
   * semana e no mês; no ano a lista é sempre vazia, porque ali eles cabem
   * exatamente na coluna a que pertencem.
   */
  semDiaDefinido: DocumentoResumo[]
}

/* ------------------------------------------------------------ aritmética */

function primeiroDiaDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function diasNoMes(iso: string): number {
  const d = paraData(iso)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

function somarMeses(iso: string, meses: number): string {
  const d = paraData(primeiroDiaDoMes(iso))
  d.setUTCMonth(d.getUTCMonth() + meses)
  return paraIso(d)
}

/** Onde começa o período que CONTÉM esta data. */
export function inicioDoPeriodo(escala: Escala, iso: string): string {
  if (escala === 'semana') return inicioDaSemana(iso)
  if (escala === 'mes') return primeiroDiaDoMes(iso)
  return `${iso.slice(0, 4)}-01-01`
}

/** Último dia do período que começa em `inicio`. */
export function fimDoPeriodo(escala: Escala, inicio: string): string {
  if (escala === 'semana') return somarDias(inicio, 6)
  if (escala === 'mes') return `${inicio.slice(0, 7)}-${String(diasNoMes(inicio)).padStart(2, '0')}`
  return `${inicio.slice(0, 4)}-12-31`
}

/** Anda `n` períodos a partir de um início de período. */
export function passoDePeriodo(escala: Escala, inicio: string, n: number): string {
  if (escala === 'semana') return somarDias(inicio, n * 7)
  if (escala === 'mes') return somarMeses(inicio, n)
  return `${Number(inicio.slice(0, 4)) + n}-01-01`
}

/** Quantos períodos separam dois inícios. Negativo = destino no passado. */
export function distanciaEmPeriodos(escala: Escala, de: string, para: string): number {
  if (escala === 'semana') {
    return Math.round((paraData(para).getTime() - paraData(de).getTime()) / (7 * 86400000))
  }
  const a = paraData(de)
  const b = paraData(para)
  const meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  return escala === 'mes' ? meses : Math.round(meses / 12)
}

/* --------------------------------------------------------------- rótulos */

function nomeDoMes(iso: string, formato: 'long' | 'short'): string {
  return paraData(iso)
    .toLocaleDateString('pt-BR', { month: formato, timeZone: 'UTC' })
    .replace('.', '')
}

/** Título do período em leitura, no cabeçalho da faixa. */
export function rotuloDoPeriodo(escala: Escala, inicio: string): string {
  if (escala === 'semana') return rotuloIntervaloSemana(inicio)
  if (escala === 'mes') return `${nomeDoMes(inicio, 'long')} de ${inicio.slice(0, 4)}`
  return inicio.slice(0, 4)
}

/** Como o período se chama quando aparece dentro de uma frase. */
export function unidadeDaEscala(escala: Escala): 'semana' | 'mês' | 'ano' {
  return escala === 'semana' ? 'semana' : escala === 'mes' ? 'mês' : 'ano'
}

/**
 * Qual coluna contém esta data, na escala em uso.
 *
 * Serve para traduzir "a data que o usuário escolheu" em "a coluna que precisa
 * ficar selecionada". No ano isso não é a data: é o primeiro dia do mês dela.
 */
export function chaveDaColuna(escala: Escala, iso: string): string {
  return escala === 'ano' ? `${iso.slice(0, 7)}-01` : iso
}

/** Primeira letra maiúscula, para começo de frase. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/* --------------------------------------------------------------- colunas */

interface MoldeDeColuna {
  iso: string
  inicio: string
  fim: string
  rotuloCurto: string
  rotuloData: string
  rotuloLongo: string
  atenuado: boolean
  arte: 'papel' | 'armario'
}

/** '01' — dia com dois dígitos, para as duas pontas da semana alinharem. */
function doisDigitos(iso: string): string {
  return iso.slice(8, 10)
}

/**
 * As semanas de um mês, recortadas NO mês.
 *
 * A primeira e a última quase sempre são parciais — 1º de abril de 2025 cai
 * numa terça, então "Sem 1" é 01 a 06. Cortar no mês é o que faz as cinco
 * colunas somarem exatamente o total do mês; semanas inteiras transbordando
 * para março e maio contariam documentos que não são daquele mês.
 */
function semanasDoMes(inicio: string): MoldeDeColuna[] {
  const ultimo = fimDoPeriodo('mes', inicio)
  const mes = nomeDoMes(inicio, 'short')
  const mesLongo = nomeDoMes(inicio, 'long')
  const ano = inicio.slice(0, 4)
  const colunas: MoldeDeColuna[] = []
  let cursor = inicio
  let n = 1
  while (cursor <= ultimo) {
    const fimDaSemana = somarDias(inicioDaSemana(cursor), 6)
    const fim = fimDaSemana > ultimo ? ultimo : fimDaSemana
    colunas.push({
      iso: cursor,
      inicio: cursor,
      fim,
      rotuloCurto: `Sem ${n}`,
      rotuloData: `${doisDigitos(cursor)} – ${doisDigitos(fim)} ${mes}`,
      rotuloLongo:
        cursor === fim
          ? rotuloDataLongo(cursor)
          : `${Number(doisDigitos(cursor))} a ${Number(doisDigitos(fim))} de ${mesLongo} de ${ano}`,
      atenuado: false,
      arte: 'papel',
    })
    cursor = somarDias(fim, 1)
    n += 1
  }
  return colunas
}

/** As colunas vazias do período, na ordem, antes de receberem documentos. */
export function moldeDoPeriodo(escala: Escala, inicio: string): MoldeDeColuna[] {
  if (escala === 'ano') {
    const ano = inicio.slice(0, 4)
    return Array.from({ length: 12 }, (_, i) => {
      const mes = `${ano}-${String(i + 1).padStart(2, '0')}-01`
      return {
        iso: mes,
        inicio: mes,
        fim: fimDoPeriodo('mes', mes),
        rotuloCurto: capitalizar(nomeDoMes(mes, 'short')),
        // O ano já está no título da faixa; repeti-lo doze vezes embaixo das
        // colunas seria ruído com aparência de informação.
        rotuloData: '',
        rotuloLongo: `${nomeDoMes(mes, 'long')} de ${ano}`,
        atenuado: false,
        arte: 'armario',
      }
    })
  }

  if (escala === 'mes') return semanasDoMes(inicio)

  return Array.from({ length: 7 }, (_, i) => {
    const iso = somarDias(inicio, i)
    return {
      iso,
      inicio: iso,
      fim: iso,
      rotuloCurto: DIAS_CURTOS[i] ?? '',
      rotuloData: rotuloDiaMes(iso),
      rotuloLongo: rotuloDataLongo(iso),
      atenuado: i >= 5,
      arte: 'papel',
    }
  })
}

/**
 * Distribui os documentos do período nas colunas.
 *
 * Um documento entra numa coluna quando a data que a fonte sustenta é
 * suficiente para posicioná-lo ali — e só então. No ano isso vale para todos;
 * no dia, só para os de precisão diária.
 */
export function agruparPeriodo(
  escala: Escala,
  inicio: string,
  documentos: DocumentoResumo[],
): PeriodoAgrupado {
  const molde = moldeDoPeriodo(escala, inicio)
  const porColuna = new Map<string, DocumentoResumo[]>(molde.map((c) => [c.iso, []]))
  const semDiaDefinido: DocumentoResumo[] = []

  /**
   * De que coluna é cada dia. Na semana e no ano a conta é direta, mas a
   * semana do mês cobre um INTERVALO — e procurar linearmente por documento
   * seria refazer a mesma busca dezenas de vezes.
   */
  const colunaDoDia = new Map<string, string>()
  if (escala === 'mes') {
    for (const c of molde) {
      let d = c.inicio
      while (d <= c.fim) {
        colunaDoDia.set(d, c.iso)
        d = somarDias(d, 1)
      }
    }
  }

  for (const doc of documentos) {
    const data = doc.data_documento
    if (!data) continue
    if (escala === 'ano') {
      // A coluna é o mês: precisão mensal posiciona com certeza total.
      porColuna.get(`${data.slice(0, 7)}-01`)?.push(doc)
      continue
    }
    if (doc.data_documento_precisao !== 'dia') {
      semDiaDefinido.push(doc)
      continue
    }
    const chave = escala === 'mes' ? colunaDoDia.get(data) : data
    if (chave) porColuna.get(chave)?.push(doc)
  }

  const colunas: Coluna[] = molde.map((c) => {
    const docs = porColuna.get(c.iso) ?? []
    return { ...c, documentos: docs, total: docs.length }
  })

  return {
    escala,
    inicio,
    fim: fimDoPeriodo(escala, inicio),
    rotulo: rotuloDoPeriodo(escala, inicio),
    colunas,
    total: colunas.reduce((a, c) => a + c.total, 0),
    semDiaDefinido,
  }
}
