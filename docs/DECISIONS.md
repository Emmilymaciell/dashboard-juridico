# DECISIONS — registro de decisões técnicas

Formato leve, deliberadamente. Uma decisão por bloco: data, contexto, alternativas,
motivo, impacto. Sem burocracia; o objetivo é que uma sessão futura entenda **por que**
as coisas são como são, sem precisar reconstruir o raciocínio.

Quando um bloco crescer demais ou precisar de discussão longa, ele vira um arquivo em
`docs/adr/`. Até então, mora aqui.

Status: `ACEITA` · `PROPOSTA` (aguarda a usuária) · `REVISADA` · `SUPERADA por DEC-xxx`

**Regras de negócio confirmadas pela usuária vivem em `config/regras_negocio.json`**,
versionado e auditável. Este documento explica o *porquê*; aquele arquivo é a
*autoridade operacional*. Nenhuma regra de negócio é hardcoded em código de aplicação.

---

## DEC-001 — Repositório próprio e independente

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** Já existe `repositorio_juridico`, que mantém `00 Indice.xlsx`. O
dashboard poderia ser um subdiretório dele.

**Alternativas.** (a) subpasta do projeto existente; (b) monorepo com os dois;
(c) repositório novo e independente.

**Decisão.** (c) — `C:\caminho\exemplo\dashboard-juridico`, com `.git` próprio,
fora de qualquer outro repositório.

**Motivo.** Responsabilidades opostas: um **escreve** no índice, o outro apenas **lê**.
Ciclos de release, stacks (PowerShell/openpyxl vs. Python/TS) e riscos diferentes.
Misturar histórico tornaria o Git GUI ilegível e criaria risco real de um código com
permissão de escrita na fonte acabar no projeto de leitura.

**Impacto.** A interface entre os dois é **exclusivamente** o arquivo `00 Indice.xlsx` e
a árvore de pastas. Nenhum import cruzado. Se o layout do índice mudar, a adaptação é
feita aqui, na ingestão.

---

## DEC-002 — A fonte é somente leitura, garantida por código

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** O acervo do Escritório Jurídico é documento jurídico de terceiro em pasta
sincronizada. Escrita acidental é dano real e possivelmente irreversível.

**Alternativas.** (a) confiar na disciplina; (b) `read_only=True` no openpyxl e pronto;
(c) camada única de acesso com trava e teste de inventário.

**Decisão.** (c). Um módulo `backend/pipeline/source_guard.py` é o **único** ponto do
código que conhece o caminho da fonte, expõe somente operações de leitura, e recusa
qualquer destino de escrita que esteja sob a raiz da fonte. A ingestão trabalha sobre
uma **cópia** em `data/raw/`.

**Motivo.** Disciplina não é controle. `read_only=True` protege o Excel, não a pasta.
A trava transforma a regra em invariante testável.

**Impacto.** Teste obrigatório em `tests/pipeline/`: inventário da fonte antes e depois
de cada execução do pipeline precisa ser idêntico. Toda transformação nova precisa
passar pelo guard.

---

## DEC-003 — DuckDB como banco analítico

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** Precisamos de uma camada consultável entre a normalização e a API.
Volume atual: 296 documentos indexados, 467 vínculos, 324 arquivos no disco. Qualquer
coisa funciona por força bruta — a escolha é pela natureza da carga, não pelo tamanho.

**Alternativas.** (a) DuckDB; (b) SQLite; (c) Parquet + pandas em memória, sem banco;
(d) Postgres.

**Decisão.** (a) DuckDB, com Parquet como camada durável.

**Motivo.** A carga é 100% analítica: `GROUP BY`, janelas, pivô, matriz `Tema × Natureza`,
séries mensais, `UNNEST` de multivalorados. DuckDB é colunar e vetorizado, tem
`PIVOT`/`QUALIFY`/`LIST` nativos, lê e escreve Parquet sem código, e é arquivo único sem
servidor. SQLite entregaria o mesmo resultado com mais SQL escrito à mão e sem os tipos
de lista. (c) não dá superfície de consulta para a API e empurra agregação para Python.
(d) exigiria servidor, o que contraria a decisão de simplicidade.

**Fraquezas conhecidas e por que não nos afetam.** Concorrência de escrita fraca — há um
único escritor (o pipeline). Formato de arquivo que evolui entre versões — o `.duckdb`
é artefato **descartável**, nunca versionado, reconstruível em segundos a partir de
`data/raw/`.

**Impacto.** `duckdb` e `pyarrow` entram nas dependências. Os `repositories` são a
única camada que fala SQL, o que mantém uma eventual troca localizada.

---

## DEC-004 — `pipeline/` dentro de `backend/`, não como pacote separado

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** A árvore sugerida no briefing tem `frontend/`, `backend/`, `data/`,
`scripts/`. A ingestão precisava de um lugar.

**Alternativas.** (a) `data_pipeline/` no topo; (b) dentro de `scripts/`;
(c) `backend/pipeline/`.

**Decisão.** (c).

**Motivo.** Pipeline e API compartilham config (`core/`) e modelos de domínio
(`domain/`). Separar em pacotes de topo duplicaria schema — a origem clássica de
divergência entre o que o pipeline grava e o que a API espera. Um só ambiente Python,
um só `pyproject`, uma só suíte de testes. `scripts/` fica para utilitários executáveis
finos, que chamam o pipeline.

**Impacto.** Desvio pequeno e consciente da árvore sugerida; a estrutura de topo
permanece a mesma. Se a ingestão virar serviço separado no futuro, a extração é
mecânica.

---

## DEC-005 — Toda informação exibida declara sua categoria de confiança

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** Boa parte do que interessa ao produto (rodovia, contrato, executora) não
está na fonte: é inferido de nome de arquivo. Exibir isso como fato seria enganoso, e
num contexto jurídico isso é grave.

**Decisão.** Cinco categorias — `DADO EXISTENTE`, `DADO DERIVADO`, `INFERÊNCIA`,
`HIPÓTESE`, `NÃO DISPONÍVEL` — atravessam o produto inteiro: modelo (colunas
`<campo>_origem`, `<campo>_confianca`), API (`meta.categoria`, `meta.cobertura`) e UI
(badge, aviso de cobertura).

**Motivo.** A regra só funciona se for estrutural. Se dependesse de o desenvolvedor
lembrar de escrever o aviso, ela seria esquecida na primeira pressa.

**Impacto.** `meta` obrigatório em toda resposta agregada — métrica sem `meta` é bug de
contrato, não detalhe. Custo pequeno; é o que separa inteligência de decoração.

---

## DEC-006 — Rejeitar KPIs de urgência, SLA e prazo de resposta

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** `Necessidade resposta` parece o campo mais valioso do índice: a
`LISTAS_APOIO` prevê 5 níveis, até `5 - urgente/crítica`, e a regra de nomenclatura
reserva o último campo do nome do arquivo para ele. Na prática: valor `1` em 152 das
154 linhas, vazio em 2. **Variância zero.**

