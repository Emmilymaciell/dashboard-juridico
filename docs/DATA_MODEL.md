# DATA_MODEL — modelo analítico proposto

**Versão 2** — revisada após as confirmações da usuária de 10/09/2026.
**Status:** proposta da Fase 1, ainda **não implementada**.
**Base factual:** `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) v2 (varredura de 10/09/2026 16:21, 296 documentos).
**Regras de negócio:** `config/regras_negocio.json` v1 — autoridade operacional (`DEC-017`).
**Princípio:** cada campo declara sua **categoria de confiança** e sua **linhagem**.

---

## 1. Princípios de modelagem

1. **A fonte é imutável e é a única verdade factual.** Todo campo derivado guarda de
   onde veio e por qual regra. Nada é sobrescrito.
2. **Regra de negócio confirmada é mais forte que a planilha.** Onde a usuária confirmou
   (mapa de contratos, regra `RD-102`, `Empreiteiras`), a regra vale, e a divergência com
   a `LISTAS_APOIO` é registrada como *diferença*, não como erro.
3. **Granularidade explícita.** Antes de qualquer agregação, a tabela declara o que é uma
   linha. Confundir grão é a origem de 90% de dashboard errado.
4. **Multivalorado nunca vira string.** `Temas` explode em tabela-ponte. Contagem por
   tema conta **vínculos** (467), e a UI diz isso.
5. **Quatro tempos, quatro colunas.** `data_documento`, `data_indexacao`,
   `data_ultima_modificacao`, `data_varredura` nunca se misturam.
6. **Missing é informação.** `NULL` explícito, nunca `"N/D"`, `0` ou string vazia.
7. **Extração de texto roda campo por campo.** Concatenar campos antes de aplicar regex é
   antipadrão neste domínio (`DEC-014`).
8. **Reprodutível.** Rodar duas vezes sobre o mesmo snapshot produz bytes idênticos.

### Categorias de confiança e proveniência

Categorias: `EX` = DADO EXISTENTE · `DE` = DADO DERIVADO · `IN` = INFERÊNCIA ·
`HI` = HIPÓTESE · `ND` = NÃO DISPONÍVEL

Proveniências gravadas nos dados: `source` · `derived` · `confirmed_business_rule` ·
`analytical_derived`

`confirmed_business_rule` é o nível mais alto: a usuária confirmou oficialmente.
Não é inferência e não carrega badge de alerta na UI — carrega a marca de regra
confirmada, com a data da confirmação.

---

## 2. Visão geral do esquema

```
                            dim_calendario
                                  |
   dim_natureza ---+              |              +--- dim_status
     (+macrogrupo) |              |              |
 dim_destinatario -+---->  fct_documento  <------+--- dim_pasta
                   |         (grão: 1 linha           |
     dim_pessoa ---+          do ÍNDICE = 296)        +--- dim_documento_logico
                                  |
          +-----------------------+-----------------------+
          |                       |                       |
  br_documento_tema      br_documento_rodovia     dim_contrato
    (467 vínculos)          (DE, 145 docs)      (confirmed_business_rule)
          |                       |                       |
      dim_tema (20)         dim_rodovia (7) ---- dim_executora (4)


  fct_varredura            fct_arquivo_fisico          fct_dq_finding
 (grão: 1 execução          (grão: 1 arquivo no        (grão: 1 achado de
  do robô = 22)              disco na varredura         qualidade por
                             = 291)                     entidade)
