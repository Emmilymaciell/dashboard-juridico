import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CategoryBadge, CoverageNote } from '@/ui/provenance'
import { TooltipProvider } from '@/ui/primitives'

function wrap(node: React.ReactNode) {
  return render(<TooltipProvider>{node}</TooltipProvider>)
}

describe('rótulos de confiança (DEC-005)', () => {
  it('dado existente não recebe badge — é o padrão', () => {
    const { container } = wrap(<CategoryBadge categoria="DADO EXISTENTE" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dado derivado é rotulado', () => {
    wrap(<CategoryBadge categoria="DADO DERIVADO" />)
    expect(screen.getByText('derivado')).toBeInTheDocument()
  })

  it('inferência é rotulada explicitamente', () => {
    wrap(<CategoryBadge categoria="INFERÊNCIA" />)
    expect(screen.getByText('inferência')).toBeInTheDocument()
  })

  it('regra confirmada é selo, não alerta de inferência', () => {
    wrap(<CategoryBadge categoria="DADO EXISTENTE" proveniencia="confirmed_business_rule" />)
    expect(screen.getByText('regra confirmada')).toBeInTheDocument()
    expect(screen.queryByText('inferência')).not.toBeInTheDocument()
  })

  it('não disponível é rotulado, não escondido', () => {
    wrap(<CategoryBadge categoria="NÃO DISPONÍVEL" />)
    expect(screen.getByText('não disponível')).toBeInTheDocument()
  })
})

describe('aviso de cobertura', () => {
  it('cobertura total não gera aviso — não há o que declarar', () => {
    const { container } = wrap(
      <CoverageNote cobertura={{ documentos: 296, cobertos: 296, percentual: 100 }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('cobertura parcial é sempre declarada', () => {
    wrap(<CoverageNote cobertura={{ documentos: 296, cobertos: 145, percentual: 49 }} />)
    expect(screen.getByText(/cobertura 49,0%/)).toBeInTheDocument()
  })

  it('sem cobertura informada não inventa aviso', () => {
    const { container } = wrap(<CoverageNote cobertura={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
