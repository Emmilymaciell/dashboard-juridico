> **Nota da versão pública.** Este é o README original do projeto, com os identificadores
> do cliente substituídos (ver `README.md` na raiz). Caminhos, comandos e números referem-se
> ao sistema em uso real; para rodar com dados fictícios, siga o `README.md` da raiz.

# Dashboard Jurídico

**Inteligência Jurídica — Escritório Jurídico / Programa.** Dashboard de Legal Intelligence sobre o
acervo jurídico produzido pelo **Escritório Jurídico** para o **Programa**, no contexto do
**Fundo** (Estado).

O nome do produto é centralizado em `frontend/src/brand/product.ts` (`PRODUCT`) — não
há string de marca escrita em página.

Volume e evolução da produção jurídica, naturezas e temas tratados, distribuição por
contrato, rodovia e executora, atividade do repositório e qualidade dos próprios
metadados — sobre os dados reais, sempre com a proveniência declarada.

> **A fonte documental é SOMENTE LEITURA.** Este projeto lê o repositório do Escritório Jurídico e
> nunca escreve nele. Ver `CLAUDE.md`, seção 3, e `DEC-002`.

---

## Como abrir o dashboard

```powershell
cd "C:\caminho\exemplo\dashboard-juridico"
.\scripts\start_dev.ps1
```

O script confere os pré-requisitos, instala o que falta, constrói o banco analítico se
ainda não existir, sobe a API e o frontend em duas janelas e abre o navegador.

| Onde | URL |
|---|---|
| **Dashboard** | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8000/api/v1 |
| Documentação da API (OpenAPI) | http://127.0.0.1:8000/docs |
| Health check | http://127.0.0.1:8000/api/v1/health |

**Para parar:** `.\scripts\stop_dev.ps1` (ou feche as duas janelas do PowerShell).

Se o PowerShell recusar a execução do script, libere apenas a sessão atual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

---

## Como atualizar os dados

A fonte é viva: muda ao longo do dia. Cada atualização captura um **snapshot
consistente** e reconstrói tudo a partir dele (`DEC-020`).

```powershell
.\scripts\refresh_data.ps1                  # snapshot novo + rebuild completo
.\scripts\refresh_data.ps1 -ValidateOnly    # só valida, sem gravar nada
```

Com a API no ar, basta recarregar o navegador depois. A fonte não é alterada em nenhum
momento.

O dashboard mostra **dois relógios**, e eles não são a mesma coisa (`DEC-021`):

- **Dados estruturados atualizados em** — até quando `00 Indice.xlsx` está atualizado;
- **Inventário físico observado em** — até quando o disco foi observado.

Quando divergem, aparece o contador de documentos **aguardando indexação**. Isso não é
falha de qualidade: é defasagem normal entre dois sistemas. A ação é rodar a atualização
no projeto `repositorio_juridico`, que é o único autorizado a escrever no índice.

---

## Instalação (primeira vez)

```powershell
# 1. dependências Python
python -m pip install fastapi "uvicorn[standard]" pydantic duckdb pyarrow pandas openpyxl
python -m pip install pytest httpx ruff        # desenvolvimento

# 2. dependências do frontend
cd frontend; npm install; cd ..

# 3. configuração local (nenhum dos dois vai para o Git)
Copy-Item config\config.example.json config\config.json
Copy-Item .env.example .env

# 4. primeiro build dos dados
python -m backend.pipeline.run --full
```

`config\regras_negocio.json` **já vem no repositório** — é versionado, porque é a
autoridade operacional das regras de domínio (`DEC-017`).

**Configuração.** Precedência: variável de ambiente > `config/config.json` >
`config/config.example.json`. Se o caminho do OneDrive mudar, ajuste `PROG_SOURCE_ROOT`
no `.env` ou `source.root` no `config.json` — o caminho não está hardcoded em lugar nenhum
do código.

---

## Como testar

```powershell
python -m pytest tests -q              # 134 testes: source guard, pipeline, API
python -m ruff check .                 # lint do backend
python scripts\01_discovery.py         # profiling somente-leitura da fonte

cd frontend
npm run typecheck                      # TypeScript strict
npm run lint
npm run test                           # 28 testes de unidade
npm run build                          # build de produção
```

O teste mais importante é `tests/pipeline/test_source_guard.py`: ele compara o inventário
da fonte **antes e depois** de um ciclo completo e falha se qualquer coisa tiver mudado.