**Alternativas.** (a) construir a área e mostrar tudo como "não exige resposta";
(b) inferir urgência de natureza/tema; (c) declarar `NÃO DISPONÍVEL`.

**Decisão.** (c). Nenhum KPI de urgência, criticidade, SLA ou fila de resposta. O campo
aparece na área de Data Governance como "previsto e não utilizado".

**Motivo.** (a) produz uma tela que só diz "nada é urgente" — informação falsa por
omissão. (b) seria inventar métrica sem sustentação, exatamente o que o briefing proíbe.

**Impacto.** Se a coordenação quiser gestão de prazos, isso é mudança de processo no
preenchimento do índice (no projeto vizinho), não feature de dashboard. Se o campo
ganhar variância, a decisão é reaberta.

**Reconfirmado em 10/09/2026 (v2 do discovery).** Com o acervo indexado dobrando para
296 documentos, o quadro se manteve: valor `1` em 293 linhas, vazio em 3, variância zero.
Não era amostra pequena — é o preenchimento real.

---

## DEC-007 — Atividade jurídica e atividade de repositório nunca se somam

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** O índice mistura duas naturezas de fato. `Data` é quando o Escritório Jurídico
produziu o documento. `Data/hora do upload`, `Última modificação`, `Subido por`,
`Modificado por` e `LOG_ATUALIZACAO` são sobre o robô de indexação e sobre quem mexeu
no arquivo no SharePoint. Concretamente: 125 das 154 linhas têm data de "upload"
`28/08/2026 10:03 (aprox.)`, que é o instante do inventário inicial.

**Decisão.** Três ilhas de fato separadas no modelo (`fct_documento` ·
`fct_varredura` + `fct_arquivo_fisico` · `fct_dq_finding`), páginas separadas
(Timeline vs. Repository Activity), e separação também na sidebar. `Data/hora do upload`
é renomeado para `data_indexacao` na camada semântica, com flag de aproximação.

**Motivo.** É o erro mais fácil e mais grave de cometer aqui: uma curva de "atividade"
que some produção jurídica com varredura de robô dá 125 documentos em 28/08/2026 —
um pico inteiramente artificial que a diretoria leria como pico de trabalho.

**Impacto.** Nenhum gráfico mistura os dois eixos. `Novos` do log é a fonte de novas
entradas; `Data/hora do upload` **nunca** é usado para série temporal.

---

## DEC-008 — Preservar o hyperlink original, nunca reconstruir

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** A URL do SharePoint é montável a partir de `Pasta` + `Arquivo`. E há 149
hyperlinks reais na planilha, com 0 divergências verificadas.

**Decisão.** Guardar `link_url` literal. Não montar URL. Se algum dia faltar link para
um documento `Na pasta`, um fallback construído pode ser oferecido — **sinalizado como
derivado**, nunca silenciosamente.

**Motivo.** A URL tem partes que não conseguimos derivar de forma confiável: o hint de
aplicativo (`/:w:/`, `/:b:/`), o tenant, o caminho pessoal e os parâmetros
(`?csf=1&web=1`). Um link montado errado abre a página de erro do SharePoint e destrói
a confiança no botão `ABRIR DOCUMENTO`, que é a função mais usada do produto.

**Impacto.** Nos 5 documentos `Excluído` (sem link), o botão fica desabilitado com
explicação, em vez de tentar adivinhar.

---

## DEC-009 — Não usar network graph nesta fase

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** O briefing sugere uma "Legal Relationship View" navegável em grafo
(`Sanções → Advertência → Beta → RD-102A → documentos`).

**Decisão.** Não implementar agora. As relações reais que existem
(tema↔natureza↔destinatário) vão para heatmaps; a navegação relacional por documento
vai para "documentos relacionados" no Document Explorer.

**Motivo.** 154 documentos, 32 nós de dimensão, rodovia com 43% de cobertura e contrato
apenas inferido. O grafo resultante seria visualmente impressionante e analiticamente
enganoso — sugeriria uma malha de relações que os dados não sustentam. Heatmap responde
às mesmas perguntas com leitura precisa.

**Impacto.** Reabrir quando: `Minuta/` resolvida (acervo indexado > ~250-500) **e**
mapa contrato↔rodovia↔executora confirmado **e** demanda concreta.

---

## DEC-010 — Contrato ↔ rodovia ↔ executora: regra confirmada, não inferência

**Data:** 10/09/2026 · **Status:** **REVISADA** em 10/09/2026 (versão original propunha
tratar tudo como inferência aguardando confirmação)

**Contexto.** Rodovia é a chave de negócio mais desejada. Na v1 do discovery só 43% dos
documentos mencionavam alguma, `RD-102` era ambíguo e o vínculo contrato↔rodovia era
inferência de nome de arquivo. **A usuária confirmou oficialmente o mapa.**

**Decisão.** Três níveis de proveniência, explicitamente separados:

| Vínculo | Proveniência | Onde vive |
|---|---|---|
| **contrato ↔ rodovia ↔ executora** | `confirmed_business_rule` | `config/regras_negocio.json` → `contratos.itens` |
| **regra `RD-102` → `RD-102A`** (sem `B` explícito) | `confirmed_business_rule` | `config/regras_negocio.json` → `rodovias.regra_rd102` |
| rodovia ↔ executora (pela coluna `Destinatarios`) | `DADO EXISTENTE` | fonte |
| documento ↔ rodovia (extração do texto) | `DADO DERIVADO` | pipeline, com campo de origem |

```
11/2025 -> RD-103  -> Alfa
12/2025 -> RD-102A -> BETA
13/2025 -> RD-101  -> Gama
14/2025 -> RD-104  -> DELTA
```

**Motivo.** Confirmação da usuária é a fonte de verdade mais forte que existe para regra
de domínio — mais forte que a planilha, que é apenas o registro operacional. Mas
confirmar o mapa **não** aumenta a cobertura: 151 dos 296 documentos continuam sem
mencionar rodovia, e **não recebem atribuição por inferência**. Atribuir por
heurística faria a coordenação decidir sobre dado fabricado.

**Impacto.**
- `dim_contrato` está **desbloqueada** e é gerada a partir do arquivo de regras, nunca
  de hardcode espalhado pela aplicação. Toda linha carrega
  `proveniencia = "confirmed_business_rule"`.
- `RD-102` **deixa de ser ambíguo**; `dim_rodovia.eh_ambigua` sai do modelo.
- A página Contracts/Roads continua abrindo com **cobertura declarada** — hoje 49% para
  rodovia e 25% para contrato confirmado pela coluna `Destinatarios` — e com o bloco
  explícito "sem rodovia identificada (151)".
- A grafia canônica da executora (`BETA`) vem da usuária; a chave de *join*
  com a fonte é `destinatario_indice` (`Executora RD102A - Beta`). As duas ficam
  no arquivo de regras.

---

