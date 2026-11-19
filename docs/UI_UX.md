# UI_UX — design system e padrões de interação

**Status:** especificação da Fase 1. Nada implementado.
**Alvo:** sensação de **software corporativo premium** — preciso, sofisticado, denso
onde precisa ser, silencioso no resto.

**Referências de linguagem:** Linear (hierarquia e calma) · Vercel (tipografia e
espaçamento) · Stripe (clareza de dados e documentação embutida) · Palantir (densidade
analítica com controle). Bloomberg entra **apenas** como referência de densidade
informacional — nunca de estética.

**Antirreferências explícitas:** cyberpunk · gamer · neon · cards flutuando sem
propósito · gradientes em excesso · gráficos 3D · glow chamativo · cara de template ·
cara de Power BI padrão.

---

## 1. Princípios

1. **Densidade com hierarquia.** Muita informação é permitida; muita informação **no
   mesmo nível visual** não é. Um elemento primário por bloco.
2. **O dado é o herói.** Nenhum ornamento compete com o número. Bordas, sombras e cores
   servem para separar e ordenar, não para decorar.
3. **Silêncio por padrão, cor com significado.** A interface é neutra; cor aparece para
   dizer algo (severidade, categoria de confiança, série de dados).
4. **Honestidade visual.** Inferência tem badge. Cobertura parcial tem aviso. Vazio diz
   por que está vazio. Nunca desenhar precisão que o dado não tem.
5. **Movimento discreto.** Animação orienta a atenção; nunca chama atenção para si.
6. **Acessível de verdade.** Contraste AA, foco visível, teclado completo. Não é
   checklist: é requisito de um produto que a diretoria vai abrir.

---

## 2. Fundamentos

### 2.1 Tipografia

| Uso | Família | Nota |
|---|---|---|
| Interface | **Inter** (fallback: `system-ui`, `Segoe UI`) | `font-feature-settings: "cv05","ss01"`; tabular nos números |
| Números e dados | Inter com `font-variant-numeric: tabular-nums` | obrigatório em tabela e KPI — sem isso a coluna "dança" |
| Código / IDs | **JetBrains Mono** (fallback: `ui-monospace`) | nome de arquivo, ID, hash |

**Escala** (rem, base 16px): `11 / 12 / 13 / 14 / 16 / 20 / 24 / 32 / 44`.
Corpo de tabela em 13px, corpo de texto 14px, KPI 32–44px.
Pesos: 400 corpo · 500 rótulo e cabeçalho de tabela · 600 título · 700 só em KPI.
`line-height`: 1.5 texto · 1.35 título · 1.2 KPI. `letter-spacing`: `-0.011em` em
títulos, `0.02em` em rótulos em caixa alta.

### 2.2 Grid e espaçamento

- Escala de 4px: `4 8 12 16 20 24 32 40 48 64`. Nada fora dela.
- Shell: sidebar 240px (colapsável a 56px) · topbar 56px · conteúdo `max-width` 1440px
  centralizado, padding 24px (32px em ≥1280px).
- Grid de conteúdo de 12 colunas, `gap` 16px. KPI ocupa 3 colunas; gráfico 6 ou 12.
- **Ritmo vertical constante:** 24px entre seções, 16px dentro de um card.

### 2.3 Cor — tokens semânticos

Nunca usar cor literal em componente. Só token.

**Light**

| Token | Valor | Uso |
|---|---|---|
| `--bg-canvas` | `#FAFAFA` | fundo da aplicação |
| `--bg-surface` | `#FFFFFF` | card, painel |
| `--bg-subtle` | `#F4F4F5` | cabeçalho de tabela, faixa alternada |
| `--border` | `#E4E4E7` | borda padrão |
| `--border-strong` | `#D4D4D8` | separador de seção |
| `--text-primary` | `#18181B` | |
| `--text-secondary` | `#52525B` | rótulo |
| `--text-tertiary` | `#A1A1AA` | metadado, placeholder |
| `--accent` | `#2563EB` | ação primária, seleção |

