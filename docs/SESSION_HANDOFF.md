# Session Handoff

> Mapa de retomada rápida depois de um `/compact`. Não é README.
> Contexto completo: `STATE.md`. Decisões: `docs/DECISIONS.md`.
> Atualizado em 22/09/2026, no encerramento da sessão *2- Painel Analítico e Rodovias*.

## Onde estamos

A Linha do Tempo é a tela principal do produto e está **aprovada visualmente**, escala
por escala, e commitada. As três escalas são a MESMA tela — o que muda é o que uma
coluna representa:

| Escala | Coluna | Quantas | Objeto |
|---|---|---|---|
| Semana | um dia | 7 | folha / pilha de papel |
| Mês | uma semana do mês | 4 a 6 | folha / pilha de papel |
| Ano | um mês | 12 | armário de 1 a 4 gavetas |

Abaixo do eixo mora o **gráfico analítico**: documentos em cyan, acumulado em roxo
(secundário), segmentos retos, sem card e sem repetir rótulo. Ele usa a mesma grade e
os mesmos valores de movimento do trilho — alinhamento 0,00 px por construção.

Arquitetura da tela, para não redescobrir:

```
TimelinePage.tsx      âncora + escala + dados (/documents recortado pelo período)
  escalas.ts          recorta o tempo em colunas e rotula   <- a regra mora aqui
  LegalTimeline.tsx   trilho, largura da coluna, arraste, travel, atenção compartilhada
    TimelineDay.tsx   uma coluna: contagem, arte, haste, node, rótulos, popovers
    TimelineChart.tsx o gráfico, na mesma grade
  magnitude.ts        quantos documentos viram que objeto (papel e armário)
```

A **Visão Geral** foi redesenhada e virou a ÚNICA aba de panorama: Portfólio e
Destinatários deixaram de ser páginas e todo o conteúdo dos dois vive nela. As rotas
antigas redirecionam.

| Faixa da Visão Geral | O que responde |
|---|---|
| 4 indicadores | quanto existe · de quantos tipos · quanto saiu no ano · quanto pede atenção |
| Matéria (treemap) + Temas (bolhas) | o que o acervo é, e sobre o que ele fala |
| Produção por mês | colunas empilhadas com a linha do total |
| Destinatários (anel) + Atividade recente | para quem se escreve, e o último acontecido |
| Naturezas em detalhe | participação (barra) · alcance (ponto) · documentos |

**Cada clique filtra a página inteira**, e o estado é a URL — o mesmo `useFilters` da
`DEC-011`. NÃO existe store paralelo. O que existe é `features/overview/cruzamento.ts`,
que traduz a dimensão do gráfico para a chave de filtro:

```
OverviewPage.tsx        composição das faixas + gavetas de detalhamento
  cruzamento.ts         dimensão visual -> chave de filtro   <- a tradução mora aqui
  blocos/indicadores    os quatro cartões da primeira faixa
  blocos/portfolio      matéria · temas · tabela de naturezas (gaveta)
  blocos/relacoes       destinatários · naturezas em detalhe
charts/painel.tsx       anel, treemap, bolhas, barra de parte
charts/naturezas.tsx    barra + ponto, em DOM
charts/empacotamento.ts posição das bolhas, calculada e determinística
lib/cores.ts            mapa semântico de cor                <- cor é categoria
```

A **página Rodovias** virou régua de abas + um painel por rodovia. A regra que
precisa ser entendida antes de mexer ali está na `DEC-034`: **a aba não tem estado
próprio, ela É o filtro `rodovia` da URL**, e por isso a consulta dessa página ignora
essa dimensão — nela a rodovia seleciona, não recorta.

```
RoadsPage.tsx          indicadores do programa + régua + painel
  rodovias.ts          acento, ordem da régua, aba ativa, filtros da consulta
  RodoviaTabs.tsx      tablist: foco rovingo, setas, Home/End, indicador que desliza
  PainelDaRodovia.tsx  um componente para todas as rodovias
```

A fonte documental mudou por fora em 16/09 e **não** foi reprocessada — assunto
separado, e é por isso que `pytest tests` está vermelho.

## O que está aprovado

- Governança do Higgsfield (`DEC-031`) e proibição da `soul-id` (`DEC-032`).
- Arquitetura, backend, pipeline, dados reais, API e testes da aplicação.
- A Linha do Tempo inteira: semana, mês, ano e o gráfico integrado.
- A Visão Geral redesenhada, com cross-filter global.
- A página Rodovias em régua de abas + painel único.
- Os renders do parecer e os quatro armários como assets do produto.

