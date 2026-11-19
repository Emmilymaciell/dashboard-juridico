import { describe, expect, it } from 'vitest'

import type { DocumentoResumo } from '@/lib/api'
import {
  agruparPeriodo,
  chaveDaColuna,
  distanciaEmPeriodos,
  fimDoPeriodo,
  inicioDoPeriodo,
  moldeDoPeriodo,
  passoDePeriodo,
  rotuloDoPeriodo,
} from './escalas'

function doc(id: number, data: string | null, precisao: string | null): DocumentoResumo {
  return {
    documento_id: id,
    data_documento: data,
    data_documento_precisao: precisao,
    natureza: 'Ofício / Carta',
    assunto: `Documento ${id}`,
    destinatario: 'Parceiro',
    temas_texto: null,
    temas_count: 0,
    rodovia_principal: null,
    contrato: null,
    estagio_documental: null,
    macrogrupo_juridico: null,
    status: 'Ativo',
    ativo: true,
    arquivo_extensao: 'pdf',
    arquivo_nome: `doc-${id}.pdf`,
    pasta: 'Oficio',
    link_disponivel: true,
  } as DocumentoResumo
}

describe('recorte do período', () => {
  it('encontra o começo do período que contém a data', () => {
    expect(inicioDoPeriodo('semana', '2025-09-24')).toBe('2025-09-22')
    expect(inicioDoPeriodo('mes', '2025-09-24')).toBe('2025-09-01')
    expect(inicioDoPeriodo('ano', '2025-09-24')).toBe('2025-01-01')
  })

  it('fecha o período no último dia real — inclusive em fevereiro bissexto', () => {
    expect(fimDoPeriodo('semana', '2025-09-22')).toBe('2025-09-28')
    expect(fimDoPeriodo('mes', '2025-09-01')).toBe('2025-09-30')
    expect(fimDoPeriodo('mes', '2025-02-01')).toBe('2025-02-28')
    expect(fimDoPeriodo('mes', '2024-02-01')).toBe('2024-02-29')
    expect(fimDoPeriodo('ano', '2025-01-01')).toBe('2025-12-31')
  })

  it('anda de período em período sem tropeçar na virada do ano', () => {
    expect(passoDePeriodo('semana', '2025-12-29', 1)).toBe('2026-01-05')
    expect(passoDePeriodo('mes', '2025-12-01', 1)).toBe('2026-01-01')
    expect(passoDePeriodo('mes', '2026-01-01', -1)).toBe('2025-12-01')
    expect(passoDePeriodo('ano', '2025-01-01', 2)).toBe('2027-01-01')
  })

  it('mede a distância na unidade da escala', () => {
    expect(distanciaEmPeriodos('semana', '2025-09-01', '2025-09-22')).toBe(3)
    expect(distanciaEmPeriodos('mes', '2025-09-01', '2026-01-01')).toBe(4)
    expect(distanciaEmPeriodos('mes', '2026-01-01', '2025-09-01')).toBe(-4)
    expect(distanciaEmPeriodos('ano', '2024-01-01', '2026-01-01')).toBe(2)
  })

  it('traduz uma data na coluna que a contém', () => {
    expect(chaveDaColuna('semana', '2025-09-24')).toBe('2025-09-24')
    expect(chaveDaColuna('mes', '2025-09-24')).toBe('2025-09-24')
    // no ano a coluna é o mês, não o dia
    expect(chaveDaColuna('ano', '2025-09-24')).toBe('2025-09-01')
  })

  it('rotula o período em leitura', () => {
    expect(rotuloDoPeriodo('semana', '2025-09-22')).toBe('22 – 28 de setembro de 2025')
    expect(rotuloDoPeriodo('mes', '2025-09-01')).toBe('setembro de 2025')
    expect(rotuloDoPeriodo('ano', '2025-01-01')).toBe('2025')
  })
})

