# Redesenho visual — V2

Registro objetivo da rodada de revisão visual e de produto. O que foi olhado como
referência, que identidade saiu disso, o que estava errado na V1 e o que mudou.

Não é um relatório de design. É o que uma sessão futura precisa saber para não
desfazer decisões por engano.

---

## 1. Visual Discovery — o que foi consultado

Pasta consultada **em modo somente leitura**, sem alterar nem copiar nada em massa:

```
C:\caminho\exemplo\midia-institucional
```

Composição (50 PNG · 47 PPTX · 18 XLSX · 9 PDF · 8 SVG · 7 JPG · 6 PBIX · 6 GIF ·
6 DOCX · 3 MP4 · 3 HTML), organizada em `Apresentacoes/`, `Banco de Imagens/`,
`BIs/`, `Capas/`, `Graficos NC/`, `Icons/`, `Logos/`, `Rascunhos/`, `Assinaturas/`.

`BIs/DASHBOARD GERAL MASTER/Dashboard_Geral_Master.pbix` e o Power BI do Parceiro
foram tratados **apenas como referência visual**. Nada foi aberto em modo de
escrita, nada foi alterado.

### O que dessas referências é aproveitável

| Referência | O que se aproveitou |
|---|---|
| `Logos/Programa.svg` | wordmark CÆP com a tagline "Consórcio do Programa" — usado na capa |
| `Logos/Programa ICON BRANCO.svg` | mesma wordmark em branco (363×195), para fundo escuro |
| `Logos/Fundo branco.png` | marca Fundo, versão branca |
| `Logos/cor verde do Parceiro.png` | **amostra de cor**, não logo: é um chapado `#015346`, a verde institucional do Parceiro |
| `Capas/CAPA Programa FOTO.jpg`, `prog_capa_documento_tecnica_minimalista_escura.pptx` | a linguagem de capa do consórcio: foto de rodovia, véu escuro, tipografia grande à esquerda |
| `Apresentacoes/`, `BIs/` | confirmam a paleta institucional (petróleo, ciano, verde do Parceiro) e o gosto por tabela densa com faixa de KPI no topo |

### Armadilhas encontradas nos ativos

Três coisas que custaram tempo e precisam ficar registradas:

1. **`SVG LOGOS Programa BRANCO.svg` (620×1064) não é um logo** — é uma *prancha* com
   vários logos (Dynatest, ESCRITÓRIO JURÍDICO e outros) empilhados. Usada como `<img>`,
   renderiza uma pilha minúscula de marcas. Não usar. O arquivo copiado para o
   projeto com esse conteúdo foi removido.
2. **`Programa ICON BRANCO.svg` não é um ícone** — é a wordmark inteira em branco,
   com a mesma caixa 363×195 da versão colorida. Não existe versão quadrada da
   marca. Foi por isso que a barra lateral usa um selo próprio "IJ" com gradiente
   em vez de tentar encaixar a wordmark num quadrado de 36 px.
3. **As duas marcas do Parceiro na pasta são BRANCAS.** Não existe versão positiva.
   `parceiro.png`, apesar do nome, é branca — sumia no tema claro. A aplicação passou
   a exibir a marca branca sempre sobre um selo `#015346`, sem inverter, sem
   recolorir e sem distorcer.

Ativos efetivamente copiados para `frontend/public/brand/` (só o necessário):
`prog-wordmark.svg`, `prog-icon-branco.svg`, `parceiro-branco.png`,
`fundo-branco.png`, `parceiro.png`, `capa-rodovia.png`.

---

## 2. Identidade

Institucional, premium, técnica. Ancorada no Programa e no Fundo, sem parecer
SaaS genérico.

```
#1C5560   teal Programa (wordmark)
#002738   azul petróleo (fundo escuro, superfícies)
#2BC0E4   ciano (acento, único acento)
#015346   verde do Parceiro (institucional, amostrado do material oficial)
#E8EEF2   cinza névoa (fundo claro)
```

### Paleta categórica de dados — `--data-1` … `--data-8`

Oito cores, ancoradas no Programa (petróleo/ciano) e no Parceiro (verde), com dois
acentos quentes terrosos para contraste. A ordem foi escolhida para que
categorias vizinhas na barra de proporção não se confundam.

| # | Papel | Claro | Escuro |
|---|---|---|---|
| 1 | ciano Programa | `189 66% 32%` | `189 76% 56%` |
| 2 | azul petróleo | `210 55% 38%` | `205 52% 48%` |
| 3 | verde do Parceiro | `166 55% 28%` | `168 52% 46%` |
| 4 | âmbar | `30 74% 40%` | `34 80% 60%` |
| 5 | índigo ardósia | `228 30% 46%` | `228 34% 62%` |
| 6 | terracota | `10 56% 44%` | `12 62% 58%` |
| 7 | verde sálvia | `150 34% 35%` | `152 36% 56%` |
| 8 | aço | `198 18% 44%` | `196 24% 70%` |