**Dark** — **sem preto puro.** Base grafite/zinc; a hierarquia sobe com luminosidade,
não com sombra (sombra não funciona no escuro).

| Token | Valor | Uso |
|---|---|---|
| `--bg-canvas` | `#111113` | fundo (grafite, não `#000`) |
| `--bg-surface` | `#18181B` | card |
| `--bg-elevated` | `#1F1F23` | popover, dropdown |
| `--bg-subtle` | `#232327` | cabeçalho de tabela |
| `--border` | `#2A2A30` | |
| `--border-strong` | `#3A3A42` | |
| `--text-primary` | `#F4F4F5` | |
| `--text-secondary` | `#A1A1AA` | |
| `--text-tertiary` | `#71717A` | |
| `--accent` | `#3B82F6` | levemente mais claro que no light |

**Semântica de estado** (mesmo par light/dark, ajustado para contraste):
`--success #16A34A / #22C55E` · `--warning #CA8A04 / #EAB308` ·
`--danger #DC2626 / #EF4444` · `--info #0891B2 / #06B6D4`.

**Paleta de dados** — categórica, 8 cores, testada em ambos os temas e para deuteranopia.
Ordem fixa, atribuída por posição no ranking, não por valor:

```
#2563EB  azul       #0D9488  teal        #7C3AED  violeta   #DB2777  rosa
#EA580C  laranja    #65A30D  lima        #0891B2  ciano     #9333EA  púrpura
```

Sequencial para heatmap: escala única de azul (`#EFF6FF` → `#1E3A8A` no light;
`#172554` → `#93C5FD` no dark). **Nunca** arco-íris em heatmap.

**Cor da categoria de confiança** — sempre a mesma em todo o produto:

| Categoria | Tratamento |
|---|---|
| `DADO EXISTENTE` | sem badge (é o padrão) |
| `DADO DERIVADO` | badge neutra, `--text-secondary` sobre `--bg-subtle` |
| `INFERÊNCIA` | badge `--warning`, contorno pontilhado |
| `HIPÓTESE` | badge `--warning` preenchida + ícone de alerta |
| `NÃO DISPONÍVEL` | texto `--text-tertiary`, itálico, "não disponível na fonte" |

### 2.4 Elevação, raio, borda

- Raio: `6px` controles · `10px` cards · `14px` modais. Nada de pílula, exceto chips.
- Sombra (só light): `0 1px 2px rgba(0,0,0,.04)` card · `0 8px 24px rgba(0,0,0,.08)` overlay.
- No dark, elevação = `--bg-elevated` + borda mais clara. Sem sombra.
- **Glassmorphism:** permitido em **um** lugar — a topbar, com `backdrop-blur(8px)` e
  fundo a 80% de opacidade quando a página rola. Em nenhum outro.
- **Glow:** permitido apenas como anel de foco (`0 0 0 3px accent/20%`) e no anel de
  seleção de linha. Nunca em card, número ou gráfico.

---

