# STATE — onde a obra está

> Leia depois de `CLAUDE.md`. Este arquivo é o ponto de retomada: se você abriu este
> projeto sem nenhum contexto de conversa, é aqui que descobre o que fazer agora.
> **Atualizar sempre que uma fase avançar** — no mesmo commit da mudança.

**Última atualização:** 22/09/2026 — encerramento da sessão *2- Painel Analítico e Rodovias*
**Fase atual:** Fases 0 a 7 concluídas. **Linha do Tempo aprovada** nas três escalas.
**Visão Geral redesenhada** como painel analítico com cross-filter global, e é agora a
única aba de panorama — Portfólio e Destinatários foram absorvidos por ela.
**Rodovias redesenhada**: régua de abas e um painel por rodovia.

### Estado do Git

| | |
|---|---|
| Projeto | `C:\caminho\exemplo\dashboard-juridico` |
| Branch | `feat/timeline-golden-screen` |
| HEAD | `5beee06` — uma rodovia por vez, régua de abas e painel inteiro (22/09/2026) |
| Árvore | **limpa** |
| Push | **nenhum** — o repositório não tem remote |

**A partir de 18/09 o projeto tem histórico.** `fac1391` congelou a visão semanal
inteira como baseline (123 arquivos); dali em diante cada correção vira um commit
atômico próprio, só depois de aprovação visual da usuária. Detalhe do fluxo e dos
ajustes já percorridos em `docs/SESSION_HANDOFF.md`.

**Servidores:** subir com `.\scripts\start_dev.ps1` (ou `uvicorn` + `npm run dev`).
Linha do Tempo em **http://127.0.0.1:5173/linha-do-tempo**.

### Testes — execução de 22/09/2026, no encerramento da sessão

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | **limpo** |
| `npx eslint src --max-warnings=0` | **limpo** |
| `npx vitest run` | **120 passando**, 10 arquivos |
| `npm run build` | **verde** (aviso de chunk > 1200 kB, conhecido) |
| `python -m pytest tests` | **1 falha, 115 passando, 20 erros** |

**O vermelho do `pytest` é conhecido e não é regressão do frontend.** Todas as 21
ocorrências estão em `tests/pipeline/test_pipeline_integracao.py`, e a causa é a mesma:
a fonte documental mudou por fora em 16/09 e não foi reprocessada, então
`backend/pipeline/steps/normalize.py` chama `.isoformat()` sobre um `str`. Os 115 que
passam cobrem API, serviços e contratos. Reexecutar tudo antes de cada commit.

---

## Como abrir o dashboard

```powershell
cd "C:\caminho\exemplo\dashboard-juridico"
.\scripts\start_dev.ps1        # sobe API + frontend e abre o navegador
```

Dashboard: http://127.0.0.1:5173 · API: http://127.0.0.1:8000/api/v1 ·
OpenAPI: http://127.0.0.1:8000/docs
Parar: `.\scripts\stop_dev.ps1` · Atualizar dados: `.\scripts\refresh_data.ps1`

---

## O que existe

