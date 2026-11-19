# GLOSSÁRIO

**Versão 2** — revisada após a releitura da fonte de 10/09/2026 16:21 (296 documentos).

Termos, siglas e entidades que aparecem nos dados. Serve dois propósitos: alinhar
vocabulário do time e alimentar os tooltips da interface (`UI_UX.md` §10).

**Coluna "Base":** `fonte` = aparece literalmente nos dados · `confirmado` = regra de
negócio confirmada pela usuária · `conhecido` = de domínio público, fora dos dados ·
`a confirmar` = **precisa de validação** antes de ir para a UI.

---

## 1. Organizações e siglas

| Sigla | Significado | Base | Presença nos dados |
|---|---|---|---|
| **Programa** | consórcio responsável pela estruturação de obras; o Escritório Jurídico é uma das consorciadas | fonte | destinatário em 3 documentos; tenant do SharePoint (`contoso.sharepoint.com`) |
| **Fundo** | Fundo de Infraestrutura (fictício) | conhecido | citado em nome de arquivo |
| **Escritório Jurídico** | Escritório Jurídico — escritório que produz o acervo | fonte | destinatário em 11 documentos |
| **Parceiro** | **exibir apenas como `Parceiro`** | **confirmado** | **destinatário nº 1: 75 documentos (25%)** |
| **Órgão Contratante** | agência estadual contratante das obras | conhecido | destinatário em 28 documentos |
| **Ministério Público** | Ministério Público Estadual | conhecido | **destinatário em 11 documentos** + tema `Ministério Público` (11 vínculos) |
| **Tribunal de Contas** | Tribunal de Contas do Estado | conhecido | destinatário em 3 documentos + tema `TCE` (5 vínculos) |
| **Comissão Legislativa** | comissão da Assembleia Legislativa Estadual | **a confirmar** | **destinatário em 6 documentos** |
| **Órgão Supervisor** | Órgão Supervisor | conhecido | destinatário em 1 documento |
| **Dynatest** | Dynatest Engenharia — supervisão/consorciada | fonte | destinatário `Dynatest / Programa` em 1 documento |
| **CMA** | — | **a confirmar (Q8)** | destinatário em 1 documento (ID 283) |
| **Seguradora** | emissora de seguro-garantia (bucket genérico) | fonte | destinatário em 12 documentos |
| **Consultoria X** | consultoria externa (nome omitido) | conhecido | previsto na `LISTAS_APOIO`, **nunca usado** |
| **BV** | Certificadora | conhecido | previsto na `LISTAS_APOIO`, **nunca usado** |
| **SUSEP** | Superintendência de Seguros Privados | conhecido | citada em nome de arquivo (certidões) |

> **`Parceiro`**: por decisão da usuária (10/09/2026), a sigla **não é expandida** em
> nenhum lugar do produto. Registrado em `config/regras_negocio.json` → `sigla_parceiro`.

**Novidade da v2:** a entrada de Ministério Público (11), Comissão Legislativa (6) e Tribunal de Contas (3), somada aos temas
`Ministério Público`, `TCE` e `Judicial / Contencioso`, revela um eixo de **resposta a órgãos de
controle e ao legislativo** que não existia na v1 do discovery. Pendência **Q10**: esse
eixo merece área própria no produto?

---

## 2. Executoras, rodovias e contratos — **REGRA CONFIRMADA**

Mapa **confirmado oficialmente pela usuária em 10/09/2026**
(`proveniencia = confirmed_business_rule`, em `config/regras_negocio.json`).
Não é mais inferência.

| Contrato | Rodovia | Executora | Docs (destinatário) | Docs (rodovia) |
|---|---|---|---|---|
| **12/2025** | **RD-102A** | **BETA** | 31 | 42 |
| **13/2025** | **RD-101** | **Gama** | 19 | 30 |
| **11/2025** | **RD-103** | **Alfa** | 13 | 30 |
| **14/2025** | **RD-104** | **DELTA** | 12 | 24 |

`Contrato 10/2025` é o contrato da **estruturadora** (Programa), sem vínculo com rodovia.

### Rodovias sem contrato confirmado

| Rodovia | Docs | Contexto |
|---|---|---|
| RD-102B | 8 | editais, minutas, declarações |
| RD-105 | 8 | editais, minutas, declarações |
| RD-106 | 3 | editais, minutas, declarações |

### Regra `RD-102` — **confirmada**

```
'RD-102'  sem 'B' explícito  ->  RD-102A
'RD-102B' com 'B' explícito  ->  RD-102B
Tolera espaço, hífen e caixa: 'RD 102', 'RD102', 'RD 102 A', 'rd102b'.
```

**`RD-102` não é mais ambíguo.**

### Não são rodovias

