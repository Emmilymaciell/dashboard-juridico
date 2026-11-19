# ROADMAP

Fases sequenciais. Nada de tela grande antes de entender os dados; nada de módulo
analítico que os dados não sustentem. O estado exato da obra fica em `STATE.md`.

Legenda: ✅ concluído · 🔄 em andamento · ⬜ não iniciado · ⛔ bloqueado

---

## ✅ FASE 0 — FOUNDATION

Repositório próprio, estrutura, regras e documentação viva.

- [x] criar `C:\caminho\exemplo\dashboard-juridico` (fora de qualquer outro repo)
- [x] `git init`, branch `main`, **sem commit**
- [x] árvore de diretórios (backend, frontend, data, scripts, config, docs, tests, logs, state, output)
- [x] `CLAUDE.md` — memória permanente do projeto
- [x] `README.md`
- [x] `.gitignore` — bloqueia documentos, dados derivados, banco, logs, segredos
- [x] `.gitattributes` — EOL e binários
- [x] `.env.example` e `config/config.example.json` — caminho da fonte configurável
- [x] `STATE.md` — ponto de retomada
- [x] `data/README.md`, `state/README.md`, `tests/README.md`
- [x] `.claude/skills/`, `.claude/commands/`

---

## ✅ FASE 1 — DISCOVERY

Entender a fonte real antes de modelar qualquer coisa.

- [x] `scripts/01_discovery.py` — profiling somente-leitura, reproduzível
- [x] mapear a árvore física (259 arquivos, 16 pastas, 1 vazia)
- [x] analisar as 4 abas de `00 Indice.xlsx`
- [x] profiling das 15 colunas: tipos, nulos, distintos, distribuições
- [x] campos multivalorados (`Temas`: 142 linhas, 467 vínculos, 20 temas)
- [x] os 4 conceitos de data, e por que não são equivalentes
- [x] hyperlinks (291/296, host único, 0 divergências)
- [x] físico vs. índice — **cobertura 100%** após a usuária indexar `Minuta/`
- [x] `LOG_ATUALIZACAO` (22 varreduras; `Excluídos` e `Modificados` inconsistentes)
- [x] pasta × natureza (5 divergências legítimas)
- [x] nomenclatura (293/296 conformes)
- [x] rodovias (49% de cobertura, regra `RD-102` confirmada) e mapa
      contrato↔rodovia↔executora **confirmado pela usuária**
