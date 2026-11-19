# dashboard_juridico

**Legal Intelligence Dashboard do acervo jurídico do Escritório Jurídico no contexto Programa / Fundo.**

Este arquivo é a memória permanente do projeto. Uma sessão nova do Claude Code deve
conseguir ler **somente este arquivo** e entender o que o sistema é, onde estão os
dados, o que pode e o que não pode ser alterado, em que fase estamos e como continuar.

- **Raiz do projeto:** `C:\caminho\exemplo\dashboard-juridico`
- **Estado atual da obra:** `STATE.md` (leia sempre em seguida a este arquivo)
- **Decisões técnicas:** `docs/DECISIONS.md`
- **Descobertas sobre os dados reais:** `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real)

---

## 1. O que este produto é

Uma aplicação web de **Legal Intelligence / Legal Operations / Document Intelligence /
Executive Analytics** sobre o acervo jurídico produzido pelo **Escritório Jurídico**
para o **Programa** (consórcio responsável pela estruturação de obras do Fundo no Estado).

Não é "um dashboard de gráficos". É um produto que responde perguntas de negócio de
coordenação, gestão e diretoria:

- o que o Escritório Jurídico está produzindo, em que volume, com que evolução no tempo;
- que naturezas de documento, que temas, que destinatários concentram a atuação;
- como se distribui a atuação por contrato, rodovia e executora;
- onde estão advertências, sanções, consultas, editais, seguros-garantia, notas técnicas;
- qual a **qualidade do próprio repositório** documental (Data Governance como área do produto);
- diferença entre **atividade jurídica** (produção de documentos) e **atividade de
  repositório** (varredura, indexação, exclusão) — conceitos distintos, que nunca devem
  ser somados no mesmo indicador.

### Regra de produto (vale para toda tela, KPI e gráfico)

Para cada elemento visual deve existir resposta a: **"que decisão ou entendimento
este elemento permite?"** Se não houver resposta, o elemento não entra.

Toda informação exibida é classificada em uma das cinco categorias, e a categoria é
visível na UI (badge / legenda / rodapé do card):

| Categoria | Significado | Exemplo |
|---|---|---|
| `DADO EXISTENTE` | vem literalmente da fonte | `Naturezas = "Advertência"` |
| `DADO DERIVADO` | calculado deterministicamente da fonte | contagem por mês de `Data` |
| `INFERÊNCIA` | extraído por regra/regex, confiança < 100% | rodovia `RD-101` a partir do assunto |
| `HIPÓTESE` | interpretação de negócio ainda não confirmada | agrupamento analítico não validado |
| `NÃO DISPONÍVEL` | a fonte não sustenta a informação | prazo de resposta real por documento |

**Nunca exibir hipótese como fato.** Nunca inventar métrica sem sustentação nos dados.

### Regras de negócio confirmadas — `config/regras_negocio.json`

Existe um nível **acima** de `DADO EXISTENTE`: a regra que a usuária confirmou
oficialmente. Ela vale mesmo quando a planilha ainda não a reflete.

| Proveniência | Significado |
|---|---|
| `confirmed_business_rule` | confirmado pela usuária, com data. Não é inferência; não leva badge de alerta |
| `source` | valor literal da fonte |
| `derived` | calculado da fonte |
| `analytical_derived` | camada analítica nossa (ex.: macrogrupo jurídico) — nunca apresentada como dado do Escritório Jurídico |

Regras confirmadas em 10/09/2026: mapa contrato↔rodovia↔executora · regra `RD-102`
(sem `B` explícito é `RD-102A`) · `Empreiteiras` é destinatário válido · macrogrupos
como camada derivada configurável · sem acoplamento ao projeto vizinho · exibir a sigla
`Parceiro` sem expansão.

**Toda regra de negócio vive em `config/regras_negocio.json`** (versionado, auditável) e
nunca hardcoded em código de aplicação. Alterar aquele arquivo exige registro em
`docs/DECISIONS.md`. Ver `DEC-017`.

---

## 2. Ecossistema — e o que este projeto NÃO é

```
REPOSITÓRIO DOCUMENTAL ESCRITÓRIO JURÍDICO (SharePoint / OneDrive)
        |
        v