| Item | Estado |
|---|---|
| Repositório Git próprio, `.gitignore`, `.gitattributes`, `.env.example` | ✅ |
| `CLAUDE.md`, `README.md`, `STATE.md`, 8 documentos em `docs/` | ✅ |
| `config/regras_negocio.json` v2 — regras confirmadas, versionado | ✅ |
| `scripts/01_discovery.py` — profiling somente-leitura, 16 verificações | ✅ |
| **Pipeline** — `source_guard`, snapshot, extract, validate, normalize, load | ✅ Fase 2 |
| **API FastAPI** — 17 endpoints, envelope com `meta` de proveniência | ✅ Fase 3 |
| **Design system** — tokens, light/dark, primitivos, wrappers ECharts | ✅ Fase 4 |
| **Capa executiva** (`/`) — branding Programa/Parceiro/Fundo, entrada por animação CSS | ✅ Fase 7 |
| **Visão Geral** (`/painel`) | ✅ Fase 5 · redesenhada V2 |
| **Acervo Documental** (`/documentos`) com ficha do documento | ✅ Fase 6 · redesenhado V2 |
| **Portfólio Jurídico** (`/portfolio`) | ✅ Fase 7 |
| **Linha do Tempo** (`/linha-do-tempo`) | ✅ Fase 7 |
| **Destinatários** (`/destinatarios`) | ✅ Fase 7 |
| **Rodovias & Contratos** (`/rodovias`) | ✅ Fase 7 |
| **Governança** (`/governanca`) — fora do menu, acessível por URL | ✅ |
| Identidade V2 — paleta institucional, cor com significado, claro/escuro | ✅ `docs/VISUAL_REDESIGN.md` |
| Testes: 134 Python + 28 frontend | ✅ |
| `start_dev.ps1`, `stop_dev.ps1`, `refresh_data.ps1`, `02_rebuild.py` | ✅ |

**Configuração local** (não versionada, já criada nesta máquina): `config/config.json`,
`.env`, `frontend/node_modules`, `data/`.

---

## Números do último ciclo (11/09/2026)

| Medida | Valor |
|---|---|
| Documentos indexados no modelo | 397 (392 ativos, 5 excluídos) |
| **Lacunas de indexação** | **0** |
| **Pendentes de reconciliação** | **0** |
| `indexed_as_of` | 11/09/2026 09:24 |
| `physical_scan_as_of` | 11/09/2026 13:11 |
| Vínculos documento↔tema | 553 |
| Documentos com rodovia | 182 |
| Documentos com contrato | 163 |
| Matéria sancionatória | 75 (fecha com a soma da série mensal) |
| Macrogrupo | 44 não classificados |
| Achados de qualidade | 15 média · 8 baixa · 15 informativo · **0 alta** |

**Estes números têm prazo de validade.** A fonte muda ao longo do dia — em uma tarde o
acervo passou por 215 → 259 → 291 → 324 → 389 documentos. Rode
`.\scripts\refresh_data.ps1` e confira `/api/v1/meta` antes de concluir qualquer coisa.
Nenhum número aparece hardcoded na aplicação.

---

## Decisões da usuária já incorporadas

| Tema | Decisão | Registro |
|---|---|---|
| Pasta `Minuta/` | está no escopo, indexada | `DISCOVERY.md` §7 |
| Contrato ↔ rodovia ↔ executora | **confirmado** (11→RD-103/Alfa · 12→RD-102A/Beta · 13→RD-101/Gama · 14→RD-104/Delta) | `DEC-010` |
| `Empreiteiras` | destinatário válido; ausência na `LISTAS_APOIO` é diferença, não erro | `DEC-017` |
| `RD-102` | sem `B` explícito → `RD-102A`. Não é mais ambíguo | `DEC-010` |
| **Q7** — `Minuta` | `estagio_documental` separado do macrogrupo; matéria derivada do tema | `DEC-019` |
| **Q8** — `CMA` | preservado como está; `status_taxonomia = pendente_de_validacao` | `DEC-022` |
| **Q9** — `Despacho/` vazia | "categoria existente, atualmente sem documentos", `info` | `DEC-022` |
| **Q10** — Contencioso | corte dentro das páginas existentes, sem página própria | `DEC-023` |
| Fonte viva | snapshot consistente por ciclo, com hash/tamanho/mtime/timestamp | `DEC-020` |
| Dois relógios | `indexed_as_of` + `physical_scan_as_of` + pendentes | `DEC-021` |
| `backups/` do projeto vizinho | não usar; projetos desacoplados | `DEC-012` |
| `Parceiro` e `Comissão Legislativa` | exibir sem expansão | `DEC-017` |

---

## Golden Screen — Linha do Tempo (semana, mês e ano)

`http://127.0.0.1:5173/linha-do-tempo` · detalhes em `docs/GOLDEN_SCREEN_TIMELINE.md`

