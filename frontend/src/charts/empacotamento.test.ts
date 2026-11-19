import { describe, expect, it } from 'vitest'

import { empacotar } from '@/charts/empacotamento'

const TEMAS = [
  { chave: 'Contrato', valor: 81 },
  { chave: 'Sanções / Advertência', valor: 80 },
  { chave: 'Documentação', valor: 70 },
  { chave: 'Contratação', valor: 59 },
  { chave: 'Governança', valor: 44 },
  { chave: 'Projeto', valor: 38 },
  { chave: 'Ministério Público', valor: 26 },
  { chave: 'Cronograma', valor: 13 },
]

describe('empacotamento de bolhas', () => {
  it('nenhuma bolha invade a outra', () => {
    const bolhas = empacotar(TEMAS, 420, 320)
    for (let i = 0; i < bolhas.length; i += 1) {
      for (let j = i + 1; j < bolhas.length; j += 1) {
        const a = bolhas[i]!
        const b = bolhas[j]!
        const distancia = Math.hypot(a.x - b.x, a.y - b.y)
        // Meio pixel de tolerância: a escala final é ponto flutuante.
        expect(distancia).toBeGreaterThan(a.r + b.r - 0.5)
      }
    }
  })

  it('cabe inteiro na caixa pedida', () => {
    const bolhas = empacotar(TEMAS, 420, 320)
    for (const b of bolhas) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(-0.5)
      expect(b.y - b.r).toBeGreaterThanOrEqual(-0.5)
      expect(b.x + b.r).toBeLessThanOrEqual(420.5)
      expect(b.y + b.r).toBeLessThanOrEqual(320.5)
    }
  })

  it('a área é proporcional ao valor, não o raio', () => {
    // 80 é 4x 20: em área. O raio, então, é o dobro — não o quádruplo.
    const [grande, pequena] = empacotar(
      [
        { chave: 'a', valor: 80 },
        { chave: 'b', valor: 20 },
      ],
      400,
      400,
    )
    expect(grande!.r / pequena!.r).toBeCloseTo(2, 1)
  })

  it('um tema sozinho não vira um círculo do tamanho da caixa', () => {
    const [unica] = empacotar([{ chave: 'Eventograma', valor: 1 }], 420, 320)
    expect(unica!.r).toBeLessThanOrEqual(0.36 * 320 + 0.5)
  })

  it('é determinístico: mesma entrada, mesma saída', () => {
    expect(empacotar(TEMAS, 420, 320)).toEqual(empacotar(TEMAS, 420, 320))
  })

  it('a ordem de entrada não muda o resultado', () => {
    const invertido = [...TEMAS].reverse()
    const a = empacotar(TEMAS, 420, 320)
    const b = empacotar(invertido, 420, 320)
    const porChave = (lista: typeof a) =>
      Object.fromEntries(lista.map((x) => [x.chave, [x.x, x.y, x.r]]))
    expect(porChave(b)).toEqual(porChave(a))
  })

  it('ignora valor zero e sobrevive a lista vazia ou caixa sem tamanho', () => {
    expect(empacotar([{ chave: 'a', valor: 0 }], 300, 300)).toEqual([])
    expect(empacotar([], 300, 300)).toEqual([])
    expect(empacotar(TEMAS, 0, 300)).toEqual([])
  })
})