repositorio_juridico          <- OUTRO projeto, OUTRA responsabilidade
  (varre a pasta e mantém o índice)
        |
        v
00 Indice.xlsx atualizado         <- contrato de dados entre os dois projetos
        |
        v
dashboard_juridico            <- ESTE projeto
  ingestão -> normalização -> modelo analítico -> DuckDB -> FastAPI -> React
        |
        v
Legal Intelligence Dashboard
```

- `C:\caminho\exemplo\repositorio-juridico` é um repositório Git **independente**.
  Ele é o **único** software autorizado a escrever em `00 Indice.xlsx`.
- Este projeto é **consumidor**: lê `00 Indice.xlsx` e a árvore de pastas, e nada mais.
- **Nunca** editar, importar código de, ou depender de arquivos internos daquele projeto.
  A interface entre os dois é exclusivamente o arquivo `00 Indice.xlsx` e a estrutura de
  pastas do repositório documental.
- Se o índice mudar de layout, o ajuste é feito **aqui**, na camada de ingestão, e
  registrado em `docs/DECISIONS.md`.

---

## 3. Fonte de dados — PROTEÇÃO ABSOLUTA

```
FONTE (SOMENTE LEITURA):
C:\caminho\exemplo\fonte-juridica
+-- 00 Indice.xlsx          <- principal fonte estruturada
+-- Advertencia/  Apendice/  Ata/  Checklist/  Consulta/  Contrato/
+-- Declaracao/   Despacho/  Edital/  Errata/   Manifestacao/  Minuta/
+-- Nota Tecnica/ Notificacoes/  Oficio/  Relatorio/
```

### PROIBIDO — sem exceção, sem autorização possível por código

Sobre **qualquer** arquivo ou pasta dentro da fonte:

- mover, renomear, excluir, sobrescrever, reorganizar, editar, salvar;
- alterar metadados ou timestamps;
- modificar `00 Indice.xlsx` (nem layout, nem células, nem abas, nem ordem);
- abrir o workbook em modo de escrita, mesmo "só para testar";
- criar, copiar ou depositar qualquer arquivo novo dentro da fonte
  (nem `.tmp`, nem cache, nem log, nem lock).

### PERMITIDO

- listar a árvore de pastas e arquivos;
- ler `00 Indice.xlsx` (`openpyxl` em modo leitura, ou sobre cópia local);
- ler tamanho, extensão e timestamps do sistema de arquivos;
- calcular hash quando necessário;
- **criar dados derivados exclusivamente dentro deste projeto**, em `data/`.

### Como isso é garantido tecnicamente

1. Todo acesso à fonte passa por **uma única** função de leitura na camada de ingestão.
2. A ingestão **copia** `00 Indice.xlsx` para `data/raw/` (com timestamp) e trabalha
   sobre a cópia. Nenhuma transformação toca o original.
3. Nenhuma dependência do projeto escreve na fonte. Testes de segurança em
   `tests/pipeline/` verificam que o caminho da fonte nunca aparece em operação de escrita.
4. O caminho da fonte **nunca é hardcoded** em código de aplicação: vem de `.env` /
   `config/config.json` (ver `.env.example` e `config/config.example.json`).

### Cuidado operacional: a fonte é viva e sincronizada

A pasta está sob sincronização do OneDrive **e é alimentada ativamente**. Em uma única
sessão de trabalho (10/09/2026) o acervo passou por **215 → 259 → 291 documentos** e o
índice de **154 → 296 linhas**. Consequências:

- **toda contagem física precisa registrar o instante da varredura**;
- divergência entre índice e disco pode ser sincronização ou indexação em curso, não
  erro de dado;
- **conclusão sobre a fonte tem prazo de validade**: rodar `scripts_discovery.py`
  antes de concluir qualquer coisa, em toda sessão;
- arquivos `~$*` e `.tmp` do Office podem aparecer: sempre filtrar;
- arquivos na **raiz** com prefixo `00 ` são artefatos de controle do repositório, não
  acervo (ver `DEC-015`).

---

## 4. Arquitetura

### Fluxo de dados

```
00 Indice.xlsx (fonte, RO)  +  árvore de pastas (fonte, RO)
        |  cópia com timestamp
        v