```

Três ilhas de fato, deliberadamente **não somáveis entre si**:

| Ilha | Mede | Nunca somar com |
|---|---|---|
| `fct_documento` | **atividade jurídica** — o que o Escritório Jurídico produziu | as outras duas |
| `fct_varredura` + `fct_arquivo_fisico` | **atividade de repositório** — indexação e inventário | atividade jurídica |
| `fct_dq_finding` | **qualidade dos metadados** | as outras duas |

---

## 3. `fct_documento`

**Grão:** uma linha da aba `ÍNDICE` = um **arquivo** catalogado. 296 linhas hoje.
**Chave:** `documento_id` (= coluna `ID`, `int`, 1…296, sem lacuna nem duplicata).

| Coluna | Tipo | Cat. | Origem / regra |
|---|---|---|---|
| `documento_id` | `INTEGER PK` | EX | `ÍNDICE.ID` |
| `natureza_key` | `TEXT FK NULL` | EX | `ÍNDICE.Naturezas`; **`NULL` em 1 linha** (ID 264) |
| `assunto` | `TEXT` | EX | `ÍNDICE.Assunto` — 246 valores distintos |
| `destinatario_key` | `TEXT FK NULL` | EX | `ÍNDICE.Destinatarios`; `NULL` em 3 linhas |
| `necessidade_resposta` | `INTEGER NULL` | EX | **sempre 1; sem poder analítico** (`DEC-006`) |
| `status_key` | `TEXT FK` | EX | `Na pasta` (291) · `Excluído` (5) |
| `arquivo_nome` | `TEXT` | EX | `ÍNDICE.Arquivo`, com extensão; 296 distintos |
| `pasta_key` | `TEXT FK` | EX | `ÍNDICE.Pasta`, valor literal |
| `pasta_norm` | `TEXT` | DE | `fold(pasta_key)` — sem acento, minúscula; *join* com o disco |
| `link_url` | `TEXT NULL` | EX | **hyperlink da célula** `Link`, literal. `NULL` nas 5 `Excluído` |
| `link_texto` | `TEXT` | EX | valor visível (sempre `"Abrir"`) — só por completude |
| `data_documento` | `DATE NULL` | EX | `ÍNDICE.Data`; **`NULL` em 1 linha** (ID 264) |
| `data_documento_precisao` | `TEXT` | DE | `mes` nos 16 IDs com dia `00` no nome; `dia` nos demais; `NULL` quando sem data |
| `data_indexacao` | `TIMESTAMP` | DE | parse de `Data/hora do upload` (`%d/%m/%Y %H:%M`) |
| `data_indexacao_aproximada` | `BOOLEAN` | DE | `TRUE` se o texto continha `(aprox.)` → 125 linhas |
| `data_ultima_modificacao` | `TIMESTAMP` | DE | parse de `Última modificação` |
| `pessoa_upload_key` | `TEXT FK NULL` | EX | `Subido por`; `NULL` em 87 linhas (29%) |
| `pessoa_modificacao_key` | `TEXT FK NULL` | EX | `Modificado por`; `NULL` em 71 linhas (24%) |
| `arquivo_extensao` | `TEXT` | DE | sufixo em minúscula |
| `arquivo_copia_office` | `BOOLEAN` | DE | nome termina em `" (N)"` antes da extensão |
| `nome_conforme_padrao` | `BOOLEAN` | DE | casa a regex da aba `NOMENCLATURA`; `FALSE` em 3 linhas (IDs 97, 102, 264) |
| `nome_natureza` | `TEXT NULL` | DE | campo 2 do nome do arquivo |
| `nome_assunto` | `TEXT NULL` | DE | campo 3 do nome do arquivo |
| `nome_destinatario_curto` | `TEXT NULL` | DE | campo 4 — **mais granular que a coluna**: `Gama`, `Beta`, `Alfa`, `Delta`, `Ministério Público`, `Tribunal de Contas`, `Fornecedores`, `Seguradora`, `Executoras` |
| `nome_necessidade_resposta` | `INTEGER NULL` | DE | campo 5 do nome |
| `contrato_key` | `TEXT FK NULL` | **confirmed** | via `destinatario_key` → `config/regras_negocio.json`; 75 linhas (25%) |
| `documento_logico_key` | `TEXT FK` | DE | agrupa mesmo documento em formatos/cópias diferentes (§4) |
| `snapshot_id` | `TEXT FK` | DE | qual snapshot da fonte gerou esta linha (linhagem) |

**Regras de agregação**

- `COUNT(*)` = arquivos catalogados (296). **Não** é "documentos jurídicos distintos".
- Produção jurídica → `status_key = 'Na pasta'`, agrupado por `data_documento`.
- Série **diária** → excluir ou marcar `data_documento_precisao = 'mes'`, senão aparece
  pico artificial em todo dia 1º. Também excluir `data_documento IS NULL` (1 linha).
- Série **mensal** → pode usar tudo; a precisão de mês é suficiente.

---

## 4. Dimensões

### `dim_natureza`
**Grão:** um valor de natureza. 25 no catálogo `LISTAS_APOIO`, 19 em uso (+1 linha vazia).

| Coluna | Cat. | Nota |
|---|---|---|
| `natureza_key` PK | EX | valor literal |
| `natureza_norm` | DE | sem acento/caixa |
| `em_listas_apoio` | DE | `TRUE` em 19/19 usados |
| `docs_count` | DE | **`Minuta` 112** · Checklist 54 · Nota Técnica 31 · Contrato 27 · Edital 20 … |
| `macrogrupo_juridico` | **analytical_derived** | de `config/regras_negocio.json` → `macrogrupos_juridicos.mapa`. **Nunca hardcoded** |
| `macrogrupo_status` | analytical_derived | `proposto` · `revisar` |
| `macrogrupo_motivo` | analytical_derived | texto, quando `revisar` |

**O problema da `Minuta`.** `macrogrupo_juridico` classifica 60,8% do acervo; os 39,2%
em `Não classificado` são quase todos `Minuta` (112 de 116). Minuta é **forma de
elaboração, não matéria jurídica** — o macrogrupo depende do assunto, não da natureza.
Ver `DEC-016` e a pendência **Q7**. Enquanto Q7 não for resolvida, a visão por macrogrupo
não vai ao Executive Overview.

**Dimensão proposta em Q7:** `estagio_documental` ∈ {`minuta`, `instrumento_final`},
separando *estágio* de *matéria*. Resolveria os 112 e responderia "quanto do acervo é
elaboração e quanto é documento consolidado?".

### `dim_tema`
**Grão:** um tema atômico. 23 no catálogo, **20 em uso**.
`tema_key`, `tema_norm`, `em_listas_apoio` (20/20), `vinculos_count` (79 … 3).

- `Contrato` lidera com 79 vínculos; `Documentação` (70) segue com baixo poder
  discriminante → `tema_generico = TRUE`, para poder sair de rankings sem sair do dado.
- Estrearam na v2: `Ministério Público` (11), `TCE` (5), `Judicial / Contencioso` (5) — o eixo de
  contencioso e controle externo (pendência **Q10**).

### `dim_destinatario`
**Grão:** um destinatário. 19 no catálogo `LISTAS_APOIO`, **18 em uso**.

| Coluna | Cat. | Nota |
|---|---|---|
| `destinatario_key` PK | EX | ex.: `Executora RD102A - Beta` |
| `em_listas_apoio` | DE | `FALSE` para `Empreiteiras` (24 docs) e `CMA` (1 doc) |
| `validado_por_regra` | **confirmed** | `TRUE` para `Empreiteiras` — **destinatário válido confirmado** (`DEC-017`) |
| `tipo` | DE | `Orgao` (Parceiro, Órgão Contratante, Tribunal de Contas, Órgão Supervisor, Ministério Público, Comissão Legislativa) · `Executora` · `Seguradora` · `Consorciada` (Programa, Escritório Jurídico, Dynatest) · `Generico` (Empreiteiras, Executoras, Outros) |
| `rodovia_key` | EX | do padrão `Executora RD###` — **vínculo confiável** |
| `executora_key` | **confirmed** | via mapa de contratos |
| `eh_bucket_generico` | DE | `TRUE` para `Empreiteiras`, `Executoras`, `Outros` — 66 docs (22%) sem stakeholder identificável |

