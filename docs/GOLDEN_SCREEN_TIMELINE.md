# Golden Screen — Linha do Tempo (visão semanal)

Registro da rodada que transforma a Linha do Tempo na experiência principal do
produto. **Somente visão semanal nesta rodada.** Mês e Ano serão derivados destes
mesmos componentes depois da aprovação.

---

## 1. Auditoria (Fase A) — o que existia antes de tocar em nada

**Git.** Branch `main`, 1 commit (`cd26fb5`), **72 entradas não commitadas** preservadas
integralmente. Nenhum `reset`, `checkout`, `clean`, `stash` ou `commit` foi executado.

**Arquivo único da página.** `frontend/src/features/timeline/TimelinePage.tsx`, 397
linhas, três blocos: grade ano × mês, colunas mensais e meses de pico.

**Dependências — nada a instalar.** A auditoria do `package.json` mostrou que tudo o que
esta rodada precisa já está no projeto:

| Necessidade | Já instalado |
|---|---|
| motion, layout animation, drag, spring, stagger | `motion` ^11.15.0 |
| popover acessível (foco, Esc, teclado) | `@radix-ui/react-popover` 1.1.4 |
| ícones estruturais | `lucide-react` 0.469.0 |

**Nenhuma dependência foi adicionada.**

**Backend — uma alteração, justificada.** Os documentos da semana vêm de
`/documents?data_inicio=&data_fim=`, que já devolve tudo o que a tela precisa em **uma
requisição** (a semana mais densa do acervo tem 23 documentos), e o `link_url` real do
SharePoint vem de `/documents/{id}`, que a ficha do Acervo já usava. Nada disso mudou.

O que mudou: `/timeline` passou a aceitar `granularidade=dia`, ao lado de
`mes | trimestre | ano` que já existiam.

**Por que foi necessário.** Sem contagem por dia no acervo inteiro não há como escolher
onde a tela abre. Abrir na semana do documento mais recente parecia óbvio e produzia uma
tela com **1 documento**; abrir em "hoje" produzia uma tela vazia. A série diária é o que
permite abrir na semana de maior volume e dizer que é isso.

A mudança é de uma linha no mapa de granularidade — mais a guarda que exclui quem não tem
dia na fonte (§2) e a cobertura declarando a lacuna. Coberta por dois testes novos em
`tests/backend/test_api.py`.

---

## 2. O que o dado real sustenta — e o que o mock mostrava

O mock de referência mostra um dia com **67 documentos**. O acervo real não tem isso:

| Medida | Valor real (14/09/2026) |
|---|---|
| Documentos com data de dia | 380 |
| Documentos com precisão apenas mensal | 16 |
| Documento sem data | 1 |
| Dias distintos com documento | 136 |
| **Máximo em um único dia** | **18** (18/11/2025) |

A interface usa o dado real. A escala de magnitude cobre todas as faixas até 51+, mas o
acervo hoje ocupa as quatro primeiras. Nenhum volume foi inventado para a tela ficar
mais cheia.

### Os 16 documentos de precisão mensal

No modelo, um documento com precisão mensal fica gravado como `AAAA-MM-01`. Agrupar por
dia sem cuidado colocaria **8 documentos no dia 1º de março de 2026** como se aquela
fosse a data real. Isso é exatamente o tipo de falsidade silenciosa que o produto
proíbe.

**Regra aplicada:** documento com `data_documento_precisao = 'mes'` **não entra em
nenhum dia** da semana. Ele aparece como um aviso próprio na semana correspondente,
dizendo quantos são e por quê. A soma dos dias mais esse aviso fecha com o total do mês.

---

## 3. Conceito

> "Estou navegando fisicamente por um arquivo jurídico vivo ao longo do tempo."

A timeline não é gráfico de apoio: é a experiência. A interface flutua sobre um ambiente
institucional real (vídeo), em vidro escuro translúcido, e os documentos têm
materialidade de papel.

---

## 4. Assets

| Arquivo | Origem | Observação |
|---|---|---|
| `frontend/public/media/legal-ambient.mp4` | vídeo enviado pela usuária | 1,8 MB, loop, mudo, `playsInline` |
| ~~`frontend/public/brand/doc-parecer.png`~~ | **derivado** do PNG do parecer | **removido em 17/09/2026** — substituído por `doc-base.png`, que é sintético |
| `frontend/public/brand/doc-base.png` | gerado do B3 (sintético) | 320×472, papel sem tinta |

### Por que o PNG do parecer é derivado e não o original

O PNG enviado é um parecer com **seis nomes de pessoas legíveis** — o destinatário e
cinco advogados. `CLAUDE.md` §5 é explícito: nome de pessoa é dado pessoal de terceiro e
**nunca** entra em commit ou arquivo de exemplo. `frontend/public/` é versionado.

O asset no repositório é uma derivação: recortada, reduzida a 260 px e suavizada até
nenhum nome sobreviver nem ampliando o arquivo. O que a interface realmente usa em
110–150 px está todo preservado — papel, dobra da folha, moldura, bloco do cabeçalho,
fio vertical e a mancha tipográfica. **O PNG original não foi copiado para o projeto.**

