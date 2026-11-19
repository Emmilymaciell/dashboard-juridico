# Persistencia — onde cada informacao mora neste projeto

Carregar no `/session-close`, no passo de persistir. Cada fato vai para UM lugar; os
outros apontam para ele. Nao duplicar.

| Tipo | Destino | Regra |
|---|---|---|
| Regra permanente do projeto | `CLAUDE.md` | so com pedido da usuaria; CLAUDE.md desatualizado e bug |
| Regra de negocio confirmada | `config/regras_negocio.json` + DEC em `docs/DECISIONS.md` | nunca sem confirmacao explicita da usuaria |
| Estado atual (snapshot) | `STATE.md` | so o AGORA; corrigir o obsoleto, nao acrescentar diario |
| Mapa de retomada | `docs/SESSION_HANDOFF.md`, topo | curto: onde paramos, nao mexer, proxima tarefa, armadilhas |
| Historico da sessao | `docs/SESSION_HANDOFF.md`, "Registro de sessoes" | uma entrada por sessao, mais nova em cima |
| Decisao duravel | `docs/DECISIONS.md` (`DEC-NNN`) | so decisao que restringe trabalho futuro; > 1 pagina vira `docs/adr/` |
| Descoberta sobre os dados reais | `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) | com data e instante da varredura |
| Tela / design aprovado | `docs/GOLDEN_SCREEN_TIMELINE.md`, `docs/UI_UX.md`, `docs/VISUAL_REDESIGN.md` | so o que foi aprovado em tela |
| Fases e backlog | `docs/ROADMAP.md` | marcar so o que tem evidencia |
| Checkpoint do pipeline | `state/last_cycle.json` + `data/raw/` | gerados pelo pipeline; NUNCA editar a mao |
| Armadilha tecnica que custou tempo | handoff, "Armadilhas" | sintoma + causa + como evitar |

Nomes de pessoas (`Subido por`, `Modificado por`), caminhos pessoais e conteudo do
acervo NAO entram em nenhum destes arquivos (`CLAUDE.md` §5).

## STATE.md — o que conferir

Linha "Ultima atualizacao" com data e nome da sessao · "Fase atual" · tabela "Estado do
Git" (branch, **HEAD funcional**, arvore, push) · tabela de testes com a DATA e os
comandos exatos · "Proximo passo imediato" · "Pendencias conhecidas" · secoes de tela
que mudaram. Apagar o que deixou de ser verdade. Numeros da fonte so com o `ciclo_id`.

**HEAD funcional:** o ultimo commit ANTES do commit `docs:` de encerramento (que nao
consegue citar o proprio hash). O `/session-start` sabe disso e trata como consistente
qualquer commit posterior que so toque documentacao.

## Handoff — topo

Atualizar: "Onde estamos" · "O que esta aprovado" / "NAO esta aprovado" · "Nao mexer" ·
"Proxima tarefa EXATA" · "Estado Git" (+ a linha nova no historico da branch) ·
"Ajustes ja percorridos" · "Armadilhas". Dizer tambem o que a proxima sessao NAO
precisa reler.

## Entrada no "Registro de sessoes" (modelo)

```
### N — Nome da sessao · DD–DD/MM/AAAA

**Objetivo.** uma frase.

**Resultados.** o que foi entregue, com commit.

**Decisoes duraveis.** DEC-NNN (uma linha cada) — ou "nenhuma".

**Descobertas.** o que se aprendeu sobre dado, ambiente ou ferramenta.

**Testes no encerramento.** comando -> resultado, um por linha; ou "nao executados: motivo".

**HEAD final.** hash curto, arvore, remote.

**Proximo passo.** uma acao executavel.
```

O numero N continua a sequencia do registro. Sessao sem trabalho funcional tambem entra.

## DEC nova (formato do arquivo)

```
## DEC-NNN — Titulo afirmativo

**Data.** DD/MM/AAAA · **Status.** aceita · **Depende de** `DEC-XXX` (se houver)

Contexto: o problema, em um paragrafo.

**Alternativas.** cada uma com o motivo da rejeicao.

**Decisao.** o que vale daqui em diante, e onde a regra vive no codigo.

**Consequencia.** o que isso obriga ou proibe.
```

Inserir antes de "## Perguntas abertas", com o proximo numero livre.

## Git dos documentos

`STATE.md` e `docs/SESSION_HANDOFF.md` entram num commit `docs:` PROPRIO, nunca junto
com funcionalidade. Commit so com ordem explicita da usuaria (`CLAUDE.md` §6).