`Empreiteiras` **não é erro de classificação**. `CMA` (1 doc) é o único valor sem
respaldo — pendência **Q8**.

### `dim_pessoa`
**Grão:** uma pessoa ou serviço que agiu no repositório. União de `Subido por` (31
valores) e `Modificado por` (29). `pessoa_key`, `eh_servico` (DE), `uploads_count`,
`modificacoes_count`.

> **Semântica crítica:** são **operadores de repositório**, não autores jurídicos.
> Rotular na UI como "quem subiu/editou no SharePoint". Dados pessoais de terceiros —
> nunca em commit, log ou print compartilhado.

### `dim_pasta`
**Grão:** uma pasta física. 16 no disco (`Despacho/` vazia — pendência **Q9**), 15 em uso.
`pasta_key`, `pasta_norm`, `arquivos_disco`, `linhas_indice`, `existe_no_disco`,
`esta_vazia`.

### `dim_status`
2 linhas: `Na pasta` (291) · `Excluído` (5). `eh_ativo` = DE.
**`Status` é físico, não jurídico** — não existe "vigente/revogado" na fonte (`ND`).

### `dim_calendario`
**Grão:** um dia, de 2024-11-01 a hoje + margem.
`data`, `ano`, `trimestre`, `mes`, `mes_nome`, `semana_iso`, `dia_semana`, `eh_dia_util`.
Evita `strftime` espalhado por query e resolve meses sem documento.