`RD-250`, `RD-251` e `RD-260` apareceram na v1 do discovery e **não existem no acervo**.
Eram falsos positivos do regex, que rodava sobre campos concatenados: a sigla do órgão (sintética na
versão pública: `MPRD`, `SITC ALERD`, `TCE-RD` — órgão + UF fictícia `RD`) + `251104…` produzia `RD 251`,
`RD 260` e `RD 250`. Corrigido em `DEC-014`, com verificação automática de regressão.

**Cobertura de rodovia: 145 de 296 documentos (49%).** Os 151 restantes não mencionam
rodovia e **não recebem atribuição por inferência**. Origem: 75 pela coluna
`Destinatarios` (confiança alta), 70 pelo `Assunto` (confiança média).

---

## 3. Naturezas documentais

As 19 em uso, de 25 catalogadas na `LISTAS_APOIO`, mais 1 linha sem natureza (ID 264).

O **macrogrupo jurídico** é camada **analítica derivada** (`DEC-016`), configurável em
`config/regras_negocio.json` — **não é dado do Escritório Jurídico**. `Não classificado` significa
"não é seguro decidir", nunca "esquecemos".

| Natureza | Docs | Macrogrupo | O que é |
|---|---|---|---|
| **Minuta** | **112** | **Não classificado** | documento em elaboração: minuta de contrato, edital, ofício, resposta |
| Checklist / Formulário | 54 | Conformidade | acompanhamento contratual, ESG, descumprimentos, demonstrativos |
| **Nota Técnica** | **31** | Consultivo | análise técnico-jurídica |
| Contrato / Instrumento | 27 | Contratual | contratos, termos aditivos, termos de colaboração |
| Edital | 20 | Licitatório | instrumentos de convocação e chamamento |
| Advertência | 12 | Sancionatório | advertência formal a executora |
| Seguro Garantia | 8 | Contratual | apólices de garantia contratual |
| Consulta | 8 | Consultivo | consulta jurídica formulada |
| Errata | 5 | Licitatório | correção de instrumento convocatório |
| Declaração | 4 | Administrativo | declarações e certidões |
| Resposta a Consulta | 4 | Consultivo | resposta a consulta recebida |
| Relatório | 3 | Conformidade | relatórios de medição e desempenho |
| Reunião / Ata | 1 | Administrativo | |
| Manifestação | 1 | Consultivo | posicionamento formal |
| Nota Explicativa | 1 | Consultivo | |
| Notificação | 1 | Sancionatório | |
| Apêndice · Anexo · Ofício / Carta | 1 cada | Não classificado | forma sem matéria própria |
| *(vazio — ID 264)* | 1 | Não classificado | nome de arquivo sem prefixo de data |

Catalogadas e **nunca usadas**: `ESG / Compliance`, `Estudo Técnico`, `Parecer`,
`Processo Administrativo`, `Termo de Referência`, `Outros`.

### O problema da `Minuta`

**112 de 296 documentos (38%)** são minutas — a maior natureza do acervo. Minuta é
**forma de elaboração, não matéria jurídica**: existe minuta de contrato, de edital, de
resposta ao Ministério Público. Por isso fica em `Não classificado`, e por isso a visão por macrogrupo
cobre apenas 60,8% do acervo.

Pendência **Q7**, com recomendação: derivar a matéria do assunto e criar a dimensão
`estagio_documental` ∈ {`minuta`, `instrumento_final`}. Ver `DEC-016`.

---

## 4. Temas

20 em uso, de 23 catalogados. **Campo multivalorado** (`;`): **467 vínculos** em 296
documentos — 142 linhas têm mais de um tema, e nenhuma linha está sem tema.

| Tema | Vínculos | Nota |
|---|---|---|
| **Contrato** | **79** | assumiu a liderança na v2 |
| Documentação | 70 | **tema genérico** — 24% dos documentos, baixo poder discriminante |
| Contratação | 58 | processo de contratação/licitação |
| Sanções / Advertência | 44 | dobrou em relação à v1 |
| Governança | 39 | |
| **Projeto** | **31** | cresceu de 5 para 31 |
| Aditivo | 24 | termo aditivo |
| Seguro Garantia | 21 | |
| Obra | 15 | |
| **Eventograma** | **14** | cresceu de 1 para 14 |
| Prestação de Contas | 13 | |
| **Ministério Público** | **11** | estreia na v2 |
| ESG | 10 | ambiental, social e governança |
| Financeiro | 8 | |
| Ambiental | 7 | |
| Cronograma · Compliance | 5 cada | |
| **TCE** · **Judicial / Contencioso** | 5 cada | estreiam na v2 |
| Medição | 3 | medição de serviços executados |

Catalogados e nunca usados: `Repasse`, `Risco jurídico`, `Outros`.

---

## 5. Termos do domínio