## O que NÃO está aprovado

- Nada em aberto. O trabalho segue **um ajuste por vez**, com aprovação visual da
  usuária antes de cada commit.

## Não mexer

- **Fonte documental** (`00 Indice.xlsx` e a pasta Escritório Jurídico): somente leitura, sempre.
- **Não rodar `refresh_data.ps1`** — a mudança externa de 16/09 é assunto separado.
- **Não commitar, não fazer push**, sem pedido explícito. Sem `reset`/`checkout`/`clean`.
- **Não gerar** asset novo no Higgsfield: os renders do parecer e dos armários vieram
  da usuária, e os 3 créditos restantes continuam intocados.
- **Não commitar `STATE.md`/`SESSION_HANDOFF.md`** junto com funcionalidade: commit
  `docs:` separado.
- **Não refatorar** o que já está aprovado sem pedido — a tela passou por oito ajustes
  aprovados um a um.
- **Não enviar ao Higgsfield:** documento real, PDF, screenshot documental,
  qualquer derivado do acervo, `00 Indice.xlsx`, nomes, assuntos, nomes de arquivo, metadados,
  textos jurídicos, logos internos, nada confidencial. Sem upload de arquivo.

## Higgsfield

| | |
|---|---|
| CLI | `@higgsfield/cli` v1.1.25, global (`higgsfield`, `higgs`) |
| Auth | OAuth PKCE concluída (`~/.higgsfield`) |
| Workspace | `00000000-0000-0000-0000-000000000000` — Private, plano **free** |
| **Créditos restantes** | **3** (de 10; 7 consumidos, sendo **1 desperdiçado**) — **preservar** |
| Modelo utilizável | `flux_2` — `gpt_image_2_5`, `recraft_v4_1` e `nano_banana` exigem plano Basic |
| Skills | 8 instaladas; `.agents/` e `.claude/skills/higgsfield-*` ignorados; `skills-lock.json` versionado |
| `soul-id` | **PROIBIDA** |

**Lição paga:** o crédito perdido foi num probe com prompt `"test"`. Em qualquer geração,
**usar o prompt real na primeira chamada válida**.

**Nenhum crédito novo pode ser gasto sem autorização explícita da usuária.** Em
particular: **não** gerar pilhas (XS/S/M/L/XL) nem família documental — a pilha é B3 como
capa mais folhas inferiores em CSS/SVG.

## Assets

```
output/asset-exploration/legal-document-base/
  B3-institucional-premium-frontal.png            APROVADO · original, nunca alterar
  B3-...-frontal-recortado.png                    APROVADO · sem fundo, 512x756
  B-institucional-premium.png                     descartado · dobra impede empilhar
  B2-...-sem-dobra.png (+ recortado)              reprovado · saiu resma
  A-editorial-minimalista.png                     descartado · genérico
  C-materialidade-juridica.png                    descartado · dobra dominante
  A-descartada-virou-pilha.png                    1ª tentativa de A (bloco em 3/4)
  prompts.txt                                     todos os prompts + resultados
output/asset-exploration/
  comparacao-documento-base.png   A|B|C
  comparacao-b-vs-b2.png          B x B2
  comparacao-b-b2-b3.png          B | B2 | B3
  comparacao-b-vs-b3-uso.png      B x B3 em 114 e 66 px
  recorte.py  montar_comparacao*.py
```

**O B3 não é mais usado.** Em 18/09 a usuária entregou seis renders reais do parecer
e, em 21/09, quatro renders de armário. São esses que estão no produto:

```
frontend/public/brand/
  parecer-folha.png                 1 documento (folha avulsa, retrato)
  parecer-pilha-xs.png              faixas xs e s
  parecer-pilha-m.png  -l.png  -xl.png
  armario-1.png .. armario-4.png    o mês, na visão anual
  doc-base.png                      ÓRFÃO — nenhuma referência no código
```

Os pipelines locais que os prepararam estão em `output/asset-exploration/`
(`preparar_parecer.py`, `preparar_armarios.py`) — a pasta é gitignorada.

Duas coisas que o preparo dos armários resolveu e que valem para qualquer render
futuro: o webp entregava o móvel com alfa entre 201 e 254, e sobre o vídeo isso lê
como fantasma; e cada render preenchia o quadro, então normalizar pela LARGURA é o
que devolve a leitura física da família.