**Aprovada visualmente pela usuária e commitada**, escala por escala, entre 18 e
21/09/2026. As três escalas são a MESMA tela: o que muda é o que uma coluna
representa.

| Escala | Coluna | Quantas | Objeto |
|---|---|---|---|
| Semana | um dia | 7 | folha / pilha de papel |
| Mês | uma semana do mês | 4 a 6 | folha / pilha de papel |
| Ano | um mês | 12 | armário de 1 a 4 gavetas |

O recorte do tempo vive em `features/timeline/escalas.ts`; dali para baixo nenhum
componente sabe em que escala está — `TimelineDay` recebe uma `Coluna` com rótulos
prontos, documentos já distribuídos e a família da arte a desenhar.

Abaixo do eixo mora o **gráfico analítico** (`TimelineChart.tsx`): duas séries de
segmentos retos — documentos em cyan, acumulado em roxo, este claramente
secundário —, sem card, sem fundo e sem repetir rótulo. Ele compartilha a mesma
grade e os mesmos valores de movimento do trilho, então o alinhamento horizontal
é 0,00 px por construção, não por ajuste.

O que está implementado e deve ser preservado:

| Mecanismo | Estado |
|---|---|
| Granularidade **diária** no backend (`/timeline?granularidade=dia`) | implementada, com 2 testes |
| Documento com precisão **apenas mensal** NÃO entra artificialmente no dia 01 | garantido no backend e no frontend |
| Radix Popover + `Portal` | obrigatório — sem ele o `overflow-hidden` recorta a prévia |
| Motion | mantido, **só para transformação** (arraste, mola, leque), nunca para revelar conteúdo |
| Arraste horizontal com inércia e limites | mantido |
| Travel through time (700–1000 ms, acelera e desacelera) | mantido |
| Deep-link `?dia=AAAA-MM-DD` | mantido |
| `prefers-reduced-motion` + `?static=1` | mantido |
| Link real do SharePoint no "Abrir documento" | mantido, vem de `/documents/{id}` |
| Três escalas derivadas de `escalas.ts` | semana, mês (em semanas) e ano (em armários) |
| Gráfico integrado, alinhado pela mesma grade do trilho | 0,00 px em 1920/1440/1366 |
| Atenção compartilhada (`ativa` no `LegalTimeline`) | hover no gráfico acende a coluna e vice-versa |
| Animação de entrada em CSS, nunca em JS | keyframe com estado de repouso VISÍVEL |

**Regra que vale para qualquer mudança futura aqui:** animação em JS não pode
governar geometria nem visibilidade. Já custou caro três vezes — ver as armadilhas
em `docs/SESSION_HANDOFF.md`.

---

## Visão Geral — painel analítico com cross-filter

`http://127.0.0.1:5173/painel`

**É agora a ÚNICA aba de panorama.** Portfólio e Destinatários deixaram de ser páginas:
todo o conteúdo dos dois vive aqui, em blocos. As rotas antigas continuam respondendo e
redirecionam, para não quebrar link salvo.

A composição, de cima para baixo:

| Faixa | O que responde |
|---|---|
| 4 indicadores | quanto existe · de quantos tipos · quanto saiu no ano · quanto pede atenção |
| Matéria + Temas | o que o acervo É (treemap) e sobre o que ele FALA (bolhas) |
| Produção por mês | quando foi produzido — colunas empilhadas com a linha do total |
| Destinatários + Atividade | para quem se escreve (anel) e o último acontecido |
| Naturezas em detalhe | participação (barra) · alcance (ponto) · documentos |

### Cross-filter: NÃO existe estado novo

A fonte da verdade do recorte é a **URL**, desde a `DEC-011`. `useFilters` já acumulava
dimensão, alternava valor, removia chip, limpava tudo e sobrevivia a recarregar e a
compartilhar link. Um `GlobalDashboardFilterState` ao lado dele seria uma segunda fonte
de verdade sobre a mesma coisa — e é assim que se produz tela que discorda de si mesma.

