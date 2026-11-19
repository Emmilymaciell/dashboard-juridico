/**
 * Data Governance. Não é uma lista de erros: é a visão executiva da qualidade
 * do acervo.
 *
 * Regra central (DEC-022): limitação conhecida NÃO é erro crítico. `CMA` é
 * taxonomia pendente de validação, não "ERRO GRAVE". Categoria física vazia é
 * "categoria existente, atualmente sem documentos". Documento que chegou depois
 * da última varredura é defasagem entre relógios, não falha.
 */

import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Info, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { ThemeBars } from '@/charts/charts'
import { ApiError, type Achado, type Severidade } from '@/lib/api'
import { dateTime, num, pct } from '@/lib/format'
import { useGovernance, useMeta } from '@/lib/queries'
import { cn } from '@/lib/utils'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  InfoHint,
  Select,
  Separator,
  Skeleton,
} from '@/ui/primitives'

const SEVERITY: Record<
  Severidade,
  { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info'; icon: React.ComponentType<{ className?: string }> }
> = {
  high: { label: 'Alta', variant: 'danger', icon: ShieldAlert },
  medium: { label: 'Média', variant: 'warning', icon: AlertTriangle },
  low: { label: 'Baixa', variant: 'neutral', icon: Info },
  info: { label: 'Informativo', variant: 'info', icon: Info },
}

const RULE_LABELS: Record<string, string> = {
  lacuna_de_indexacao: 'Lacuna de indexação',
  pendente_de_reconciliacao: 'Aguardando indexação',
  campo_ausente_pessoa_upload: 'Responsável ausente',
  campo_ausente_pessoa_modificacao: 'Modificador ausente',
  campo_ausente_destinatario: 'Destinatário ausente',
  campo_ausente_natureza: 'Natureza ausente',
  campo_ausente_data_documento: 'Data ausente',
  data_documento_nao_normalizada: 'Data inválida ou vazia no índice',
  taxonomia_pendente_de_validacao: 'Taxonomia pendente de validação',
  taxonomia_planilha_vs_regra: 'Planilha vs. regra confirmada',
  nome_fora_do_padrao: 'Nome fora do padrão',
  campo_previsto_nao_utilizado: 'Campo previsto e não utilizado',
  log_excluidos_inconsistente: 'Log de exclusões inconsistente',
  duplicidade_copia_office: 'Cópia do Office',
  duplicidade_par_formato: 'Mesmo documento em dois formatos',
  duplicidade_variante_ou_versao: 'Variante ou versão sucessiva',
  macrogrupo_nao_classificado: 'Matéria não classificada',
  categoria_sem_documentos: 'Categoria sem documentos',
  link_ausente_em_documento_ativo: 'Link ausente em documento ativo',
  data_precisao_mensal: 'Precisão de data mensal',
  data_indexacao_aproximada: 'Data de indexação aproximada',
  regressao_extracao_rodovia: 'Regressão na extração de rodovia',
}

export function GovernancePage() {
  const { data: meta } = useMeta()
  const { data, isPending, isError, error, refetch } = useGovernance()
  const [severityFilter, setSeverityFilter] = React.useState<'todas' | Severidade>('todas')

  if (isError) {
    return (
      <div className="space-y-5">
        <Header />
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Erro ao carregar governança.'}
          hint={error instanceof ApiError ? error.acao : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    )
  }

  const resumo = data?.resumo
  const blocos = data?.blocos ?? []
  const achados = data?.achados ?? []
  const filtered =
    severityFilter === 'todas' ? achados : achados.filter((a) => a.severidade === severityFilter)

  const completeness = (blocos.find((b) => b.chave === 'completude')?.itens ?? []) as Array<{
    campo: string
    total: number
    preenchidos: number
    percentual: number
  }>
  const coverage = (blocos.find((b) => b.chave === 'cobertura')?.itens ?? []) as Array<{
    pasta_norm: string
    arquivos_disco: number
    linhas_indice: number
    ativos_indice: number
    delta: number
    vazia: boolean
  }>
  const taxonomy = (blocos.find((b) => b.chave === 'taxonomia')?.itens ?? []) as Array<{
    dimensao: string
    status_taxonomia: string
    valores: number
    documentos: number
  }>
  const pending = (blocos.find((b) => b.chave === 'reconciliacao')?.itens ?? []) as Array<{
    arquivo_nome: string
    pasta: string
    mtime_disco: string
  }>

  return (
    <div className="animate-fade-in space-y-5">
      <Header />

      {/* ------------------------------------------------------------- resumo */}
      {isPending || !resumo ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ScoreCard
              label="Score de completude"
              value={pct(resumo.score_completude)}
              hint={resumo.formula_score}
              tone={resumo.score_completude >= 85 ? 'positive' : 'warning'}
            />
            <ScoreCard
              label="Cobertura do índice"
              value={
                resumo.acervo_fisico
                  ? pct(
                      Math.round(
                        (1000 *
                          (resumo.acervo_fisico -
                            resumo.pendentes_reconciliacao -
                            resumo.lacunas_indexacao)) /
                          resumo.acervo_fisico,
                      ) / 10,
                    )
                  : '—'
              }
              hint={`${num(resumo.documentos)} documentos indexados de ${num(resumo.acervo_fisico)} no disco. ${num(resumo.pendentes_reconciliacao)} aguardando a próxima varredura, ${num(resumo.lacunas_indexacao)} lacuna(s) real(is).`}
              tone={resumo.lacunas_indexacao > 0 ? 'warning' : 'positive'}
            />
            <ScoreCard
              label="Lacunas de indexação"
              value={num(resumo.lacunas_indexacao)}
              hint="Arquivo anterior à última varredura e ausente do índice. Este é o achado que realmente importa."
              tone={resumo.lacunas_indexacao > 0 ? 'danger' : 'positive'}
            />
            <ScoreCard
              label="Achados abertos"
              value={num(resumo.achados_total)}
              hint={Object.entries(resumo.por_severidade)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => `${count} ${SEVERITY[key as Severidade]?.label.toLowerCase()}`)
                .join(' · ')}
              tone={(resumo.por_severidade.high ?? 0) > 0 ? 'danger' : 'neutral'}
            />
          </div>

          {/* Destaque honesto: se não há lacuna, a página começa pela boa notícia. */}
          {resumo.lacunas_indexacao === 0 ? (
            <Card className="border-positive/30 bg-positive/[0.04]">
              <div className="flex items-start gap-3 px-5 py-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Nenhuma lacuna de indexação no acervo
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Todo arquivo anterior à última varredura está no índice — disco e fonte
                    estruturada batem pasta por pasta.
                    {resumo.pendentes_reconciliacao > 0 ? (
                      <>
                        {' '}
                        Os <b>{num(resumo.pendentes_reconciliacao)}</b> documento(s) fora do índice
                        chegaram <b>depois</b> da última varredura: é defasagem normal entre dois
                        relógios, e a ação é rodar a atualização no projeto{' '}
                        <span className="font-mono">repositorio_juridico</span>.
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      )}

      {/* ------------------------------------------------ completude + taxonomia */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Completude de metadados"
            subtitle="quanto do acervo cada campo realmente cobre"
          />
          {isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-line">
              {completeness.map((item) => (
                <div key={item.campo} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-40 shrink-0 truncate text-xs text-ink">{item.campo}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
                    <span
                      className={cn(
                        'block h-full rounded-full transition-all duration-500 ease-swift',
                        item.percentual >= 95
                          ? 'bg-positive'
                          : item.percentual >= 70
                            ? 'bg-accent'
                            : 'bg-warning',
                      )}
                      style={{ width: `${item.percentual}%` }}
                    />
                  </span>
                  <span className="tabular w-14 shrink-0 text-right text-xs font-medium text-ink">
                    {pct(item.percentual)}
                  </span>
                  <span className="tabular w-20 shrink-0 text-right text-2xs text-ink-faint">
                    {num(item.preenchidos)}/{num(item.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Aderência à taxonomia"
            subtitle="divergência pode ser estado confirmado ou achado a validar"
            actions={
              <InfoHint>
                Valor fora da <span className="font-mono">LISTAS_APOIO</span> pode ser válido por
                regra confirmada pela usuária — isso é <b>estado</b>, não erro. Só o que está fora
                da planilha <i>e</i> sem regra fica pendente de validação. A fonte nunca é alterada
                por este projeto.
              </InfoHint>
            }
          />
          {isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle">
                  <tr>
                    <th className="px-4 py-2 text-2xs font-medium uppercase tracking-wider text-ink-muted">
                      Dimensão
                    </th>
                    <th className="px-4 py-2 text-2xs font-medium uppercase tracking-wider text-ink-muted">
                      Situação
                    </th>
                    <th className="px-4 py-2 text-right text-2xs font-medium uppercase tracking-wider text-ink-muted">
                      Valores
                    </th>
                    <th className="px-4 py-2 text-right text-2xs font-medium uppercase tracking-wider text-ink-muted">
                      Documentos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {taxonomy.map((row) => (
                    <tr key={`${row.dimensao}-${row.status_taxonomia}`} className="border-t border-line">
                      <td className="px-4 py-2 capitalize text-ink">{row.dimensao}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            row.status_taxonomia === 'ok'
                              ? 'neutral'
                              : row.status_taxonomia === 'confirmado_por_regra'
                                ? 'positive'
                                : 'warning'
                          }
                        >
                          {row.status_taxonomia === 'ok'
                            ? 'na taxonomia'
                            : row.status_taxonomia === 'confirmado_por_regra'
                              ? 'confirmado por regra'
                              : 'pendente de validação'}
                        </Badge>
                      </td>
                      <td className="tabular px-4 py-2 text-right text-ink">{num(row.valores)}</td>
                      <td className="tabular px-4 py-2 text-right text-ink-muted">
                        {num(row.documentos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* -------------------------------------------------- cobertura por pasta */}
      <Card>
        <CardHeader
          title="Cobertura do índice por categoria"
          subtitle="disco vs. fonte estruturada, pasta por pasta"
          actions={
            meta ? (
              <span className="text-2xs text-ink-faint">
                inventário de {dateTime(meta.physical_scan_as_of)}
              </span>
            ) : null
          }
        />
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-left text-xs">
              <thead className="bg-subtle">
                <tr>
                  {['Categoria', 'No disco', 'No índice', 'Ativos', 'Δ', 'Situação'].map((label, i) => (
                    <th
                      key={label}
                      className={cn(
                        'px-4 py-2 text-2xs font-medium uppercase tracking-wider text-ink-muted',
                        i > 0 && i < 5 && 'text-right',
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.pasta_norm} className="border-t border-line hover:bg-subtle">
                    <td className="px-4 py-2 capitalize text-ink">{row.pasta_norm}</td>
                    <td className="tabular px-4 py-2 text-right text-ink">
                      {num(row.arquivos_disco)}
                    </td>
                    <td className="tabular px-4 py-2 text-right text-ink-muted">
                      {num(row.linhas_indice)}
                    </td>
                    <td className="tabular px-4 py-2 text-right text-ink-muted">
                      {num(row.ativos_indice)}
                    </td>
                    <td
                      className={cn(
                        'tabular px-4 py-2 text-right font-medium',
                        row.delta > 0 ? 'text-warning' : 'text-ink-faint',
                      )}
                    >
                      {row.delta > 0 ? `+${num(row.delta)}` : '0'}
                    </td>
                    <td className="px-4 py-2">
                      {row.vazia && row.linhas_indice === 0 ? (
                        <Badge variant="info">categoria sem documentos</Badge>
                      ) : row.delta > 0 ? (
                        <Badge variant="warning">
                          <Clock3 className="size-3" />
                          aguardando indexação
                        </Badge>
                      ) : (
                        <Badge variant="positive">em dia</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --------------------------------------------- pendências + distribuição */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Distribuição dos achados"
            subtitle="onde a atenção deve ir primeiro"
          />
          <div className="px-2 py-3">
            {isPending || !resumo ? (
              <Skeleton className="mx-2 h-40" />
            ) : (
              <ThemeBars
                items={Object.entries(resumo.por_severidade)
                  .filter(([, count]) => count > 0)
                  .map(([key, count]) => ({
                    chave: SEVERITY[key as Severidade]?.label ?? key,
                    documentos: count,
                    ativos: null,
                    vinculos: null,
                    extra: {},
                  }))}
                valueKey="documentos"
                max={4}
              />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Pendências de reconciliação"
            subtitle={
              meta
                ? `documentos no disco posteriores a ${dateTime(meta.indexed_as_of)}`
                : 'documentos aguardando a próxima varredura'
            }
            actions={<Badge variant="info">{num(pending.length)}</Badge>}
          />
          {isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-6 text-positive" />}
              title="Nada aguardando indexação"
              description="O índice está sincronizado com o inventário físico."
            />
          ) : (
            <>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                {pending.slice(0, 60).map((file) => (
                  <li key={`${file.pasta}/${file.arquivo_nome}`} className="flex items-start gap-2 px-4 py-2">
                    <span className="w-20 shrink-0 truncate text-2xs capitalize text-ink-faint">
                      {file.pasta}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-2xs text-ink">
                      {file.arquivo_nome}
                    </span>
                    <span className="tabular shrink-0 text-2xs text-ink-faint">
                      {dateTime(file.mtime_disco)}
                    </span>
                  </li>
                ))}
              </ul>
              {pending.length > 60 ? (
                <p className="border-t border-line px-4 py-2 text-2xs text-ink-faint">
                  e mais {num(pending.length - 60)} arquivo(s).
                </p>
              ) : null}
              <div className="border-t border-line px-4 py-2.5">
                <p className="text-2xs leading-relaxed text-ink-muted">
                  Não é lacuna de qualidade: são documentos que chegaram depois da última
                  varredura. A ação é rodar a atualização no projeto{' '}
                  <span className="font-mono">repositorio_juridico</span> — este projeto não
                  escreve no índice.
                </p>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------ tabela de achados */}
      <Card>
        <CardHeader
          title="Achados"
          subtitle="cada linha diz o que é, onde está e qual a severidade real"
          actions={
            <div className="flex items-center gap-2">
              <Select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(event.target.value as 'todas' | Severidade)
                }
                className="h-7 text-xs"
                aria-label="Filtrar por severidade"
              >
                <option value="todas">todas as severidades</option>
                {(['high', 'medium', 'low', 'info'] as Severidade[]).map((key) => (
                  <option key={key} value={key}>
                    {SEVERITY[key].label}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-6 text-positive" />}
            title="Nenhum achado nesta severidade"
          />
        ) : (
          <FindingsTable achados={filtered} />
        )}
        <div className="border-t border-line px-4 py-2.5">
          <p className="text-2xs leading-relaxed text-ink-faint">
            Limitação conhecida não é erro crítico. <b>Taxonomia pendente de validação</b> significa
            que o valor foi preservado exatamente como está na fonte e aguarda confirmação — não que
            esteja errado.
          </p>
        </div>
      </Card>
    </div>
  )
}

function Header() {
  const { data: meta } = useMeta()
  return (
    <header className="space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Data Governance</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
        Qualidade do acervo documental como área do produto. Os problemas aparecem, e aparecem
        classificados: o que é achado, o que é estado conhecido e o que é apenas defasagem entre a
        fonte estruturada e o inventário físico.
      </p>
      {meta ? (
        <p className="pt-1 text-2xs text-ink-faint">
          Ciclo <span className="font-mono">{meta.ciclo_id}</span> · índice{' '}
          <span className="font-mono">{meta.indice_sha256?.slice(0, 12)}…</span> · regras de negócio
          v{meta.regras_negocio_versao}
        </p>
      ) : null}
    </header>
  )
}

function ScoreCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'positive' | 'warning' | 'danger' | 'neutral'
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps">{label}</span>
        <InfoHint>{hint}</InfoHint>
      </div>
      <p
        className={cn(
          'tabular mt-2 text-2xl font-semibold leading-none',
          tone === 'positive'
            ? 'text-positive'
            : tone === 'warning'
              ? 'text-warning'
              : tone === 'danger'
                ? 'text-danger'
                : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-2 line-clamp-2 text-2xs leading-snug text-ink-faint">{hint}</p>
    </Card>
  )
}

function FindingsTable({ achados }: { achados: Achado[] }) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, Achado[]>()
    for (const finding of achados) {
      const list = map.get(finding.regra_key) ?? []
      list.push(finding)
      map.set(finding.regra_key, list)
    }
    return [...map.entries()].sort((a, b) => {
      const order: Severidade[] = ['high', 'medium', 'low', 'info']
      const sa = order.indexOf(a[1][0]!.severidade)
      const sb = order.indexOf(b[1][0]!.severidade)
      return sa - sb || b[1].length - a[1].length
    })
  }, [achados])

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="divide-y divide-line">
      {grouped.map(([rule, items]) => {
        const first = items[0]!
        const config = SEVERITY[first.severidade]
        const Icon = config.icon
        const isOpen = expanded.has(rule)
        return (
          <div key={rule}>
            <button
              type="button"
              onClick={() => toggle(rule)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle"
              aria-expanded={isOpen}
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  first.severidade === 'high'
                    ? 'text-danger'
                    : first.severidade === 'medium'
                      ? 'text-warning'
                      : first.severidade === 'info'
                        ? 'text-info'
                        : 'text-ink-faint',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {RULE_LABELS[rule] ?? rule}
                  </span>
                  <Badge variant={config.variant}>{config.label}</Badge>
                  {items.length > 1 ? (
                    <Badge variant="outline">{num(items.length)} ocorrências</Badge>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                  {first.descricao}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'mt-1 size-4 shrink-0 text-ink-faint transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            {isOpen ? (
              <div className="border-t border-line bg-subtle/40 px-4 py-2">
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {items.slice(0, 80).map((item, index) => (
                    <li
                      key={`${item.entidade_tipo}-${item.entidade_id}-${index}`}
                      className="flex items-start gap-2 py-1 text-2xs"
                    >
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {item.entidade_tipo}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-mono text-ink">
                          {item.entidade_id}
                        </span>
                        {items.length > 1 ? (
                          <span className="block text-ink-faint">{item.descricao}</span>
                        ) : null}
                      </span>
                      {item.entidade_tipo === 'documento' ? (
                        <Link
                          to={`/documents?doc=${item.entidade_id}`}
                          className="shrink-0 text-accent hover:underline"
                        >
                          abrir
                        </Link>
                      ) : item.entidade_tipo === 'destinatario' ? (
                        <Link
                          to={`/documents?destinatario=${encodeURIComponent(item.entidade_id)}`}
                          className="shrink-0 text-accent hover:underline"
                        >
                          ver documentos
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {items.length > 80 ? (
                  <p className="pt-1 text-2xs text-ink-faint">
                    e mais {num(items.length - 80)} ocorrência(s).
                  </p>
                ) : null}
                <Separator className="my-2" />
                <p className="text-2xs text-ink-faint">
                  proveniência: <span className="font-mono">{first.proveniencia}</span>
                </p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