A sombra dos renders é rasterizada e **não** serve como sombra final — sombra é CSS.

## Próxima tarefa EXATA

**Aguardando o próximo ajuste visual da usuária.** Não há tarefa técnica pendente e
bloqueante. Não antecipar nada, não refatorar nada por conta própria.

Se for preciso escolher algo por conta própria, a primeira da fila é **abrir a gaveta de
detalhamento no navegador** (`ui/gaveta.tsx`, botão "Ver detalhamento" na Visão Geral):
está implementada e verificada só no código, nunca aberta em tela.

Quando o ajuste chegar: alterar só o necessário, testar, mostrar o resultado,
**não commitar**, esperar o "aprovado, pode commitar", e então fazer um commit
atômico só daquilo.

## Estado Git

| | |
|---|---|
| Branch | `feat/timeline-golden-screen` |
| HEAD | `5beee06` — *feat(roads): uma rodovia por vez, numa regua de abas e um painel inteiro* |
| Árvore | **limpa** |
| Push | **nenhum** — o repositório não tem remote |

Histórico da branch, do mais novo para o mais antigo:

| Commit | O quê |
|---|---|
| `5beee06` | Rodovias: régua de abas e um painel por rodovia |
| `63e68e3` | documentação em dia com o painel |
| `871f532` | naturezas em barra e ponto; vídeo de ambiente; faixa de indicadores |
| `2498bfb` | calendário, matriz e Sankey fora; produção ganha a horizontal |
| `ba2b8d5` | **o painel vira exploração**: cross-filter global e doze formas novas |
| `b83cf2a` | KPIs de interlocução, cruzamento e matéria predominante fora |
| `4c12d4a` | três painéis viram um; Portfólio e Destinatários absorvidos |
| `b4c87fc` | documentação em dia com a Linha do Tempo |
| `5883262` | gráfico analítico integrado ao eixo |
| `98e29d9` | mês em semanas, ano em armários |
| `8bcd33a` | cabeçalho da Visão Geral fora |
| `6e387f9` | limpeza de blocos repetidos em Visão Geral e Portfólio |
| `741a9e8` | borda espera 4 s parada, ou responde a um clique |
| `e6ff77a` | "ir para uma data" na barra de filtros; período sobe |
| `ddf0be4` | painel de vidro fora; semana um corpo maior; vídeo novo |
| `6e687ee` | popover sobrevive ao trajeto do cursor até dentro dele |
| `0c6715e` | ícones trocados pelos renders reais do parecer |
| `fac1391` | baseline da visão semanal (123 arquivos) |
| `cd26fb5` | fundação do projeto + discovery (em `main`) |

### Fluxo de trabalho vigente, a partir do baseline

**Uma correção por vez.** Para cada uma: alterar só o necessário, testar, mostrar
o resultado, **não commitar**, esperar a usuária dizer "aprovado, pode commitar",
e só então fazer um commit atômico daquela correção. Nunca misturar duas
correções no mesmo commit sem autorização.

`STATE.md` e `docs/SESSION_HANDOFF.md` ficam FORA dos commits de funcionalidade e
entram num commit `docs:` próprio.

### Ajustes já percorridos

| # | Pedido | Situação |
|---|---|---|
| 1 | trocar os ícones pelos renders do parecer | commitado (`0c6715e`) |
| 2 | popover não pode sumir quando o cursor caminha até ele | commitado (`6e687ee`) |
| 3 | dia selecionado fixa os dois cards | **REPROVADO e revertido** — ver abaixo |
| 3b | tirar o vidro, aumentar a semana, vídeo novo | commitado (`ddf0be4`) |
| 4 | "ir para uma data" na barra de filtros; período sobe | commitado (`e6ff77a`) |
| 5 | borda espera 4 s parada, ou clique vai na hora | commitado (`741a9e8`) |
| 6 | enxugar Visão Geral e Portfólio | commitado (`6e387f9`) + (`8bcd33a`) |
| 7 | criar as versões mensal e anual | commitado (`98e29d9`) |
| 8 | gráfico analítico integrado | commitado (`5883262`) |
| 9 | juntar Visão Geral + Portfólio + Destinatários numa aba só | commitado (`4c12d4a`) |
| 10 | tirar KPIs de interlocução, cruzamento e matéria predominante | commitado (`b83cf2a`) |
| 11 | redesenho completo da Visão Geral com cross-filter | commitado (`ba2b8d5`) |
| 12 | tirar calendário, matriz e Sankey; produção sozinha na horizontal | commitado (`2498bfb`) |
| 13 | naturezas em barra + ponto; vídeo de ambiente; rodapé e sobretítulo fora | commitado (`871f532`) |
| 14 | proporção dos quatro indicadores da primeira faixa | commitado (`871f532`) |
| 15 | Rodovias: uma rodovia por vez, em abas | commitado (`5beee06`) |

