# PRODUCT_SPEC — páginas, KPIs e o que os dados sustentam

**Versão 2** — revisada após as confirmações da usuária de 10/09/2026.
**Status:** proposta da Fase 1. Nada implementado.
**Regra de admissão:** nenhum KPI ou gráfico entra sem resposta a
**"que decisão ou entendimento este elemento permite?"**
**Base factual:** `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) v2 (296 documentos, varredura de 10/09/2026 16:21).
Categorias: `EX` `DE` `IN` `HI` `ND` · proveniências: `source` `derived`
`confirmed_business_rule` `analytical_derived`.

---

## 1. Público e perguntas de negócio

| Público | Pergunta central | Página |
|---|---|---|
| Coordenação | O que o Escritório Jurídico entregou no período? Onde está a pressão? | Executive Overview · Timeline |
| Gestão de contratos | Como se distribui a atuação por contrato, rodovia e executora? | Legal Portfolio · Contracts |
| Jurídico | Onde estão as advertências e sanções? Há reincidência? | Legal Portfolio · Themes |
| Coordenação do repositório | O acervo está indexado e classificado corretamente? | Data Governance · Repository Activity |
| Qualquer um | Onde está *aquele* documento? | Document Explorer |
| Diretoria | Resumo confiável, sem ruído | Executive Overview |

---

## 2. Veredito por KPI candidato

Nem tudo que parece KPI se sustenta nos dados de 10/09/2026.

### 2.1 Sustentados — entram

| KPI | Valor hoje | Cat. | Decisão que permite |
|---|---|---|---|
| Documentos catalogados | 296 | EX | tamanho do acervo indexado |
| Documentos ativos na pasta | 291 | EX | acervo efetivamente disponível |
| Documentos marcados como excluídos | 5 | EX | o que saiu da pasta e por quê investigar |
| Produção no período (mês/trimestre) | 2025-09: 50 · 2026-03: 28 | DE | ritmo de entrega, comparação período a período |
| Variação vs. período anterior | +/− % | DE | a produção acelerou ou caiu? |
| Média móvel de 3 meses | — | DE | tendência sem o ruído mês a mês (17 meses de série) |
| Naturezas distintas em uso | 19 de 25 | DE | amplitude da atuação jurídica |
| Documentos por natureza | **Minuta 112** · Checklist 54 · Nota Técnica 31 · Contrato 27 | EX | onde o esforço se concentra |
| Vínculos documento↔tema | 467 em 296 documentos | DE | intensidade temática (rotulado como vínculos) |
| Documentos com sanção/advertência | 44 vínculos · 12 docs de natureza Advertência | EX | exposição sancionatória |
| Stakeholders distintos | 18 de 19 | EX | dispersão de interlocução |
| Concentração no maior destinatário | Parceiro = 75 (25%) | DE | dependência de um interlocutor |
| **Cobertura do índice** | **291 de 291 = 100%** | DE | o índice cobre o acervo? (era 58% na v1) |
| Completude de metadados | 71% em `Subido por` | DE | confiabilidade das visões de pessoa |
| Achados de qualidade abertos | 17 regras | DE | fila de saneamento do repositório |
| Última varredura do repositório | 10/09/2026 16:01 | EX | o dado está fresco? |
| **Documentos por contrato** | 12/2025: 31 · 13/2025: 19 · 11/2025: 13 · 14/2025: 12 | **confirmed** | carga de trabalho por contrato — **regra confirmada** |

### 2.2 Sustentados com ressalva — entram **rotulados**

| KPI | Ressalva obrigatória na UI |
|---|---|
| Documentos por rodovia | cobertura de **49%** (145/296). `RD-102` **não é mais ambíguo** (regra confirmada). `DE`, com campo de origem e confiança |
| Documentos por contrato | mapa **confirmado**, mas só **25%** dos documentos têm contrato atribuível pela coluna `Destinatarios` |
| Documentos por executora | vínculo rodovia↔executora é `EX`; contrato↔rodovia é `confirmed_business_rule` |
| Documentos por macrogrupo jurídico | **39% em "Não classificado"** (112 são `Minuta`). `analytical_derived`, `PROPOSTA`. **Fora do Executive Overview** até resolver Q7 |
| Atividade por pessoa | descreve **operação de repositório**, não autoria jurídica. 29% sem dado |
| Série **diária** de produção | 16 documentos têm precisão só mensal + 1 sem data — excluir ou marcar |
| Novas entradas no índice | usar `LOG_ATUALIZACAO.Novos` (confiável: 171), **nunca** `Data/hora do upload` |

### 2.3 Rejeitados — **não** entram

| KPI candidato | Por que não |
|---|---|
| Urgência / criticidade / SLA / fila de resposta | `Necessidade resposta` = 1 em 293 de 296 linhas, zero variância — **reconfirmado com o acervo dobrado**. **`ND`** |
| Rodovias `RD-250`, `RD-251`, `RD-260` | **não existem no acervo** — eram falsos positivos do regex (`DEC-014`) |
| Tempo médio de resposta | não existe par pergunta↔resposta na fonte. **`ND`** |
| Valor financeiro de contratos / aditivos / apólices | nenhum valor monetário no índice. **`ND`** |
| Exclusões por período (via log) | `LOG_ATUALIZACAO.Excluídos` = 0 em 22 execuções, apesar de 5 exclusões reais |
| "Novas entradas por dia" via `Data/hora do upload` | só 7 valores distintos, 125 marcados `(aprox.)` — é data de varredura |
| Documentos vigentes vs. revogados | `Status` é físico (`Na pasta`/`Excluído`), não jurídico. **`ND`** |
| Autoria jurídica / produtividade por advogado | colunas de pessoa são de repositório. Além disso: métrica de produtividade individual sobre 71% de cobertura seria irresponsável |
| Análise de conteúdo, cláusulas, entidades no texto | PDFs e DOCX não são lidos nesta fase. **`ND`** |
| Previsão / tendência estatística | 17 meses, volume entre 1 e 50, com variação de 6x entre meses vizinhos. Média móvel sim; projeção não |
| Word cloud de assuntos | 246 assuntos distintos em 296 linhas; nuvem não permite decisão nenhuma |
| Gráfico 3D, gauge decorativo, pizza de 19 fatias | não permitem leitura precisa |
| Macrogrupo jurídico no Executive Overview | 39% em "Não classificado" — a maior fatia seria o não-saber (Q7) |

---

## 3. Páginas

### P1 — EXECUTIVE OVERVIEW `prioridade 1`

Primeira tela. **Extremamente limpa.** Máximo 4 KPIs + 3 visualizações + 1 lista.
Se a diretoria olhar por 20 segundos, precisa sair sabendo o essencial.

**Cabeçalho:** seletor de período (padrão: últimos 6 meses) · última varredura ·
badge de alerta de governança quando houver achado de severidade alta.

**Faixa de KPIs (4):**
1. Documentos ativos — 291, com Δ vs. período anterior
2. Produção no período — nº + sparkline de 17 meses
3. Exposição sancionatória — documentos de natureza sancionatória no período
   (12 `Advertência` + 1 `Notificação`; 44 vínculos ao tema `Sanções / Advertência`)
4. **Cobertura do índice — 100%**, em **verde**, clicável para Data Governance

> O 4º KPI era o alarme da v1 (58%). A usuária resolveu, e ele agora é a prova de que o
> repositório está íntegro. Vale manter na tela justamente por isso: é o indicador que
> avisa se voltar a cair.

**Visualizações (3):**
1. **Produção mensal** — barras + média móvel de 3 meses. Com 17 meses de série e volume
   de 1 a 50, a média móvel finalmente tem significado. Responde: o ritmo mudou?
2. **Top 8 naturezas + "Outras"** — barras horizontais ordenadas.
   A visão por **macrogrupo jurídico** fica **fora desta tela** enquanto 39% do acervo
   estiver em "Não classificado" (112 `Minuta`) — ver Q7 e `DEC-016`. Um gráfico
   executivo cuja maior fatia é "Não classificado" não permite decisão nenhuma.
3. **Top 8 temas** — barras horizontais, rótulo explícito "vínculos documento-tema"
   (467 vínculos ≠ 296 documentos), com opção de ocultar `Documentação`.

**Lista:** atividade recente — últimos 10 documentos por `data_documento`, com natureza,
destinatário e link direto.

**Não vai aqui:** rodovias (49% de cobertura não é assunto de tela executiva), pessoas,
macrogrupo (até Q7), tabela grande, mapa relacional.

---

### P2 — LEGAL PORTFOLIO `prioridade 3`

Visão analítica por categoria jurídica. Uma linha por natureza, ordenável:
docs, % do acervo, primeiro e último documento, temas dominantes, destinatários,
sparkline temporal. Clicar em uma natureza abre um painel de detalhe (não uma nova página).

Agrupamento por macrogrupo quando Q7 for resolvida, com a fatia "Não classificado"
sempre visível e rotulada.
**Tratamento da cauda longa:** as 8 naturezas com 1 documento vão para "Naturezas
pontuais (8)", expansível — não como fatias de gráfico.

**Cortes com destaque próprio** (são as perguntas jurídicas reais):

| Corte | Volume |
|---|---|
| **Minutas e elaboração** | 112 docs — a maior parcela do acervo |
| Conformidade contratual (checklists, formulários, relatórios) | 54 + 3 |
| Notas técnicas | 31 |
| Contratos e aditivos | 27 docs · 79 vínculos `Contrato` + 24 `Aditivo` |
| Editais, erratas e convocações | 25 |
| Advertências e sanções | 12 docs · 44 vínculos `Sanções / Advertência` |
| Seguros-garantia | 8 docs · 21 vínculos |
| Consultas e respostas | 12 (o par pergunta/resposta existe como natureza, mas o vínculo entre elas é `ND`) |
| **Contencioso e controle externo** | 11 `Ministério Público` + 5 `TCE` + 5 `Judicial / Contencioso` — eixo novo (Q10) |

O corte de **minutas** é novo e é o maior do acervo. Ele responde uma pergunta que antes
não existia: *quanto do trabalho jurídico está em elaboração?*

---

### P3 — TIMELINE & DELIVERIES `prioridade 4`

Série temporal da produção jurídica.

- Granularidade: **mês** (padrão) · trimestre · ano. **Semana e dia ficam desabilitados**
  com tooltip explicando: 16 documentos têm precisão apenas mensal, 1 não tem data, e a
  média é de ~17 documentos/mês — série diária seria ruído.
- Decomposição por natureza, tema, destinatário, rodovia (49%), contrato (confirmado),
  macrogrupo (quando Q7 sair).
- Modos: barras empilhadas · área 100% (mix) · linhas múltiplas · média móvel de 3 meses.
- Marcadores de contexto: assinatura dos contratos 11 a 14/2025 — agora possível, porque
  o mapa é `confirmed_business_rule`.
- Comparação período a período.

**Cuidado obrigatório:** esta página mostra `data_documento`, ou seja **quando o
documento foi produzido**. A curva de quando ele **entrou no índice** é outra e vive na
página Repository Activity. Nunca no mesmo eixo.

---

### P4 — THEMES & STAKEHOLDERS `prioridade 5`

Relações entre tema, natureza, destinatário e rodovia.

| Visualização | Quando usar | Justificativa |
|---|---|---|
| **Heatmap Tema × Natureza** | sempre | 20 × 19 com 467 vínculos: densidade adequada, leitura precisa |
| **Heatmap Tema × Destinatário** | sempre | 20 × 18 — revela pauta por interlocutor |
| **Matriz Natureza × Destinatário** | sempre | 19 × 18 |
| **Sankey Destinatário → Tema** | ≥ 3 nós de cada lado após filtro | só com filtro aplicado; sem filtro fica ilegível |
| **Treemap de temas** | opcional | proporção; heatmap já cobre |
| **Network graph** | **não nesta fase** | ver P9 |

Toda célula é clicável e leva ao Document Explorer com o filtro aplicado.

---

### P5 — CONTRACTS / ROADS / EXECUTORAS `prioridade 5` — **DESBLOQUEADA**

O mapa contrato↔rodovia↔executora é **regra de negócio confirmada** (`DEC-010`). A página
deixa de ser condicionada e sobe de prioridade.

Abre com aviso permanente de cobertura:
*"Rodovia identificada em 145 de 296 documentos (49%). Os 151 restantes não mencionam
rodovia — não são atribuídos por inferência."*

**Quatro cartões principais**, um por contrato confirmado:

| Contrato | Rodovia | Executora | Docs (destinatário) | Docs (rodovia) |
|---|---|---|---|---|
| 12/2025 | RD-102A | BETA | 31 | 42 |
| 13/2025 | RD-101 | Gama | 19 | 30 |
| 11/2025 | RD-103 | Alfa | 13 | 30 |
| 14/2025 | RD-104 | DELTA | 12 | 24 |

Cada cartão mostra: executora, documentos, timeline de eventos, advertências e sanções,
aditivos, seguros-garantia, e um selo de **regra confirmada em 10/09/2026** — não um
badge de inferência.

**Dois números por cartão, e a diferença importa.** "Docs por destinatário" (confiança
alta, coluna `Destinatarios`) e "docs por rodovia" (extraído do texto, confiança média).
A diferença — 42 vs. 31 no RD-102A — são documentos que *tratam* daquela rodovia sem
serem *endereçados* à executora: editais, minutas, respostas a órgãos. Exibir os dois
lado a lado, rotulados, é mais informativo do que escolher um.

**Blocos secundários:**
- Rodovias sem contrato confirmado: `RD-102B` (8), `RD-105` (8), `RD-106` (3) — aparecem
  em editais, minutas e declarações. Contratação em andamento ou não iniciada.
- `Contrato 10/2025` (estruturadora, Programa) — sem rodovia, em cartão próprio.
- "Sem rodovia identificada (151)" — clicável, tratado como fato, não erro.

**A regra `RD-102`** aparece como nota de rodapé da página: *"'RD-102' sem 'B' explícito é
tratado como RD-102A, por regra de negócio confirmada em 10/09/2026."* O usuário precisa
saber que a normalização existe.

---

### P6 — REPOSITORY ACTIVITY `prioridade 4`

**Atividade de repositório ≠ atividade jurídica.** A página começa dizendo isso.

- Série das 22 varreduras: `total_na_pasta` vs `total_no_indice` no tempo — as duas
  linhas se separam em 03/09 (as 5 exclusões) e se reaproximam em 10/09 conforme a
  indexação avança. **É o gráfico que conta a história da correção da lacuna.**
- Novas entradas por varredura: 25 em 03/09 · 2+2 em 10/09 · **110 às 15:50** · 2 às
  15:52 · **30 às 16:00**.
- Crescimento do inventário: 125 → 296 em 13 dias, com 171 entradas — sendo **142 em uma
  única tarde**.
- Cadência de varredura (22 execuções, intervalos muito irregulares).
- Operadores do repositório: `Subido por` / `Modificado por`, com a cobertura declarada
  (71% / 76%) e o rótulo "operação de repositório, não autoria jurídica".
- **Aviso fixo:** `LOG_ATUALIZACAO.Excluídos` e `Modificados` somam 0 nas 22 execuções
  apesar de 5 exclusões reais — campo do log não confiável; a contagem vem do `Status`.
- Arquivos de controle do repositório (2), listados à parte do acervo (`DEC-015`).

**Esta página é o exemplo mais claro de por que atividade de repositório não é atividade
jurídica:** em 10/09/2026 o repositório registrou 142 "entradas", e nenhuma delas é um
documento produzido naquele dia. Somar as duas coisas na mesma curva produziria um pico
de trabalho jurídico que nunca existiu.

---

### P7 — DOCUMENT EXPLORER `prioridade 2`

**A área mais importante depois do Overview.** Com 296 linhas, é a página que a
coordenação vai abrir todo dia.

**Layout:** três zonas — barra de comando no topo, lista à esquerda/centro, painel de
detalhe à direita. **Selecionar um documento nunca troca de página.**

**Busca e filtros**
- Command bar (`Ctrl/Cmd + K`): busca em `assunto`, `arquivo_nome`, `nome_assunto`.
  Sem acento e sem caixa. Com 296 registros, tudo em memória — resposta instantânea.
- Filtros combináveis, exibidos como **chips removíveis**, com contagem ao lado de cada
  valor: natureza · tema (multi) · destinatário · status · pasta · período ·
  operador · rodovia (`IN`) · extensão · conformidade de nome · precisão de data.
- Filtros de qualidade: "sem destinatário" (2) · "sem tema" (1) · "fora do padrão de
  nome" (2) · "possível duplicata" (12 grupos) · "não indexado" (110, quando
  `fct_arquivo_fisico` estiver na visão).
- Estado dos filtros na URL — link compartilhável reproduz a visão.

**Lista**
- Colunas: data (com marca de precisão mensal), natureza, assunto, destinatário, temas
  (chips), status, formato.
- Ordenação por qualquer coluna. Paginação de 50 (virtualização só quando passar de
  ~2.000 linhas — 296 não justifica).
- Linha `Excluído` visualmente distinta, **não escondida**.
- Agrupamento opcional por documento lógico: colapsa par `.docx`/`.pdf` em uma linha
  com badge "2 formatos".

**Painel de detalhe**
- Breadcrumb `Pasta / Natureza / Assunto`.
- **Todos** os campos da fonte, incluindo os vazios — mostrados como "não informado",
  nunca omitidos.
- Bloco temporal com os quatro tempos separados e rotulados, incluindo
  "data de indexação aproximada" quando for o caso.
- Chips de tema, destinatário decomposto (papel · rodovia · empresa), rodovias
  inferidas com badge `INFERÊNCIA`.
- Documentos relacionados: mesmo documento lógico · mesmo assunto em outras datas
  (reincidência) · mesmo destinatário + tema.
- Achados de qualidade daquele documento.
- **Botão `ABRIR DOCUMENTO`** — usa `link_url` literal, abre em nova aba. Desabilitado
  com explicação nos 5 documentos excluídos. Nunca reconstrói a URL silenciosamente.

---

### P8 — DATA GOVERNANCE `prioridade 3`

Qualidade de dados como área real do produto. Não esconder problema; torná-lo acionável.

**Cabeçalho:** score de qualidade (composto, com a fórmula visível — score sem fórmula
é opinião) · achados por severidade · comparação com a varredura anterior.

**Destaque nº 1 — cobertura do índice: 100%.** O achado que dominava a v1 (110 arquivos
de `Minuta/` fora do índice) foi **resolvido pela usuária**. A página começa com a boa
notícia e com a série que a comprova, porque um painel de qualidade que só mostra
problema perde credibilidade quando o problema é resolvido.

**Achados abertos, por severidade:**

| Sev. | Achado | Volume |
|---|---|---|
| média | **Macrogrupo não classificado** — 112 `Minuta` + 4 | 116 (39%) · Q7 |
| média | `Subido por` ausente | 87 (29%) |
| média | `Modificado por` ausente | 71 (24%) |
| média | Possível duplicidade semântica | 19 grupos |
| média | `Necessidade resposta` previsto e não utilizado | 1 campo |
| média | `LOG_ATUALIZACAO.Excluídos` inconsistente | 5 exclusões vs. 0 no log |
| baixa | `CMA` fora da taxonomia | 1 (ID 283) · Q8 |
| baixa | Nome fora do padrão | 3 (IDs 97, 102, 264) |
| baixa | ID 264 sem natureza, sem data e sem destinatário | 1 |
| baixa | `Despacho/` vazia | 1 · Q9 |
| info | `Empreiteiras`: planilha vs. regra confirmada | 24 docs — **não é erro** |
| info | Arquivos de controle do repositório | 2 |
| info | Precisão de data mensal · indexação aproximada | 16 · 125 |

**Painéis:**
1. **Cobertura do índice** — matriz pasta × (disco / índice / `Na pasta` / Δ), viva.
   Hoje: 15 pastas, Δ zero em todas.
2. **Completude por campo** — barras: `Subido por` 71% · `Modificado por` 76% ·
   `Destinatarios` 99% · `Temas` **100%** · `Link` 98% · `Naturezas` 99,7% · `Data` 99,7%.
3. **Taxonomia** — três blocos, **e a distinção entre eles é o ponto**:
   (a) fora da planilha **e** sem regra → `CMA` (1 doc), achado real;
   (b) fora da planilha **mas válido por regra confirmada** → `Empreiteiras` (24 docs),
   marcado como diferença planilha-vs-regra, **não** como erro;
   (c) previstos e nunca usados → 6 naturezas, 3 destinatários, 3 temas.
4. **Nomenclatura** — 293/296 conformes; os 3 desvios listados, com destaque para o
   ID 264 (um nome sem prefixo de data produziu três campos vazios).
5. **Duplicidade** — 19 grupos, classificados em par-de-formato / cópia-Office /
   variante-de-revisão / versões-sucessivas. Deixa claro que **variantes `Limpa` vs.
   `com Marcas` e versões sucessivas não são erro**.
6. **Macrogrupo jurídico** — painel próprio, por ser o maior achado aberto: 116 não
   classificados, o motivo registrado por natureza, e as três opções de Q7. É um achado
   sobre **a nossa camada derivada**, não sobre a fonte — e a página diz isso.
7. **Coerência temporal** — 16 documentos com precisão mensal · 1 sem data · 125 datas de
   indexação aproximadas · 0 datas no futuro · 0 anacronismos. Os "0" também são
   informação: são a prova de que o campo é confiável.
8. **Pasta × Natureza** — as 8 divergências legítimas, como informação de organização,
   não como defeito.
9. **Links** — 291 válidos em formato · 5 ausentes (todos `Excluído`) · 0 duplicados ·
   0 divergentes. Validação HTTP real fica **fora de escopo** (exigiria autenticação no
   SharePoint e tráfego externo).
10. **Inconsistências do log** — exclusões e modificações não registradas nas 22
    varreduras; pasta `Despacho/` vazia.
11. **Guardas de regressão** — verificações que provam que erros conhecidos não voltaram:
    `RD-250`/`RD-251`/`RD-260` ausentes de `dim_rodovia` (`DEC-014`), contrato confirmado
    com destinatário correspondente, arquivos de controle fora do acervo.

Cada achado exporta a lista de IDs afetados (CSV local) para que o saneamento aconteça
no projeto vizinho, que é quem pode escrever no índice.

---

### P9 — LEGAL RELATIONSHIP VIEW `prioridade 9 — não implementar agora`

Navegação relacional (`Sanções → Advertência → Beta → RD-102A → documentos`).

**Reavaliação em 10/09/2026.** Dois dos três critérios de reabertura foram atendidos: o
acervo passou de 250 documentos indexados (296) e o mapa contrato↔rodovia↔executora foi
confirmado. **Ainda assim: não implementar agora.**

**Por quê.** O terceiro critério — demanda concreta de navegação relacional — não
apareceu. E o volume maior não melhorou a densidade relacional: a cobertura de rodovia é
de 49%, 22% dos documentos estão em buckets genéricos de destinatário, e não existe
vínculo formal entre documentos (nem pergunta↔resposta, nem documento↔aditivo). Um grafo
sobre isso mostraria a estrutura da nossa taxonomia, não a estrutura real do acervo.

O que a v2 **de fato** habilitou é mais simples e mais útil: com o mapa de contratos
confirmado, a cadeia `Sanções → Advertência → BETA → RD-102A → documentos` já é
navegável em P5 (cartão do contrato) e em P7 ("documentos relacionados"), sem grafo.

**Critério de reabertura, revisto:** existir **vínculo documento↔documento** na fonte
(par consulta/resposta, aditivo↔contrato, advertência↔notificação) **ou** demanda
explícita da coordenação. Volume, por si, não é mais critério.

---

## 4. Prioridade de implementação

| Ordem | Página | Fase | Motivo |
|---|---|---|---|
| 1 | Executive Overview | 5 | prova o pipeline ponta a ponta com pouca superfície |
| 2 | Document Explorer | 6 | maior valor diário; com 296 documentos, é a tela do dia a dia |
| 3 | Legal Portfolio | 7 | o perfil do acervo mudou muito; entender a composição virou prioridade |
| 4 | Data Governance | 7 | o achado grande foi resolvido; o que resta é fila de saneamento |
| 5 | **Contracts / Roads / Executoras** | 7 | **desbloqueada** pela confirmação do mapa |
| 6 | Timeline · Repository Activity | 7 | |
| 7 | Themes & Stakeholders | 7 | |
| — | Relationship View | — | condicionada a vínculo documento↔documento ou demanda explícita |

Mudança de ordem em relação à v1: **Legal Portfolio subiu** (a composição do acervo se
transformou: `Minuta` passou de 1 para 112 documentos) e **Data Governance desceu** (o
achado de severidade alta foi resolvido). **Contracts subiu** de 6ª e condicionada para
5ª e desbloqueada.

---

## 5. Transversal a todas as páginas

- **Badge de categoria** (`EX` `DE` `IN` `HI`) em todo KPI e gráfico que não seja
  `DADO EXISTENTE` puro.
- **Cobertura declarada** sempre que a métrica não cobrir 100% do acervo.
- **Rodapé de proveniência** em todo card: fonte, snapshot, horário da varredura.
- **Estados completos:** skeleton · vazio (com o motivo: sem dado vs. filtro restritivo)
  · erro (o que falhou e o que fazer) · parcial (dado incompleto, e quanto).
- **Drill-through universal:** clicar em qualquer número leva ao Document Explorer com
  o filtro correspondente. Um KPI que não navega é um número morto.
- **Exportação local** (CSV/XLSX da visão filtrada) — sem serviço externo.
- **Números conferíveis:** cada KPI tem teste automatizado que o compara com o cálculo
  direto sobre o snapshot da fonte.
