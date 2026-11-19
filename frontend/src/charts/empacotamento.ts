/**
 * Empacotamento de círculos — determinístico, sem física.
 *
 * Packed bubbles costuma ser feito com simulação de forças: as bolhas se
 * empurram até parar. O resultado é bonito e é uma armadilha — muda a cada
 * render, nunca assenta igual duas vezes, e a mesma tela capturada duas vezes
 * não se parece consigo mesma. Pior: enquanto a simulação roda, o gráfico
 * inteiro depende de `requestAnimationFrame`, e este projeto já aprendeu o que
 * acontece com isso numa aba que não pinta.
 *
 * Aqui a posição é CALCULADA. Coloca-se a maior bolha no centro e cada seguinte
 * no primeiro ponto livre de uma espiral de Arquimedes — mesma entrada, mesma
 * saída, sempre. Nenhum quadro de animação é necessário para o desenho existir.
 *
 * O raio vem da ÁREA, não do diâmetro: `r ∝ √valor`. Com raio proporcional ao
 * valor, uma bolha de 80 pareceria 4 vezes maior que uma de 20 em área, e o
 * olho lê área.
 */

export interface BolhaEntrada {
  chave: string
  valor: number
}

export interface Bolha extends BolhaEntrada {
  x: number
  y: number
  r: number
}

/** Duas bolhas se tocam? Uma folga pequena evita encostar visualmente. */
function colide(x: number, y: number, r: number, postas: Bolha[], folga: number): boolean {
  for (const b of postas) {
    const dx = x - b.x
    const dy = y - b.y
    const minimo = r + b.r + folga
    if (dx * dx + dy * dy < minimo * minimo) return true
  }
  return false
}

/**
 * Empacota os itens e devolve as bolhas já ajustadas à caixa pedida.
 *
 * O algoritmo trabalha em unidades próprias e só no fim escala tudo para caber
 * em `largura` x `altura`, preservando a razão entre os raios — que é o dado.
 */
export function empacotar(
  itens: BolhaEntrada[],
  largura: number,
  altura: number,
  folga = 4,
): Bolha[] {
  const validos = itens.filter((i) => i.valor > 0)
  if (validos.length === 0 || largura <= 0 || altura <= 0) return []

  const ordenados = [...validos].sort((a, b) => b.valor - a.valor)
  const maior = ordenados[0]!.valor
  // Raio de trabalho: a maior bolha vale 100, as outras entram por √proporção.
  // O mínimo de 14 impede que a cauda longa vire poeira ilegível.
  const raio = (valor: number) => Math.max(14, 100 * Math.sqrt(valor / maior))

  const postas: Bolha[] = []
  for (const item of ordenados) {
    const r = raio(item.valor)
    if (postas.length === 0) {
      postas.push({ ...item, x: 0, y: 0, r })
      continue
    }
    // Espiral: o passo angular diminui conforme o raio cresce para a varredura
    // ficar uniforme, e o raio cresce devagar o bastante para não pular um
    // encaixe possível.
    let colocada = false
    for (let passo = 1; passo < 20000 && !colocada; passo += 1) {
      const angulo = passo * 0.35
      const distancia = 6 * Math.sqrt(passo)
      const x = Math.cos(angulo) * distancia
      const y = Math.sin(angulo) * distancia
      if (!colide(x, y, r, postas, folga)) {
        postas.push({ ...item, x, y, r })
        colocada = true
      }
    }
    if (!colocada) postas.push({ ...item, x: 0, y: 0, r })
  }

  // Caixa envolvente real (inclui os raios) e escala única para os dois eixos:
  // escalar x e y por fatores diferentes transformaria círculo em elipse e a
  // área deixaria de ser comparável.
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const b of postas) {
    minX = Math.min(minX, b.x - b.r)
    maxX = Math.max(maxX, b.x + b.r)
    minY = Math.min(minY, b.y - b.r)
    maxY = Math.max(maxY, b.y + b.r)
  }
  /**
   * Escala única para os dois eixos — e com TETO.
   *
   * Sem teto, um recorte com um tema só produz uma bolha que enche a caixa
   * inteira: 300px de círculo para dizer "1". O teto prende o maior raio a
   * pouco mais de um terço da menor dimensão, então um conjunto pequeno fica
   * pequeno, que é a leitura honesta.
   */
  const paraCaber = Math.min(largura / (maxX - minX), altura / (maxY - minY))
  const maiorRaio = Math.max(...postas.map((b) => b.r))
  const teto = (0.36 * Math.min(largura, altura)) / maiorRaio
  const escala = Math.min(paraCaber, teto)
  const centroX = (minX + maxX) / 2
  const centroY = (minY + maxY) / 2

  return postas.map((b) => ({
    ...b,
    x: largura / 2 + (b.x - centroX) * escala,
    y: altura / 2 + (b.y - centroY) * escala,
    r: b.r * escala,
  }))
}