describe('colunas de cada escala', () => {
  it('a semana tem sete dias, de segunda a domingo', () => {
    const c = moldeDoPeriodo('semana', '2025-09-22')
    expect(c).toHaveLength(7)
    expect(c[0]!.rotuloCurto).toBe('Seg')
    expect(c[0]!.rotuloData).toBe('22 set')
    expect(c[6]!.iso).toBe('2025-09-28')
    expect(c.filter((x) => x.atenuado).map((x) => x.rotuloCurto)).toEqual(['Sáb', 'Dom'])
  })

  it('o mês é contado em SEMANAS, recortadas no mês', () => {
    // abril de 2025 começa numa terça: a primeira semana é parcial, a última
    // também. É exatamente o desenho da referência.
    const c = moldeDoPeriodo('mes', '2025-04-01')
    expect(c).toHaveLength(5)
    expect(c.map((x) => x.rotuloCurto)).toEqual(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'])
    expect(c[0]!.rotuloData).toBe('01 – 06 abr')
    expect(c[4]!.rotuloData).toBe('28 – 30 abr')
    // nenhuma semana vaza para o mês vizinho
    expect(c[0]!.inicio).toBe('2025-04-01')
    expect(c[4]!.fim).toBe('2025-04-30')
  })

  it('mês que começa na segunda tem semanas cheias; mês que termina na segunda ganha uma curta', () => {
    const setembro = moldeDoPeriodo('mes', '2025-09-01')
    expect(setembro[0]!.rotuloData).toBe('01 – 07 set')
    const marco = moldeDoPeriodo('mes', '2025-03-01')
    expect(marco).toHaveLength(6)
    expect(marco[5]!.rotuloData).toBe('31 – 31 mar')
  })

  it('a semana do mês se lê por extenso nos cards e no drawer', () => {
    const c = moldeDoPeriodo('mes', '2025-04-01')
    expect(c[0]!.rotuloLongo).toBe('1 a 6 de abril de 2025')
    // semana de um dia só não vira "31 a 31"
    expect(moldeDoPeriodo('mes', '2025-03-01')[5]!.rotuloLongo).toBe('31 de março de 2025')
  })

  it('cada escala declara de que família é o seu objeto', () => {
    expect(moldeDoPeriodo('semana', '2025-09-22').every((c) => c.arte === 'papel')).toBe(true)
    expect(moldeDoPeriodo('mes', '2025-09-01').every((c) => c.arte === 'papel')).toBe(true)
    // o ano é o único que guarda o mês em móvel, não em pilha
    expect(moldeDoPeriodo('ano', '2025-01-01').every((c) => c.arte === 'armario')).toBe(true)
  })

  it('o ano tem doze meses e nenhuma segunda linha', () => {
    const c = moldeDoPeriodo('ano', '2025-01-01')
    expect(c).toHaveLength(12)
    expect(c[0]!.rotuloCurto).toBe('Jan')
    expect(c[11]!.rotuloCurto).toBe('Dez')
    // o ano já está no título da faixa: repeti-lo doze vezes seria ruído
    expect(c.every((x) => x.rotuloData === '')).toBe(true)
    expect(c[8]!.iso).toBe('2025-09-01')
    expect(c[8]!.fim).toBe('2025-09-30')
    expect(c.some((x) => x.atenuado)).toBe(false)
  })
})

describe('distribuição dos documentos', () => {
  it('no mês, cada documento cai na SUA semana', () => {
    const p = agruparPeriodo('mes', '2025-04-01', [
      doc(1, '2025-04-02', 'dia'), // Sem 1 (01–06)
      doc(2, '2025-04-06', 'dia'), // Sem 1, na virada
      doc(3, '2025-04-07', 'dia'), // Sem 2, do outro lado da virada
      doc(4, '2025-04-30', 'dia'), // Sem 5, última e parcial
    ])
    expect(p.colunas[0]!.total).toBe(2)
    expect(p.colunas[1]!.total).toBe(1)
    expect(p.colunas[4]!.total).toBe(1)
    expect(p.total).toBe(4)
  })

  it('precisão mensal fica FORA dos dias — na semana e no mês', () => {
    const p = agruparPeriodo('mes', '2025-09-01', [
      doc(1, '2025-09-01', 'mes'),
      doc(2, '2025-09-01', 'dia'),
    ])
    expect(p.colunas[0]!.total).toBe(1)
    expect(p.semDiaDefinido).toHaveLength(1)
    expect(p.total).toBe(1)
  })

  it('no ANO a precisão mensal entra normalmente: a coluna É o mês', () => {
    const p = agruparPeriodo('ano', '2025-01-01', [
      doc(1, '2025-09-01', 'mes'),
      doc(2, '2025-09-17', 'dia'),
      doc(3, '2025-03-04', 'dia'),
    ])
    expect(p.colunas[8]!.total).toBe(2) // setembro
    expect(p.colunas[2]!.total).toBe(1) // março
    expect(p.semDiaDefinido).toHaveLength(0)
    expect(p.total).toBe(3)
  })

  it('documento sem data nenhuma não entra em lugar algum', () => {
    const p = agruparPeriodo('ano', '2025-01-01', [doc(1, null, null)])
    expect(p.total).toBe(0)
    expect(p.semDiaDefinido).toHaveLength(0)
  })

  it('documento fora do período não é forçado para dentro', () => {
    const p = agruparPeriodo('mes', '2025-09-01', [doc(1, '2025-10-05', 'dia')])
    expect(p.total).toBe(0)
  })

  it('a mesma contagem soma igual em qualquer escala', () => {
    const semana = agruparPeriodo('semana', '2025-09-22', [
      doc(1, '2025-09-23', 'dia'),
      doc(2, '2025-09-23', 'dia'),
    ])
    const ano = agruparPeriodo('ano', '2025-01-01', [
      doc(3, '2025-09-10', 'dia'),
      doc(4, '2025-09-20', 'dia'),
    ])
    expect(semana.colunas[1]!.total).toBe(ano.colunas[8]!.total)
  })
})