### `dim_rodovia` — regra `RD-102` **confirmada**
**Grão:** uma rodovia. **7 valores**, todos canônicos.

```
REGRA CONFIRMADA (usuária, 10/09/2026):
  'RD-102' sem 'B' explícito  ->  RD-102A
  'RD-102B' (B explícito)     ->  RD-102B
  Tolera espaço, hífen e caixa.
```

| `rodovia_key` | docs | `tem_contrato` | Proveniência |
|---|---|---|---|
| RD-102A | 42 | `TRUE` (12/2025) | confirmed + derived |
| RD-101 | 30 | `TRUE` (13/2025) | confirmed + derived |
| RD-103 | 30 | `TRUE` (11/2025) | confirmed + derived |
| RD-104 | 24 | `TRUE` (14/2025) | confirmed + derived |
| RD-102B | 8 | `FALSE` | derived |
| RD-105 | 8 | `FALSE` | derived |
| RD-106 | 3 | `FALSE` | derived |

`eh_ambigua` **sai do modelo** — não há mais rodovia ambígua.
**Cobertura: 145 de 296 documentos (49%).** Toda tela que use rodovia declara isso.

`RD-250`, `RD-251` e `RD-260` **não existem no acervo**: eram falsos positivos do regex
antigo (`DEC-014`). Ficam registrados como guarda de regressão em
`config/regras_negocio.json`, com verificação automática.

### `dim_executora` e `dim_contrato` — `confirmed_business_rule`
**Desbloqueadas.** Geradas a partir de `config/regras_negocio.json` → `contratos.itens`,
nunca de hardcode.

| `contrato_key` | `rodovia_key` | `executora_key` | `destinatario_indice` (join) | docs |
|---|---|---|---|---|
| 11/2025 | RD-103 | Alfa | `Executora RD103 - Alfa` | 13 |
| 12/2025 | RD-102A | BETA | `Executora RD102A - Beta` | 31 |
| 13/2025 | RD-101 | Gama | `Executora RD102A…` → `Executora RD101 - Gama` | 19 |
| 14/2025 | RD-104 | DELTA | `Executora RD104 - Delta` | 12 |

Colunas: `contrato_key`, `numero`, `ano`, `rodovia_key`, `executora_key`,
`destinatario_indice`, `docs_count`, `proveniencia = 'confirmed_business_rule'`,
`confirmado_em = '2026-09-10'`.

`Contrato 10/2025` (estruturadora, Programa) **não** tem rodovia e fica como `DE` do nome do
arquivo, em `nao_mapeados`.

Cobertura de contrato confirmado: **75 de 296 documentos (25%)**, pelo caminho de
confiança alta (coluna `Destinatarios`).

### `dim_documento_logico` — `DADO DERIVADO`
**Grão:** um documento **conceitual**, agrupando o mesmo conteúdo em formatos e cópias
diferentes. Resolve os 19 grupos de duplicidade semântica.

Chave: `fold(data_documento + assunto + destinatario)`.
Colunas: `arquivos_count`, `formatos`, `tem_copia_office`, `tipo_grupo`.

| `tipo_grupo` | Significado | Tratamento |
|---|---|---|
| `par_formato` | mesmo documento em `.docx` e `.pdf` | 1 documento lógico, 2 arquivos |
| `copia_office` | `arquivo` + `arquivo (2)` | duplicata real — as 5 linhas `Excluído` são deste tipo |
| `variante_revisao` | `Limpa` vs. `com Marcas` | **não é duplicata** — são etapas de revisão |
| `versoes_sucessivas` | mesmo assunto, datas diferentes | **não é duplicata** — é reincidência, e é informação de negócio |
| `unico` | sem par | — |

