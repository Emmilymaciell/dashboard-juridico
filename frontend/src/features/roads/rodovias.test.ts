import { describe, expect, it } from 'vitest'

import {
  acentoDaRodovia,
  filtrosDaConsulta,
  indiceDoAcento,
  ordemDasAbas,
  rodoviaAtiva,
  selecaoDaAba,
} from '@/features/roads/rodovias'

const PROGRAMA = ['RD-102A', 'RD-101', 'RD-103', 'RD-104']

describe('aba ativa e filtro de rodovia sao a mesma coisa', () => {
  it('sem filtro, abre na rodovia padrao', () => {
    expect(rodoviaAtiva(PROGRAMA, undefined, 'RD-102A')).toBe('RD-102A')
    expect(rodoviaAtiva(PROGRAMA, [], 'RD-104')).toBe('RD-104')
  })

  it('sem filtro e sem padrao valido, cai na primeira da regua', () => {
    expect(rodoviaAtiva(PROGRAMA, undefined)).toBe('RD-102A')
    expect(rodoviaAtiva(PROGRAMA, [], 'RD-999')).toBe('RD-102A')
  })

  it('o filtro manda: a aba ativa e a que esta na URL', () => {
    expect(rodoviaAtiva(PROGRAMA, ['RD-104'])).toBe('RD-104')
  })

  it('com duas rodovias no filtro, vale a primeira que existe na régua', () => {
    expect(rodoviaAtiva(PROGRAMA, ['RD-103', 'RD-101'])).toBe('RD-103')
  })

  it('rodovia fora da régua não deixa a régua sem aba marcada', () => {
    expect(rodoviaAtiva(PROGRAMA, ['RD-999'])).toBe('RD-102A')
    expect(rodoviaAtiva(PROGRAMA, ['RD-999', 'RD-101'])).toBe('RD-101')
  })

  it('régua vazia não tem aba ativa', () => {
    expect(rodoviaAtiva([], ['RD-101'])).toBeNull()
  })

  it('clicar numa aba troca a rodovia em vez de acumular', () => {
    expect(selecaoDaAba('RD-101')).toEqual({ rodovia: ['RD-101'] })
  })
})

describe('a consulta da página ignora a dimensão rodovia', () => {
  it('tira rodovia e preserva todo o resto', () => {
    const filtros = {
      rodovia: ['RD-102A'],
      natureza: ['Minuta'],
      data_inicio: '2026-01-01',
      data_fim: '2026-12-31',
      busca: 'eventograma',
    }
    expect(filtrosDaConsulta(filtros)).toEqual({
      natureza: ['Minuta'],
      data_inicio: '2026-01-01',
      data_fim: '2026-12-31',
      busca: 'eventograma',
    })
  })

  it('não inventa chave quando não há filtro de rodovia', () => {
    expect(filtrosDaConsulta({ natureza: ['Edital'] })).toEqual({ natureza: ['Edital'] })
  })
})

describe('acento das rodovias', () => {
  it('é fixo por nome, e as quatro do programa não colidem', () => {
    const indices = PROGRAMA.map(indiceDoAcento)
    expect(new Set(indices).size).toBe(4)
  })

  it('rodovia desconhecida cai na reserva, sem quebrar', () => {
    expect(indiceDoAcento('RD-999')).toBe(7)
    expect(acentoDaRodovia('RD-999')).toBe('hsl(var(--data-8))')
  })

  it('devolve cor com alfa quando pedido', () => {
    expect(acentoDaRodovia('RD-102A', 0.4)).toBe('hsl(var(--data-1) / 0.4)')
  })
})

describe('ordem da régua', () => {
  it('é alfabética e não acompanha o volume', () => {
    const porVolume = [
      { rodovia: 'RD-102A', documentos: 53 },
      { rodovia: 'RD-101', documentos: 45 },
      { rodovia: 'RD-103', documentos: 34 },
      { rodovia: 'RD-104', documentos: 31 },
    ]
    expect(ordemDasAbas(porVolume).map((r) => r.rodovia)).toEqual([
      'RD-101',
      'RD-102A',
      'RD-103',
      'RD-104',
    ])
  })

  it('a ordem não muda quando o volume muda', () => {
    const antes = [
      { rodovia: 'RD-102A', documentos: 53 },
      { rodovia: 'RD-101', documentos: 45 },
    ]
    const depois = [
      { rodovia: 'RD-101', documentos: 7 },
      { rodovia: 'RD-102A', documentos: 6 },
    ]
    expect(ordemDasAbas(antes).map((r) => r.rodovia)).toEqual(
      ordemDasAbas(depois).map((r) => r.rodovia),
    )
  })

  it('não muta a lista recebida', () => {
    const original = [{ rodovia: 'RD-104' }, { rodovia: 'RD-101' }]
    ordemDasAbas(original)
    expect(original[0]!.rodovia).toBe('RD-104')
  })
})