**Sobre o ajuste 3, revertido.** O que existiu e foi desfeito, caso o pedido volte:
`emDocumento`/`emNode` passavam a incluir `selecionado`, os cards fixados ignoravam
clique fora (senão clicar dentro de um contaria como "fora" para o outro e os dois
sumiam juntos), Esc desfazia a seleção, e o card do documento migrava para o LADO
quando preso — porque em 1440x900 não há espaço acima da pilha e os dois cards caíam
um sobre o outro, ilegíveis. Saiu com `git restore`; não está no histórico.

## Armadilhas que já custaram tempo

**`<button>` não preenche a coluna do grid.** Controle de formulário dimensiona por
`fit-content` mesmo com `display: flex`. Dois dos quatro cartões da primeira faixa têm
clique, viram `<button>` e mediam 190 px dentro de um track de 385 — a sobra parecia
espaçamento errado do grid, e o grid estava certo. Cartão clicável precisa de `w-full`.

**`heatmap` em eixo cartesiano só pinta com `visualMap`.** Sem ele o ECharts monta os
eixos, não desenha célula nenhuma e não reclama.

**O canvas do ECharts não resolve `var(--x)`.** A cor sai transparente, silenciosamente.
Dentro de gráfico, use o token JÁ RESOLVIDO (`useChartTokens`); `var()` só no DOM.

**`CountUp` congelava no número errado.** A rede de segurança existia mas `finished` nunca
voltava a `false`: valia só para a primeira contagem, e numa aba que não pinta o número
ficava no valor anterior. Vi 68 onde o dado era 75.

**Escrita de arquivo no Windows pode dobrar a quebra de linha.** `charts/relacoes.tsx`
ficou com uma linha em branco entre cada linha do arquivo — compilava, e produziria 532
linhas de ruído no diff. Conferir com `split('\r\n')` e ver se as ímpares são vazias.

**Animação de gráfico não termina em aba que não pinta.** Uma captura do Sankey mostrou
só a primeira coluna; os dados estavam certos e o desenho também — era quadro incompleto.
Antes de tratar como defeito, confirmar pela API ou pelo DOM.

**O HMR do Vite serve quadro velho.** Uma captura chegou a mostrar o botão
"Ver mais" AUSENTE de um card; conferindo o DOM ao vivo ele estava lá, com
121x34 px, dentro do card. Antes de tratar qualquer coisa como defeito visual,
**confirmar no DOM**, não na imagem.

**Hover não se testa aqui.** O Chrome não entrega evento de mouse real a uma aba
que não está desenhando, e evento sintético não passa pela delegação do React —
`fireEvent.mouseEnter` não dispara `onMouseEnter`, porque o React deriva
enter/leave de `mouseover`/`mouseout`. Lógica de hover se testa em hook isolado
(ver `useFocoComCarencia.test.ts`), não dirigindo o componente em jsdom: a
tentativa por componente falhou e levou oito minutos.

**Animação em JS nunca governa geometria nem visibilidade.** Já mordeu três
vezes: opacidade presa em `initial`, dois períodos montados ao mesmo tempo, e os
sete nodes em 0x0 (aparecendo como pontos pretos). Tamanho e estado de repouso
são CSS; o Motion fica para transformação de verdade.

**O painel do navegador não desenha quando a janela está minimizada ou atrás.**
Sem quadros, `requestAnimationFrame` não dispara, transição de CSS não avança,
`ResizeObserver` não é entregue e a captura de tela falha ou devolve quadro velho.
Consequências práticas: medir `getComputedStyle` de algo em transição mente — leia o
`style` inline; e medida que dependa de `ResizeObserver` precisa de um
`window.addEventListener('resize', ...)` junto. Para capturar o estado de repouso,
`document.documentElement.classList.add('no-reveal')` desliga as animações de entrada.