---

## 5. Tabelas-ponte

### `br_documento_tema`
**Grão:** um vínculo documento↔tema. **467 linhas** (296 documentos, 142 multivalorados,
nenhum sem tema).
`documento_id`, `tema_key`, `ordem`, `tema_texto_original`.

> `SUM` sobre esta tabela = **vínculos**, não documentos. Para contar documentos por
> tema: `COUNT(DISTINCT documento_id)`. Toda métrica daqui carrega o rótulo
> "vínculos documento-tema" na UI.

### `br_documento_rodovia` — `DADO DERIVADO`
**Grão:** um vínculo documento↔rodovia extraído do texto. 145 documentos.

`documento_id`, `rodovia_key`, `campo_origem`, `confianca`.

| `campo_origem` | Vínculos | `confianca` |
|---|---|---|
| `Destinatarios` | 75 | `alta` |
| `Assunto` | 70 | `media` |
| `Arquivo` | 0 | `media` |

A extração roda **campo por campo**, na ordem `Destinatarios → Assunto → Arquivo`; o
primeiro campo que encontra define a confiança. Concatenar campos é proibido (`DEC-014`).

---

## 6. Fatos de repositório e de qualidade

### `fct_varredura`
**Grão:** uma execução do robô de indexação. **22 linhas**, de `LOG_ATUALIZACAO`.

`varredura_id`, `data_varredura`, `novos`, `modificados`, `excluidos`, `reaparecidos`,
`total_na_pasta`, `total_no_indice`, `observacao`, `delta_pasta_indice` (DE).

> **Aviso obrigatório no modelo:** `excluidos` e `modificados` somam **0** nas 22
> execuções, apesar das 5 linhas `Excluído`. **Não usar esses campos como métrica** —
> usar `fct_documento.status_key`. `novos` é confiável: 171 acumulados, e
> `125 + 171 = 296` ✓, com `total_na_pasta = 291` batendo com o acervo físico ✓.

### `fct_arquivo_fisico`
**Grão:** um arquivo do **acervo** no disco no instante de uma varredura. **291 linhas**
em 10/09/2026 16:21.

`snapshot_id`, `pasta_norm`, `arquivo_nome`, `extensao`, `tamanho_bytes`, `mtime_disco`,
`indexado` (DE), `scanned_at`.

**Arquivos de controle do repositório ficam fora desta tabela** e vão para
`fct_arquivo_controle` (2 linhas: `00 Indice.xlsx` e
`00 Nomenclatura - arquivos fora do padrao.docx`). Ver `DEC-015`: sem essa separação,
um instrumento de controle contaria como lacuna de indexação e geraria alerta falso.

**Coluna `situacao_indexacao`** (DE), calculada comparando `mtime_disco` com a última
`fct_varredura.data_varredura` (`DEC-018`):

| Valor | Significado | Severidade |
|---|---|---|
| `indexado` | existe no índice | — |
| `pendente_de_varredura` | `mtime` posterior à última varredura | informativo |
| `lacuna_de_indexacao` | `mtime` anterior à última varredura e fora do índice | **alta** |

Essa distinção é o que impede o indicador de cobertura de oscilar a cada arquivo novo.
Às 16:21 a tabela respondia "o índice cobre o acervo?" com **291 de 291 = 100%**; às
16:37, com **291 indexados, 33 pendentes, 0 lacunas** — e as duas respostas estão certas.

> `scanned_at` é obrigatório em qualquer número que venha daqui, e a UI mostra o horário
> da varredura, não "agora".

### `fct_dq_finding`
**Grão:** um achado de qualidade sobre uma entidade específica.

`finding_id`, `regra_key`, `severidade`, `entidade_tipo`, `entidade_id`, `descricao`,
`detectado_em`, `snapshot_id`.

Regras e ocorrências na varredura de 10/09/2026 16:21:

