---
name: session-close
description: Protocolo oficial de ENCERRAMENTO de sessao deste projeto. Para o desenvolvimento, reconcilia Git e disco, valida o que foi feito, persiste no repositorio tudo que so existe na conversa (STATE, handoff, registro de sessoes, decisoes), confere o Git e PARA. Use quando a usuaria pedir para encerrar ou fechar a sessao.
disable-model-invocation: true
---

# /session-close — encerrar uma sessao

**Se esta conversa sumir agora, nenhum conhecimento importante pode sumir junto.**
A proxima sessao vai comecar com `/session-start`, sem esta conversa, em qualquer
maquina. O que nao estiver no repositorio ao fim desta skill nao existe.

## O que esta skill NAO faz

- nao comeca a proxima tarefa, nao adiciona funcionalidade, nao refatora "de passagem";
- nao corrige nada fora do que a sessao ja estava fazendo;
- nao descarta, esconde, reseta, faz stash nem apaga alteracao — sua ou da usuaria;
- nao commita sem ordem explicita da usuaria, nem faz push (`CLAUDE.md` §6);
- nao declara teste que nao rodou, investigacao como entrega, intencao como resultado,
  hipotese como fato;
- nao roda `refresh_data.ps1`, pipeline nem Higgsfield.

Se houver trabalho pela metade, ele fica pela metade — registrado como tal.

## Retrato automatico do Git (gerado na invocacao)

```!
git rev-parse --show-toplevel 2>&1 || echo "SEM GIT"
git branch --show-current 2>&1 || true
git rev-parse HEAD 2>&1 || true
git status --porcelain=v1 -uall 2>&1 | head -60 || true
git diff --stat 2>&1 | tail -25 || true
git diff --cached --stat 2>&1 | tail -25 || true
git log --oneline -15 2>&1 || true
```

Se o bloco vier vazio ou literal, rode esses comandos antes de seguir.

## Passos

**1. Parar e reconciliar.** Confirme que a raiz termina em `dashboard_juridico`.
Separe as alteracoes locais em: da sessao (voce sabe por que existem) e alheias (nao
explicadas — do usuario; so registrar). Liste os commits feitos nesta sessao.

**2. Auditar a sessao.** Pergunta obrigatoria: *"o que importante esta so nesta
conversa?"* Percorra a conversa e classifique: concluido (com commit ou arquivo) ·
parcial · investigado e nao implementado · descoberta · decisao · hipotese (e descartada)
· bug encontrado · limitacao · risco · bloqueio · pergunta aberta · arquivos criados e
modificados · alteracoes nao commitadas. Defeito encontrado e nao corrigido e pendencia,
com sintoma, causa e correcao proposta.

**3. Validar o que foi feito.** Carregue
[references/validacao.md](references/validacao.md) e rode SO o que corresponde ao que
mudou. Registre comando exato + resultado real. O que nao der para rodar: registrar
motivo e risco. Sessao sem mudanca de codigo: nenhum teste, e dizer isso.

**4. Persistir.** Carregue [references/persistencia.md](references/persistencia.md) e
grave cada item do passo 2 no lugar dele. Minimo obrigatorio de toda sessao:
- `STATE.md` como snapshot do AGORA (corrigir o obsoleto, nao empilhar);
- topo de `docs/SESSION_HANDOFF.md` (onde paramos, proxima tarefa, nao mexer);
- uma entrada nova no "Registro de sessoes", com o numero seguinte;
- `DEC-NNN` so se houve decisao duravel de verdade.
Preserve as categorias do projeto (`DADO EXISTENTE` ... `NAO DISPONIVEL`,
`confirmed_business_rule`); nada de dado pessoal de terceiro nem caminho pessoal.

**5. Checkpoint do pipeline.** Rode
`python -B .claude/skills/session-start/scripts/fonte_vs_ciclo.py` e registre no STATE o
veredito com a data: qual ciclo esta no banco e se a fonte mudou depois dele. Se a sessao
rodou o pipeline, o `ciclo_id` novo e as contagens vem de `state/last_cycle.json`.

**6. Definir UMA proxima unidade.** Acao executavel, nunca "continuar o trabalho":
objetivo · criterio de conclusao · dependencias · arquivos de alto sinal · riscos ·
verificacoes esperadas · skills/subagentes uteis. Gravar no STATE e no handoff.

**7. Git.** Mostre `git status` e `git diff --stat` finais. Se a usuaria ja tiver dado
ordem explicita de commit nesta sessao para este trabalho, siga o checklist de
`CLAUDE.md` §6. Caso contrario, proponha:
- os commits de trabalho pendente, cada um atomico;
- um commit `docs:` SEPARADO so com STATE / handoff / DECISIONS;
com a mensagem sugerida, e ESPERE "commita". Nunca push.

## Relatorio final (formato fixo; campo inaplicavel diz "nao se aplica")

```
SESSAO            numero · nome · objetivo
REPOSITORIO       diretorio · branch · HEAD · working tree
CONCLUIDO / PARCIAL / INVESTIGADO-NAO IMPLEMENTADO
DESCOBERTAS · DECISOES DURAVEIS · HIPOTESES E QUESTOES ABERTAS
VALIDACOES        comando -> resultado (ou: nao executada, motivo, risco)
ALTERACOES NAO COMMITADAS   da sessao x alheias
DOCUMENTACAO ATUALIZADA     arquivo -> o que mudou
FONTE/CICLO       veredito do fonte_vs_ciclo.py
INCONSISTENCIAS   o que nao bate e nao foi resolvido
PROXIMO PASSO EXATO + ARQUIVOS DE ALTO SINAL + SKILLS/AGENTES
RISCOS / BLOQUEIOS
GIT FINAL         branch · HEAD · status · commits propostos aguardando ordem
/rename SUGERIDO  /rename N - Nome
```

Terminar exatamente com:

"Handoff concluído. Nenhuma nova implementação foi iniciada."

e PARAR.