## DEC-011 — Filtros na URL, sem biblioteca de estado global

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** O Document Explorer terá muitos filtros combinados.

**Decisão.** Estado de servidor em TanStack Query; estado de filtro na query string
via `useSearchParams`. Sem Redux, sem Zustand.

**Motivo.** Não há estado global de aplicação real — só filtros e tema. Filtro na URL
dá de graça: link compartilhável, botão voltar funcionando, visão reproduzível e
debug trivial. Uma store global seria complexidade sem contrapartida.

**Impacto.** Serialização de filtros precisa ser estável e curta. Se um dia a URL ficar
longa demais, migra-se para um hash de preset — decisão localizada.

---

## DEC-012 — Não consumir os `backups/` do projeto vizinho

**Data:** 10/09/2026 · **Status:** **ACEITA** — confirmada pela usuária em 10/09/2026:
os projetos permanecem desacoplados; consumo de histórico do projeto vizinho exigirá
**contrato formal entre os projetos**. Registrada em `config/regras_negocio.json` →
`acoplamento_projeto_vizinho.permitido = false`.

**Contexto.** `repositorio_juridico` guarda 30 versões datadas de `00 Indice.xlsx`
(28/08 a 10/09/2026), mais `00 Indice ORIGINAL-antes-da-automacao.xlsx` e
`historico/indice_snapshot.csv`. Isso é uma série temporal real do índice, muito melhor
que os 16 pontos de `LOG_ATUALIZACAO`: permitiria medir crescimento do acervo, correção
de metadados e churn de classificação.

**Alternativas.** (a) ler os backups do outro repositório; (b) ignorar;
(c) o dashboard construir seu próprio histórico a partir dos snapshots que ele mesmo
grava em `data/raw/`.

**Decisão.** (c). Fontes permitidas: `00 Indice.xlsx` atual · aba `LOG_ATUALIZACAO` ·
inventário físico somente leitura · snapshots gerados por **este** projeto em `data/raw/`.

**Motivo.** (a) cria acoplamento entre dois repositórios que hoje se falam apenas por
`00 Indice.xlsx` — e faz o dashboard depender da estrutura interna de diretórios de
outro projeto, que pode mudar sem aviso. (c) constrói histórico daqui para frente sem
acoplamento nenhum, ao custo de não ter o passado.

**Impacto.** Não há série histórica retroativa do índice. A nossa começa no primeiro
snapshot do pipeline (Fase 2). Até lá, os 22 pontos de `LOG_ATUALIZACAO` são a única
visão temporal do repositório — e são suficientes para a página Repository Activity.
Se um dia o histórico retroativo for necessário, o caminho é um contrato formal entre os
projetos, com `DEC-` próprio.

---

## DEC-013 — Não versionar dado derivado nem banco analítico

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** `data/raw/` guarda cópias de `00 Indice.xlsx`; `data/processed/` guarda
Parquet e o `.duckdb`.

**Decisão.** Nada em `data/`, `logs/`, `output/`, `state/` entra no Git. `.gitignore`
bloqueia também `*.pdf`, `*.docx`, `*.xlsx`, `*.duckdb`, `*.parquet` em qualquer lugar
do repositório.

**Motivo.** Três razões independentes: (1) são documentos jurídicos de terceiro e dados
pessoais — histórico Git é permanente e difícil de expurgar; (2) são artefatos
reconstruíveis, e versionar artefato é ruído; (3) binário no histórico inutiliza o
diff no Git GUI, que é como a usuária lê o projeto.

**Impacto.** A reprodutibilidade vem do **código do pipeline** + fonte, não de dado
versionado. Um clone limpo roda `01_discovery.py` e reconstrói tudo.

---

## DEC-014 — Extração de rodovia roda campo por campo, com guarda de regressão

**Data:** 10/09/2026 · **Status:** ACEITA · **Correção de defeito**

**Contexto.** A v1 do discovery relatou as rodovias `RD-251` (13 documentos), `RD-260`
(6) e `RD-250` (1). **Nenhuma existe no acervo.** Eram falsos positivos do meu próprio
regex: o padrão rodava sobre os campos `Assunto + Destinatarios + Arquivo`
**concatenados**, e a junção produzia rodovia onde não havia:

```
"MPRD"       + " " + "251104 - Minuta - ..."  ->  "RD 251"   -> RD-251
"SITC ALERD" + " " + "260105 - Minuta - ..."  ->  "RD 260"   -> RD-260
"TCE-RD"     + " " + "250522 - Contrato ..."  ->  "RD 250"   -> RD-250
```

(Versão pública: siglas de órgãos estaduais terminam com a UF; na versão pública a UF fictícia é 'RD', igual ao prefixo das rodovias — por isso os exemplos MPRD/ALERD/TCE-RD abaixo são siglas sintéticas, mantidas só para explicar o bug. No produto, os órgãos aparecem como Ministério Público,
Comissão Legislativa e Tribunal de Contas.)

Ou seja: siglas que **terminam em "RD"** (MPRD, ALERD, TCE-RD) colavam no prefixo de data
`AAMMDD` do nome do arquivo. O erro só ficou visível quando a indexação da pasta
`Minuta/` trouxe 30+ documentos endereçados ao Ministério Público e à Comissão Legislativa — na v1 eram poucos e
o ruído passou como "rodovia com 1 menção".

**Alternativas.** (a) lista de exclusão dos valores errados; (b) exigir contexto textual
("rodovia RD-xxx"); (c) rodar o regex **por campo** e barrar `RD` precedido de letra.

**Decisão.** (c), com duas travas somando:

```python
ROAD_PATTERN = re.compile(r"(?<![A-Za-z])RD\s*-?\s*(\d{3})\s*([AB])?\b", re.IGNORECASE)
ROAD_FIELDS  = ("Destinatarios", "Assunto", "Arquivo")   # avaliados isoladamente
```

O lookbehind resolve `MPRD`/`ALERD`; a avaliação por campo resolve `TCE-RD` (onde o `RD`
é precedido de hífen, não de letra) e qualquer combinação futura do mesmo tipo.
O primeiro campo que encontra a rodovia define a confiança: `Destinatarios` = alta,
`Assunto` = média, `Arquivo` = média.

**Motivo.** (a) trata o sintoma e falha no próximo caso. (b) é frágil: o acervo escreve
rodovia de todas as formas (`RD101`, `RD 102 B`, `RD-104`), quase nunca com a palavra
"rodovia". (c) elimina a classe inteira de erro.

**Impacto.**
- `RD-250`, `RD-251` e `RD-260` saem do modelo. Cobertura de rodovia corrigida de
  "43%" (v1, inflada) para **49%** real.
- Os três ficam registrados em `config/regras_negocio.json` →
  `rodovias.falsos_positivos_conhecidos` como **guarda de regressão**: uma verificação
  automática falha se qualquer um reaparecer.
