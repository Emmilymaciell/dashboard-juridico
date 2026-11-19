"""Etapa 5 — carga em Parquet (camada durável) e DuckDB (camada consultada).

A carga é ATÔMICA: grava em `prog.duckdb.tmp` e só então substitui. Falha no meio deixa
o banco anterior intacto — a API nunca vê um banco pela metade.

Parquet é a camada durável; o `.duckdb` é descartável e reconstruível (DEC-003, DEC-013).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

from backend.app.core.config import Settings
from backend.pipeline.steps.normalize import Model

# Colunas cujo tipo precisa ser fixado: uma tabela vazia ou toda-nula viraria `null`
# no Arrow e quebraria a query depois. Declarar é mais barato que depurar.
FORCED_TYPES: dict[str, dict[str, pa.DataType]] = {
    "fct_documento": {
        "documento_id": pa.int64(),
        "necessidade_resposta": pa.int64(),
        "ano": pa.int64(),
        "temas_count": pa.int64(),
        "rodovias_count": pa.int64(),
        "ativo": pa.bool_(),
        "link_disponivel": pa.bool_(),
        "arquivo_copia_office": pa.bool_(),
        "nome_conforme_padrao": pa.bool_(),
        "data_indexacao_aproximada": pa.bool_(),
        "destinatario_generico": pa.bool_(),
    },
    "br_documento_tema": {"documento_id": pa.int64(), "ordem": pa.int64()},
    "br_documento_rodovia": {"documento_id": pa.int64()},
    "fct_varredura": {
        "novos": pa.int64(),
        "modificados": pa.int64(),
        "excluidos": pa.int64(),
        "reaparecidos": pa.int64(),
        "total_na_pasta": pa.int64(),
        "total_no_indice": pa.int64(),
    },
    "fct_arquivo_fisico": {"tamanho_bytes": pa.int64(), "indexado": pa.bool_()},
}


def _to_table(name: str, rows: list[dict]) -> pa.Table:
    if not rows:
        return pa.table({})
    columns = list(rows[0].keys())
    forced = FORCED_TYPES.get(name, {})
    arrays = {}
    for column in columns:
        values = [row.get(column) for row in rows]
        target = forced.get(column)
        if target is not None:
            arrays[column] = pa.array(values, type=target)
        elif all(v is None for v in values):
            arrays[column] = pa.array(values, type=pa.string())
        else:
            arrays[column] = pa.array(values)
    return pa.table(arrays)


def write_parquet(model: Model, settings: Settings, cycle_id: str) -> dict[str, Path]:
    directory = settings.data_processed / cycle_id
    directory.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for name, rows in model.tables.items():
        if not rows:
            continue
        path = directory / f"{name}.parquet"
        pq.write_table(_to_table(name, rows), path, compression="zstd")
        written[name] = path
    (directory / "meta_ciclo.json").write_text(
        json.dumps(model.meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return written


def load_duckdb(model: Model, settings: Settings, cycle_id: str) -> Path:
    parquet_files = write_parquet(model, settings, cycle_id)

    final = settings.duckdb_path
    final.parent.mkdir(parents=True, exist_ok=True)
    tmp = final.with_suffix(final.suffix + ".tmp")
    for stale in (tmp, Path(str(tmp) + ".wal")):
        if stale.exists():
            stale.unlink()

    connection = duckdb.connect(str(tmp))
    try:
        for name, path in parquet_files.items():
            connection.execute(
                f'CREATE OR REPLACE TABLE "{name}" AS '
                f"SELECT * FROM read_parquet('{path.as_posix()}')"
            )
        # Visão de conveniência: documento já com tema atomizado, para filtro por tema.
        if "br_documento_tema" in parquet_files:
            connection.execute(
                """
                CREATE OR REPLACE VIEW vw_documento_tema AS
                SELECT d.*, t.tema, t.ordem AS tema_ordem
                FROM fct_documento d
                LEFT JOIN br_documento_tema t USING (documento_id)
                """
            )
        if "br_documento_rodovia" in parquet_files:
            connection.execute(
                """
                CREATE OR REPLACE VIEW vw_documento_rodovia AS
                SELECT d.*, r.rodovia AS rodovia_vinculo, r.campo_origem, r.confianca
                FROM fct_documento d
                LEFT JOIN br_documento_rodovia r USING (documento_id)
                """
            )
        connection.execute("CHECKPOINT")
    finally:
        connection.close()

    # Substituição atômica na medida do que o Windows permite.
    if final.exists():
        backup = final.with_suffix(final.suffix + ".old")
        if backup.exists():
            backup.unlink()
        os.replace(final, backup)
        try:
            os.replace(tmp, final)
        finally:
            if backup.exists():
                backup.unlink()
    else:
        os.replace(tmp, final)

    (settings.state_dir / "last_cycle.json").write_text(
        json.dumps(
            {
                "ciclo_id": cycle_id,
                "duckdb_path": str(final),
                "parquet_dir": str(settings.data_processed / cycle_id),
                "meta": model.meta,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    _prune_parquet(settings.data_processed, keep_last=6)
    return final


def _prune_parquet(root: Path, keep_last: int) -> None:
    import shutil

    cycles = sorted(
        (p for p in root.glob("*") if p.is_dir() and (p / "meta_ciclo.json").exists()),
        reverse=True,
    )
    for stale in cycles[keep_last:]:
        shutil.rmtree(stale, ignore_errors=True)