---

## 5. Escala de magnitude documental

Determinística, em `features/timeline/magnitude.ts`, com teste próprio. A pilha é
**montada** com N folhas reais — nunca o mesmo ícone com `scale` diferente.

| Documentos | Faixa | Folhas desenhadas |
|---|---|---|
| 1 | `unico` | 1 (folha inteira, com a prévia) |
| 2–4 | `xs` | 3 |
| 5–10 | `s` | 5 |
| 11–25 | `m` | 8 |
| 26–50 | `l` | 12 |
| 51+ | `xl` | 16 |

A quantidade **sempre** tem número textual ao lado, para acessibilidade e para não
depender da leitura da pilha.

---

## 6. Componentes

```
features/timeline/
  TimelinePage.tsx              orquestra a página e o travel through time
  magnitude.ts                  regra de magnitude (pura)
  week.ts                       semana, rótulos pt-BR, agrupamento por dia
  aterrissagem.ts               em que semana a tela abre, e por quê
  useMovimentoReduzido.ts       preferência do sistema + modo estático
  magnitude.test.ts             testes de magnitude, semana e agrupamento
  components/
    LegalVideoBackground.tsx    vídeo + blur + véu, sem pointer events
    LegalTimeline.tsx           trilho, linha, arraste com inércia e limites
    TimelineDay.tsx             coluna do dia: magnitude, node, data e os popovers
    LegalDocumentStack.tsx      a folha e a pilha montada
    DocumentPreviewPopover.tsx  prévia de um documento e de vários (+N)
    PeriodInfoPopover.tsx       card analítico do node
    TimelineEdgeNavigation.tsx  hotspots laterais com aceleração progressiva
    TimelineToolbar.tsx         data, "ir para a semana", Ano/Mês/Semana, Hoje, setas
```

Alguns componentes previstos no plano inicial não viraram arquivo próprio porque
seriam casca de uma linha: o node e a linha do trilho vivem onde são usados
(`TimelineDay`, `LegalTimeline`), e a escolha entre folha e pilha é uma condição
dentro de `TimelineDay`. Componente que só repassa props é indireção, não separação
de responsabilidade.

---

## 7. Estados

| Estado | Tratamento |
|---|---|
| `normal` | folha/pilha em repouso, node 8 px |
| `hover` | temporário; sobe 4–8 px, sombra cresce, trecho do trilho acende |
| `selected` | **persistente**; envolve pilha + node + data com coluna de luz, halo e data em acento |
| `focus-visible` | anel de foco próprio, navegável por teclado |

Hover em outro dia **não** tira a seleção. Hover no documento abre prévia; hover no node
abre o card analítico — são interações diferentes, de propósito.

---

## 8. Movimento

Todos os tempos seguem a tabela combinada; desaceleração no fim, nunca linear.

| Interação | Duração |
|---|---|
| hover | 150–220 ms |
| prévia (popover) | 220–320 ms |
| travel para data distante | 700–1000 ms conforme distância |

`prefers-reduced-motion` desliga travel, drag com inércia, parallax e springs; tudo vira
fade curto. O modo estático `?static=1` do projeto continua valendo.

---

## 9. Defeitos encontrados na própria implementação

Registrados porque são armadilhas que voltam, não curiosidades.

### Animação de entrada em JS não pode governar visibilidade

Apareceu **quatro vezes** nesta rodada, sempre igual: um elemento com
`initial={{ opacity: 0 }}` no Motion fica preso invisível quando a animação não
roda — aba oculta, captura headless, `?static=1`, `prefers-reduced-motion`.

Vítimas: o painel de vidro inteiro, o invólucro dos dois popovers, os metadados
escalonados da prévia e as linhas do card do node.

**Regra desta base de código:** entrada é keyframe CSS com `both` e estado de
repouso visível (`.reveal-up`, `.pop-de-baixo`, `.pop-de-cima`, `.stagger-in`),
e `html.no-reveal` desliga tudo. Motion fica para transformação de verdade
(arraste, mola, leque), nunca para revelar conteúdo. Onde o Motion permanece —
o leque das três folhas — `opacity` saiu do `initial`: se a animação falhar, as
folhas aparecem empilhadas, nunca invisíveis.

### O vídeo estava atrás do fundo do shell