- Lição registrada: **concatenar campos antes de aplicar regex é um antipadrão** neste
  domínio. Vale para a extração de contrato, de número de ofício e para qualquer
  extração futura — o texto de um campo nunca deve poder formar padrão com o do vizinho.

---

## DEC-015 — Arquivos de controle do repositório não são acervo

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** Na varredura das 16:21 apareceu na raiz da fonte o arquivo
`00 Nomenclatura - arquivos fora do padrao.docx`. Ele tem o mesmo papel de
`00 Indice.xlsx`: é instrumento de controle do repositório, não documento jurídico do
acervo. Sem regra, ele contaria como "arquivo não indexado" e geraria um alerta falso —
justamente no indicador que a usuária acabou de zerar.

**Decisão.** Arquivos na **raiz** da fonte cujo nome casa com os padrões de
`config/regras_negocio.json` → `arquivos_controle_repositorio.padroes` (hoje: prefixo
`00 `) são artefatos de controle: ficam fora da contagem do acervo, e sua ausência no
índice **não** é lacuna de indexação. São contados e listados à parte, nunca silenciados.

**Motivo.** A alternativa — indexar tudo que existe no disco — misturaria o instrumento
com o objeto medido, e faria a cobertura do índice nunca chegar a 100% por construção.
Listar à parte, em vez de simplesmente ignorar, evita o oposto: esconder um arquivo real
que apareça na raiz por engano.

**Impacto.** O acervo passa a ser 291 documentos (292 arquivos − 1 de controle), a
cobertura do índice é 100%, e a verificação "todo arquivo físico está indexado" passa.
Se surgir na raiz um arquivo que **não** case com os padrões, ele volta a ser tratado
como lacuna — o comportamento correto.

---

## DEC-016 — Macrogrupo jurídico é camada analítica configurável, e `Minuta` fica sem classificação

**Data:** 10/09/2026 · **Status:** ACEITA (mapa) + **PROPOSTA** (tratamento da `Minuta`)

**Contexto.** A usuária aprovou criar a camada de macrogrupos (`Contratual`,
`Conformidade`, `Sancionatório`, `Licitatório`, `Consultivo`, `Administrativo`), com três
condições: **não** tratar como dado original do Escritório Jurídico; mapping **explícito e
auditável**; e usar **`Não classificado` + sinalização de revisão** onde não for seguro
decidir, em vez de inventar.

**Decisão.** O mapa `Natureza original → Macrogrupo derivado` vive em
`config/regras_negocio.json` → `macrogrupos_juridicos.mapa`, com
`_proveniencia: "analytical_derived"` e, por natureza, um `status` ∈ {`proposto`,
`revisar`} e um `motivo` quando `revisar`. Nenhum macrogrupo é hardcoded.

Resultado sobre 296 documentos: **60,8% classificado**, e **116 (39,2%) em
`Não classificado`** — dos quais **112 são da natureza `Minuta`**.

**Por que `Minuta` fica sem classificação.** Minuta é **forma de elaboração, não matéria
jurídica**: existe minuta de contrato, de edital, de ofício, de resposta ao Ministério Público. O
macrogrupo depende do **assunto**, não da natureza. Classificar as 112 em qualquer um dos
seis grupos seria inventar — exatamente o que a instrução veda. `Anexo`, `Apêndice` e
`Ofício / Carta` (1 cada) têm o mesmo padrão: forma sem matéria.

**Consequência que precisa ser dita.** Com 39% do acervo em `Não classificado`, **a visão
por macrogrupo não serve ao Executive Overview hoje.** Três saídas:

| Opção | Efeito |
|---|---|
| (a) 7º macrogrupo `Elaboração` | resolve a contagem, mas mistura forma com matéria na mesma dimensão |
| **(b) derivar o macrogrupo da matéria e criar `estagio_documental`** | **recomendada** |
| (c) manter `Minuta` fora da visão | honesto, mas perde 38% do acervo na tela |

**Recomendação: (b).** Uma minuta de contrato é matéria **contratual** em estágio de
**elaboração**. Separar as duas dimensões preserva o significado e abre uma pergunta de
gestão que hoje não tem resposta: *quanto do acervo é trabalho em elaboração e quanto é
documento consolidado?* Com 112 minutas em 296 documentos, essa é provavelmente a
informação mais acionável do acervo — e ela está invisível enquanto `Minuta` for tratada
como categoria de matéria.

**Impacto.** O Executive Overview usa "top naturezas + Outras" até esta decisão sair.
A implementação de (b) exige derivar matéria do `Assunto` — o que a torna `DADO DERIVADO`
com cobertura declarada, não `DADO EXISTENTE`. Aguardando decisão da usuária.

---

## DEC-017 — `config/regras_negocio.json` é a autoridade operacional das regras de domínio

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** As confirmações de 10/09/2026 (mapa de contratos, regra `RD-102`,
`Empreiteiras` válido, macrogrupos, não-acoplamento, exibir só `Parceiro`) precisavam de um
lugar que não fosse código nem prosa de documentação.

**Alternativas.** (a) constantes em `core/config.py`; (b) tabelas no DuckDB alimentadas
por migração; (c) um JSON versionado, lido por pipeline, API e testes.

**Decisão.** (c) — `config/regras_negocio.json`, **versionado** (não contém segredo nem
dado pessoal), com `_meta` de proveniência e data de confirmação, e proveniência por
bloco (`confirmed_business_rule`, `analytical_derived`, `derived`).

**Motivo.** (a) espalha regra por código e obriga deploy para mudar domínio — exatamente
o que a usuária pediu para evitar. (b) esconde a regra dentro de um artefato descartável
(`.duckdb` não é versionado, `DEC-013`). (c) é auditável em diff no Git GUI: mudança de
regra de negócio aparece como mudança de uma linha legível, não enterrada em Python.

**Impacto.**
- As dimensões `dim_contrato`, `dim_rodovia` e `dim_natureza.macrogrupo` são **geradas a
  partir deste arquivo** na Fase 2.
- Toda linha derivada dele carrega `proveniencia`, que atravessa até o `meta` da API e o
  badge da UI (`DEC-005`).
- **`Empreiteiras`** (24 documentos): destinatário **válido** por regra confirmada, ainda
  ausente da `LISTAS_APOIO`. Registrado como *diferença entre o estado da planilha e a
  regra confirmada*, **não** como erro de classificação. Este projeto não escreve no
  Excel; regularizar a planilha, se for o caso, é do `repositorio_juridico`.
- **`Parceiro`**: campo `expansao: null` e `exibir_como: "Parceiro"`. A sigla não é expandida em
  lugar nenhum do produto, por decisão da usuária.
- Alterar este arquivo exige registro em `DECISIONS.md` — a versão (`_meta.versao`) entra
  no relatório de discovery e, na Fase 2, no `snapshot_id` do modelo.

---

## DEC-018 — Distinguir "indexação pendente" de "lacuna de indexação"

**Data:** 10/09/2026 · **Status:** ACEITA

