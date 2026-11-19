# .claude/skills/

Skills especificas deste projeto — procedimentos repetiveis que uma sessao futura do
Claude Code deve seguir do mesmo jeito, toda vez.

Formato: uma pasta por skill, com `SKILL.md` dentro.

Existentes:

| Skill | O que faz |
|---|---|
| `session-start` | protocolo oficial de ABERTURA: reconstroi o estado pelo repositorio, reconcilia e PARA |
| `session-close` | protocolo oficial de ENCERRAMENTO: valida, persiste em STATE/handoff/DECISIONS e PARA |

`/estado` (em `.claude/commands/`) e atalho de `/session-start`. As pastas
`higgsfield-*` sao de terceiros e ficam fora do Git (`.gitignore`).

Candidatas identificadas (criar quando o procedimento existir de fato, nao antes):

| Skill | Quando | Fase |
|---|---|---|
| `rodar-pipeline` | executar ingestao, conferir reconciliacao, reportar achados | 2 |
| `validar-dashboard` | provar que um KPI da UI bate com o calculo direto na fonte | 5 |
| `revisar-fonte` | reconferir a fonte apos mudanca no repositorio do Escritório Jurídico | 2 |

Nao criar skill que so repita o que ja esta em `CLAUDE.md`.