O que faltava, e mora em `features/overview/cruzamento.ts`, é o **vocabulário do
gráfico**: um gráfico clica em "Sancionatório", não em `macrogrupo=Sancionatório`; clica
num mês, não num par de datas. Um lugar só conhece essa tradução, e nenhum gráfico
conhece outro gráfico.

```
GRÁFICO -> aplicar(dimensão, valor) -> URL -> queries -> TODOS os gráficos
```

Tempo **troca** em vez de acumular: dois períodos ao mesmo tempo seriam uma união que a
API não expressa com um intervalo só.

### Arquitetura da tela

```
OverviewPage.tsx        composição das faixas + gavetas de detalhamento
  cruzamento.ts         dimensão visual -> chave de filtro   <- a tradução mora aqui
  blocos/indicadores    os quatro cartões da primeira faixa
  blocos/portfolio      matéria (treemap) · temas (bolhas) · tabela de naturezas
  blocos/relacoes       destinatários (anel) · naturezas em detalhe
  blocos/destinatarios  cada parte em detalhe (dentro da gaveta)
charts/painel.tsx       anel, treemap, bolhas, barra de parte
charts/naturezas.tsx    barra + ponto, em DOM
charts/relacoes.tsx     barras radiais
charts/empacotamento.ts posição das bolhas, calculada e determinística
lib/cores.ts            mapa semântico de cor                <- cor é categoria
```

### Regras que valem para qualquer mudança aqui

**Cor é categoria, nunca posição.** O mapa anterior atribuía cor pela ordem de chegada, e
a ordem vinha do volume: bastava um filtro mudar o ranking para Contratual herdar a cor
que era do Sancionatório um segundo antes. `lib/cores.ts` fixa as sete matérias por nome,
com Sancionatório em âmbar — que é atenção, não erro — e Não classificado em aço neutro.
Tema não tem mapa fixo (são 20 e crescem): a cor sai de um hash do próprio nome, que não
é semântica mas é estável.

**Nada de métrica inventada.** Não há campo de complexidade, nem período anterior
comparável para uma variação percentual. Onde a referência visual pedia um número que não
existe, a resposta foi trocar a dimensão, não fabricá-la.

**Alcance é contagem, não percentual.** `count(DISTINCT d.destinatario)`. Por isso a barra
de participação e o ponto de alcance têm faixas e réguas separadas — na mesma régua, 27% e
16 destinatários pareceriam comparáveis. E destinatários distintos **não se somam**: a
mesma parte recebe minuta, ofício e advertência, então a linha "Outras naturezas" tem
barra e contagem mas não tem ponto.

### O que foi retirado, e por quê

| Bloco | Motivo |
|---|---|
| "Necessidade de resposta" (rosca) | 394 documentos num único nível dos 5 previstos: zero variabilidade |
| Composição do acervo (treemap antigo) | dizia por área o que a tabela de naturezas diz por linha |
| Concentração temática | duplicava "Temas do acervo" |
| Cruzamento destinatário × matéria | pedido da usuária, depois de ver em tela |
| Calendário de intensidade e matéria × mês | pedido da usuária |
| Fluxo do acervo (Sankey) | pedido da usuária |

**Se o Sankey voltar,** a regra que ele respeitava precisa voltar junto: ele NÃO afirmava
o cruzamento triplo destinatário × natureza × matéria, e sim duas travessias independentes
do `/matrix`. `Minuta` sozinha se espalha por sete matérias e `Ofício / Carta` por cinco —
natureza não determina matéria, e compor as duas para afirmar um caminho inteiro seria
inventar um número que ninguém contou.

### Vídeo de ambiente