data/raw/                     snapshot imutável do que foi lido
        |  extract
        v
contratos de schema           validação estrutural (abas, colunas, tipos)
        |  normalize
        v
data/processed/*.parquet      modelo analítico (fatos + dimensões + pontes)
        |  load
        v
data/processed/prog.duckdb    banco analítico reconstruível
        |
        v
FastAPI (backend/app)         única porta de saída dos dados
        |  JSON
        v
React + TypeScript (frontend) apresentação
```

O frontend **nunca** lê Excel, nunca lê arquivo da fonte, nunca acessa o disco.
Tudo passa pela API.

### Layout do repositório

```
dashboard_juridico/
+-- .claude/                  skills e comandos do projeto
+-- backend/
|   +-- app/                  FastAPI (api/ core/ domain/ services/ repositories/ schemas/)
|   +-- pipeline/             ingestão, validação, normalização, carga (steps/ contracts/)
+-- frontend/                 React + TS + Vite + Tailwind + shadcn/ui + ECharts
+-- data/
|   +-- raw/                  snapshots da fonte (NÃO versionado)
|   +-- processed/            parquet + prog.duckdb (NÃO versionado)
|   +-- cache/                cache de trabalho (NÃO versionado)
+-- scripts/                  utilitários executáveis (discovery, rebuild, validação)
+-- config/                   regras_negocio.json (versionado) + config.json (local)
+-- docs/                     documentação viva do projeto
+-- tests/                    backend/ pipeline/ frontend/
+-- logs/  state/  output/    execução (NÃO versionado)
+-- CLAUDE.md  README.md  STATE.md
+-- .gitignore  .gitattributes  .env.example
```

**Por que `pipeline/` dentro de `backend/`:** um único ambiente Python, um único
`pyproject`, uma única suíte de testes, e reuso direto de `core/` (config) e `domain/`
(modelos) entre pipeline e API — sem duplicar schema. Ver `DEC-004`.

### Stack

| Camada | Escolha | Observação |
|---|---|---|
| Frontend | React + TypeScript **strict** + Vite | |
| Estilo | Tailwind CSS + shadcn/ui | design tokens próprios em `frontend/src/styles` |
| Gráficos | Apache ECharts | via wrapper próprio; nunca ECharts cru dentro de página |
| Backend | Python + FastAPI + Pydantic v2 | |
| Dados | pandas + openpyxl (leitura), Parquet (intermediário) | Polars só se houver ganho medido |
| Analítico | **DuckDB** | ver `DEC-003` |
| Testes | pytest (backend/pipeline), Vitest (frontend) | |

### Fora de escopo neste estágio (não introduzir)

Kubernetes, microserviços, Redis, Kafka, WebSockets, cloud, arquitetura distribuída,
IA via API, qualquer serviço externo. O volume é pequeno (296 linhas de índice,
291 documentos em 10/09/2026 16:21). A arquitetura deve **poder** crescer, não crescer
antes da hora.

**Uma exceção, e ela não é de runtime.** O Higgsfield é autorizado como ferramenta de
**desenvolvimento** para gerar asset visual sintético (`DEC-031`). A aplicação entregue
continua sem serviço externo: o que entra no produto é o arquivo de imagem, já revisado.
Nada no `backend/` nem no `frontend/` chama o Higgsfield em execução.

---

## 5. Segurança e privacidade

1. **Nenhum documento jurídico sai da máquina.** APIs externas permanecem **proibidas**
   para dados, documentos e conteúdo do acervo. Telemetria, analytics, trackers e upload
   de conteúdo documental continuam proibidos sem exceção.

   **Exceção autorizada, única e nomeada:** o **Higgsfield** pode ser usado
   exclusivamente para **geração de asset visual sintético**, sem qualquer conteúdo
   documental, pessoal, confidencial ou identificável. Prompt só com descrição visual
   genérica. A lista fechada do que é permitido e do que é proibido está em `DEC-031`; a
   skill `soul-id` é **proibida** (`DEC-032`).

   Isto **não** é autorização genérica para outras APIs. É exceção específica, limitada a
   uma ferramenta e a um propósito, e não amplia o que pode sair desta máquina. Qualquer
   outra API externa continua precisando de autorização própria.
2. Antes de adicionar qualquer dependência que faça rede: **avisar a usuária e esperar
   autorização.**
3. Nenhum documento jurídico entra no Git. `.gitignore` bloqueia `*.pdf`, `*.docx`,
   `*.xlsx`, `data/**`, `logs/**`, `output/**`, `state/**`, `*.duckdb`, `*.parquet`.
4. Nenhum segredo no Git. Somente `.env.example` e `config/config.example.json`.
5. Nomes de pessoas (colunas `Subido por` / `Modificado por`) são **dados pessoais de
   terceiros**: podem ser exibidos na aplicação local, mas nunca em commit, log público,
   issue, print compartilhado ou arquivo de exemplo.
6. Caminhos pessoais não são hardcoded no código — só em `.env` / `config.json` locais e,
   como referência de documentação, neste arquivo.

---

## 6. Git — regras deste projeto

**O Claude NUNCA commita por iniciativa própria.** Nem ao terminar tarefa, nem ao
corrigir bug, nem ao fim da sessão, nem ao gerar arquivo, nem "porque parece um bom
momento". Testes, tentativas e refinamentos ficam no disco, fora do histórico.

Commit **somente** após instrução explícita da usuária: *"commita"*, *"pode commitar"*,
*"aprovado, salva a versão"*, *"atualiza o git"*, `/versionar` ou equivalente inequívoco.
Em caso de dúvida se a frase foi um pedido de commit: **não commitar** e perguntar em
uma linha.

### Checklist obrigatório antes de cada commit autorizado

1. rodar os testes/validações relevantes e mostrar o resultado;
2. `git status`;
3. revisar o diff;
4. apontar arquivos inesperados;
5. verificar segredos e dados sensíveis (nomes de pessoas, caminhos, documentos);
6. propor a mensagem de commit;
7. commitar **depois** do "ok".

### Proibido sem pedido explícito

`git push` · `git reset --hard` · `git checkout --` · `git clean -fd` · `rebase` ·
`commit --amend` · `push --force` · criar/trocar branch no meio de um trabalho.

### Estilo de commit

A usuária lê o histórico em **Git GUI**. Commits pequenos, semanticamente coerentes,
sem misturar mudanças não relacionadas. Prefixos: `feat:` `fix:` `refactor:` `docs:`
`test:` `chore:`. Não ser dogmático; o importante é histórico legível.

Branch padrão: `main`.

---

## 7. Padrões de engenharia

**Frontend**

- TypeScript `strict`; sem `any` silencioso.
- Separação clara: `ui/` (apresentação) · `features/` (domínio) · `lib/api/` (acesso a dados).
- Componente grande é defeito: quebrar. Nada de página de 800 linhas.
- Todo estado de carregamento tem skeleton; todo vazio tem empty state; todo erro tem
  estado de erro que explica o que falhou.
- Acessibilidade: foco visível, contraste AA, navegação por teclado, `aria-*` em
  componentes interativos.
- Responsivo de verdade — inclusive tabelas (scroll horizontal contido no container,
  nunca na página).

**Backend**

- Pydantic v2 para todo contrato de entrada e saída; sem dict solto atravessando camadas.
- `core/` config centralizada (uma fonte de verdade para caminhos e parâmetros).
- `services/` regra de negócio · `repositories/` acesso ao DuckDB · `api/` só HTTP.
- Erros tratados e logados; nunca `except: pass`.
- Todo endpoint tem teste.

**Dados**

- Schema explícito e versionado em `backend/pipeline/contracts/`.
- Validar na entrada: abas, colunas esperadas, tipos, cardinalidades.
- Missing value é informação — nunca preencher com invenção; usar `NULL` e contabilizar.
- Linhagem: cada campo derivado registra de onde veio e por qual regra.
- Pipeline **reproduzível**: rodar duas vezes sobre o mesmo snapshot dá o mesmo resultado.

---

## 8. Observabilidade e QA

Precisamos poder **provar** que o dashboard está correto. Toda métrica exibida tem uma
verificação equivalente calculada direto da fonte:

```
total exibido no dashboard  ==  total calculado a partir de 00 Indice.xlsx
```

Cobrir: KPIs · filtros (isolados e combinados) · datas · links · campos multivalorados
(soma de temas maior que o nº de documentos é esperado, e precisa estar rotulado assim) ·
dados ausentes · normalização · endpoints · frontend · responsividade · estados de erro ·
ingestão idempotente.

---

## 9. Comandos

> Só `scripts/01_discovery.py` existe hoje. O restante é o contrato do que será criado
> nas fases 2 a 4 — ao implementar, atualizar este bloco **no mesmo commit**.

```powershell
# Discovery / profiling da fonte (somente leitura) — JÁ EXISTE
python scripts\01_discovery.py

# Pipeline de dados (Fase 2)
python -m backend.pipeline.run --full          # snapshot -> validar -> normalizar -> DuckDB
python -m backend.pipeline.run --validate-only # só validação, sem gravar

# API (Fase 3)
uvicorn backend.app.main:app --reload --port 8000

# Frontend (Fase 4)
cd frontend; npm install; npm run dev

# Testes
python -m pytest tests -q
cd frontend; npm run test; npm run lint; npm run typecheck
```

---

## 10. Fluxo de trabalho com a usuária

Decisões técnicas reversíveis e de escopo claro: **tomar e seguir**, registrando quando
relevante. **Parar e consultar** antes de: mudar arquitetura significativamente ·
adicionar serviço externo ou dependência pesada · tocar a fonte · remover recurso
importante · commitar · fazer push · qualquer operação destrutiva · mudar decisão de
produto que altere o objetivo.

Ao encontrar problema: não esconder, não improvisar em silêncio. Explicar, investigar,
propor solução.

Idioma: **português do Brasil**, direto ao ponto. Ao entregar arquivo, informar o
caminho completo.

---

## 11. Abrir e encerrar sessões

A conversa é descartável; o repositório é a fonte canônica. Dois protocolos oficiais,
em `.claude/skills/`:

- **`/session-start`** — abre a sessão: lê regras → `STATE.md` → handoff → Git, confere
  a fonte contra o último ciclo do pipeline, entrega um briefing e **para** sem
  implementar. `/session-start baseline` também roda os testes. `/estado` é atalho.
- **`/session-close`** — encerra: valida o que foi feito, grava em `STATE.md`, no handoff
  e em `docs/DECISIONS.md` tudo que só existia na conversa, propõe os commits e **para**.

A fonte muda rápido (em 10/09/2026 o acervo foi de 215 a 291 documentos numa tarde):
número de documentação tem prazo de validade. O `/session-start` só compara o hash do
índice; para investigar a fonte a fundo, `/discovery` (`scripts\01_discovery.py`).

Se algo neste arquivo divergir do código, o código está certo e **este arquivo precisa
ser corrigido no mesmo commit**. CLAUDE.md desatualizado é bug.