## 3. Shell da aplicação

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ SIDEBAR  │ TOPBAR: breadcrumb · período · busca(⌘K) · tema · varredura  │
│ 240px    ├──────────────────────────────────────────────────────────────┤
│          │                                                              │
│ Overview │  CONTEÚDO — max 1440px, 12 colunas, gap 16                   │
│ Portfolio│                                                              │
│ Timeline │                                                              │
│ Themes   │                                                              │
│ Contracts│                                                              │
│ ─────────│                                                              │
│ Explorer │                                                              │
│ ─────────│                                                              │
│ Repos.   │                                                              │
│ Governanc│                                                              │
│          │                                                              │
│ ─────────│                                                              │
│ snapshot │                                                              │
└──────────┴──────────────────────────────────────────────────────────────┘
```

- **Sidebar** em três grupos separados por divisor, refletindo os três domínios:
  *Análise jurídica* · *Exploração* · *Repositório e qualidade*. Essa separação é
  conceitual, não estética: impede o usuário de somar atividade jurídica com atividade
  de repositório.
- Item ativo: barra de 2px em `--accent` à esquerda + fundo `--bg-subtle`. Sem pílula.
- Pé da sidebar: snapshot atual e horário da última varredura, sempre visível. É o
  contexto de confiança de tudo na tela.
- **Topbar** carrega o seletor de período **global** — é o filtro que atravessa páginas.
- Badge de alerta na topbar quando houver achado de governança de severidade alta
  (hoje: nenhum — a cobertura do índice está em 100%; o maior achado aberto é o
  macrogrupo não classificado, de severidade média).

---

## 4. Componentes

### KPI card
Rótulo (12px, `--text-secondary`, caixa alta leve) · valor (32–44px, tabular) ·
delta com seta e cor semântica · sparkline opcional de 12 pontos · badge de categoria
quando não for `EX` · rodapé de proveniência no hover.
**Todo KPI é clicável** e leva ao Explorer com o filtro correspondente. Cursor de
ponteiro é a promessa; cumprir.

### Card de gráfico
Cabeçalho: título · subtítulo com **grão e cobertura** ("296 documentos · 100% do
acervo" ou "145 documentos · 49% — rodovia extraída do texto") · ações (alternar tipo,
exportar). Quando a métrica vier de regra confirmada, o selo é "regra confirmada em
10/09/2026", não badge de inferência.
Corpo com altura fixa por breakpoint (evita salto de layout no carregamento).
Rodapé: legenda interativa + fonte/snapshot.

### Tabela de dados
Cabeçalho sticky · zebra em `--bg-subtle` a 40% · altura de linha 40px (compacto: 32px) ·
números tabulares alinhados à direita · texto truncado com tooltip · seleção com anel
`--accent` · linha `Excluído` com faixa lateral `--danger` e texto `--text-secondary`,
**nunca escondida**. Scroll horizontal **dentro do container**, jamais na página.

### Chip de filtro
Pílula com rótulo, valor, contagem e `×`. Fundo `--bg-subtle`, borda `--border`.
Filtro de inferência ganha contorno pontilhado — o usuário vê que está filtrando por
dado inferido.

### Painel de detalhe
Drawer à direita, 480px (tela cheia no mobile), `Esc` fecha, foco preso dentro.
Campos em duas colunas; **campo vazio aparece** como "não informado" em
`--text-tertiary` — omitir campo vazio esconde problema de dado.

### Estados
| Estado | Regra |
|---|---|
| **Skeleton** | mesma geometria do conteúdo final; sem shimmer forte; aparece só após 200ms |
| **Vazio (sem dado)** | ícone discreto + "nenhum documento neste recorte" + o que fazer |
| **Vazio (filtro)** | mostra os filtros ativos + botão "limpar filtros" — distinto do acima |
| **Erro** | o que falhou, em português, sem stack; botão "tentar novamente"; contorno `--danger` |
| **Parcial** | dado incompleto: mostra o que tem + aviso de cobertura. Nunca esconder o parcial |

---

## 5. Gráficos (ECharts)

**Regras**

1. Nenhuma página monta `option` direta. Só wrappers: `<BarChart>`, `<LineChart>`,
   `<Heatmap>`, `<Sankey>`, `<Treemap>`, `<Sparkline>`.
2. Tema ECharts derivado dos tokens CSS, com troca light/dark sem remount.
3. **Sem 3D. Sem gauge decorativo. Sem pizza com mais de 5 fatias.**
   Com 19 naturezas, barra horizontal ordenada é a resposta.
4. Eixo de valor começa em zero em gráfico de barras. Sem exceção.
5. Tooltip mostra valor absoluto **e** percentual do total, mais o grão
   ("38 vínculos · 25% dos vínculos").
6. Toda série tem, além da cor, um segundo canal de distinção (ordem, rótulo direto ou
   padrão) — cor sozinha não é acessível.
7. Rótulo direto na série quando houver ≤ 5 séries; legenda só acima disso.
8. Clique em elemento de gráfico navega para o Explorer filtrado.
9. Gráfico com menos de 3 pontos não é gráfico: mostrar o número.

**Escolha de forma**

| Pergunta | Forma | Não usar |
|---|---|---|
| evolução no tempo | barras (contagem) ou linha (tendência) + média móvel 3m | área empilhada com muitas séries |
| ranking de categorias | barra horizontal ordenada | pizza, donut |
| composição no tempo | área 100% | barras empilhadas absolutas para mix |
| cruzamento de duas dimensões | heatmap | grafo |
| fluxo entre dois conjuntos | Sankey, **só com filtro** | Sankey sem filtro |
| parte/todo hierárquico | treemap | sunburst |
| valor único com contexto | KPI + sparkline | gauge |

---

## 6. Interação

- **Command palette (`⌘K` / `Ctrl+K`)**: busca de documento, navegação entre páginas,
  ações. Com 296 documentos, a busca é local e instantânea.
- **Atalhos:** `/` foca a busca · `Esc` fecha overlay · `g o` Overview · `g e` Explorer ·
  `g v` Governance · `↑↓` navega a lista · `Enter` abre o detalhe · `?` mostra os atalhos.
- **Hover** revela ação secundária e proveniência; nunca esconde informação essencial.
- **Drill-through universal:** todo número navega. KPI que não navega é número morto.
- **Filtros na URL** — a visão é compartilhável e reproduzível.
- **Nenhuma ação destrutiva existe** na aplicação: é um produto de leitura. Não há
  botão que altere a fonte, e isso é intencional.

**Movimento**

| Transição | Duração | Curva |
|---|---|---|
| hover, foco | 120ms | `ease-out` |
| drawer, popover | 200ms | `cubic-bezier(.16,1,.3,1)` |
| troca de página | 180ms | fade + 4px de deslocamento |
| entrada de gráfico | 400ms | `ease-out`, uma vez, sem stagger longo |

`prefers-reduced-motion: reduce` desliga tudo, mantendo só opacidade.

---

## 7. Responsividade

| Breakpoint | Layout |
|---|---|
| `< 640` | uma coluna; sidebar em drawer; tabela vira cards; gráficos com altura reduzida |
| `640–1024` | duas colunas; sidebar colapsada em ícones |
| `1024–1440` | layout completo; sidebar expandida |
| `> 1440` | conteúdo centralizado em 1440px; densidade maior nas tabelas |

O uso real é desktop. Mobile precisa ser **usável** (consultar um documento, ver um
KPI), não completo — um heatmap 19×13 não cabe em 375px e não deve tentar.

---

## 8. Temas

- Três estados: `light`, `dark`, `system` (padrão).
- Preferência em `localStorage`; `system` acompanha `prefers-color-scheme`.
- Troca **sem** flash: classe no `<html>` aplicada antes da primeira pintura.
- **Os dois temas são primários.** Nada de dark mode como inversão automática — as
  duas paletas são especificadas, e a paleta de dados é validada nas duas.

---

## 9. Acessibilidade

- Contraste ≥ 4.5:1 em texto, ≥ 3:1 em elemento gráfico e borda de controle.
- Anel de foco visível em **tudo** que recebe foco (`0 0 0 3px accent/20%` + borda).
- Navegação completa por teclado, incluindo tabela e gráficos (versão em tabela
  acessível por trás de cada gráfico).
- `aria-label` em ícone sem texto; `aria-live` em resultado de filtro
  ("47 documentos encontrados").
- Nenhuma informação transmitida **só** por cor.
- Ordem de foco = ordem visual. Skip link para o conteúdo.

---

## 10. Microcópia

- Português do Brasil, direto. Sem jargão de dashboard.
- Rótulos dizem o **grão**: "vínculos documento-tema", não "total de temas".
- Data em pt-BR (`10/09/2026`); data de precisão mensal como `mar/2026`, com tooltip
  "documento de periodicidade mensal — dia não informado na fonte".
- Termos do domínio (Parceiro, Órgão Contratante, Programa, executora, eventograma) têm tooltip com a
  definição do `docs/GLOSSARIO.md`. Um produto de inteligência jurídica que não explica
  suas siglas é um produto para quem já sabe tudo.
- Erro diz o que aconteceu e o que fazer, nunca só "erro inesperado".
- Nada de exclamação, nada de emoji na interface.