A página tem vídeo de fundo, como a Linha do Tempo, mas a camada é `sticky` com margem
negativa e **não** `fixed`: `PageTransition` envolve a página numa animação, e ancestral
com `transform` vira bloco de contenção — o `fixed` passaria a se medir por ele em vez da
janela. Os cartões desta página ficam a 82% com desfoque próprio (classe `.com-ambiente`),
senão o vídeo só apareceria nas frestas. O `backdrop-filter` custa caro em área grande e
por isso está preso a esta página, fora da classe `.card` global.

---

## Problemas visuais da Linha do Tempo — RESOLVIDOS (histórico)

Lista levantada pela usuária na avaliação visual de 16/09 e **fechada** entre 17 e
21/09. Fica registrada porque explica por que a tela é como é hoje:

1. página ainda parece dashboard com timeline;
2. vídeo jurídico tímido;
3. glass ainda opaco / chapa escura;
4. espaço morto;
5. total semanal parecendo KPI solto;
6. filtros competindo com a timeline;
7. documentos/pilhas artificiais;
8. magnitude pouco distinta;
9. falta conexão documento → node;
10. track fraco;
11. selected state pesado;
12. node info card precisa refinamento;
13. popovers invadem safe zones;
14. single preview precisa ser mais visual;
15. multi preview precisa parecer pilha abrindo;
16. "Ver mais" deve futuramente preservar o contexto temporal;
17. empty week precisa de estado próprio;
18. drag / edge navigation precisam de affordance;
19. travel precisa ser percebido fisicamente;
20. motion language ainda está insuficiente.

---

## Plano de correção da Linha do Tempo — CONCLUÍDO

| Fase | Escopo | Estado |
|---|---|---|
| **1** | Composição + background + glass | entregue (§13) |
| **1.1 + 2A** | Vídeo nítido + documentos reais + magnitude | entregue (§14) |
| **2B + 3A** | Track, conexão, selected, popovers, safe zones | entregue (§15) |
| **4 + 5 + 6** | Motion, navegação temporal, empty states, drawer | entregue (§16) |
| **Escalas** | Mês em semanas, ano em armários | entregue (§17) |
| **Gráfico** | Camada analítica integrada ao eixo | entregue |

Seções em `docs/GOLDEN_SCREEN_TIMELINE.md`. A partir daqui o trabalho é **uma
correção por vez**, com aprovação visual da usuária antes de cada commit.

---

## Higgsfield — integração, autorização e segurança

Governança em `DEC-031` (exceção autorizada) e `DEC-032` (`soul-id` proibida).

**Integração**

- `@higgsfield/cli` v1.1.25 instalado globalmente (binários `higgs` e `higgsfield`);
- autenticação **OAuth 2.0 PKCE concluída**; credencial local em `~/.higgsfield`;
- workspace selecionado: `00000000-0000-0000-0000-000000000000` (Private, plano free);
- **8 skills instaladas** via `npx skills add higgsfield-ai/skills`;
- `.agents/` **ignorado** no Git; symlinks `.claude/skills/higgsfield-*` **ignorados**;
- `skills-lock.json` **permanece versionável** — manifesto com hash, garante
  reprodutibilidade;
- o postinstall do npm **não** foi aprovado: o binário se instalou sob demanda;
- **`soul-id` é PROIBIDA** (`DEC-032`) — sem treino, geração ou identificação por rosto,
  sem biometria, sem imagem de colaborador, advogado, cliente ou terceiro;
- Higgsfield autorizado **somente** para asset visual sintético;
- **Higgsfield NÃO é dependência de runtime.** Nada no `backend/` nem no `frontend/`
  chama o serviço em execução — o que entra no produto é o arquivo de imagem revisado.

**Segurança — NUNCA enviar ao Higgsfield**

documento real · PDF · screenshot documental · qualquer derivado do acervo ·
`00 Indice.xlsx` · nomes · assuntos · nomes de arquivos · metadados · textos jurídicos ·
logos internos (Escritório Jurídico, Parceiro, Programa) · qualquer conteúdo confidencial.

**Somente prompts visuais sintéticos. Sem upload de arquivo.**

---

## Fase 0.5 — asset direction do documento-base