| Termo | Significado |
|---|---|
| **Eventograma** | cronograma de eventos contratuais (marcos de execução). 14 vínculos |
| **Executora** | empresa ou consórcio que executa a obra da rodovia |
| **Estruturadora** | responsável pela estruturação do programa (Contrato 10/2025, Programa) |
| **Empreiteiras** | destinatário **válido confirmado** (24 docs); ainda ausente da `LISTAS_APOIO` |
| **Executoras** | bucket genérico de destinatário (4 docs), presente na `LISTAS_APOIO` |
| **Termo aditivo (TA)** | alteração formal de contrato. `1 TA`, `2 TA` no nome dos arquivos |
| **Seguro-garantia** | apólice que garante o cumprimento do contrato |
| **Expectativa de sinistro** | comunicação à seguradora de possível acionamento da apólice |
| **Advertência** | sanção formal branda, prévia a penalidades maiores |
| **Instrumento de convocação** | chamamento público para contratação |
| **Consolidado** | versão do contrato com todos os aditivos incorporados |
| **Limpa / Com marcas** | versão de minuta sem / com marcas de revisão — **não são duplicatas** |
| **revjuridico** | arquivo revisado pelo Escritório Jurídico |
| **Recomendação (Ministério Público)** | recomendação expedida pelo Ministério Público, que exige resposta formal |

---

## 6. Termos deste produto

| Termo | Significado |
|---|---|
| **Snapshot** | leitura datada da fonte, copiada para `data/raw/`. Unidade de reprodutibilidade |
| **Varredura** | execução do robô de indexação do projeto vizinho. 22 registradas em `LOG_ATUALIZACAO` |
| **Acervo** | os 291 documentos jurídicos no disco. **Não inclui** os 2 arquivos de controle do repositório |
| **Arquivo de controle do repositório** | `00 Indice.xlsx` e `00 Nomenclatura…`, na raiz. Instrumento, não objeto (`DEC-015`) |
| **Documento lógico** | agrupamento do mesmo documento em formatos ou cópias diferentes (`.docx` + `.pdf`) |
| **Vínculo documento-tema** | uma linha da tabela-ponte. **467 vínculos ≠ 296 documentos** |
| **Cobertura** | fração do acervo que uma métrica realmente representa. Sempre declarada |
| **Precisão de data** | `dia` ou `mes`. 16 documentos têm apenas precisão mensal |
| **Data de indexação** | quando a linha entrou no índice (era `Data/hora do upload`). **Não** é upload real |
| **Atividade jurídica** | produção de documentos pelo Escritório Jurídico (eixo `data_documento`) |
| **Atividade de repositório** | varredura, indexação, exclusão (eixo `data_varredura`). **Nunca somar com a anterior** |
| **Estágio documental** | proposta de Q7: `minuta` vs. `instrumento_final` |
| **Achado (DQ finding)** | problema de qualidade detectado, com severidade e entidade afetada |
| **Bucket genérico** | destinatário sem stakeholder identificável (`Empreiteiras`, `Executoras`, `Outros`) — 66 docs, 22% |
| **Guarda de regressão** | verificação que prova que um erro conhecido não voltou (ex.: `RD-251` ausente) |

---

## 7. Categorias de confiança e proveniência

| Categoria | Significado | Tratamento na UI |
|---|---|---|
| `DADO EXISTENTE` | literal da fonte | padrão, sem badge |
| `DADO DERIVADO` | cálculo determinístico | badge neutra |
| `INFERÊNCIA` | regra/regex, confiança < 100% | badge de alerta + cobertura declarada |
| `HIPÓTESE` | interpretação de negócio não confirmada | badge preenchida + ícone |
| `NÃO DISPONÍVEL` | a fonte não sustenta | "não disponível na fonte", em itálico |

| Proveniência | Significado | Tratamento na UI |
|---|---|---|
| `confirmed_business_rule` | **confirmado pela usuária, com data** | selo "regra confirmada em DD/MM/AAAA" — **não** é badge de alerta |
| `source` | valor literal da fonte | padrão |
| `derived` | calculado da fonte | badge neutra |
| `analytical_derived` | camada analítica nossa (macrogrupo) | rotulada como classificação analítica, nunca como dado do Escritório Jurídico |

---

## 8. Pendências deste glossário

| # | Pendência |
|---|---|
| **Q7** | tratamento de `Minuta` no macrogrupo (afeta §3) |
| **Q8** | **`CMA`** (1 doc, ID 283, `Nota Tecnica - Composicao Orcamento Unitario`) é destinatário válido ou erro de preenchimento? (afeta §1) |
| **Q10** | o eixo de contencioso e controle externo (Ministério Público, Tribunal de Contas, Comissão Legislativa) merece área própria? |
| — | **`Comissão Legislativa`**: entendo como comissão da Assembleia Legislativa de Estado, mas a sigla `SITC` **não está confirmada**. Consta da `LISTAS_APOIO`, então é destinatário válido; só a expansão precisa de conferência antes de entrar em tooltip. |

**Resolvidas na v2:** `Parceiro` (exibir sem expansão) · mapa contrato↔rodovia↔executora
(confirmado) · regra `RD-102` (confirmada) · `Empreiteiras` (destinatário válido) ·
`RD-250`/`RD-251`/`RD-260` (falsos positivos, removidos).
