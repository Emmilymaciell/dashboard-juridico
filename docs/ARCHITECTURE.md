# ARCHITECTURE — arquitetura técnica

**Status:** **implementada** nas fases 2 a 6 (pipeline, API, frontend, 3 páginas funcionais).
Este documento descreve o que existe; onde disser "a implementar", é fase 7+.
**Princípio:** arquitetura preparada para crescer, sem crescer antes da hora.
O volume atual é 296 linhas de índice e 291 documentos no disco (10/09/2026 16:21;
era 154 e 259 uma hora antes — a fonte cresce). Qualquer complexidade além do
necessário para isso é custo, não preparação.

---

## 1. Visão geral

```
┌─ FONTE (SOMENTE LEITURA) ────────────────────────────────────────────────┐
│  OneDrive/SharePoint — 02 Repositorio\Escritório Jurídico                            │
│  00 Indice.xlsx  +  16 pastas de natureza                                │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │ leitura + cópia
┌─ INGESTÃO (backend/pipeline) ─────────────────────────────────────────────┐
│  01 snapshot   copia o xlsx e inventaria o disco  ->  data/raw/           │
│  02 extract    lê abas e hyperlinks               ->  frames tipados      │
│  03 validate   contratos bloqueantes + achados DQ ->  fct_dq_finding      │
│  04 normalize  trim, split, parse, derivações     ->  modelo analítico    │
│  05 load       grava Parquet e carrega DuckDB     ->  data/processed/      │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │ SQL
┌─ API (backend/app, FastAPI) ──────────────────────────────────────────────┐
│  repositories -> services -> api/v1     Pydantic v2 em toda fronteira     │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │ HTTP/JSON, localhost
┌─ FRONTEND (frontend, React+TS+Vite) ─────────────────────────────────────┐
│  lib/api -> features -> ui              ECharts via wrapper próprio       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Regra de fronteira:** o frontend não lê Excel, não lê disco, não conhece caminho de
arquivo. Tudo passa pela API. A API não lê Excel: só consulta o DuckDB. Só a ingestão
toca a fonte.

---

## 2. Camada de dados

### 2.1 Por que DuckDB (e não SQLite) — `DEC-003`

O volume é pequeno o suficiente para que qualquer opção funcione. A escolha é pela
**natureza da carga**: tudo aqui é agregação, `GROUP BY`, janela, pivô e cruzamento
(`Tema × Natureza`, séries mensais, matriz pasta × índice).

| Critério | DuckDB | SQLite |
|---|---|---|
| Carga analítica (OLAP, colunar, vetorizada) | nativo | linha a linha |
| `Parquet` como formato de entrada/saída | `read_parquet` / `COPY TO` nativos | precisa de código |
| Window functions, `PIVOT`, `QUALIFY`, `LIST`/`UNNEST` | completo | parcial ou ausente |
| Ler Excel/CSV direto para prototipagem | extensões nativas | não |
| Zero servidor, arquivo único | sim | sim |
| Concorrência de escrita | fraca | melhor |
| Estabilidade do formato do arquivo | evolui entre versões | muito estável |

Os dois pontos fracos do DuckDB **não nos afetam**: há um único escritor (o pipeline),
e o `.duckdb` é artefato **descartável** — nunca versionado, sempre reconstruível a
partir de `data/raw/` em segundos. Os Parquet são a camada durável.

Escapatória: se algum dia precisarmos de múltiplos escritores ou de embutir o banco em
distribuição, os repositories são a única camada que fala SQL — trocar é localizado.

### 2.2 Artefatos

| Caminho | Conteúdo | Versionado |
|---|---|---|
| `data/raw/00_Indice_<snapshot>.xlsx` | cópia byte-a-byte da fonte | não |
| `data/raw/filesystem_<snapshot>.json` | inventário do disco no instante da varredura | não |
| `data/processed/<tabela>_<snapshot>.parquet` | modelo analítico, camada durável | não |
| `data/processed/prog.duckdb` | banco consultado pela API | não |
| `data/cache/` | trabalho intermediário descartável | não |
| `state/last_snapshot.json` | ponteiro para o snapshot corrente | não |
| `output/discovery_*.json` | relatórios de profiling | não |

Nada em `data/`, `logs/`, `output/`, `state/` entra no Git — ver `.gitignore`.

### 2.3 Pipeline

`python -m backend.pipeline.run --full`

```
snapshot -> extract -> validate -> normalize -> load
```

Propriedades exigidas:

- **Idempotente** — mesmo snapshot ⇒ mesma saída, byte a byte.
- **Atômico na carga** — grava `prog.duckdb.tmp` e só então substitui. Falha no meio
  deixa o banco anterior intacto.
- **Auditável** — cada tabela leva `snapshot_id`; `logs/pipeline_<snapshot>.log`
  registra contagens de entrada e saída de cada etapa.
- **Fail-fast no contrato, tolerante no dado** — coluna faltando aborta;
  valor fora da taxonomia gera achado e segue.
- **Somente leitura na fonte** — um único módulo (`pipeline/steps/snapshot.py`) tem
  permissão de tocar o caminho da fonte, e só para ler e copiar.

### 2.4 Trava de proteção da fonte

```python
# backend/pipeline/source_guard.py — IMPLEMENTADO
# - resolve o caminho da fonte uma única vez, a partir da config
# - expõe apenas: list_tree(), copy_index_to(dest), stat_file()
# - nenhuma função de escrita; nenhum caminho de destino pode estar sob a fonte
# - assert explícito: dest.resolve() não é subcaminho de source_root.resolve()
```

Testes em `tests/pipeline/test_source_guard.py` verificam que:
qualquer destino sob a fonte levanta exceção · o workbook é aberto em modo leitura ·
`openpyxl.Workbook.save` nunca é chamado com um caminho sob a fonte ·
nenhum arquivo novo aparece na fonte após a execução (comparação de inventário antes/depois).

---

## 3. Backend

```
backend/app/
├── main.py                 criação do app, CORS local, handlers de erro
├── core/
│   ├── config.py           Settings (pydantic-settings): .env > config.json > default
│   └── logging.py           logging estruturado -> logs/api.log
├── domain/                 modelos de domínio, sem dependência de framework
├── schemas/                DTOs Pydantic v2 de request/response
├── repositories/           única camada que escreve SQL (DuckDB)
├── services/               regra de negócio, agregações, rótulos de categoria
└── api/v1/                 routers: apenas HTTP -> service -> HTTP
```

### Contratos de API — princípios

1. **Toda resposta agregada carrega proveniência.**

```json
{
  "data": [ { "mes": "2026-03", "documentos": 19 } ],
  "meta": {
    "categoria": "DADO DERIVADO",
    "grao": "documento",
    "cobertura": { "documentos": 296, "considerados": 296, "percentual": 100 },
    "snapshot_id": "2026-09-10T15:30:05",
    "varredura_em": "2026-09-10T14:25:00"
  }
}
```

O campo `meta` não é enfeite: é o que permite ao frontend renderizar o badge de
categoria e o aviso de cobertura sem hardcode. Métrica sem `meta` é bug de contrato.

2. **Grão declarado.** Endpoint de tema devolve `grao: "vinculo_documento_tema"`;
   endpoint de documento devolve `grao: "documento"`. O frontend rotula a partir disso.
3. **Erro tipado** — `{ "erro": { "codigo": "...", "mensagem": "...", "detalhe": {...} } }`.
   Código estável, mensagem em português, sem stack trace.
4. **Sem estado.** Filtros vão na query string; nada de sessão.
5. **Somente localhost** nesta fase. CORS restrito à origem do Vite.

### Endpoints previstos (v1)

```
GET /api/v1/health
GET /api/v1/meta/snapshot              snapshot atual, varredura, contagens de controle
GET /api/v1/documentos                 lista paginada + filtros combinados
GET /api/v1/documentos/{id}            detalhe completo, incluindo campos vazios
GET /api/v1/documentos/{id}/relacionados
GET /api/v1/kpis/overview              os 4 KPIs do Executive Overview
GET /api/v1/series/producao            série temporal por granularidade e decomposição
GET /api/v1/dimensoes/{dim}            natureza | tema | destinatario | pessoa | pasta | status
GET /api/v1/matriz                     heatmaps: ?linhas=tema&colunas=natureza
GET /api/v1/repositorio/varreduras     LOG_ATUALIZACAO
GET /api/v1/repositorio/cobertura      matriz pasta x (disco/índice)
GET /api/v1/governanca/achados         fct_dq_finding, filtrável por severidade
GET /api/v1/export/documentos.csv      exportação local da visão filtrada
```

---

## 4. Frontend

```
frontend/src/
├── app/            entry, router, providers, error boundary
├── ui/             primitivos shadcn/ui + tokens (sem regra de negócio)
├── charts/          wrappers ECharts: <BarChart>, <LineChart>, <Heatmap>, <Sankey>
├── features/
│   ├── overview/  explorer/  portfolio/  timeline/  themes/
│   ├── contracts/ repository/ governance/
├── lib/
│   ├── api/        client tipado + hooks (TanStack Query)
│   ├── format/     datas pt-BR, números, precisão de data
│   └── filters/    estado de filtros <-> URL
└── styles/         tokens, temas light/dark
```

**Decisões**

- **Estado de servidor:** TanStack Query. Cache, revalidação e estados de
  loading/erro/vazio saem de graça, e são requisito de UI.
- **Estado de filtro:** na URL (`useSearchParams`). Link compartilhável reproduz a
  visão exata. Sem Redux/Zustand — não há estado global suficiente para justificar.
- **ECharts sempre via wrapper.** Nenhuma página monta `option` de ECharts direto:
  tema, paleta, tooltip, acessibilidade e responsividade ficam em um lugar só.
- **Tipos do backend:** gerados a partir do OpenAPI do FastAPI, nunca escritos à mão —
  divergência entre API e UI vira erro de compilação.
- **`strict: true`** no TypeScript, sem exceções.
- **Roteamento:** React Router, code-splitting por página.

---

## 5. Configuração

Precedência: **variável de ambiente > `config/config.json` > `config/config.example.json`**.

- Caminho da fonte **nunca** hardcoded em código de aplicação.
- Um único ponto de leitura: `backend/app/core/config.py`; `scripts/` usa a mesma lógica.
- `.env` e `config/config.json` são locais e ignorados pelo Git.
- Frontend recebe só o que precisa, via `VITE_API_BASE_URL`. Nenhum caminho de disco
  chega ao browser.

---

## 6. Segurança

| Risco | Controle |
|---|---|
| Escrita acidental na fonte | `source_guard` + testes de inventário antes/depois |
| Documento jurídico no Git | `.gitignore` bloqueia `*.pdf` `*.docx` `*.xlsx` `data/**` |
| Segredo no Git | só `.env.example` e `config.example.json`; sem token no projeto |
| Vazamento externo | zero dependência de rede em runtime; nenhuma telemetria; API em localhost |
| Dado pessoal de terceiro | nomes de pessoas nunca em commit, log ou exemplo |
| Dependência maliciosa | versões travadas; toda nova dependência justificada e autorizada |

Nenhuma dependência que transmita dados pode ser adicionada sem autorização explícita.

---

## 7. Testes

| Camada | Ferramenta | Cobre |
|---|---|---|
| Segurança da fonte | pytest | `source_guard`, inventário imutável, modo leitura |
| Contratos de dados | pytest | abas, colunas, tipos, `ID` único |
| Normalização | pytest | split de `;`, parse de data, `(aprox.)`, `fold()`, precisão mensal |
| Reconciliação | pytest | os números de `DATA_MODEL.md` §9 contra o snapshot |
| Repositories | pytest | SQL contra DuckDB temporário |
| API | pytest + httpx | status, schema, `meta`, filtros combinados, erros |
| Frontend unitário | Vitest | formatação, filtros, transformações |
| Componentes | Vitest + Testing Library | estados vazio/erro/skeleton, acessibilidade |
| Ponta a ponta (fase 8) | Playwright | Overview e Explorer sobre snapshot fixo |

**Teste de reconciliação** é o que responde "o dashboard está certo?": para cada KPI,
compara o valor da API com o valor calculado direto do snapshot, por dois caminhos
independentes. Diferença = build vermelho.

**Implementado:** 134 testes Python (`pytest`) e 28 no frontend (Vitest), com
`pyproject.toml` na raiz e `vitest.config.mts` no frontend.

---

## 8. Dependências previstas

**Backend:** `fastapi` · `uvicorn` · `pydantic` · `pydantic-settings` · `duckdb` ·
`pandas` · `openpyxl` · `pyarrow` · `pytest` · `httpx` · `ruff`
**Frontend:** `react` · `react-dom` · `react-router-dom` · `typescript` · `vite` ·
`tailwindcss` · shadcn/ui (`radix-ui`, `class-variance-authority`, `tailwind-merge`) ·
`echarts` · `@tanstack/react-query` · `lucide-react` · `vitest` · `@testing-library/react` ·
`eslint` · `prettier`

Nenhuma faz rede em runtime. `polars` fica de fora até haver ganho medido — `pandas`
resolve 296 linhas com folga.

---

## 9. Deploy

**Fase atual: nenhum.** Roda local: `uvicorn` na 8000, Vite na 5173.
Quando houver necessidade de compartilhar, a opção mais simples é build estático do
frontend servido pelo próprio FastAPI, em um único processo. Cloud, container e domínio
só entram com decisão explícita da usuária — e mudam a análise de segurança, porque
hoje nada sai da máquina.