`fixed inset-0 -z-10` deixava o vídeo atrás do `bg-canvas` (#011825, opaco) da
casca da aplicação: carregava, decodificava, tocava — e não aparecia. Agora é
`absolute inset-0 z-0` cobrindo a **área da página**, com o conteúdo em `z-10`.
Não invade a barra lateral nem a barra de filtros.

Havia ainda um segundo motivo de invisibilidade: a opacidade do vídeo era
revelada por um estado alimentado pelo evento `canPlay`, que **já havia
disparado** antes de o React anexar o handler quando o arquivo vinha do cache. O
fade de entrada foi removido — o fundo `#040a12` atrás já cobre o carregamento.

### Mola de duração ~zero produz transform inválido

`useSpring(x, { duration: 0.001 })` para o modo de movimento reduzido gerava
transform inválido e o painel inteiro deixava de pintar. Com movimento reduzido
a mola sai de cena e o valor cru é usado.

### `requestAnimationFrame` permanente

A navegação de borda mantinha um laço rodando para sempre, "sem fazer nada"
quando não havia borda ativa. A página nunca ficava ociosa: o compositor não
descansava e a captura de tela não concluía. O laço agora só existe enquanto o
cursor está na zona da borda.

### Popover recortado por `overflow-hidden`

O trilho recorta o arraste e o painel recorta o canto arredondado — os dois
cortavam a prévia. Por isso os popovers são Radix com `Portal`, o que também
trouxe reposicionamento automático nas bordas (primeiro e último dia), Esc e
gestão de foco.

---

## 10. Verificação

| Item | Resultado |
|---|---|
| `python -m pytest tests` | 136 passaram |
| `python -m ruff check .` | limpo |
| `npx tsc -b` | sem erros |
| `npx eslint src --max-warnings 0` | sem avisos |
| `npm run test` | 39 passaram (3 arquivos) |
| `npx vite build` | 6,85 s |

**Arraste** verificado a 1380 px: `cursor: grab`, trilho de 1500 px contra
viewport de 1032 px — 468 px de excedente arrastável.

**Travel through time** medido de 22–28/set/2025 para 23–29/mar/2026 (26
semanas): percorre 1–7/dez → 19–25/jan → 16–22/fev → 9–15/mar → 16–22/mar →
23–29/mar. Acelera no começo, desacelera ao chegar e pousa na semana exata.

**Gancho de QA** (`?qa=`) confirmado ausente do bundle de produção.

---

## 11. Parâmetros de URL

| Parâmetro | Efeito |
|---|---|
| `?dia=AAAA-MM-DD` | abre na semana daquele dia e o deixa selecionado — deep-link de verdade |
| `?static=1` | modo estático já existente no projeto |
| `?qa=documentos` \| `node` | abre um popover sem hover — **somente em desenvolvimento** |

O `?qa=` existe porque captura headless não tem cursor, e sem ele não havia como
registrar os estados de hover em resolução cheia. Fica atrás de
`import.meta.env.DEV` e some do bundle de produção — verificado no artefato
compilado.

---

## 13. Fase 1 — composição, background e glass (17/09/2026)

Primeira das seis fases de correção visual. **Só estrutura da página.** Documentos,
magnitude, node, selected, popovers, motion, drawer, Mês e Ano não foram tocados —
inclusive o asset B3, aprovado na Fase 0.5, **não** entrou na timeline (isso é Fase 2).

### As nove correções

| # | Antes | Depois |
|---|---|---|
| 1 | vídeo desfocado a 22 px e a `brightness(0.72)`: névoa sem assunto | 13 px, `brightness(0.86)`, `object-position: 50% 62%` — o ambiente é reconhecível e o trecho interessante fica **atrás do painel** |
| 2 | véu do miolo a 0,44 | 0,24 — o escurecimento é da camada B, graduado, não do filtro |
| 3 | vidro com `blur(18px)` e cor chapada | `blur(8px)`, gradiente 0,55 → 0,63 e highlight interno no topo; o desfoque do vidro **se soma** ao do vídeo, e a 18 px o que passava não era ambiente, era leite |
| 4 | painel centralizado num `flex-1` com 9rem de reserva: experiência caída na metade inferior | painel nasce logo abaixo do título, estica até um **teto de 562 px** |
| 5 | "24" em corpo 30, solto, ao lado do título | **bloco editorial** dentro do painel: `22 – 28 de setembro de 2025` / `24 documentos · maior volume do acervo` |
| 6 | duas fileiras de badges (pico, documentos sem dia) | tudo na mesma linha do volume |
| 7 | hierarquia começava pelos controles | período/volume → controles → timeline |
| 8 | seis controles soltos, cada um com borda própria | dois grupos numa casca só: **destino** (data + Ir) e **leitura** (escala, Hoje, setas) |
| 9 | barra de filtros global com o mesmo peso da toolbar | modo `discreto` **só na rota da Linha do Tempo**: menos altura, fundo mais recuado, 72% de opacidade que volta a 100% no hover e no foco. Comportamento e lógica idênticos |

### Sete dias visíveis — o que mudou de verdade

`LARGURA_DIA` era fixa em **212 px**: sete colunas pediam 1.484 px, e a área útil em
1440×900 tem ~1.116 px. Sábado e domingo ficavam fora da viewport, só alcançáveis por
arraste — dois dias da semana escondidos.

Agora a coluna é **medida**: `clamp(146, viewport / 7, 212)`. O piso de 146 px é o que
ainda acomoda a pilha mais larga (122 px da faixa `xl`) com respiro lateral. Abaixo
disso o excedente volta a ser arrastável, como antes.

O excedente do arraste passou a ser calculado **aritmeticamente** a partir da largura
recém-escolhida, não lido de `scrollWidth`: ler o DOM ali criaria laço com o
`ResizeObserver` e o primeiro quadro usaria a largura antiga.

### Verificação

| Item | Resultado |
|---|---|
| `npx tsc -b` | sem erros |
| `npx eslint src --max-warnings 0` | sem avisos |
| `npm run test` | 39 passaram (3 arquivos) |
| `npx vite build` | 17,4 s |
| 1440×900 e 1920×1080 | **Seg a Dom visíveis**, sem arraste |
| `?static=1` | painel pinta normalmente — sem regressão da armadilha do §9 |
| vídeo tocando | `paused: false`, `currentTime` 1,97 → 3,49 s medido no navegador |
| outras páginas | barra de filtros **inalterada** fora da Linha do Tempo (conferido no Portfólio) |

Capturas em `output/screenshots/f1-*.png`.

### Em aberto para a avaliação humana

Em 1920×1080 o teto de 562 px deixa ~330 px de ambiente abaixo do painel. É deliberado —
"interface flutuando sobre um ambiente" — mas é exatamente o tipo de escolha que só a
avaliação visual decide. É um número.

---

## 14. Fase 1.1 + 2A — vídeo nítido e os documentos de verdade (17/09/2026)

### 1.1 — o vídeo perde o desfoque

O caminho foi **22 → 13 → 0 px**. O erro era somar dois desfoques: o vídeo já
chegava borrado e o painel aplicava `backdrop-filter` por cima. O resultado era
leitoso — nem ambiente nítido, nem vidro convincente, porque **vidro fosco só se
percebe quando há algo nítido ao redor para comparar**.

Agora a legibilidade vem de onde deve: véu escuro graduado (fechado um ponto no
topo e na base, porque detalhe atrás de texto pequeno compete com a leitura),
vidro do painel e contraste tipográfico. O desfoque virou exclusividade da
camada C, que subiu de 8 para **14 px**. A escala do vídeo caiu de 1,06 para
1,02 — ela existia só para esconder a borda que o desfoque comia.

### 2A — o documento

O placeholder era uma **chapa branca**: `div` com `background` claro,
`overflow-hidden`, `rounded-[3px]` e uma foto dentro. A silhueta era a da caixa,
não a do papel, e a sombra era `box-shadow` — o retângulo do `div`.

O documento agora tem duas camadas, e a divisão é o ponto:

| Camada | O quê | Por quê |
|---|---|---|
| **Papel** | `/brand/doc-base.png` — o B3 aprovado com a tinta retirada localmente | grão, borda, tom e silhueta são o que sobrevive a ser reduzido a 88 px. Papel é matéria: textura em vetor fica sintética |
| **Conteúdo** | SVG com `viewBox` em unidades da folha | é vetorial, então é nítido em 66 px e em 400 px. A pseudo-letra do render virava borrão — era ela que fazia o documento parecer miniatura ruim |

Sem `background`, sem `overflow-hidden`, sem borda. A silhueta é o alfa do PNG e
a sombra é `drop-shadow` em duas camadas — curta de contato, longa de ambiente —
que acompanha o recorte em vez de desenhar um retângulo atrás.

**Como a tinta saiu sem levar o grão.** `output/asset-exploration/preparar_doc_base.py`
separa frequência: a baixa carrega os blocos impressos, a alta carrega o grão. O
"papel sem tinta" vem de preencher as regiões de tinta por difusão — desfoque
iterativo com reimposição do que se conhece —, o que funciona para o cabeçalho
de 177 px, que nenhum filtro de máximo alcançaria. Sobra 7% de fantasma, porque
0% deixaria o papel plástico. Grão a 70% e `unsharp` curto: cheio, a folha
reduzida lia como papel amassado.

Houve uma tentativa de **extrair** a geometria do conteúdo do próprio B3. Foi
descartada: devolvia 43 retângulos, e a maior parte era pedaço de letra e a
sombra da borda direita. A hierarquia editorial é desenhada à mão em
`LegalDocumentStack.tsx` — cabeçalho, rótulo, fio, três parágrafos com última
linha curta, bloco de destaque e fio de assinatura. Abaixo de 74 px de largura
os fios de 0,9 unidade somem, porque nesse tamanho cairiam abaixo de 1 px e
virariam cinza sujo.

### A escala de magnitude, revista

A proporção da folha passou de 1,155 (recorte achatado do parecer) para
**756/512 = 1,477**, a do B3.

**A pilha cresce para CIMA.** Com deslocamento lateral de 4 px a faixa `xl`
ocupava 190 px e invadia a coluna vizinha, que tem 146 px no mínimo. Uma resma
vista de frente ganha altura, não largura.

O deslocamento lateral que resta é **irregular**, num ciclo de três posições:
com desvio monotônico a lateral virava uma escada perfeita, e escada perfeita
não é papel, é gráfico de barras.

| Faixa | Documentos | Folhas | Passo | Largura |
|---|---|---|---|---|
| `unico` | 1 | 1 | — | 88 |
| `xs` | 2–4 | 3 → 5 | 4,0 | 90 |
| `s` | 5–10 | 6 → 9 | 3,8 | 92 |
| `m` | 11–25 | 10 → 14 | 3,6 | 95 |
| `l` | 26–50 | 15 → 19 | 3,4 | 98 |
| `xl` | 51+ | 20 → 26 | 3,2 | 101 |

A novidade é a seta: **o número de folhas interpola DENTRO da faixa.** Antes a
faixa inteira desenhava a mesma pilha, e como o acervo real concentra a semana
na faixa `s`, 5, 7 e 10 documentos saíam idênticos — a semana toda com a mesma
forma. Largura e passo continuam por faixa, para a leitura de ordem de grandeza
ficar estável; só a altura responde à contagem fina. Continua determinístico: a
mesma contagem desenha a mesma pilha na semana, no mês e no ano.

### Verificação

`tsc -b` limpo · `eslint --max-warnings 0` limpo · **39 testes** passando ·
`vite build` ok. Capturas em `output/screenshots/f2-*.png`.

**Resolvido na rodada seguinte:** `frontend/public/brand/doc-parecer.png` foi
**removido**. Busca no repositório inteiro confirmou zero referência ativa — não
era usado por código, teste, documentação executável nem fallback; só aparecia em
prosa histórica. Como derivava de um parecer real, mantê-lo sem uso era risco sem
contrapartida.

---

## 15. Fase 2B + 3A — interacao visual do nucleo (17/09/2026)

### A conexao documento -> tempo

Era o ponto mais fraco: as pilhas flutuavam perto do eixo sem pertencer a ele.
Tres pecas resolvem, e nenhuma delas e um grafico.

| Peca | Repouso | Hover | Selecionado |
|---|---|---|---|
| **Haste** — 14 px, 1 px de largura, entre a pilha e o node | branco a 0,13, quase invisivel | branco a 0,40 | accent a 0,75 |
| **Trecho local do trilho** — a largura da coluna, sobre a linha de base | invisivel | branco a 0,50, esmaecendo nas pontas | accent a 0,55 |
| **Linha de base** — atravessa a semana inteira | fio de 1 px a 0,38 no centro + halo de 3 px desfocado | — | — |

O halo desfocado atras do fio foi a solucao para o eixo sumir contra o video: da
espessura otica sem engrossar o traco.

### O node, quatro estados de verdade

Antes, hover e selecionado usavam o MESMO accent e o mesmo halo — nao havia como
saber se o dia estava escolhido ou apenas sob o cursor.

| Estado | Ponto | Halo | Anel |
|---|---|---|---|
| normal | 9 px, branco 0,66 (vazio: 6 px, 0,30) | nenhum | 3 px do fundo, para isolar do trilho |
| hover | 12 px, **branco 0,96** | radial branco 0,20, escala 0,82 | 3 px do fundo |
| selecionado | 13 px, **accent** | radial accent 0,34, escala 1 | 3,5 px do fundo + 1,5 px accent |
| focus-visible | qualquer um dos acima | — | anel **branco** de 2 px com offset — deliberadamente diferente do accent, para nao se confundir com selecao |

### Selecionado sem caixa

A versao anterior desenhava um retangulo arredondado com 1 px de borda em volta
da coluna inteira: o dia selecionado lia como um card destacado dentro de uma
lista de cards. Agora a selecao e a soma de cinco sinais fracos, nenhum deles
uma moldura:

1. gradiente vertical sem borda e sem canto, quase invisivel;
2. a pilha sobe 3 px (hover sobe 9 — os dois somam);
3. a haste em accent;
4. o node em accent com halo maior;
5. contagem, dia e data em accent.

Hover em outro dia nao tira a selecao: `selecionado` e `foco` sao props
separadas e nunca derivadas uma da outra.

### Os dois popovers nao brigam

`foco` e um estado unico com tres valores excludentes — `nenhum`, `documentos`,
`node`. Nao existe combinacao em que os dois estejam abertos, porque nao existe
estado que represente isso.

### Zona segura

`collisionPadding` **medido na abertura**, nunca constante:

| Lado | Origem | Por que |
|---|---|---|
| topo | base de `[data-zona-segura]` + 14 px | protege titulo, subtitulo, filtros, periodo, escala e "ir para uma data". A barra de filtros muda de altura quando ganha a linha de chips |
| esquerda / direita | borda de `[data-limite-popover]` + 8 px | o padrao do Radix mede a JANELA, e a janela inclui a barra lateral: a previa do primeiro dia pousava em cima do menu. E o menu recolhe, entao o valor nao pode ser fixo |
| base | 20 px | folga para a nota de rodape |

Como nao ha espaco acima da pilha em 1440x900, o Radix vira a previa para
baixo. A classe de entrada e a ordem da haste seguem o `data-side` **resolvido**,
nao o pedido — sem isso a animacao ia para o lado errado e a haste saia do topo
do card.

Isso impos um ORCAMENTO DE ALTURA, e ele mudou o desenho dos tres cards:

- previa de um documento: **<= 300 px**;
- leque de varios: o leque foi para o LADO dos titulos, nao acima deles — empilhado o card passava de 420 px e era cortado;
- card do node: **<= 280 px**, e o insight virou uma linha em vez de uma caixa.

Card que nao cabe nao e card rico, e card cortado.

### Previa de um documento

O papel ocupa **~42% da largura util** (146 px num card de 384). Antes eram 34%,
e o card lia como ficha administrativa com um icone ao lado. A ordem do
escalonamento e a ordem da leitura: natureza, assunto, destinatario/data/arquivo,
e o CTA por ultimo.

### Leque de varios

Ate tres folhas de 104 px: centro primeiro, depois esquerda, depois direita,
rotacao de no maximo 2 graus. Badge `+N` na ultima. Ao lado, ate tres titulos com
a natureza embaixo, e o `Ver mais (N)` — que **mantem o comportamento atual**, o
drawer e rodada futura.

### Contagens

Ganharam faixa propria de altura fixa (`ALTURA_CONTAGEM = 22`). Enquanto
dividiam espaco com a pilha, pilha alta empurrava o seu numero para cima e sete
numeros desalinhados destruiam a leitura horizontal da semana. A folga acima da
pilha caiu de 34 para 10 px, porque nao precisa mais reservar espaco para o
rotulo.

### Sabado e domingo

Dia sem documento continua sendo data valida. O que muda e a enfase — rotulo a
0,62 em vez de 0,88, ponto de 6 px em vez de 9 —, nunca linguagem de componente
desabilitado. O card do node de um dia vazio diz por extenso: a ausencia e do
acervo, nao do calendario.

### Verificacao

`tsc -b` limpo · `eslint --max-warnings 0` limpo · **39 testes** · `vite build` ok.
Capturas em `output/screenshots/f3-*.png`: normal, selecionado, previa unica no
primeiro dia, leque, card do node, domingo vazio, 1440x900 e 1920x1080.

---

## 16. Fases 4 + 5 + 6 — motion, navegacao temporal, empty states e drawer (18/09/2026)

Rodada que **completa a funcionalidade da visao semanal**. Nao e aprovacao
visual: e o ponto em que a tela passa a ter todos os comportamentos previstos.

### Motion — o que foi feito e o que foi recusado

O movimento explica fisica, nao decora. Nenhum bounce, nenhum pulse infinito,
nenhuma particula.

| Interacao | O que acontece | Duracao |
|---|---|---|
| hover no documento unico | sobe 9 px, escala 1,045, sombra curta encolhe e a longa cresce | ~180 ms |
| hover na pilha | a capa sobe e as folhas de baixo abrem 9% — a pilha respira | ~180 ms |
| previa | nasce do papel por keyframe CSS, conteudo escalonado, CTA por ultimo | 240 ms + escalonamento |
| hover no node | ponto cresce, halo aparece, haste acende, trecho do trilho reage | 180 ms |
| selecionado -> outro dia | os dois lados fazem transicao CSS ao mesmo tempo: um apaga enquanto o outro acende | 200-300 ms |
| troca de periodo | o rotulo entra 14 px no sentido da viagem; a contagem sobe 8 px | 200-240 ms |

**Layout/shared transitions do Motion foram avaliadas e recusadas.** O ganho
seria a mancha de accent *viajar* de um dia para o outro; o custo e um elemento
compartilhado entre sete colunas dentro de um trilho arrastavel com dois
popovers em portal. Transicao CSS nos dois lados entrega continuidade sem
acoplar a selecao a posicao.

### Travel — o eixo participa

Antes o travel trocava o conteudo da semana e pronto: a sensacao era de array
substituido. Agora cada passo tambem **empurra o trilho** 64 px no sentido da
viagem, e ele assenta em 260 ms. Sete passos seguidos leem como percurso.

O empurrao mora num valor de movimento **separado** do arraste. Os dois nao
podem dividir o mesmo valor: o arraste guarda onde o usuario largou o trilho, e
o travel precisa voltar a zero ao fim de cada passo — misturados, uma semana
visitada durante o percurso herdava o deslocamento da anterior.

Duracao por distancia, como combinado — **nunca acima de 1 s**:

| Distancia | Duracao |
|---|---|
| ate 2 semanas | 300-460 ms |
| 3 a 8 semanas | 500-700 ms |
| mais que isso | 700-1000 ms |

Saltos longos **nao** renderizam centenas de semanas: os passos sao amostrados
(2 a 7), com `ease-out` cubico, e o destino recebe a unica reacao de chegada.

### Drag

Cursor `grab`, `grabbing` durante o movimento, inercia mais curta que o padrao
(`power` 0,2 contra 0,28) e **encaixe na coluna mais proxima** ao soltar, em
220 ms sem mola — mola ali brigaria com a inercia e produziria o elastico que
nao queremos. Hover, clique, popover e selecao continuam funcionando durante e
depois.

**Dica de primeiro uso:** um chip "Arraste para navegar" aparece uma unica vez
por navegador, some em 6 s ou no primeiro arraste, e so existe quando ha
excedente. A persistencia e `localStorage` dentro de `try/catch` — em janela
anonima o acesso lanca, e uma dica dispensavel nao pode derrubar a tela.

### Edge navigation

O gradiente **nasce da borda** e cresce com a proximidade, em vez de ligar e
desligar: em repouso ele nao existe. Antes as duas faixas ficavam escuras
permanentemente a 32% e liam como moldura da timeline.

A intensidade e escrita **direto no estilo do elemento**, nao em estado do
React: `mousemove` dispara dezenas de vezes por segundo e um `setState` por
evento repintaria a semana inteira a cada movimento do cursor.

O laco de `requestAnimationFrame` continua existindo **apenas enquanto ha borda
ativa** — a correcao do §9 foi preservada e verificada.

### Empty week

Semana sem documento mantem o eixo, os sete nodes e as sete datas. No lugar das
pilhas: "Nenhum documento nesta semana", a frase que a ausencia e do acervo e
nao do calendario, e **dois atalhos com datas reais** — ultimo e proximo
registro, vindos da serie diaria. Se o acervo nao tem nada de um dos lados,
aquele atalho nao aparece, em vez de um botao morto. Clicar viaja ate la.

A regra vive em `features/timeline/vizinhos.ts`, fora de componente, com testes
proprios: quando o mes e o ano existirem, o mesmo calculo serve.

### Drawer contextual

"Ver mais" **nao troca mais de pagina**. Abre um drawer com a lista do dia:
miniatura, natureza, assunto, destinatario, data, extensao e o
"Abrir documento" com o `link_url` real. Busca local sobre o que ja esta em
memoria, e so quando ha mais de tres itens. No pe, a saida explicita para o
Acervo Documental, com os filtros do dia.

A timeline continua atras, com a semana, a posicao e o dia selecionado
intactos. Esc fecha. E o foco volta para a **pilha daquele dia**, nao para o
`body`: o gatilho era o "Ver mais" de dentro de um popover de hover, que deixa
de existir quando o drawer abre — sem o desvio, quem navega por teclado voltava
para a barra lateral.

### Card do node — folga vertical resolvida de forma adaptativa

O card mede o espaco real abaixo do node ao abrir. Com menos de 300 px ele
troca para o modo **compacto**: sai o sobrescrito e a terceira linha de
composicao, some a caixa do insight (que ja virara uma linha). O corpo do texto
nao encolhe — card que encolhe ate ficar ilegivel trocou de problema.

| Altura da janela | Resultado |
|---|---|
| 900 | compacto, abre para baixo, ~67 px de folga ate o rodape |
| 800 | compacto, abre para baixo, cabe |
| 768 | compacto e **vira para cima** sozinho; cabe inteiro. Cobre a propria pilha — e o preco, e nessa altura nao ha alternativa |

### Defeito encontrado na segunda passada

**Os sete nodes estavam em 0x0.** O ponto usava `animate={{ width, height }}`
sem tamanho de repouso: quando a animacao de montagem nao roda — aba oculta,
captura headless, movimento reduzido — ele nascia em 0 e ficava. O que aparecia
era so o anel escuro de 3 px, ou seja **um ponto preto** nos dias com
documento, enquanto os dias vazios (que tinham outro caminho de render) pareciam
mais presentes que os dias cheios. A hierarquia estava invertida na tela.

E a mesma armadilha do §9 deste documento, agora em geometria em vez de
opacidade. Corrigido da mesma forma: **o tamanho de repouso e CSS**, a transicao
tambem, e o Motion sai de cena. Medido depois da correcao: dia com documento com
centro em 190-212 de luminancia e ~70 px claros; dia vazio em 133-153 e ~20-29.

A mesma conversao foi feita no rotulo da contagem, por consistencia.

**Outro defeito da mesma passada:** o rotulo do periodo usava `AnimatePresence`
com entrada e saida. Em aba oculta o elemento que deveria sair ficava montado
para sempre e a tela mostrava **dois periodos ao mesmo tempo**. Trocado por
keyframe CSS em elemento remontado por `key`: sem saida, nao ha o que travar.

### Acessibilidade

Tab alcanca pilha, node e data de cada dia, e as acoes dos popovers e do drawer.
Enter e Espaco abrem. Esc fecha previa e drawer. `focus-visible` do node e da
data usa anel **branco**, diferente do accent da selecao, para os dois estados
nao se confundirem. O drawer tem focus trap do Radix e devolve o foco a pilha.
`prefers-reduced-motion` desliga o empurrao do travel, o encaixe do arraste, a
inercia e as transicoes do ponto; a funcionalidade permanece inteira.

### Verificacao

`tsc -b` limpo · `eslint --max-warnings 0` limpo · **53 testes** (14 novos:
vizinhos da semana vazia, filtro local e comportamento do drawer) ·
`vite build` 15,7 s.

Capturas em `output/screenshots/f5-*.png` e a gravacao de QA em
`output/screenshots/qa-linha-do-tempo.gif`.

**Sobre a gravacao:** e uma sequencia de estados, nao um video de 60 fps. A
captura roda em Chrome headless, que nao tem cursor; o que a gravacao prova e
que cada estado existe, cabe na janela e esta correto. Arraste e a chegada do
cursor na borda nao aparecem nela — foram verificados no navegador
(`cursor: grab` ativo, trilho maior que a viewport) e nao ha como filma-los com
esta ferramenta.

**A visao semanal esta funcionalmente completa. A aprovacao visual humana
continua pendente.**

---

## 12. Fora de escopo na rodada inicial

Mês, Ano, gavetas anuais e os morphs Ano → Mês → Semana. Nenhuma outra página foi
tocada.

**Mês e Ano saíram do fora-de-escopo em 21/09/2026** — ver §17. Gavetas anuais e
morphs continuam fora.

---

## 17. As três escalas (21/09/2026)

Semana, Mês e Ano passaram a existir de verdade. Não são três telas: são a MESMA
tela, e a única coisa que muda entre elas é **o que uma coluna representa**.

| Escala | Coluna | Quantas | Objeto | Largura mínima |
|---|---|---|---|---|
| Semana | um dia | 7 | papel | 146 px — os sete cabem em 1440×900, como sempre |
| Mês | uma **semana** do mês | 4 a 6 | papel | 146 px — todas cabem |
| Ano | um mês | 12 | **armário** | 88 px — o ano inteiro cabe sem arrastar |

As semanas do mês são recortadas NO mês: abril de 2025 começa numa terça, então
"Sem 1" é 01–06 e "Sem 5" é 28–30. Semana inteira transbordando para março
contaria documento que não é daquele mês, e as colunas deixariam de somar o
total da faixa.

O recorte do tempo e os rótulos vivem em `features/timeline/escalas.ts`; daí para
baixo nenhum componente sabe em que escala está. `TimelineDay` recebe uma `Coluna`
com rótulos prontos e documentos já distribuídos — é por isso que pilha, eixo,
ponto, haste, prévia, card do node, drawer, arraste, navegação de borda e empty
state funcionaram nas três escalas sem ganhar um `if` sequer.

### Duas famílias de objeto, e o porquê

**Papel no dia e na semana; armário no mês.** Um mês do acervo não se lê como uma
pilha em cima da mesa — se lê como o arquivo onde aquele mês foi guardado. A
família tem quatro peças, de uma a quatro gavetas, e o que cresce é a ALTURA: a
largura é a mesma nas quatro, porque é o mesmo móvel. Os renders vieram da
usuária; `output/asset-exploration/preparar_armarios.py` normaliza o alfa (o
webp entregava o móvel a 201–254, que sobre o vídeo lia como fantasma) e o
enquadramento — cada render preenchia o quadro, então o armário baixo saía largo
e o alto saía estreito. Normalizar pela largura devolve a leitura física e deixa
as alturas monotônicas: 0,71 / 0,97 / 1,32 / 1,87.

**As faixas do armário não são as do papel**, e não deveriam ser: lá a coluna é
um dia, aqui é um mês inteiro. São 1–10, 11–30, 31–50 e 51+ documentos, que
distribuem o intervalo real do acervo (meses de 1 a 55) em vez de empilhar todo
mundo na última gaveta.

**A proporção objeto/coluna.** A arte escala com a largura da coluna, não por
valor fixo — 0,5× a 1,3× no papel, com teto de 1,0× no armário, que já é quase
duas vezes mais alto que largo. É o que faz o mês parecer a semana vista de mais
longe em vez de outro desenho.

### A sutileza que o modelo precisou respeitar

Documento cuja fonte só informa **mês** não existe como dia: o modelo grava
`AAAA-MM-01` e colocá-lo no dia 1º seria apresentar uma data que a fonte não
sustenta. Na semana e no mês ele fica fora das colunas, contado à parte na linha
do cabeçalho. **No ano ele entra normalmente** — ali a coluna É o mês, e a
precisão mensal posiciona com certeza total. É a mesma regra de sempre (nunca
exibir o que a fonte não sustenta), com dois resultados diferentes porque a
pergunta é outra.

### Navegação

- As setas andam um período na escala em uso, e dizem qual ("Ano anterior").
- **Trocar de escala é zoom**: a âncora fica onde está. Da semana de 22/09 para o
  mês abre setembro; voltar devolve a semana de 22/09.
- **Com uma coluna selecionada, ela vira a âncora** — escolher novembro no ano e
  clicar em "Mês" abre novembro. É o gesto de aprofundar, sem inventar controle novo.
- "Hoje" e o "ir para uma data" da barra de filtros respeitam a escala ativa.

### Dados

Uma requisição a `/documents` recortada pelo período, como já era. Nenhum contrato
de API mudou, nenhum endpoint novo foi criado. O teto sobe para 500 no mês e no ano
(o ano mais cheio tem 247 documentos; o teto da API é 500) — pedir menos truncaria
a contagem das colunas em silêncio, que é o pior defeito possível numa tela cuja
função é contar.

### Verificação

22 testes novos (86 no total, verdes): o recorte das semanas do mês — mês que
começa na terça, mês que termina na segunda, semana de um dia só —, fronteiras
de fevereiro bissexto, virada de ano no passo e na distância, rótulos, as faixas
do armário e a distribuição dos documentos nas três escalas, incluindo a
precisão mensal.

No navegador, em 1440×900: semana com 7 colunas; setembro com 5 colunas de
semana somando os mesmos 55 documentos da faixa; ano de 2025 com 12 armários,
247 documentos e nada a arrastar.
Drawer de uma semana do mês abriu com 24 itens e título "22 a 28 de setembro de
2025"; o de um mês, com 55. Card do node no ano trouxe
naturezas, destinatários e matéria do mês. Ano vazio (2023) mostrou o empty state
com os vizinhos reais — 8 de setembro de 2022 antes, 19 de novembro de 2024
depois.