**Contexto.** Às 16:21 a cobertura do índice era 100% (291 de 291). Às 16:37, 33 novos
documentos apareceram em `Notificacoes/` e `Advertencia/`, e a mesma verificação passou a
acusar "33 arquivos fora do índice". Nada estava errado: os arquivos chegaram às 16:32, e
a última varredura do robô foi às 16:01.

Ou seja, a verificação oscilava entre OK e FALHA **em função do relógio**, não da
qualidade do dado. Uma verificação que falha por comportamento normal do ecossistema
treina quem lê a ignorar.

**Alternativas.** (a) tolerância fixa (ignorar arquivos das últimas N horas);
(b) comparar com a data da última varredura registrada em `LOG_ATUALIZACAO`;
(c) manter a verificação como estava e explicar caso a caso.

**Decisão.** (b). Para cada arquivo do acervo ausente do índice, compara-se o `mtime` do
disco com o **maior** `LOG_ATUALIZACAO.Data/hora`:

| Situação | Classificação | Tratamento |
|---|---|---|
| `mtime` **posterior** à última varredura | `pendente_de_varredura` | **aviso**, não achado. Ação: rodar `repositorio_juridico` |
| `mtime` **anterior** à última varredura | `lacuna_de_indexacao` | **achado real** de severidade alta |

Só a segunda derruba a verificação.

**Motivo.** (a) exigiria escolher um número arbitrário, e o robô roda em intervalos
irregulares (22 execuções em 13 dias, de minutos a dias de distância). (c) transfere para
a pessoa um trabalho que o dado já permite fazer — a data da varredura está na própria
fonte. (b) usa o dado que existe e torna a verificação estável e significativa.

**Impacto.**
- A verificação "todo arquivo físico está indexado" foi substituída por "nenhuma **lacuna**
  de indexação", mais um aviso separado contando os pendentes.
- `fct_dq_finding` ganha duas regras distintas, com severidades diferentes:
  `arquivo_pendente_de_varredura` (informativo) e `lacuna_de_indexacao` (alta).
- A página Data Governance mostra as duas separadamente. Um alerta que diz "33 arquivos
  fora do índice" sem dizer que 33 são normais é pior do que não alertar.
- Efeito colateral útil: o número de pendentes é, de fato, um **indicador operacional** —
  quanto o repositório acumulou desde a última varredura. Isso responde "vale rodar o
  indexador agora?", que é uma pergunta real de quem opera o repositório.

---

## DEC-019 — `estagio_documental` separado de macrogrupo jurídico (resolve Q7)

**Data:** 10/09/2026 · **Status:** ACEITA — decidido pela usuária

**Contexto.** `Minuta` é a maior natureza do acervo e deixava 39% dos documentos em
`Não classificado` no macrogrupo, inviabilizando aquela visão.

**Decisão.** Três conceitos **independentes**, nunca colapsados em um só campo:

| Conceito | O que responde | Proveniência |
|---|---|---|
| `natureza` | que tipo de documento é | `source` |
| `estagio_documental` | em que estágio está: em elaboração ou consolidado | `derived` |
| `macrogrupo_juridico` | qual a matéria jurídica | `derived` quando houver evidência; senão `Não classificado` |

`estagio_documental` é **conservador**, derivado da natureza e de marcadores do nome:

- `em_elaboracao` — natureza `Minuta`, ou nome com `Minuta`/`Limpa`/`Marcas`/`Rev`/`Revisado`;
- `consolidado` — naturezas de instrumento final (`Contrato / Instrumento`, `Edital`,
  `Advertência`, `Notificação`, `Seguro Garantia`, `Errata`, `Declaração`, `Relatório`…);
- `nao_determinado` — quando não há evidência.

**Derivação de matéria sem forçar.** Para documentos cuja natureza não carrega matéria
(`Minuta`, `Anexo`, `Apêndice`, `Ofício / Carta`), o macrogrupo é derivado **dos temas**,
por um mapa tema→macrogrupo em `config/regras_negocio.json`, e somente quando o sinal é
inequívoco. Sem sinal: `Não classificado` com `macrogrupo_origem = "sem_evidencia"`.

**Resultado medido (10/09/2026, após implementar).** A derivação por tema funcionou muito
melhor que a estimativa: `Não classificado` caiu de **116 documentos (39%) para 3 (1%)**.
`estagio_documental` separa 113 em elaboração de 181 consolidados. A visão por macrogrupo
tornou-se utilizável — mas, por decisão da usuária, **segue fora dos KPIs principais do
Executive Overview** no MVP: ela é `derived`, não dado da fonte, e a tela executiva usa o
que é confiável (natureza, tema, destinatário, data, rodovia e contrato confirmados,
status, atividade do repositório).

**Impacto.** No MVP, macrogrupo **não é KPI principal** do Executive Overview. Os KPIs
usam o que é confiável: natureza, tema, destinatário, data, rodovia e contrato
confirmados, status e atividade do repositório. O dashboard deixa de estar bloqueado.

---

## DEC-020 — Snapshot consistente por ciclo (a fonte é viva, e isso é requisito)

**Data:** 10/09/2026 · **Status:** ACEITA — pedido explícito da usuária

**Contexto.** Em uma tarde a fonte passou por 215 → 259 → 291 → 324 documentos. Ler a
fonte em pontos diferentes de um mesmo processamento produziria números de momentos
diferentes na mesma tela.

**Decisão.** Todo processamento acontece dentro de um **ciclo** identificado
(`ciclo_id`), sobre um **snapshot imutável** capturado no início:

```
FONTE VIVA -> source_guard (somente leitura) -> snapshot do ciclo
           -> manifest (hash + tamanho + mtime + captured_at + origem + ciclo_id)
           -> validação -> normalização -> Parquet -> DuckDB -> FastAPI -> React
```

Se a fonte mudar durante o ciclo, **o ciclo termina com o que capturou**. A próxima
execução pega o estado novo. Nenhum número da aplicação mistura dois momentos.

O manifest (`data/raw/<ciclo_id>/manifest.json`) registra: caminho de origem, `sha256`
do índice, tamanho, `mtime`, `captured_at`, `ciclo_id`, hash do inventário físico e
contagens de controle. É a prova de qual estado gerou cada número.

**Impacto.** `source_guard.py` é o único módulo que conhece o caminho da fonte, expõe só
leitura, e **recusa qualquer destino de escrita sob a raiz da fonte**. Snapshots e bancos
derivados não entram no Git (`DEC-013`).

---

## DEC-021 — Dois relógios explícitos: `indexed_as_of` e `physical_scan_as_of`

**Data:** 10/09/2026 · **Status:** ACEITA — pedido explícito da usuária

**Contexto.** O índice estruturado e o disco não estão sincronizados: o robô roda em
intervalos irregulares. Em 10/09/2026 16:37 havia 296 documentos indexados (índice de
16:01) e 324 no disco (varredura de 16:37).

**Decisão.** O modelo e a API expõem **três** campos, e a UI mostra os dois primeiros
sempre que forem diferentes:

