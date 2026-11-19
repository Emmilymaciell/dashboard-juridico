import { describe, expect, it } from 'vitest'

import { filtrarDocumentos } from './components/DayDocumentsDrawer'
import { registrosVizinhos } from './vizinhos'
import type { DocumentoResumo } from '@/lib/api'

/** Série diária como a API devolve: só os dias que têm documento. */
const SERIE = [
  { periodo: '2025-08-14', documentos: 3 },
  { periodo: '2025-08-29', documentos: 1 },
  { periodo: '2025-10-03', documentos: 7 },
  { periodo: '2025-10-20', documentos: 2 },
]

describe('registros vizinhos de uma semana vazia', () => {
  it('acha o último antes e o próximo depois', () => {
    // semana de 15 a 21 de setembro: vazia no acervo de exemplo
    const { anterior, proximo } = registrosVizinhos(SERIE, '2025-09-15')
    expect(anterior).toEqual({ iso: '2025-08-29', documentos: 1 })
    expect(proximo).toEqual({ iso: '2025-10-03', documentos: 7 })
  })

  it('ignora os dias DENTRO da própria semana', () => {
    // a semana de 29/09 a 05/10 contém o registro de 03/10; ele não pode
    // aparecer como "próximo", senão o atalho não levaria a lugar nenhum
    const { proximo } = registrosVizinhos(SERIE, '2025-09-29')
    expect(proximo).toEqual({ iso: '2025-10-20', documentos: 2 })
  })

  it('devolve null quando não há nada de um dos lados', () => {
    const antesDeTudo = registrosVizinhos(SERIE, '2025-08-04')
    expect(antesDeTudo.anterior).toBeNull()
    expect(antesDeTudo.proximo).toEqual({ iso: '2025-08-14', documentos: 3 })

    const depoisDeTudo = registrosVizinhos(SERIE, '2025-11-03')
    expect(depoisDeTudo.proximo).toBeNull()
    expect(depoisDeTudo.anterior).toEqual({ iso: '2025-10-20', documentos: 2 })
  })

  it('não confia na ordem da série nem conta dia sem documento', () => {
    const bagunçada = [
      { periodo: '2025-10-03', documentos: 7 },
      { periodo: '2025-09-20', documentos: 0 },
      { periodo: '2025-08-14', documentos: 3 },
    ]
    const { anterior, proximo } = registrosVizinhos(bagunçada, '2025-09-15')
    expect(anterior).toEqual({ iso: '2025-08-14', documentos: 3 })
    expect(proximo).toEqual({ iso: '2025-10-03', documentos: 7 })
  })
})

function doc(parcial: Partial<DocumentoResumo>): DocumentoResumo {
  return {
    documento_id: 1,
    data_documento: '2025-09-23',
    data_documento_precisao: 'dia',
    assunto: null,
    natureza: null,
    destinatario: null,
    rodovia_principal: null,
    arquivo_extensao: null,
    ...parcial,
  } as DocumentoResumo
}

describe('filtro local do drawer', () => {
  const docs = [
    doc({ documento_id: 1, assunto: 'Contrato RD 103 Consolidado', natureza: 'Minuta' }),
    doc({ documento_id: 2, assunto: 'Nota sobre prazo', destinatario: 'Órgão Contratante' }),
    doc({ documento_id: 3, assunto: 'Aditivo', rodovia_principal: 'RD-101' }),
  ]

  it('sem termo, devolve tudo', () => {
    expect(filtrarDocumentos(docs, '   ')).toHaveLength(3)
  })

  it('busca em assunto, natureza, destinatário e rodovia', () => {
    expect(filtrarDocumentos(docs, 'minuta').map((d) => d.documento_id)).toEqual([1])
    expect(filtrarDocumentos(docs, 'orgao').map((d) => d.documento_id)).toEqual([2])
    expect(filtrarDocumentos(docs, 'rd-101').map((d) => d.documento_id)).toEqual([3])
  })

  it('ignora acento e caixa — quem digita "minuta" não digita "Minuta"', () => {
    const comAcento = [doc({ documento_id: 9, assunto: 'Manifestação sobre o edital' })]
    expect(filtrarDocumentos(comAcento, 'MANIFESTACAO')).toHaveLength(1)
  })

  it('nada encontrado devolve lista vazia, não a lista inteira', () => {
    expect(filtrarDocumentos(docs, 'zzzz')).toHaveLength(0)
  })
})
