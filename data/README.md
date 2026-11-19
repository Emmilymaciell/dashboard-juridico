# data/

Dados **derivados**, dentro do projeto. **Nada aqui vai para o Git.**
A fonte original nunca é modificada — ver `CLAUDE.md`, seção 3.

```
data/
├── raw/         snapshots da fonte, imutáveis depois de gravados
├── processed/   modelo analítico (Parquet) + prog.duckdb
└── cache/       trabalho intermediário, descartável a qualquer momento
```

## `raw/` — a fronteira com a fonte

Único lugar do projeto onde existe cópia da fonte. Escrito **só** pela etapa de
snapshot da ingestão; nenhuma transformação altera um snapshot já gravado.

```
raw/00_Indice_<snapshot_id>.xlsx      cópia byte-a-byte de 00 Indice.xlsx
raw/filesystem_<snapshot_id>.json     inventário do disco no instante da varredura
```

`snapshot_id` é o timestamp ISO da varredura (ex.: `2026-09-10T15-30-05`). Toda tabela
do modelo carrega esse id — é o que dá linhagem e reprodutibilidade.

## `processed/` — o modelo analítico

Parquet é a camada **durável**; `prog.duckdb` é a camada **consultada** pela API e é
descartável: reconstrói em segundos a partir de `raw/`. Ver `DEC-003` e `DEC-013`.

## `cache/`

Pode ser apagada inteira sem consequência. Se algo aqui virar necessário, ou é
`processed/`, ou é bug.

---

## Regras

1. Nenhum arquivo desta pasta entra no Git (`.gitignore` bloqueia `data/**`, `*.xlsx`,
   `*.pdf`, `*.docx`, `*.duckdb`, `*.parquet`).
2. Contém **documentos e dados pessoais de terceiros** — não copiar para fora do
   projeto, não anexar em issue, não enviar para serviço externo.
3. `raw/` é somente-escrita-uma-vez. Corrigir um snapshot é gerar outro.
4. Tudo aqui é reconstruível. Apagar `data/` inteira e rodar o pipeline de novo deve
   produzir o mesmo resultado, desde que a fonte não tenha mudado.
5. Limpeza: manter os últimos snapshots relevantes; snapshots antigos podem ser
   apagados sem cerimônia.