---

## Arquitetura

```
00 Indice.xlsx (somente leitura) + árvore de pastas
      |  snapshot do ciclo: hash + tamanho + mtime + timestamp + origem
      v
data/raw/<ciclo>/          snapshot imutável (não versionado)
      |  extract -> validate -> normalize
      v
data/processed/<ciclo>/     Parquet: fatos, dimensões, pontes
      |  load atômico
      v
data/processed/prog.duckdb  banco analítico (descartável, reconstruível)
      |  SQL
      v
FastAPI (backend/app)       única porta de saída dos dados
      |  JSON com meta de proveniência
      v
React + TypeScript          apresentação
```

O frontend nunca lê Excel, nunca toca o disco e nunca recalcula agregação.
A API nunca lê a fonte: consulta só o DuckDB. Só a ingestão toca a fonte, e só para ler.

**Stack:** React 18 · TypeScript strict · Vite 6 · Tailwind 3 · Radix (estilo shadcn/ui) ·
Apache ECharts 5 · TanStack Query · Python 3.12 · FastAPI · Pydantic v2 · DuckDB · Parquet.

---

## O que está implementado

| Área | Estado |
|---|---|
| Pipeline (snapshot, validação, normalização, Parquet, DuckDB) | ✅ |
| API FastAPI — 17 endpoints com `meta` de proveniência | ✅ |
| Design system (tokens, light/dark, primitivos, gráficos) | ✅ |
| **Capa executiva** (`/`) | ✅ funcional |
| **Visão Geral** (`/painel`) | ✅ funcional |
| **Portfólio Jurídico** (`/portfolio`) | ✅ funcional |
| **Linha do Tempo** (`/linha-do-tempo`) | ✅ funcional |
| **Destinatários** (`/destinatarios`) | ✅ funcional |
| **Rodovias & Contratos** (`/rodovias`) | ✅ funcional |
| **Acervo Documental** (`/documentos`) + ficha do documento | ✅ funcional |
| **Governança** (`/governanca`) | ✅ funcional, fora do menu |
| Identidade visual V2 (claro e escuro) | ✅ `docs/VISUAL_REDESIGN.md` |

### Rotas

```
/                  capa executiva (fora do shell da aplicação)
/painel            Visão Geral
/portfolio         Portfólio Jurídico
/linha-do-tempo    Linha do Tempo
/destinatarios     Destinatários
/rodovias          Rodovias & Contratos
/documentos        Acervo Documental   (?doc=<id> abre a ficha)
/governanca        Governança do acervo — acessível por URL, fora do menu
```

Parâmetros de apresentação aceitos em qualquer rota:

| Parâmetro | Efeito |
|---|---|
| `?aparencia=light` ou `?aparencia=dark` | força a aparência sem gravar a preferência (`DEC-028`) |
| `?static=1` | desliga as animações de entrada (captura de tela, apresentação) |

Os filtros também vivem na URL (`DEC-011`), então qualquer recorte é um link.

### Endpoints

```
GET /api/v1/health                    prontidão do modelo
GET /api/v1/meta                      ciclo, dois relógios, contagens de controle
GET /api/v1/meta/rules                regras de negócio confirmadas em vigor
GET /api/v1/overview                  KPIs + série + cortes do Overview
GET /api/v1/timeline                  série temporal (mês | trimestre | ano)
GET /api/v1/natures                   documentos por natureza
GET /api/v1/themes                    vínculos documento-tema
GET /api/v1/stakeholders              documentos por destinatário
GET /api/v1/roads                     documentos por rodovia (regra RD-102)
GET /api/v1/contracts                 contratos confirmados e executoras
GET /api/v1/matrix                    matriz de duas dimensões (heatmap)
GET /api/v1/documents                 lista paginada + filtros combinados
GET /api/v1/documents/{id}            detalhe completo
GET /api/v1/documents/export/csv      exportação da visão filtrada
GET /api/v1/governance                qualidade do acervo e achados
GET /api/v1/repository-activity       atividade do indexador
GET /api/v1/dimensions/{nome}         dimensão bruta
GET /api/v1/filters/options           valores disponíveis para os filtros
GET /api/v1/response-priority         escala de necessidade de resposta
GET /api/v1/years                     distribuição por ano
GET /api/v1/portfolio                 Portfólio Jurídico
GET /api/v1/timeline-detail           Linha do Tempo
GET /api/v1/stakeholders-detail       Destinatários
GET /api/v1/roads-detail              Rodovias & Contratos
```