**Medir o espaço livre pela caixa errada.** O gráfico media a folga até o rodapé da
SEÇÃO, que para em 600 px por causa do teto de altura da faixa — resultado: 108 px de
desenho e um terço da tela vazio embaixo. A área útil é a caixa da PÁGINA
(`data-area-grafico`). Antes de concluir que "não há espaço", conferir qual caixa está
sendo medida.

**`python -m pytest tests` está VERMELHO** — 115 passam, 1 falha, 20 erram, todos
em `tests/pipeline/`. Causa: a fonte mudou por fora e uma coluna de data agora
chega como texto, então `normalize.py:293` chama `.isoformat()` num `str`. Não é
regressão do frontend; é o assunto separado da fonte.

## Comandos úteis

```powershell
# subir a aplicação (os servidores estão derrubados)
.\scripts\start_dev.ps1
# Linha do Tempo: http://127.0.0.1:5173/linha-do-tempo

# regressão antes de qualquer commit
#   pytest está VERMELHO por causa da fonte alterada — ver as armadilhas
python -m pytest tests -q
python -m ruff check .
cd frontend; npx tsc -b; npx eslint src --max-warnings 0; npm run test

# Higgsfield: conferir saldo ANTES de gerar
higgsfield account status
higgsfield generate cost flux_2 --prompt "..." --aspect_ratio 3:4 --resolution 1k

cd frontend; npm run build            # o build também entra na regressão

# capturas: o HMR do Vite serve quadro velho, e o painel não desenha com a janela
# minimizada. Para o estado de repouso:
#   document.documentElement.classList.add('no-reveal')
#   ?dia=AAAA-MM-DD  abre o dia · ?qa=documentos|node|drawer  abre popover (só em dev)
```

**Atenção ao capturar:** o HMR do Vite quebra com frequência e serve módulo velho.
Reiniciar o dev server (`rm -rf node_modules/.vite` e subir de novo) antes de cada
rodada de captura.

---

## Registro de sessões

Histórico curto, uma entrada por sessão. O estado ATUAL fica em `STATE.md`; aqui fica o
que aconteceu, para uma sessão futura não precisar reconstruir o raciocínio.

### 2 — Painel Analítico e Rodovias · 21–22/09/2026

**Objetivo.** Continuar a lista de ajustes visuais da usuária, uma correção por vez.

**Resultados.** A Visão Geral absorveu Portfólio e Destinatários e virou a única aba de
panorama, com cross-filter global sobre a URL. A página Rodovias saiu de quatro cartões
simultâneos para régua de abas + painel único. Doze formas de gráfico novas entraram e
seis saíram por pedido ou por auditoria do dado.

**Decisões duráveis.** `DEC-033` (cor é categoria, nunca posição) e `DEC-034` (a aba de
rodovia é o filtro da URL, e a página não recorta por ela).

**Auditorias que mudaram o produto.** "Necessidade de resposta" saiu porque são 394
documentos num único nível dos cinco previstos — zero variabilidade. "Complexidade
média" não virou eixo porque o campo não existe. O Sankey, enquanto existiu, nunca
afirmou o cruzamento triplo: `Minuta` se espalha por sete matérias e `Ofício / Carta`
por cinco, então natureza não determina matéria.

**Testes no encerramento.** `tsc` limpo · `eslint` limpo · `vitest` 120 passando ·
`build` verde · `pytest` 1 falha, 115 passando, 20 erros — todos em
`test_pipeline_integracao.py`, pela fonte não reprocessada desde 16/09.

**HEAD final.** `5beee06`, árvore limpa, sem remote.

**Próximo passo.** Aguardar o próximo ajuste visual. Se for preciso escolher: abrir a
gaveta de detalhamento no navegador.

### 1 — Golden Screen da Linha do Tempo · 10–21/09/2026

**Objetivo.** Fundação do projeto, pipeline, API, design system e a Linha do Tempo.

**Resultados.** Fases 0 a 7; a Linha do Tempo aprovada nas três escalas (semana em dias,
mês em semanas, ano em armários) com o gráfico analítico integrado ao eixo. Oito ajustes
visuais percorridos, um deles reprovado e revertido.

**Decisões duráveis.** `DEC-031` (Higgsfield como exceção nomeada) e `DEC-032` (`soul-id`
proibida), entre as anteriores.

**HEAD ao fim.** `b4c87fc`.