| `regra_key` | Sev. | Ocorrências | Nota |
|---|---|---|---|
| `lacuna_de_indexacao` | alta | **0** | arquivo anterior à última varredura e fora do índice. Era 110 na v1 |
| `arquivo_pendente_de_varredura` | informativo | 33 (às 16:37) | chegou **depois** da última varredura — normal, não achado (`DEC-018`) |
| `valor_fora_da_taxonomia` | baixa | 1 (`CMA`) | Q8 |
| `pessoa_upload_ausente` | média | 87 (29%) | |
| `pessoa_modificacao_ausente` | média | 71 (24%) | |
| `campo_previsto_nao_utilizado` | média | 1 (`Necessidade resposta`) | `DEC-006` |
| `log_excluidos_inconsistente` | média | 1 (5 exclusões vs. 0 no log) | |
| `possivel_duplicidade_semantica` | média | 19 grupos | classificados por `tipo_grupo` |
| `macrogrupo_nao_classificado` | média | 116 (39%) | 112 são `Minuta` — Q7 |
| `nome_fora_do_padrao` | baixa | 3 (IDs 97, 102, 264) | |
| `natureza_ausente` | baixa | 1 (ID 264) | |
| `data_documento_ausente` | baixa | 1 (ID 264) | |
| `destinatario_ausente` | baixa | 3 | |
| `pasta_vazia` | baixa | 1 (`Despacho/`) | Q9 |
| `taxonomia_planilha_vs_regra` | informativo | 1 (`Empreiteiras`, 24 docs) | **não é erro** (`DEC-017`) |
| `arquivo_controle_repositorio` | informativo | 2 | fora do acervo (`DEC-015`) |
| `data_precisao_mensal` | informativo | 16 | |
| `data_indexacao_aproximada` | informativo | 125 | |

**Nota sobre severidade `informativo`:** existe para dar visibilidade sem alarme falso.
`taxonomia_planilha_vs_regra` é o caso exemplar — `Empreiteiras` é destinatário válido, e
o achado só registra que a planilha ainda não reflete a regra confirmada.

Fazer da qualidade um **dado modelado**, e não texto de relatório, é o que permite à
página Data Governance ser filtrável, ordenável, contável e comparável entre varreduras.

---

## 7. Linhagem e snapshots

```
snapshot_id = <timestamp da varredura>   ex.: 2026-09-10T16-21-39
    |
    +-- data/raw/00_Indice_<snapshot_id>.xlsx      cópia byte-a-byte da fonte
    +-- data/raw/filesystem_<snapshot_id>.json     inventário do disco
    +-- data/raw/regras_negocio_<snapshot_id>.json cópia das regras aplicadas
    +-- data/processed/<tabela>_<snapshot_id>.parquet
    +-- data/processed/prog.duckdb                 último snapshot carregado
```

Toda tabela leva `snapshot_id` e `regras_versao`. Isso dá: reprodutibilidade,
auditoria (de qual arquivo e de qual versão de regra veio cada número) e comparação entre
varreduras — exatamente o que faltou para comparar a v1 e a v2 do discovery sem
recalcular tudo à mão.

`data/raw/` é o único lugar onde existe cópia da fonte, e é **somente escrita** pela
ingestão.

---

## 8. Regras de normalização (contrato da ingestão)

| Regra | Detalhe |
|---|---|
| `trim` | toda string; `""` → `NULL` |
| multivalorado | split por `;`, trim de cada parte, descarta vazios, preserva ordem |
| datas em texto | `%d/%m/%Y %H:%M`; extrai `(aprox.)` para flag booleana antes do parse |
| `Data` | `datetime` → `DATE`; `NULL` preservado como `NULL` |
| precisão de data | dia `00` no nome → `precisao = 'mes'`, valor no dia 1º |
| comparação de pasta | sempre `fold()`: sem acento, minúscula |
| **rodovia** | regex **por campo**, com lookbehind `(?<![A-Za-z])`; regra `RD-102` → `RD-102A` sem `B` explícito |
| **contrato** | `destinatario_key` → `config/regras_negocio.json`; nunca hardcode |
| **macrogrupo** | `natureza_key` → mapa do arquivo de regras; sem match → `Não classificado` + `revisar` |
| hyperlink | preservado literal; **nunca reconstruído** (`DEC-008`) |
| `Necessidade resposta` | inteiro; `de-para` com os rótulos da `LISTAS_APOIO` |
| arquivos de controle | padrões da raiz → `fct_arquivo_controle`, fora do acervo |
| lixo do Office | `~$*`, `.~lock.*`, `*.tmp` filtrados na varredura, e contados no log |
| taxonomia | valor fora da `LISTAS_APOIO` é **gravado** e marcado; se houver regra confirmada, marcado como *diferença*, não erro |
| idempotência | mesmo snapshot + mesma versão de regras ⇒ mesma saída, byte a byte |