```
output/asset-exploration/legal-document-base/
  A-editorial-minimalista.png      768x1024
  B-institucional-premium.png      768x1024
  C-materialidade-juridica.png     768x1024
  A-descartada-virou-pilha.png     1a tentativa de A: saiu como bloco em 3/4
  prompts.txt                      prompt base + 3 clausulas + registro de seguranca
output/asset-exploration/
  comparacao-documento-base.png    montagem A|B|C em 3 tamanhos sobre fundo escuro
  montar_comparacao.py             script da montagem (recorte + composicao)
```

**Modelo.** `gpt_image_2_5` foi a primeira escolha (transparência nativa, proporção 2:3),
mas exige plano **Basic** — `job_minimum_basic_plan_required`. `recraft_v4_1` e
`nano_banana` caem no mesmo bloqueio.

Usado: **`flux_2` / FLUX.2**, `aspect_ratio=3:4`, `resolution=1k`, **1 crédito** por
geração. Sem transparência nativa (daí a placa neutra) e **sem `seed` exposta** — a
consistência entre A, B e C vem de prompt base idêntico, não de seed.

**Créditos.** Começou com **10**, consumidos **5**, restam **5**.

> **1 crédito foi desperdiçado** num probe `grok_image` com o prompt `"test"`, usado para
> descobrir quais modelos o plano free aceitava. **Não repetir esse erro.** Antes de
> qualquer próxima geração: usar o **prompt real já na primeira chamada válida**, para
> que um acerto vire asset em vez de lixo.

**Avaliação**

| | Leitura |
|---|---|
| **A — Editorial Minimalista** | boa leitura pequena; mais genérico; quase vetorial; **boa base para empilhamento** (não tem dobra) |
| **B — Institucional Premium** | **melhor equilíbrio geral**; boa hierarquia; boa leitura pequena; **candidato preferencial atual** |
| **C — Materialidade Jurídica** | maior realismo; textura boa no tamanho grande, mas parte dela se perde na escala da timeline; dobra muito dominante |

**Problemas descobertos**

- sombra **rasterizada** no render não deve ser usada como sombra final;
- a sombra deve ser criada em **CSS**;
- o fundo cinza do FLUX.2 dificulta o recorte;
- o cinza do cabeçalho de B/C é tonalmente quase idêntico ao fundo (**B: +3,3** de
  luminância; **C: −5,7**);
- limiar simples não resolve;
- flood fill também falha, por regiões conectadas através da fresta da dobra;
- fechamento morfológico não resolveu completamente;
- produção precisa de **segmentação real** OU de geração futura sobre **fundo cromático
  saturado**.

### Fase 0.5B e 0.5C — B2 e B3

| | |
|---|---|
| **B2** — sem dobra, fundo cromático | **reprovado.** Saiu como bloco espesso em três-quartos: uma resma, não folha única. Mesma falha da 1ª tentativa de A |
| **B3** — frontal, folha única, fundo cromático | **APROVADO como documento-base oficial provisório** (17/09/2026) |

O que fez B3 funcionar, depois de B2 ter falhado: saiu `standing upright` (atrator de
mockup de livro em pé) e saiu `readable sheet thickness`, trocado por *hairline edge, one
or two pixels wide, no side face, no bottom face, no visible volume*.

**Arquivos de B3**

```
output/asset-exploration/legal-document-base/
  B3-institucional-premium-frontal.png             original, NUNCA alterar
  B3-institucional-premium-frontal-recortado.png   fundo cromático removido, 512x756
output/asset-exploration/
  comparacao-b-b2-b3.png         B | B2 | B3 em prévia, 114 px e 66 px
  comparacao-b-vs-b3-uso.png     B x B3 só nos tamanhos reais
  recorte.py                     as duas técnicas de recorte
  montar_comparacao_b3.py        montagem da fase 0.5C
```

