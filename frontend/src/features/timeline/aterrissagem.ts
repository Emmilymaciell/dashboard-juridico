/**
 * Onde a Linha do Tempo abre.
 *
 * Abrir na semana do documento mais recente parece a escolha óbvia e é ruim: no
 * acervo real essa semana tem **1 documento**, e a tela abre praticamente vazia
 * sem que nada esteja errado. Abrir em "hoje" é pior ainda — hoje costuma não
 * ter nada.
 *
 * A escolha é abrir na semana de maior volume do acervo, **dizendo na tela que
 * é isso**. É dado real, é o retrato honesto de onde o trabalho se concentrou, e
 * "Hoje" continua a um clique. O que não se faz é abrir numa semana qualquer e
 * deixar a pessoa achar que o acervo é vazio.
 */

import type { PontoTemporal } from '@/lib/api'

import { inicioDaSemana } from './week'

export interface Aterrissagem {
  /** Segunda-feira da semana escolhida. */
  inicio: string
  /** Documentos naquela semana. */
  total: number
  /** Verdade se a semana escolhida é a de maior volume, e não a mais recente. */
  ehPico: boolean
}

export function escolherAterrissagem(
  dias: PontoTemporal[],
  hojeIso: string,
): Aterrissagem | null {
  if (dias.length === 0) return null

  const porSemana = new Map<string, number>()
  for (const d of dias) {
    const semana = inicioDaSemana(d.periodo)
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + d.documentos)
  }

  const semanaDeHoje = inicioDaSemana(hojeIso)
  const totalDeHoje = porSemana.get(semanaDeHoje) ?? 0
  // Se a semana corrente tem movimento de verdade, é ela: é o que a pessoa
  // veio ver. O limiar é baixo de propósito — dois documentos já são trabalho.
  if (totalDeHoje >= 2) {
    return { inicio: semanaDeHoje, total: totalDeHoje, ehPico: false }
  }

  let melhor = ''
  let maior = -1
  for (const [semana, total] of porSemana) {
    // Empate fica com a mais recente: entre dois picos iguais, o recente informa mais.
    if (total > maior || (total === maior && semana > melhor)) {
      maior = total
      melhor = semana
    }
  }
  return { inicio: melhor, total: maior, ehPico: true }
}
