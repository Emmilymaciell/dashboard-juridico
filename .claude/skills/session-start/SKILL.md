---
name: session-start
description: Protocolo oficial de ABERTURA de sessao deste projeto. Reconstroi o estado real pelo repositorio (regras, STATE, handoff, Git, disco, ultimo ciclo do pipeline), reconcilia, entrega um briefing e PARA sem implementar nada. Use ao abrir uma sessao nova, depois de /compact ou ao retomar dias depois.
argument-hint: "[baseline]"
disable-model-invocation: true
---

# /session-start — abrir uma sessao

**A conversa e descartavel; o repositorio e a fonte canonica.** Esta skill reconstroi
o contexto SO a partir do disco e do Git, como se nenhuma conversa anterior existisse.

## Modo: somente leitura, do inicio ao fim

Enquanto esta skill estiver em execucao, e ate a usuaria autorizar trabalho novo:

- NAO editar, criar ou apagar arquivo; NAO corrigir "rapidinho" nada que aparecer;
- NAO commitar, fazer push, stash, reset, checkout, clean, nem trocar de branch;
- NAO instalar dependencia; NAO subir servidor;
- NAO rodar `refresh_data.ps1`, o pipeline, nem `01_discovery.py` (este grava em `output/`);
- NAO usar Higgsfield.

Permitido: ler arquivos, `git` de leitura, e o script read-only desta skill. Testes so
quando o argumento `baseline` for passado (ver passo 6).

## Retrato automatico do Git (gerado na invocacao)

```!
git rev-parse --show-toplevel 2>&1 || echo "SEM GIT: adaptar o relatorio, nao inventar Git"
git branch --show-current 2>&1 || true
git rev-parse HEAD 2>&1 || true
git status --porcelain=v1 -uall 2>&1 | head -40 || true
git log --oneline -12 2>&1 || true
git remote -v 2>&1 || true
```

Se o bloco acima vier vazio ou como texto literal (execucao de shell desabilitada),
rode esses mesmos comandos antes de seguir.

## Passos

**1. Confirmar o projeto.** A raiz acima precisa terminar em `dashboard_juridico`.
Se nao terminar, pare e diga onde esta. Classifique o status em staged / unstaged /
untracked. Alteracao local que ninguem explicou e do usuario: so registrar, nunca mexer.

**2. Ler as regras, nesta ordem e so isto:**
`CLAUDE.md` -> `STATE.md` -> `docs/SESSION_HANDOFF.md` (secoes "Proxima tarefa EXATA",
"Nao mexer", "Armadilhas" e a ultima entrada do "Registro de sessoes").
`docs/DECISIONS.md`: ler so as DEC citadas no handoff/STATE como recentes ou ligadas a
proxima tarefa (`grep -n "^## DEC-"` para achar). `config/regras_negocio.json`,
`docs/ROADMAP.md`, `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) e o resto de `docs/`: so se a proxima tarefa
tocar o assunto. Nao varrer o codigo.

**3. Reconciliar Git x documentacao.** STATE e handoff registram o *HEAD funcional* — o
ultimo commit antes do commit `docs:` de encerramento, que nao consegue citar o proprio
hash. Rode `git log --name-only --format="%h %s" <HEAD registrado>..HEAD`:
- vazio -> bate;
- so commits que tocam documentacao (`*.md`, `docs/`, `.claude/`) -> **consistente**,
  liste-os;
- qualquer commit com codigo -> **DIVERGENCIA**: o estado escrito esta atrasado.
Compare tambem a branch e a arvore (limpa?) com o registrado.

**4. Checkpoint do pipeline e da fonte.** Rode:
`python -B .claude/skills/session-start/scripts/fonte_vs_ciclo.py`
Ele compara o hash do `00 Indice.xlsx` atual com o do ultimo ciclo processado
(`state/last_cycle.json`, que e local e nao versionado). `DIVERGENTE` significa que todo
numero do STATE e da tela descreve uma fonte que ja mudou — reportar, nunca reprocessar.
Os numeros do STATE tem prazo de validade: cite-os sempre com a data do ciclo.

**5. Classificar o que existe**, com evidencia (commit, arquivo, teste):
concluido · parcialmente concluido · em andamento (arvore suja) · pendente · bloqueado.
Preserve as categorias do projeto: `DADO EXISTENTE` / `DERIVADO` / `INFERENCIA` /
`HIPOTESE` / `NAO DISPONIVEL` e `confirmed_business_rule`. Intencao nao e entrega;
hipotese nao e fato; teste registrado nao e teste executado.

**6. Validacao.** Sem argumento: reporte o ultimo resultado REGISTRADO (tabela de testes
do STATE, com a data) e escreva "nenhum teste executado nesta sessao". Com `baseline`
(`$ARGUMENTS`): rode os comandos de
[../session-close/references/validacao.md](../session-close/references/validacao.md) e
registre comando exato + resultado real. O `pytest` vermelho por causa da fonte nao
reprocessada e risco conhecido, nao regressao — nao tentar corrigir.

**7. Proxima unidade de trabalho.** Uma so, a menor coerente, tirada do handoff
("Proxima tarefa EXATA") e das pendencias — nao replanejar o projeto. Objetivo, motivo,
criterio de conclusao, arquivos provaveis, riscos, verificacoes esperadas.

**8. Numero da sessao.** O ultimo numero esta no "Registro de sessoes" do handoff
(`### N — Nome · datas`). Sugira `N+1 - <nome curto da proxima unidade>` e
`/rename N+1 - <nome>`. Se houver ambiguidade, diga que ha e nao invente.

**9. Perguntar so o que o repositorio nao responde** (decisao de produto, aprovacao de
risco). Nunca inventar resposta para evitar perguntar.

## Briefing (formato fixo, campos inaplicaveis dizem "nao se aplica")

```
PROJETO        diretorio · objetivo em uma linha
SESSAO         numero sugerido · nome sugerido · objetivo proposto
GIT            branch · HEAD completo e curto · status (staged/unstaged/untracked) · remote
RECONCILIACAO  HEAD registrado x real · commits desde entao · arvore
FONTE/CICLO    saida do fonte_vs_ciclo.py (veredito + data do ciclo)
CONCLUIDO / PARCIAL / EM ANDAMENTO / PENDENTE   com a evidencia de cada item
PROXIMA TAREFA EXATA + CRITERIOS DE CONCLUSAO
ARQUIVOS DE ALTO SINAL   para a proxima tarefa, e so eles
DECISOES RELEVANTES      DEC-NNN que restringem a proxima tarefa
SKILLS / SUBAGENTES      /discovery, /versionar, /code-review, Explore... so os uteis
VALIDACAO      ultimo resultado registrado (data) · executado agora (comando + resultado)
PENDENCIAS / BLOQUEIOS
INCONSISTENCIAS   STATE x handoff x Git x disco x fonte — cada uma, sem corrigir
```

Ao final, escrever exatamente:

"Contexto reconstruído. Nenhuma alteração foi realizada."

e PARAR. Nao comecar a proxima tarefa. Esperar autorizacao explicita da usuaria. Se,
mesmo assim, algo no disco tiver mudado durante esta skill (nao deveria), dizer o que.