| Campo | Significado |
|---|---|
| `indexed_as_of` | até quando a **fonte estruturada** está atualizada (maior `LOG_ATUALIZACAO.Data/hora`) |
| `physical_scan_as_of` | até quando o **inventário físico** foi observado (`captured_at` do ciclo) |
| `pending_reconciliation_count` | documentos no disco posteriores a `indexed_as_of` e ausentes do índice |

Texto na UI: *"Dados estruturados atualizados em X"* e, quando divergir,
*"Inventário físico observado em Y"*.

**Motivo.** Documento recém-chegado depois da última varredura **não é falha de
qualidade** — é defasagem normal entre dois sistemas. Tratar como erro treinaria a
usuária a ignorar o alerta. Ao mesmo tempo, esconder a defasagem faria o dashboard
parecer completo quando não está.

**Impacto.** Substitui a checagem binária "todo arquivo está indexado". Ver `DEC-018`,
que já separava `lacuna_de_indexacao` de `pendente_de_varredura`; esta decisão leva a
distinção para o contrato da API e para a tela.

---

## DEC-022 — Taxonomia divergente é estado, não erro (resolve Q8 e Q9)

**Data:** 10/09/2026 · **Status:** ACEITA — decidido pela usuária

**Decisão.** Todo valor de taxonomia carrega `status_taxonomia`:

| Valor | Significado | Severidade em Data Governance |
|---|---|---|
| `ok` | consta da `LISTAS_APOIO` | — |
| `confirmado_por_regra` | fora da planilha, válido por regra confirmada (`Empreiteiras`) | `info` |
| `pendente_de_validacao` | fora da planilha e sem regra (`CMA`) | `low` |

`CMA` é preservado **exatamente como está na fonte** (`valor_observado = "CMA"`), sem
reclassificação automática, e **não bloqueia** ingestão nem desenvolvimento.

**Categoria física vazia não é problema de qualidade.** `Despacho/` fica registrada como
*"categoria existente, atualmente sem documentos"*, severidade `info`, e **não** aparece
como alerta executivo.

**Motivo.** Chamar de "erro grave" o que é limitação conhecida destrói a credibilidade da
página de governança. A distinção entre *achado* e *estado* é o que faz um painel de
qualidade ser usado em vez de ignorado.

---

## DEC-023 — Contencioso entra como corte, não como página (resolve Q10)

**Data:** 10/09/2026 · **Status:** ACEITA — decidido pela usuária

**Decisão.** Ministério Público, Tribunal de Contas, Comissão Legislativa, Órgão Supervisor e os temas `Ministério Público`, `TCE` e
`Judicial / Contencioso` são tratados **normalmente** dentro de Legal Portfolio, Themes &
Stakeholders e Document Explorer. **Sem página exclusiva** de Contencioso nesta fase.

A avaliação de módulo próprio acontece **depois** de ver o dashboard funcionando, com
base visual e quantitativa.

`Comissão Legislativa` é exibido apenas assim, **sem expansão** — como `Parceiro` (`DEC-017`).

---

## DEC-024 — Cor de gráfico se resolve por *token resolvido com vírgula*, nunca por `hsl()` separado por espaço

**Data.** 11/09/2026 · **Status.** aceita

Os design tokens são guardados no formato Tailwind — `196 82% 55%`, separado por
espaço (CSS Color 4). O canvas do navegador aceita isso num preenchimento sólido,
e por isso a maioria dos gráficos funcionava. Mas **o parser de cor do zrender
(ECharts) só entende `hsl(h, s%, l%)` com vírgula.** Onde o ECharts precisa
*interpolar* cor — `visualMap.inRange`, gradientes com `colorStops` — a sintaxe
por espaço falha em silêncio e o resultado sai preto.

Sintoma real: o heatmap de destinatário × matéria renderizava **todas as células
e a própria legenda em preto sólido**, sem erro em console.

**Decisão.**

1. `readToken()` em `charts/EChart.tsx` normaliza o token para `hsl(h, s%, l%)`
   (e `hsla(...)` quando há alfa). É o único lugar que lê token de cor.
2. Alfa nunca por concatenação. `` `${tokens.accent}55` `` produz
   `hsl(196 82% 55%)55`, string inválida — não cor translúcida. Usar
   `withAlpha(cor, alfa)`, exportado do mesmo módulo.
3. Rampa escrita à mão em template string também vai com vírgula.

**Consequência.** Toda cor que entra em `option` do ECharts passa por
`readToken` ou `withAlpha`. Cor literal em página é defeito.

---

## DEC-025 — A cor codifica *significado*, e a ausência de classificação tem cor reservada

**Data.** 11/09/2026 · **Status.** aceita

A V1 pintava régua de linha, barra de participação e sparkline por **índice da
linha na tabela**. O resultado era arco-íris: a cor variava sem querer dizer
nada, e o âmbar caía em linhas que não tinham nada de anormal — lido como alerta.

**Decisão.**

1. **Uma dimensão, um matiz.** Ranking, série temporal e composição usam rampa de
   uma só cor, variando luminosidade. Matiz diferente é reservado para
   *categoria* diferente.
2. **Onde há categoria, a cor é a categoria.** No Portfólio a cor é a **matéria
   jurídica**, idêntica na barra de proporção, na régua, no ponto do badge e na
   sparkline. O mapa vem de `coresPorMateria()` em `lib/utils.ts` — uma fonte de
   verdade, não um `index % 8` espalhado por página.
3. **`Não classificado` fica fixo no aço (`--data-8`).** É *ausência* de
   classificação, não uma matéria; dar-lhe cor de categoria a apresentaria como
   se fosse uma, contra a regra de produto de nunca exibir hipótese como fato.
4. **Âmbar é matéria sancionatória.** Vem do token `--warning`, não de uma posição
   da paleta categórica — posição muda quando a paleta é reordenada.

**Fora de propósito na paleta:** azul genérico de framework e roxo de SaaS. A V1
tinha os dois, e eram as cores que faziam a tela parecer template.

---

## DEC-026 — Ausência de rodovia é ausência, não "Geral"

**Data.** 11/09/2026 · **Status.** aceita · **Refina** `DEC-014`

Existe diferença entre *"este documento é de alcance geral do programa"* e
*"não conseguimos identificar rodovia neste documento"*. A V1 colapsava as duas
em `Geral`, inclusive na faixa de destaque da ficha — que dizia "Geral" logo
acima de uma seção dizendo "nenhuma menção identificável". A tela se contradizia.

**Decisão.**

- Por documento (tabela e ficha): `—`, com explicação em tooltip de que não houve
  menção identificável no assunto, no destinatário nem no nome do arquivo.
- Em agregado (página Rodovias): um grupo único e nomeado por inteiro —
  **"Geral / não vinculado a rodovia"** — com o texto dizendo que reúne peças de
  alcance geral **e** documentos sem referência identificada.
