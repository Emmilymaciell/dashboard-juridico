# Validacao — comandos deste projeto

Carregar quando for preciso RODAR verificacao: no `/session-close` sempre que houve
mudanca de codigo; no `/session-start` so com o argumento `baseline`.

Todos rodam na raiz do projeto. Registrar sempre **comando exato + resultado real**
(contagens, nao adjetivos). Nunca escrever "passou" sem ter rodado nesta sessao.

## Qual rodar, por tipo de mudanca

| Mudou | Rodar |
|---|---|
| so documentacao / `.claude/` | nenhum teste; conferir links e caminhos citados |
| `frontend/` | typecheck · lint · vitest · build |
| `backend/app/` | pytest de `tests/backend` · ruff |
| `backend/pipeline/` ou `config/` | pytest completo · ruff |
| baseline (`/session-start baseline`) | todos abaixo |

## Comandos

```
python -m pytest tests -q
python -m pytest tests/backend -q
python -m ruff check .
cd frontend; npx tsc -b
cd frontend; npx eslint src --max-warnings 0
cd frontend; npm run test
cd frontend; npm run build
```

## Vermelho conhecido (nao e regressao)

`python -m pytest tests` falha em `tests/pipeline/test_pipeline_integracao.py` desde
que a fonte mudou por fora (16/09/2026) e nao foi reprocessada: `normalize.py` chama
`.isoformat()` sobre `str`. Comparar com a contagem registrada no `STATE.md`: o mesmo
numero de falhas, so nesse arquivo, e o estado conhecido; qualquer falha FORA dele e
regressao. Nao corrigir isso dentro de outra tarefa, e nunca rodando
`refresh_data.ps1` sem pedido explicito.

## Se nao der para rodar

Registrar: verificacao nao executada · motivo · risco residual. Exemplo real: em
30/09/2026 o Windows (Controle de Aplicativo) bloqueou a DLL do `duckdb` e a API nao
subia — isso derruba pytest e servidor, e precisa aparecer no relatorio como bloqueio
de ambiente, nao como falha de codigo.

## Verificacao em tela

Visual se confirma no DOM, nao em captura: o HMR do Vite serve quadro velho e o
painel do navegador nao desenha com a janela atras (ver "Armadilhas" no handoff).
Subir com `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000` e
`cd frontend; npm run dev` — o `start_dev.ps1` roda o pipeline se o banco faltar.
Ao terminar, parar os dois (o `npm` deixa o `vite` orfao na porta 5173).
