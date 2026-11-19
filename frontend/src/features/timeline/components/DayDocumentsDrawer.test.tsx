/**
 * O drawer só é "contextual" se fechar do jeito certo.
 *
 * Estes testes existem porque a verificação no navegador não conseguiu provar o
 * Esc: a janela estava em segundo plano e o Chrome se recusa a entregar evento
 * de teclado real a uma aba que não está desenhando. Em jsdom o teclado é
 * determinístico, e é exatamente este comportamento — abrir, listar, filtrar,
 * fechar com Esc — que não pode regredir sem alguém perceber.
 *
 * Usa `fireEvent`, não `user-event`: a segunda biblioteca não está no projeto,
 * e nenhum destes casos precisa de simulação de digitação real. Dependência
 * nova exige autorização — e aqui não faz falta.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import type { DocumentoResumo } from '@/lib/api'
import { DayDocumentsDrawer } from './DayDocumentsDrawer'

function doc(id: number, assunto: string, natureza: string): DocumentoResumo {
  return {
    documento_id: id,
    data_documento: '2025-09-23',
    data_documento_precisao: 'dia',
    assunto,
    natureza,
    destinatario: 'Órgão Contratante',
    rodovia_principal: null,
    arquivo_extensao: 'PDF',
  } as DocumentoResumo
}

const DOCS = [
  doc(1, 'Contrato RD 103 Consolidado', 'Minuta'),
  doc(2, 'Remuneração do presidente', 'Consulta'),
  doc(3, 'Aditivo ambiental', 'Minuta'),
  doc(4, 'Nota sobre prazo', 'Nota Técnica'),
]

function montar(props: Partial<React.ComponentProps<typeof DayDocumentsDrawer>> = {}) {
  // `retry: false`: o drawer busca o link real de cada documento e aqui não há
  // servidor; sem isto o React Query ficaria repetindo a chamada durante o teste.
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onFechar = vi.fn()
  const utils = render(
    <QueryClientProvider client={cliente}>
      <DayDocumentsDrawer
        iso="2025-09-23"
        titulo="23 de setembro de 2025"
        documentos={DOCS}
        aberto
        onFechar={onFechar}
        onVerNoAcervo={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { ...utils, onFechar }
}

describe('drawer contextual do dia', () => {
  it('mostra a data, a contagem e um item por documento', () => {
    montar()
    expect(screen.getByText('23 de setembro de 2025')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('Esc fecha', async () => {
    const { onFechar } = montar()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onFechar).toHaveBeenCalled())
  })

  it('o botão de fechar fecha', async () => {
    const { onFechar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(onFechar).toHaveBeenCalled())
  })

  it('o filtro local reduz a lista sem ir ao servidor', async () => {
    montar()
    fireEvent.change(screen.getByPlaceholderText(/Filtrar por assunto/), {
      target: { value: 'minuta' },
    })
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
  })

  it('oferece a saída para o Acervo', () => {
    const onVerNoAcervo = vi.fn()
    montar({ onVerNoAcervo })
    fireEvent.click(screen.getByRole('button', { name: /Ver no Acervo Documental/ }))
    expect(onVerNoAcervo).toHaveBeenCalled()
  })

  it('fechado, não renderiza nada — o contexto atrás continua intacto', () => {
    montar({ aberto: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