- **Sem percentual de cobertura em lugar nenhum.** "49% de cobertura" sugere meta
  não cumprida, quando boa parte do acervo simplesmente não é por rodovia.

O rótulo mora em `frontend/src/brand/product.ts` (`ROTULO_GERAL`) e no backend em
`pages_service.py`. Não duplicar em página.

---

## DEC-027 — Ordenação com empate precisa de critério de desempate

**Data.** 11/09/2026 · **Status.** aceita

`ORDER BY documentos DESC` com empate deixa a ordem a critério do DuckDB. Com
`RD-102B` e `RD-105` empatadas em 8 documentos, a última linha do cartão de
rodovias **mudava entre recargas** sem nada ter mudado nos dados. Num produto
cuja premissa é reprodutibilidade, isso é defeito.

**Decisão.** Toda consulta de agregação ordena por valor **e** pela chave:
`ORDER BY documentos DESC, 1` (e `, 1, 2` nas matrizes). Doze consultas em
`repositories/analytics.py` e `services/pages_service.py` foram corrigidas.

---

## DEC-028 — `?aparencia=light|dark` força a aparência; `tema` continua sendo filtro

**Data.** 11/09/2026 · **Status.** aceita · **Depende de** `DEC-011`

Os filtros vivem na URL (`DEC-011`), e `tema` é o filtro de **tema jurídico**.
Usar `?tema=dark` para trocar aparência produz um recorte vazio — o valor entra
como filtro e não casa com nada.

**Decisão.** A aparência é forçada por **`?aparencia=light|dark`**, lida em
`ThemeProvider` apenas na montagem e **sem gravar** na preferência salva. Serve
para linkar uma leitura clara para apresentação ou impressão, e torna a captura
de tela dos dois temas reproduzível.

**Consequência.** Nome de parâmetro de apresentação nunca deve colidir com nome
de dimensão do modelo. Antes de criar um, conferir `lib/filters.ts`.

---

## DEC-029 — A escala tipográfica customizada precisa estar registrada no `tailwind-merge`

**Data.** 11/09/2026 · **Status.** aceita

`cn('text-kpi', 'text-ink')` devolvia só `text-ink`. O `tailwind-merge` não
conhece `text-kpi`, assume que `text-*` desconhecido é **cor**, e a cor posterior
elimina a anterior. Efeito: **todos os KPIs renderizavam em 14 px em vez de
48–64 px** — sem erro, sem aviso.

**Decisão.** `lib/utils.ts` usa `extendTailwindMerge` registrando `kpi`,
`kpi-lg`, `kpi-sm` e `display` no grupo `font-size`. Toda chave nova de
`fontSize` no `tailwind.config` entra **também** aqui, no mesmo commit.

---

## DEC-030 — A média móvel saiu do produto e do contrato da API

**Data.** 11/09/2026 · **Status.** aceita

A usuária pediu a remoção da "Média móvel 3M" do gráfico mensal. Remover só o
desenho deixaria `PontoTemporal.media_movel_3` no contrato — um campo calculado,
servido e não usado, que convida a redesenhar a linha.

**Decisão.** `media_movel_3` foi **removido do schema** e deu lugar a
`sancionatorios`: a parcela de matéria sancionatória do período, que é o recorte
com valor de decisão. A soma de `sancionatorios` na série mensal fecha com o KPI
de exposição sancionatória (75 em 11/09/2026) — verificação de consistência
disponível a qualquer momento.

---

## DEC-031 — Higgsfield é exceção nomeada à proibição de APIs externas, restrita a asset visual sintético

**Data.** 16/09/2026 · **Status.** aceita · **Autorizada por.** a usuária, explicitamente
· **Altera.** `CLAUDE.md` §5.1 e §5.2

### Contexto

`CLAUDE.md` §5 estabelece que nenhum documento jurídico sai da máquina e que não se usa
API externa. A regra existe para proteger o acervo do Escritório Jurídico, e **continua valendo
integralmente**.

A Linha do Tempo precisa de assets visuais com materialidade — folha, pilha, gaveta de
arquivo, ambiente institucional. Hoje esses assets são desenhados em CSS/SVG ou derivados
de um PNG de referência. A usuária autorizou o uso do Higgsfield para gerá-los.

O Higgsfield gera **na nuvem**. Isso é, por definição, uma API externa. Portanto a
autorização não pode ser tratada como "detalhe de ferramenta": é exceção à regra de
segurança do projeto e precisa de fronteira escrita.

### Decisão

O Higgsfield é autorizado **exclusivamente** como gerador de asset visual sintético para
a interface. A autorização é **específica e limitada**: não cria precedente para nenhuma
outra API externa, nem amplia o que pode sair desta máquina.

#### Uso PERMITIDO

- geração de assets visuais sintéticos;
- ícones e ilustrações documentais;
- papel;
- pilhas;
- gavetas de arquivo;
- elementos visuais sem conteúdo real;
- experimentos de direção visual;
- backgrounds sintéticos, quando necessário.

#### Conteúdo PROIBIDO em prompt, anexo, upload ou referência

Nada do que segue pode ser enviado ao Higgsfield, em nenhuma forma — nem em prompt, nem
como imagem de referência, nem como arquivo:

- qualquer documento jurídico real;
- PDF do acervo;
- screenshot de documento real;
- conteúdo do `00 Indice.xlsx`;
- assunto real de documento;
- nome real de arquivo;
- nome de pessoa;
- e-mail;
- autor;
- destinatário;
- metadado documental identificável;
- texto jurídico real;
- informação interna;
- dado derivado que permita reconstruir conteúdo do acervo;
- qualquer dado pessoal ou confidencial.

**Os prompts usam apenas descrição visual genérica e sintética.** "Folha A4 branca com
mancha de texto abstrata, cabeçalho institucional, dobra no canto superior direito" é
permitido. Qualquer coisa que nomeie, cite ou permita reconstruir um documento do acervo
não é.

### Consequências práticas

1. **O asset volta sintético e entra como asset.** O que o Higgsfield devolve é imagem
   genérica: vai para `frontend/public/`, é revisado antes de entrar e nunca é
   apresentado como se fosse documento do acervo.
2. **O fluxo é de mão única.** Sai descrição visual, volta imagem. Nada do acervo sobe.
3. **`upload` do CLI é de uso restrito.** O comando existe e aceita "media and document
   inputs" — o segundo caso está proibido aqui. Só sobe imagem sintética que já obedeça
   às regras acima.
4. **O PNG do parecer não é referência válida.** O asset derivado em
   `frontend/public/brand/doc-parecer.png` vem de um parecer real e tem estrutura de um
   documento real, ainda que ilegível. Não serve de imagem de referência para o
   Higgsfield.
5. **Revisar antes de usar.** As skills instaladas rodam com permissão total de agente,
   conforme o próprio instalador avisa.

### O que NÃO muda

