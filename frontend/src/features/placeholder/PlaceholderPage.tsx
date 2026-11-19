import { ArrowRight, Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, Button, Card } from '@/ui/primitives'

/**
 * Shell das páginas ainda não implementadas. Diz o que virá e por quê —
 * melhor 3 páginas excelentes que 8 superficiais.
 */
export function PlaceholderPage({
  title,
  lead,
  planned,
}: {
  title: string
  lead: string
  planned: string[]
}) {
  return (
    <div className="animate-fade-in space-y-5">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <Badge variant="outline">planejado</Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{lead}</p>
      </header>

      <Card className="max-w-3xl">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-subtle text-ink-muted">
            <Construction className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">O que esta área vai entregar</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Já especificado em <span className="font-mono">docs/PRODUCT_SPEC.md</span>. Os dados
              e a API que sustentam esta página já existem.
            </p>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {planned.map((item) => (
            <li key={item} className="flex gap-3 px-5 py-3">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-faint" />
              <span className="text-sm leading-relaxed text-ink-muted">{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-xs text-ink-faint">
            Enquanto isso, o Document Explorer já chega a qualquer documento do acervo.
          </p>
          <Link to="/documents">
            <Button variant="secondary" size="sm">
              Abrir Documents
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