**Fora de propósito:** azul genérico de framework e roxo de SaaS. A V1 tinha os
dois (`205 62% 62%` e `266 58% 68%`) e eram exatamente as cores que faziam a tela
parecer template.

### Regras de cor

- **Uma dimensão, um matiz.** Série temporal, ranking e composição usam rampa de
  uma só cor, variando luminosidade. Matiz diferente sinaliza *categoria*
  diferente; usá-lo para ranking é ruído.
- **Cor com função.** No Portfólio a cor **é a matéria jurídica**, e é a mesma na
  barra de proporção, na régua da linha, no ponto do badge e na sparkline. Antes
  era o índice da linha — arco-íris sem significado.
- **"Não classificado" nunca recebe cor de categoria.** Fica fixo no aço
  (`--data-8`), via `coresPorMateria()` em `lib/utils.ts`. É *ausência* de
  classificação, não uma matéria; pintá-la como as outras a apresentaria como se
  fosse uma, contra a regra de produto.
- **Âmbar é matéria sancionatória, não decoração.** Onde o âmbar aparecia por
  acidente (ano 2026 na distribuição, uma rodovia qualquer no ranking) ele lia
  como alerta. Removido desses lugares; usa o token `--warning` onde o
  significado é real.

---

## 3. O que estava errado na V1

Além da avaliação da usuária ("não gostei visualmente"), estes eram defeitos
objetivos:

| Problema | Causa |
|---|---|
| KPIs renderizando em 14 px | `tailwind-merge` não conhecia `text-kpi` e o classificava como cor; a classe de cor seguinte o eliminava. Corrigido com `extendTailwindMerge` |
| Heatmap com células **preto sólido** | `readToken` devolvia `hsl(196 82% 55%)` (CSS Color 4, separado por espaço). O canvas aceita em preenchimento sólido, mas o parser do zrender só entende `hsl(h, s%, l%)` com vírgula — e `visualMap` precisa *interpolar*. Falhava em silêncio |
| Sombras e gradientes invisíveis | `` `${tokens.accent}55` `` produz `hsl(196 82% 55%)55`, string inválida. Substituído por `withAlpha()` |
| Legenda do heatmap como bloco vertical | o ECharts ignora `itemWidth`/`itemHeight` em `orient: 'horizontal'`. A legenda passou a ser desenhada em DOM |
| Tiles médios do treemap só com o número | `width` + `overflow: truncate` no bloco `rich`: quando o texto não cabe, o ECharts **descarta o rótulo inteiro**. O nome passou a ser encurtado no formatter |
| Animações deixando conteúdo invisível | `initial={{opacity:0}}` em JS não resolve quando a animação não roda (aba oculta, captura headless). Entradas migraram para keyframes CSS `reveal-*`, com estado de repouso visível, e modo estático `?static=1` |
| Três gráficos idênticos lado a lado | natureza, tema e destinatário todos em barra horizontal |
| Linha da tabela com altura irregular | duas tags de tema quebravam a linha; agora é uma tag + `+N` |
| Cabeçalho da tabela em caixa mista e alta ao mesmo tempo | o preflight do Tailwind aplica `text-transform: none` em `<button>`, e as colunas ordenáveis são botões |
| Ordenação instável | empates (`RD-102B` e `RD-105`, 8 documentos cada) sem critério de desempate: a tela mudava entre recargas. 12 consultas ganharam desempate |

---

## 4. Estrutura nova

### Jornada

```
/                 capa executiva (fora do shell)
/painel           Visão Geral
/portfolio        Portfólio Jurídico
/linha-do-tempo   Linha do Tempo
/destinatarios    Destinatários
/rodovias         Rodovias & Contratos
/documentos       Acervo Documental  (+ ?doc=<id> abre a ficha)
/governanca       fora do menu, acessível por URL
```

"Repositório e Qualidade" saiu **do menu**, não do sistema: validações, testes,
pipeline, endpoints e verificações de integridade continuam íntegros, e a página
de governança continua acessível por URL.

### Uma forma de gráfico por pergunta

| Pergunta | Forma |
|---|---|
| composição do acervo | treemap (área = volume) |
| ranking de interlocutores | lollipop (leitura por posição) |
| concentração temática | barra com trilha e share explícito |
| produção no tempo | colunas grandes, faixa sancionatória na base |
| proporção entre matérias | barra única segmentada |
| cruzamento de duas dimensões | heatmap sequencial |
| densidade mês × ano | grade de calendário |
| série dentro de linha de tabela | sparkbars |