**Qualidade do recorte, medida.** Verdice (`G − max(R,B)`) do fundo 169 contra máximo 18
no objeto; verde residual no objeto 0,0; luminância média da borda interna 221,7 contra
223,7 do miolo — **não sobrou franja de sombra**; ~1 px de antialias no perímetro. Zero
furo, zero halo, nenhum fechamento morfológico. **O fundo cromático saturado fica como
método obrigatório de qualquer geração futura de asset.**

**Ressalva aceita pela usuária.** O corpo do texto de B3 saiu como **pseudo-letra**
(glifos ilegíveis formando falsas palavras), não como barra cinza abstrata; a textura do
papel também ficou mais rugosa que a de B. Não há palavra real, nome, número nem nada
legível. Em 114 px, 66 px e na miniatura de 110–150 px do popover a pseudo-letra vira
mancha tipográfica e desaparece. **Isso NÃO justifica nova geração.** Se um dia
incomodar, cobrir/substituir localmente por barras abstratas em SVG/CSS.

**Como B3 entra no produto**

- B3 será a **capa realista** da pilha;
- as **folhas inferiores** da pilha são feitas em **CSS/SVG** no frontend;
- **não** gerar pilhas no Higgsfield (XS/S/M/L/XL) — repetir o mesmo PNG é desperdício;
- **não** gerar família documental agora.

**Fase 0.5 CONCLUÍDA.** Saldo Higgsfield: **3 créditos**, a preservar. Nenhum crédito
novo pode ser gasto sem autorização explícita da usuária.

---

## Fonte documental alterada externamente — 16/09/2026

`00 Indice.xlsx` foi alterado por fora, por volta de **08:00 de 16/09**.

| | |
|---|---|
| Hash atual | `2c4f26f1…` |
| Tamanho atual | 57.344 bytes |
| Hash do último snapshot (14/09) | `54d6d197…` |
| Tamanho anterior | 66.403 bytes |

**A alteração NÃO foi produzida por esta sessão** — nenhum artefato `~$`/`.tmp`/`.lock`
na fonte, e a sessão só fez leitura. O índice **encolheu** cerca de 9 KB, o que é
incomum.

**Mudou DE NOVO em 17/09/2026, por volta das 09:33** — agora com **79.918 bytes** e
`sha256 a1034e7f…`. Também não foi esta sessão: nenhum artefato `~$`/`.tmp`/`.lock` na
pasta e o acesso continua sendo só de leitura.

**`refresh_data.ps1` ainda NÃO deve ser executado.** Assunto a investigar separadamente.
**Não misturar atualização da fonte com o redesign da Linha do Tempo.**

---

## Rodovias — uma rodovia por vez

`http://127.0.0.1:5173/rodovias`

Eram quatro cartões simultâneos numa grade 2x2. Agora é uma **régua de abas** e **um
painel do tamanho da página**: header editorial (ícone, código, contrato, executora,
contagem), três indicadores de apoio, naturezas predominantes e evolução mensal lado a
lado, atividade recente e o CTA para o acervo daquela rodovia.

**A decisão estrutural está na `DEC-034` e precisa ser lida antes de mexer aqui:** a aba
não tem estado próprio — ela É o filtro `rodovia` da URL. A consequência é que a consulta
desta página **ignora a dimensão rodovia**; nela essa dimensão seleciona, não recorta.

```
RoadsPage.tsx          composição: indicadores do programa + régua + painel
  rodovias.ts          acento, ordem da régua, aba ativa, filtros da consulta  <- as regras
  RodoviaTabs.tsx      tablist com foco rovingo, setas, Home/End, indicador que desliza
  PainelDaRodovia.tsx  um componente para todas as rodovias, sem JSX por rodovia
```

A régua é **alfabética** e não se mexe quando um filtro muda o ranking; a **abertura** é
a obra de maior volume. O acento é fixo por nome (`DEC-033`).

---

## Próximo passo imediato

**Aguardando o próximo ajuste visual da usuária.** Não há tarefa técnica pendente e
bloqueante: a sessão encerrou com a árvore limpa e a validação registrada acima.

