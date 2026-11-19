import { describe, expect, it } from 'vitest'

import { alturaDaPilha, alturaDoArmario, armario, magnitude, rotuloDocumentos } from './magnitude'
import { agruparPeriodo } from './escalas'
import { diasDaSemana, inicioDaSemana, rotuloIntervaloSemana } from './week'
import type { DocumentoResumo } from '@/lib/api'

describe('magnitude documental', () => {
  it('coloca cada contagem na faixa certa', () => {
    expect(magnitude(0).tier).toBe('vazio')
    expect(magnitude(1).tier).toBe('unico')
    expect(magnitude(2).tier).toBe('xs')
    expect(magnitude(4).tier).toBe('xs')
    expect(magnitude(5).tier).toBe('s')
    expect(magnitude(10).tier).toBe('s')
    expect(magnitude(11).tier).toBe('m')
    expect(magnitude(25).tier).toBe('m')
    expect(magnitude(26).tier).toBe('l')
    expect(magnitude(50).tier).toBe('l')
    expect(magnitude(51).tier).toBe('xl')
    expect(magnitude(999).tier).toBe('xl')
  })

  it('monta a pilha com mais folhas conforme o volume, nunca escalando uma só', () => {
    const folhas = [1, 3, 7, 20, 40, 120].map((n) => magnitude(n).folhas)
    // estritamente crescente: é o número de folhas que codifica o volume
    for (let i = 1; i < folhas.length; i += 1) {
      expect(folhas[i]!).toBeGreaterThan(folhas[i - 1]!)
    }
  })

  it('a quantidade sempre tem número textual', () => {
    expect(rotuloDocumentos(0)).toBe('sem documentos')
    expect(rotuloDocumentos(1)).toBe('1 doc')
    expect(rotuloDocumentos(14)).toBe('14 docs')
  })

  it('reserva altura antes de renderizar, para não deslocar o layout', () => {
    expect(alturaDaPilha(magnitude(1))).toBeGreaterThan(0)
    expect(alturaDaPilha(magnitude(40))).toBeGreaterThan(alturaDaPilha(magnitude(1)))
  })
})

describe('semana', () => {
  it('começa na segunda-feira', () => {
    // 2025-11-18 é uma terça
    expect(inicioDaSemana('2025-11-18')).toBe('2025-11-17')
    // a própria segunda não se desloca
    expect(inicioDaSemana('2025-11-17')).toBe('2025-11-17')
    // domingo pertence à semana que começou na segunda anterior
    expect(inicioDaSemana('2025-11-23')).toBe('2025-11-17')
  })

  it('devolve sete dias consecutivos', () => {
    const dias = diasDaSemana('2025-11-17')
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe('2025-11-17')
    expect(dias[6]).toBe('2025-11-23')
  })

  it('rotula o intervalo sem repetir o mês à toa', () => {
    expect(rotuloIntervaloSemana('2025-11-17')).toBe('17 – 23 de novembro de 2025')
    // semana que cruza o mês nomeia os dois
    expect(rotuloIntervaloSemana('2025-09-29')).toBe('29 de setembro – 5 de outubro de 2025')
    // semana que cruza o ano nomeia os dois anos
    expect(rotuloIntervaloSemana('2025-12-29')).toBe(
      '29 de dezembro de 2025 – 4 de janeiro de 2026',
    )
  })
})

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

describe('agrupamento da semana', () => {
  it('coloca cada documento no seu dia', () => {
    const s = agruparPeriodo('semana', '2025-11-17', [
      doc(1, '2025-11-18', 'dia'),
      doc(2, '2025-11-18', 'dia'),
      doc(3, '2025-11-20', 'dia'),
    ])
    expect(s.colunas[1]!.total).toBe(2) // terça
    expect(s.colunas[3]!.total).toBe(1) // quinta
    expect(s.total).toBe(3)
  })

  it('NÃO coloca documento de precisão mensal em nenhum dia', () => {
    // O modelo grava AAAA-MM-01 para precisão mensal. Distribuí-lo no dia 1º o
    // apresentaria com uma data que a fonte não sustenta.
    const s = agruparPeriodo('semana', '2025-12-01', [
      doc(1, '2025-12-01', 'mes'),
      doc(2, '2025-12-01', 'mes'),
      doc(3, '2025-12-01', 'dia'),
    ])
    expect(s.colunas[0]!.total).toBe(1)
    expect(s.semDiaDefinido).toHaveLength(2)
    expect(s.total).toBe(1)
  })

  it('ignora documento sem data', () => {
    const s = agruparPeriodo('semana', '2025-11-17', [doc(1, null, null)])
    expect(s.total).toBe(0)
    expect(s.semDiaDefinido).toHaveLength(0)
  })

  it('marca sábado e domingo', () => {
    const s = agruparPeriodo('semana', '2025-11-17', [])
    expect(s.colunas.filter((c) => c.atenuado).map((c) => c.rotuloCurto)).toEqual(['Sáb', 'Dom'])
  })
})

describe('armários do ano', () => {
  it('escolhe a quantidade de gavetas pela faixa', () => {
    expect(armario(0).gavetas).toBe(0)
    expect(armario(1).gavetas).toBe(1)
    expect(armario(10).gavetas).toBe(1)
    expect(armario(11).gavetas).toBe(2)
    expect(armario(30).gavetas).toBe(2)
    expect(armario(31).gavetas).toBe(3)
    expect(armario(50).gavetas).toBe(3)
    expect(armario(51).gavetas).toBe(4)
    expect(armario(999).gavetas).toBe(4)
  })

  it('mantém a largura e cresce em ALTURA — é o mesmo móvel', () => {
    const larguras = [1, 15, 40, 90].map((n) => armario(n).largura)
    expect(new Set(larguras).size).toBe(1)
    const alturas = [1, 15, 40, 90].map((n) => alturaDoArmario(armario(n)))
    expect(alturas).toEqual([...alturas].sort((a, b) => a - b))
    expect(new Set(alturas).size).toBe(4)
  })

  it('mês vazio não desenha móvel nenhum', () => {
    expect(alturaDoArmario(armario(0))).toBe(0)
  })

  it('o rótulo continua sendo o número, como no papel', () => {
    expect(armario(0).rotulo).toBe('sem documentos')
    expect(armario(1).rotulo).toBe('1 doc')
    expect(armario(47).rotulo).toBe('47 docs')
  })
})