- [x] 14 regras de qualidade de dados catalogadas
- [x] `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real), `DATA_MODEL.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`,
      `UI_UX.md`, `ROADMAP.md`, `DECISIONS.md`, `GLOSSARIO.md`

**Saída:** 13 verificações automáticas (11 OK, 2 achados reais de qualidade).

---

## ✅ FASE 2 — DATA FOUNDATION

Pipeline reproduzível: fonte → Parquet → DuckDB. **Desbloqueada:** Q7-Q10 decididas em 10/09/2026 (`DEC-019` a `DEC-023`).

- [x] `backend/pyproject.toml` + ambiente (`duckdb`, `pyarrow`, `pytest`, `ruff`)
- [x] `backend/app/core/config.py` — `Settings` com precedência env > json
- [x] `backend/pipeline/source_guard.py` — **trava de somente-leitura da fonte**
- [x] `steps/01_snapshot.py` — cópia do xlsx + inventário do disco em `data/raw/`
- [x] `steps/02_extract.py` — abas e hyperlinks → frames tipados
- [x] `contracts/indice_v1.py` — 15 colunas, tipos, abas obrigatórias
- [x] `steps/03_validate.py` — contratos bloqueantes + 14 regras de DQ
- [x] `steps/04_normalize.py` — trim, split `;`, parse de data, `(aprox.)`,
      precisão mensal, `fold()`, decomposição de destinatário, parse de nome
- [x] `steps/05_load.py` — Parquet + DuckDB com carga atômica
- [x] `run.py` — `--full`, `--validate-only`, `--snapshot`
- [x] testes: source_guard · contratos · normalização · **reconciliação** (`DATA_MODEL.md` §9)
- [x] `scripts/02_rebuild.py` e `scripts/99_validar.py`

**Critério de aceite:** rodar duas vezes dá saída idêntica; os 8 números de
reconciliação batem; nenhum arquivo novo aparece na fonte (inventário antes/depois).

---

## ✅ FASE 3 — BACKEND

- [x] `main.py`, CORS local, handlers de erro tipados, logging
- [x] `repositories/` — SQL sobre DuckDB, única camada com SQL
- [x] `services/` — agregações + rótulo de categoria e cobertura
- [x] `schemas/` — Pydantic v2, envelope `{ data, meta }`
- [x] endpoints: `health` · `meta/snapshot` · `documentos` · `documentos/{id}` ·
      `documentos/{id}/relacionados` · `kpis/overview` · `series/producao` ·
      `dimensoes/{dim}` · `matriz` · `repositorio/varreduras` · `repositorio/cobertura` ·
      `governanca/achados` · `export/documentos.csv`
- [x] OpenAPI publicado (base dos tipos do frontend)
- [x] teste para cada endpoint: status, schema, `meta`, filtros combinados, erro

**Critério de aceite:** toda resposta agregada traz `meta` com categoria, grão,
cobertura e snapshot. Nenhum endpoint lê Excel.

---

## ✅ FASE 4 — DESIGN SYSTEM + FRONTEND FOUNDATION

- [x] Vite + React + TS `strict` + Tailwind + shadcn/ui
- [x] tokens de cor, tipografia, espaçamento (`UI_UX.md` §2) nos dois temas
- [x] theme provider light/dark/system, sem flash
- [x] shell: sidebar em 3 grupos, topbar, breadcrumb, período global, snapshot no pé
- [x] primitivos: KPI card · card de gráfico · tabela · chip · drawer · badge de
      categoria · aviso de cobertura · tooltip · skeleton · empty · error
- [x] wrappers ECharts com tema derivado dos tokens
- [x] cliente de API tipado (gerado do OpenAPI) + TanStack Query
- [x] filtros ↔ URL
- [x] `⌘K`, atalhos, foco, `aria-live`
- [x] Vitest + Testing Library; lint; typecheck

**Critério de aceite:** shell navegável nos dois temas, todos os estados demonstráveis,
zero erro de `strict`, contraste AA verificado.

---

## ✅ FASE 5 — EXECUTIVE OVERVIEW

Primeira página funcional, ponta a ponta.

- [x] 4 KPIs (ativos · produção no período · exposição sancionatória · cobertura do índice)
- [x] produção mensal com média móvel de 3 meses
- [x] composição por grupo jurídico (ou top 8 naturezas + "Outras", até validação)
- [x] top 8 temas, rotulado como vínculos, com opção de ocultar `Documentação`
- [x] atividade recente (10 últimos)
- [x] período global funcionando
- [x] badge de alerta de governança
- [x] drill-through de todo KPI
- [x] **teste de reconciliação de cada KPI contra o snapshot**

---

## ✅ FASE 6 — DOCUMENT EXPLORER

- [x] lista com ordenação e paginação de 50
- [x] busca `⌘K` sem acento/caixa
- [x] filtros combinados em chips com contagem, incluindo filtros de qualidade
- [x] estado de filtro na URL
- [x] drawer de detalhe com **todos** os campos, inclusive vazios
- [x] bloco temporal com os 4 tempos separados e a marca de aproximado
- [x] documentos relacionados (formato · reincidência · destinatário+tema)
- [x] botão `ABRIR DOCUMENTO` com `link_url` literal; desabilitado nos 5 excluídos
- [x] agrupamento opcional por documento lógico
- [x] exportação CSV da visão filtrada

---

## ⬜ FASE 7 — DEMAIS MÓDULOS

Ordem por valor. Implementar **apenas** o que os dados sustentam.

- [x] **Data Governance** — implementada junto com as fases 5 e 6
- [ ] Legal Portfolio (o perfil do acervo mudou: `Minuta` 1 -> 113 documentos)
- [ ] Legal Portfolio
- [ ] Timeline & Deliveries
- [ ] Repository Activity
- [ ] Themes & Stakeholders (heatmaps; Sankey só com filtro)
- [ ] ⛔ Contracts / Roads / Executoras — **bloqueado** pelas perguntas abertas
- [ ] ⛔ Legal Relationship View — **bloqueado** por volume; reavaliar acima de ~500 indexados

---

## ⬜ FASE 8 — QA E REFINAMENTO

- [ ] reconciliação completa: todo KPI da UI × cálculo direto na fonte
- [ ] Playwright em Overview e Explorer sobre snapshot fixo
- [ ] filtros combinados, casos de borda, 5 excluídos, 15 datas mensais, 2 nomes fora do padrão
- [ ] auditoria de acessibilidade (contraste, teclado, foco, leitor de tela)
- [ ] responsividade real em 375 / 768 / 1440
- [ ] performance (o volume é pequeno; a meta é interação instantânea)
- [ ] revisão de segurança: nenhuma chamada externa, nenhum dado sensível em log
- [ ] `CLAUDE.md`, `STATE.md` e `DECISIONS.md` conferidos contra o código

---

## Fora de escopo até decisão explícita

Leitura de conteúdo de PDF/DOCX · OCR · NLP ou IA via API · autenticação e multiusuário ·
deploy em cloud · escrita no índice (é do projeto vizinho) · integração com SharePoint
API · notificações · agendamento · uso dos `backups/` do projeto vizinho como série
histórica.