**Filtros aceitos em todo endpoint analítico:** `data_inicio`, `data_fim`, `natureza`,
`tema`, `destinatario`, `rodovia`, `contrato`, `status`, `estagio`, `macrogrupo`, `busca`,
`somente_ativos`. Valores múltiplos repetem a chave (`?natureza=A&natureza=B`).

---

## Princípios do produto

**RESUMO → EXPLORAÇÃO → EVIDÊNCIA DOCUMENTAL.** Todo KPI e todo elemento de gráfico
navega para o Acervo Documental com o recorte correspondente, e de lá para o documento
original no SharePoint. Um número que não navega é um número morto.

**A cor tem função.** Uma dimensão, um matiz; onde há categoria, a cor é a categoria; e
`Não classificado` tem cor reservada, porque é ausência de classificação e não uma
categoria (`DEC-025`). Ver `docs/VISUAL_REDESIGN.md`.

**Nenhum número é hardcoded.** Tudo vem do snapshot atual. Os valores que aparecem em
`docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) são estados históricos, nunca dados da aplicação.

**Proveniência declarada.** Cada informação carrega sua origem — `source`, `derived`,
`confirmed_business_rule`, `inferred`, `taxonomy_pending`, `missing` — e a UI rotula o que
não é dado literal da fonte. Cobertura parcial é sempre declarada.

**Limitação conhecida não é erro crítico.** Taxonomia divergente pode ser estado
confirmado ou achado a validar; categoria vazia é categoria vazia; documento recém-chegado
é defasagem entre relógios. Ver `DEC-022`.

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | memória permanente: objetivo, arquitetura, regras, restrições, Git |
| [`STATE.md`](STATE.md) | fase atual, o que está feito, próximo passo, pendências |
| [`config/regras_negocio.json`](config/regras_negocio.json) | **regras confirmadas pela usuária** — autoridade operacional |
| [`docs/DISCOVERY.md`](docs/DISCOVERY.md) (removido na versão pública: perfil do acervo real) | o que os dados reais são — números medidos |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | modelo analítico: fatos, dimensões, pontes, linhagem |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | páginas, KPIs, e o que os dados sustentam ou não |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | arquitetura técnica e contratos entre camadas |
| [`docs/UI_UX.md`](docs/UI_UX.md) | design system, tokens, temas, padrões de interação |
| [`docs/VISUAL_REDESIGN.md`](docs/VISUAL_REDESIGN.md) | redesenho V2: referências, paleta, armadilhas dos ativos |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | fases 0 a 8 |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | 30 decisões registradas (DEC-001…DEC-030) |
| [`docs/GLOSSARIO.md`](docs/GLOSSARIO.md) | siglas do domínio: Programa, Fundo, Parceiro, Órgão Contratante, Ministério Público, executoras |
| [`tests/README.md`](tests/README.md) | o que cada suíte cobre e por quê |

---

## Ecossistema

Este projeto **não** mantém o índice documental. Quem faz isso é o projeto vizinho e
independente `repositorio_juridico`, o único autorizado a escrever em
`00 Indice.xlsx`. Aqui somos consumidores desse arquivo — e os dois projetos permanecem
desacoplados (`DEC-012`).

```
Repositório Escritório Jurídico -> repositorio_juridico -> 00 Indice.xlsx -> dashboard_juridico
```

---

## Git

Repositório próprio, branch `main`. **Commits só acontecem quando a usuária pede
explicitamente.** Nada de commit automático, nada de push automático. Regras completas em
`CLAUDE.md`, seção 6.

Nunca entram no histórico: documentos jurídicos (`*.pdf`, `*.docx`, `*.xlsx`), snapshots e
dados derivados (`data/`), banco analítico (`*.duckdb`, `*.parquet`), logs, saídas,
segredos, `node_modules`.

---

## Segurança

Nada sai desta máquina: a API escuta apenas em `127.0.0.1`, e não há telemetria,
analytics, tracker ou envio de conteúdo documental. Nenhuma dependência faz rede em
tempo de execução. Qualquer dependência que possa transmitir dados precisa de autorização
explícita antes de ser adicionada.