- Nenhum documento jurídico sai da máquina.
- Nenhum conteúdo do acervo vai para serviço externo.
- Nenhuma outra API externa fica autorizada.
- Telemetria, analytics e trackers continuam proibidos.
- A aplicação em si continua sem rede externa: o Higgsfield é ferramenta de
  **desenvolvimento**, não dependência de runtime do produto.

---

## DEC-032 — `soul-id` é proibida neste projeto

**Data.** 16/09/2026 · **Status.** aceita · **Depende de** `DEC-031`

A skill `higgsfield-soul-id` treina um modelo personalizado no **rosto de uma pessoa
real**. Isso é dado biométrico de terceiro — a categoria mais sensível que este projeto
poderia tocar, e nada na interface precisa dela.

**Decisão.** `soul-id` é **proibida**. Não é "não usada por ora": é proibida.

Especificamente, neste projeto não se faz:

- treinamento baseado em rosto de pessoa real;
- geração baseada em rosto de pessoa real;
- identificação baseada em rosto de pessoa real;
- uso de biometria, em qualquer forma;
- uso de imagem de colaborador, advogado, cliente ou terceiro para treinamento.

A skill permanece instalada porque veio no pacote `higgsfield-ai/skills` e removê-la
individualmente quebraria o `skills-lock.json`. Estar instalada não é autorização —
está registrada aqui como proibida, e o mesmo vale para o comando `higgsfield soul-id`
do CLI.

---

## DEC-033 — Cor é categoria, nunca posição

**Data.** 21/09/2026 · **Status.** aceita

O mapa de cor por matéria atribuía o índice da paleta pela **ordem de chegada** da
lista, e a lista vinha ordenada por volume. Bastava um filtro mudar o ranking para
`Contratual` herdar a cor que era do `Sancionatório` um segundo antes — e o leitor que
tinha acabado de associar âmbar a sanção via a associação se desfazer sozinha.

**Alternativas.** Manter por posição e aceitar a troca (rejeitada: destrói a leitura
cruzada entre gráficos); colorir por matiz único com luminosidade por volume (rejeitada:
some a distinção entre categorias).

**Decisão.** `frontend/src/lib/cores.ts` fixa as sete matérias **por nome**. Duas cores
carregam semântica e não são negociáveis: `Sancionatório` é **âmbar** — que é atenção,
não erro, e por isso não é vermelho — e `Não classificado` é **aço neutro**, porque
ausência de classificação não é uma categoria disputando atenção.

Onde não cabe mapa fixo, o índice sai de um **hash do próprio nome**: não é semântica,
mas é estável. É o caso dos temas, que são vinte e crescem com o acervo.

**Consequência.** Toda cor de gráfico passa por `lib/cores.ts` ou por um mapa fixo
equivalente na própria feature (é o caso do acento por rodovia, em
`features/roads/rodovias.ts`). Categoria nova exige uma linha no mapa; sem ela, cai numa
reserva declarada em vez de roubar a cor de outra.

**Armadilha registrada junto.** O canvas do ECharts **não resolve `var(--x)`** — a cor
sai transparente, sem erro no console. Dentro de gráfico, use o token já resolvido por
`useChartTokens`; `var()` só no DOM.

---

## DEC-034 — A aba de rodovia É o filtro da URL, e a página não recorta por ela

**Data.** 22/09/2026 · **Status.** aceita · **Depende de** `DEC-011`

A página Rodovias passou de quatro cartões simultâneos para uma régua de abas e um
painel único. Isso criou duas coisas que pareciam estado: a **aba ativa** e o **filtro
global de rodovia**. Aba dizendo `RD-102A` enquanto o filtro diz `RD-104` seria defeito
grave, e sincronizar dois estados é como esse defeito costuma nascer.

**Alternativas.** Estado local da aba mais efeito de sincronização com o filtro
(rejeitada: dois lugares de verdade, e a corrida entre eles é justamente o defeito);
parâmetro de URL próprio, `?rodovia_ativa=` (rejeitada pelo mesmo motivo).

**Decisão.** A aba **não tem estado próprio — ela é o filtro `rodovia` da URL**. Clicar
numa aba escreve exatamente uma rodovia nesse filtro; o menu global escrevendo ali muda
a aba pelo mesmo caminho. Deep-link, botão voltar e refresh saem de graça, porque a
fonte da verdade já era a URL desde a `DEC-011`.

**Consequência, e ela precisa ser dita.** A consulta desta página **ignora a dimensão
rodovia**: se não ignorasse, escolher uma aba devolveria uma lista de uma rodovia só e
as outras sumiriam da própria régua. Nesta página essa dimensão **seleciona, não
recorta**. Todos os outros filtros seguem recortando — inclusive as contagens das abas.
É também o que mantém os indicadores do topo gerais com uma aba escolhida.

**Restrição de navegação.** A régua é ordenada **alfabeticamente**, não por volume: a
lista chega do backend por volume, e volume muda com filtro — as abas reordenavam
embaixo do cursor. A régua não se mexe; a abertura é a obra de maior volume.

A regra vive em `frontend/src/features/roads/rodovias.ts`, com teste próprio.

---

## Perguntas abertas

Todas as seis perguntas da v1 foram **respondidas pela usuária em 10/09/2026**:

| # | Pergunta | Resposta | Onde |
|---|---|---|---|
| Q1 | `Minuta/` deve estar no índice? | **Sim** — já indexada; cobertura 100% | `DISCOVERY.md` §7 |
| Q2 | Mapa contrato↔rodovia↔executora? | **Confirmado** | `DEC-010` |
| Q3 | `Empreiteiras` é válido? | **Sim**, destinatário válido | `DEC-017` |
| Q4 | `RD-102` é ambíguo? | **Não** — sem `B` explícito é `RD-102A` | `DEC-010` |
| Q5 | Macrogrupos jurídicos? | **Aprovados** como camada derivada configurável | `DEC-016` |
| Q6 | Usar `backups/` do vizinho? | **Não** — projetos desacoplados | `DEC-012` |
| — | Expansão da sigla Parceiro? | **Não expandir** — exibir só `Parceiro` | `DEC-017` |

### Pendências

**Q7 a Q10 foram decididas pela usuária em 10/09/2026** — ver `DEC-019` a `DEC-023`.

| # | Pergunta | Decisão | Onde |
|---|---|---|---|
| Q7 | `Minuta` no macrogrupo | separar `estagio_documental` de macrogrupo; não forçar matéria | `DEC-019` |
| Q8 | `CMA` | preservar como está, `status_taxonomia = pendente_de_validacao` | `DEC-022` |
| Q9 | `Despacho/` vazia | categoria existente sem documentos; não é achado | `DEC-022` |
| Q10 | Contencioso | corte dentro das páginas existentes; reavaliar depois do MVP | `DEC-023` |

Nenhuma pendência bloqueia a implementação. Reavaliar depois do MVP: se Contencioso
merece módulo próprio, e se o mapa tema→macrogrupo cobre bem os documentos sem matéria
na natureza.