Pizza, donut, 3D, gauge decorativo e **média móvel** continuam fora. A média móvel
foi removida também do contrato da API (`PontoTemporal.media_movel_3` deu lugar a
`sancionatorios`): deixar o campo convidava a desenhá-la de novo.

---

## 5. Honestidade na apresentação — o que mudou

Estas mudanças não são estéticas; são de correção de leitura.

- **Ausência de rodovia não é "Geral".** Na tabela e na faixa de destaque da
  ficha, documento sem rodovia identificável mostra `—` com explicação, não
  "Geral". O agrupamento honesto existe só na página Rodovias, com nome completo
  — *"Geral / não vinculado a rodovia"* — e sem percentual de cobertura.
- **Contagem de cartão diz o que é.** "Composição do acervo — 364" virou
  *"as 9 maiores naturezas — 364 dos 397 documentos do recorte"*. O número 364
  nunca foi o acervo; era a soma do que estava na tela.
- **Número de contrato não é data nem status.** `14/2025` virou `nº 14/2025`, em
  monoespaçada e neutro — verde sugeria semáforo.
- **Rótulo diz o que o rótulo promete.** "Principal interlocutor" mostra *Parceiro*;
  "Natureza dominante" mostra *Minuta*; "Mês de maior volume" mostra *set/25*. A
  contagem desceu para o apoio.
- **Participação não é crescimento.** A faixa anual diz isso explicitamente, e
  anos residuais (< 2%) são agrupados como "anteriores" com a explicação de que
  são registros isolados, não série.
- **Necessidade de resposta continua declarada como não diferenciadora.** O campo
  tem 394 registros no nível 1 e 3 sem classificação: o bloco mostra a escala de
  5 níveis prevista na fonte, marca os 4 níveis previstos e sem uso, e não finge
  análise onde não há variância.
- **O eixo mensal traz só meses com produção**, e o cartão diz isso — os meses
  vazios estão na densidade temporal.

---

## 6. Escala e tipografia

Pensadas para 1920×1080 a distância de reunião, por **contraste de escala**, não
por "tudo grande":

- KPI da Visão Geral: 64 px (`text-kpi-lg`) · KPI das páginas de análise: 48 px
- rótulo de KPI: 11 px, caixa alta, `tracking` aberto
- título de página: 30 px · título de bloco: 14 px
- nota de proveniência: 11 px, contraste reduzido

A hierarquia é o que faz o número ser lido primeiro. As chaves `kpi`, `kpi-lg`,
`kpi-sm` e `display` estão registradas no `extendTailwindMerge` de
`lib/utils.ts` — **sem isso elas são silenciosamente descartadas**.

---

## 7. Movimento

Entradas por keyframes CSS (`reveal-up`, `reveal-in`, `reveal-left`,
`reveal-scale-x`) com `animation-fill-mode: both`, atrasos ≤ 0,36 s, e
`html.no-reveal` forçando estado final quando há `?static=1` ou
`prefers-reduced-motion`. `CountUp` tem timer de segurança de 900 ms.

Motion for React está autorizado nesta fase e é usado em interação (drawer,
hover, listas). GSAP, Rive, Spline, Three.js e afins ficam para a fase
"experiência premium" — não entraram.

---

## 8. Aparência clara e escura

Ambas são de primeira classe. Tokens completos definidos em `:root` (claro),
redefinidos em `@media (prefers-color-scheme: dark)` e em `[data-theme]` /
`.dark`.

Novidade desta rodada: **`?aparencia=light|dark`** força a aparência por URL, sem
mexer na preferência salva. Serve para linkar uma leitura clara para apresentação
ou impressão, e é o que torna a captura de tela dos dois temas reproduzível.
Deliberadamente **não** se chama `tema` — esse nome já é o filtro de tema
jurídico na URL (DEC-011), e a colisão produz recorte vazio.

---

## 9. Capturas

`output/screenshots/` (não versionado), 1920 px de largura, modo estático:

```
v3-01-capa.png              v3-07-documentos.png
v3-02-painel-dark.png       v3-08-drawer.png
v3-03-portfolio.png         v3-09-painel-light.png
v3-04-linha-do-tempo.png    v3-10-capa-light.png
v3-05-destinatarios.png     v3-11-documentos-light.png
v3-06-rodovias.png
```

> **Cuidado com estas imagens.** A ficha do documento exibe `Subido por` e
> `Modificado por`, que são **nomes de pessoas** — dado pessoal de terceiro.
> `output/` está no `.gitignore` e deve continuar. Não versionar, não anexar em
> issue, não compartilhar print da ficha.