---

## 9. Contratos de validação (o que quebra o build)

**Bloqueante — para o pipeline:**

1. abas `ÍNDICE`, `LISTAS_APOIO`, `NOMENCLATURA`, `LOG_ATUALIZACAO` presentes;
2. as 15 colunas da aba `ÍNDICE`, na ordem exata;
3. `ID` inteiro, único, não nulo;
4. `Status` ∈ {`Na pasta`, `Excluído`};
5. `config/regras_negocio.json` presente e com `_meta.versao`;
6. nenhuma escrita na fonte durante toda a execução.

> `Data` **deixou de ser** contrato bloqueante: existe 1 linha legítima sem data
> (ID 264, arquivo sem prefixo de data). Virou `fct_dq_finding` de severidade baixa.

**Alerta — registra `fct_dq_finding` e segue:** tudo em §6, mais qualquer valor novo fora
da `LISTAS_APOIO` sem regra confirmada.

**Guarda de regressão:** `RD-250`, `RD-251`, `RD-260` **não podem aparecer** em
`dim_rodovia`. Se aparecerem, o regex regrediu (`DEC-014`).

**Reconciliação — provas de que o modelo bate com a fonte** (valores de 10/09/2026 16:21):

```
COUNT(fct_documento)                                    == 296
COUNT(fct_documento WHERE status='Na pasta')            == 291
COUNT(fct_documento WHERE status='Excluído')            ==   5
COUNT(br_documento_tema)                                == 467
COUNT(DISTINCT documento_id) em br_documento_tema       == 296   (nenhum sem tema)
COUNT(fct_arquivo_fisico)                               == 291
COUNT(fct_arquivo_fisico WHERE NOT indexado)            ==   0   (cobertura 100%)
COUNT(fct_arquivo_controle)                             ==   2
COUNT(fct_documento WHERE link_url IS NULL)             ==   5   (== os 5 'Excluído')
COUNT(DISTINCT documento_id) em br_documento_rodovia    == 145
COUNT(fct_documento WHERE contrato_key IS NOT NULL)     ==  75
SUM(fct_varredura.novos) + 125                          == 296
MAX(fct_varredura.total_na_pasta)                       == 291   (== fct_arquivo_fisico)
COUNT(dim_rodovia WHERE rodovia_key IN ('RD-250','RD-251','RD-260')) == 0
```

Estes números são de uma varredura específica e mudam quando a fonte muda: o teste
compara o modelo com o **snapshot correspondente**, nunca com constantes fixas no código.
A v1 → v2 é a prova de que isso não é preciosismo — os números dobraram em uma hora.

---

## 10. Pendências que afetam o modelo

| # | Pergunta | Bloqueia |
|---|---|---|
| **Q7** | Como tratar `Minuta` no macrogrupo? Recomendação: derivar a matéria do assunto e criar `estagio_documental` | `dim_natureza.macrogrupo_juridico` para 39% do acervo |
| **Q8** | `CMA` (ID 283) é destinatário válido? | `dim_destinatario.validado_por_regra` |
| **Q9** | `Despacho/` (vazia) fica na taxonomia de pastas? | `dim_pasta.esta_vazia` |
| **Q10** | Contencioso e controle externo (Ministério Público, Tribunal de Contas, Comissão Legislativa) merece área própria? | escopo, não modelo — as dimensões já suportam |

**Resolvidas na v2:** `Minuta/` no índice (Q1) · mapa de contratos (Q2) · `Empreiteiras`
válido (Q3) · regra `RD-102` (Q4) · macrogrupos aprovados como camada derivada (Q5) ·
sem acoplamento ao projeto vizinho (Q6) · `Parceiro` sem expansão.
