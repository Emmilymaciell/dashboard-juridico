# state/

Estado de execução da aplicação. **Não versionado.** Não confundir com `STATE.md`, na
raiz, que é o estado *do projeto* (documentação, versionada).

Arquivos previstos (Fase 2):

| Arquivo | Conteúdo |
|---|---|
| `last_snapshot.json` | ponteiro para o snapshot corrente e suas contagens de controle |
| `pipeline_runs.jsonl` | histórico de execuções: início, fim, etapas, achados, resultado |
| `source_inventory_<snapshot>.json` | inventário da fonte antes/depois, para o teste de imutabilidade |

Regras: conteúdo descartável e reconstruível · nunca guardar dado de documento aqui,
só metadado de execução · apagar a pasta não quebra nada, apenas perde histórico local.