O fluxo é o de sempre, e vale para tudo nesta fase: **uma correção por vez** — alterar só
o necessário, testar, mostrar o resultado, **não commitar**, esperar o "aprovado, pode
commitar", e então um commit atômico só daquilo.

### Pendências conhecidas, nenhuma bloqueando a tela

| Pendência | Natureza |
|---|---|
| Fonte documental mudou por fora em 16/09 e não foi reprocessada | é o que deixa `pytest` vermelho; `refresh_data.ps1` continua sem rodar, por decisão |
| `max(macrogrupo_juridico)` devolve representante ARBITRÁRIO, não dominante | `Ofício / Carta` aparece como Sancionatório embora só 5 dos 61 o sejam; corrigir é backend |
| Gaveta de detalhamento (`ui/gaveta.tsx`) verificada só no código | nunca foi aberta no navegador |
| Foco visível das abas de Rodovias | implementado, nunca confirmado em tela |
| `legal-ambient.mp4` e `doc-base.png` órfãos | 15,8 MB de vídeo versionado no total |
| `CLAUDE.md` §5.5 contradiz o repositório | os renders do parecer trazem nomes legíveis e entraram no Git com autorização verbal; falta registrar em `docs/DECISIONS.md` |
| `docs/VISUAL_REDESIGN.md:16` tem caminho pessoal | redigir antes de qualquer push |

---

## Limitações conhecidas

| Limitação | Nota |
|---|---|
| Bundle do frontend em ~1,07 MB (343 KB gzip) | ECharts é a maior parte. Code-splitting por página fica para a Fase 8 |
| Sem teste ponta a ponta (Playwright) | Fase 8. Hoje há 134 testes Python + 28 frontend + smoke manual |
| Macrogrupo é camada derivada | fora dos KPIs principais por decisão (`DEC-019`) |
| Validação HTTP dos hyperlinks | Fora de escopo: exigiria autenticação no SharePoint e tráfego externo |
| `Necessidade resposta` não diferencia | 394 registros no nível 1: o bloco declara isso e não finge análise |
| Documento sem rodovia identificável | Limite do dado. Exibido como ausência, nunca convertido em "Geral" (`DEC-026`) |
| `estagio_documental` fora da interface | Continua no modelo e na API; saiu da UI por pedido da usuária |

---

## Riscos ativos

| Risco | Mitigação |
|---|---|
| Escrita acidental na fonte | `source_guard` recusa destino sob a fonte; teste compara o inventário antes/depois de cada ciclo |
| A fonte muda rápido | Snapshot por ciclo (`DEC-020`); todo número carrega `ciclo_id` e os dois relógios |
| Layout de `00 Indice.xlsx` mudar | Contrato estrutural bloqueante: o pipeline aborta com código 2 e não grava nada |
| Extração por regex gerar dado falso | Já aconteceu (`DEC-014`): regex por campo + guarda de regressão para `RD-250/251/260` |
| Dado pessoal de terceiro em commit | `.gitignore` + regra em `CLAUDE.md` §5; nomes anonimizados na documentação |
| Número errado silencioso na tela | Testes de reconciliação fonte → modelo → API para cada KPI |
| Commit acidental | `CLAUDE.md` §6: nunca commitar sem pedido explícito |

---

## Como retomar (checklist)

```powershell
# 1. contexto
#    CLAUDE.md -> STATE.md -> config/regras_negocio.json -> docs/DECISIONS.md
git log --oneline -20
git status

# 2. reconferir a fonte (ela muda rápido) e reconstruir os dados
.\scripts\refresh_data.ps1

# 3. subir e olhar
.\scripts\start_dev.ps1

# 4. rodar as validações antes de propor qualquer mudança
python -m pytest tests -q
cd frontend; npm run typecheck; npm run lint; npm run test; cd ..

# 5. só então propor trabalho novo, seguindo docs/ROADMAP.md
```
