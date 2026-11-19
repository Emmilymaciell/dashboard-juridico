"""Orquestrador do pipeline: snapshot -> extract -> validate -> normalize -> load.

    python -m backend.pipeline.run --full
    python -m backend.pipeline.run --validate-only
    python -m backend.pipeline.run --reuse-cycle 2026-09-10T17-00-00

Um ciclo, um estado. Se a fonte mudar durante a execução, o ciclo termina com o que
capturou; a próxima execução pega o estado novo (DEC-020).
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import json
import sys
from collections import Counter

from backend.app.core.config import get_business_rules, get_settings
from backend.pipeline.contracts import indice_v1
from backend.pipeline.steps import extract as extract_step
from backend.pipeline.steps import load as load_step
from backend.pipeline.steps import normalize as normalize_step
from backend.pipeline.steps import snapshot as snapshot_step

for stream in (sys.stdout, sys.stderr):
    with contextlib.suppress(AttributeError, ValueError):  # pragma: no cover
        stream.reconfigure(encoding="utf-8", errors="replace")

EXIT_OK = 0
EXIT_CONTRACT = 2
EXIT_ERROR = 3


def _log(message: str) -> None:
    print(f"  {message}", flush=True)


def run(full: bool = True, validate_only: bool = False, reuse_cycle: str | None = None) -> int:
    settings = get_settings()
    rules = get_business_rules()
    started = dt.datetime.now()

    print("=" * 74)
    print("PIPELINE — dashboard_juridico")
    print("=" * 74)
    _log(f"fonte (somente leitura) : {settings.source_root}")
    _log(f"regras de negócio       : v{rules.version} (confirmadas em {rules.confirmed_at})")

    # 1. snapshot -------------------------------------------------------------
    if reuse_cycle:
        snap = snapshot_step.load(settings, reuse_cycle)
        if snap is None:
            print(f"ERRO: ciclo {reuse_cycle} não encontrado em {settings.data_raw}")
            return EXIT_ERROR
        _log(f"reusando snapshot       : {snap.cycle_id}")
    else:
        snap = snapshot_step.capture(settings, rules)
        _log(f"ciclo                   : {snap.cycle_id}")
        _log(f"índice sha256           : {snap.index_fingerprint['sha256'][:16]}…")
        _log(f"acervo físico           : {snap.inventory.total_acervo} documento(s)")
        _log(f"arquivos de controle    : {len(snap.inventory.control_files)}")

    # 2. extract --------------------------------------------------------------
    extracted = extract_step.extract(snap.index_copy)
    _log(f"linhas no índice        : {len(extracted.rows)}")
    _log(f"hyperlinks              : {len(extracted.hyperlinks)}")
    _log(f"varreduras no log       : {len(extracted.log_atualizacao)}")

    # 3. validate (contrato estrutural — bloqueante) --------------------------
    report = indice_v1.validate_structure(extracted.sheetnames, extracted.header, extracted.rows)
    if not report.ok:
        print()
        print("*** QUEBRA DE CONTRATO ESTRUTURAL DO ÍNDICE ***")
        for violation in report.violations:
            print(f"  - {violation}")
        print()
        print("O layout de 00 Indice.xlsx mudou. A ingestão precisa ser revista antes de")
        print("rodar — é melhor não ter dado do que ter dado errado.")
        return EXIT_CONTRACT
    _log(f"contrato estrutural     : OK ({report.schema_version})")

    # 4. normalize ------------------------------------------------------------
    model = normalize_step.normalize(extracted, snap, rules)
    meta = model.meta
    _log(f"documentos no modelo    : {meta['documentos_indexados']} "
         f"(ativos {meta['documentos_ativos']}, excluídos {meta['documentos_excluidos']})")
    _log(f"vínculos documento-tema : {meta['vinculos_tema']}")
    _log(f"docs com rodovia        : {meta['docs_com_rodovia']}")
    _log(f"docs com contrato       : {meta['docs_com_contrato']}")
    _log(f"indexed_as_of           : {meta['indexed_as_of']}")
    _log(f"physical_scan_as_of     : {meta['physical_scan_as_of']}")
    _log(f"pendentes reconciliação : {meta['pending_reconciliation_count']}")
    _log(f"lacunas de indexação    : {meta['indexing_gap_count']}")

    severities = Counter(f.severidade for f in model.findings)
    _log("achados de qualidade    : " + (
        ", ".join(f"{k}={v}" for k, v in sorted(severities.items())) or "nenhum"
    ))

    if validate_only:
        print()
        print("--validate-only: nada foi gravado em data/processed nem no DuckDB.")
        return EXIT_OK

    # 5. load -----------------------------------------------------------------
    duckdb_path = load_step.load_duckdb(model, settings, snap.cycle_id)
    _log(f"parquet                 : {settings.data_processed / snap.cycle_id}")
    _log(f"duckdb                  : {duckdb_path}")

    # 6. reconciliação --------------------------------------------------------
    checks = reconcile(model, snap, extracted)
    print()
    print("-- reconciliação fonte -> modelo " + "-" * 40)
    for check in checks:
        flag = "OK  " if check["ok"] else "FALHA"
        print(f"  [{flag}] {check['nome']}: {check['esperado']} == {check['obtido']}")
    failed = [c for c in checks if not c["ok"]]

    elapsed = (dt.datetime.now() - started).total_seconds()
    log_path = settings.logs_dir / f"pipeline_{snap.cycle_id}.log"
    log_path.write_text(
        json.dumps(
            {
                "ciclo_id": snap.cycle_id,
                "duracao_s": round(elapsed, 2),
                "meta": meta,
                "reconciliacao": checks,
                "achados": [f.as_dict() for f in model.findings],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(f"Ciclo {snap.cycle_id} concluído em {elapsed:.1f}s. Log: {log_path.name}")
    if failed:
        print(f"ATENÇÃO: {len(failed)} verificação(ões) de reconciliação falharam.")
        return EXIT_ERROR
    return EXIT_OK


def reconcile(model: normalize_step.Model, snap, extracted) -> list[dict]:
    """Prova que o modelo bate com a fonte. Números derivados do snapshot, nunca fixos."""
    docs = model.table("fct_documento")
    temas = model.table("br_documento_tema")
    arquivos = model.table("fct_arquivo_fisico")
    varreduras = model.table("fct_varredura")

    checks = [
        {
            "nome": "linhas do índice = documentos no modelo",
            "esperado": len(extracted.rows),
            "obtido": len(docs),
        },
        {
            "nome": "hyperlinks na fonte = links no modelo",
            "esperado": len(extracted.hyperlinks),
            "obtido": sum(1 for d in docs if d["link_disponivel"]),
        },
        {
            "nome": "acervo no snapshot = arquivos físicos no modelo",
            "esperado": snap.inventory.total_acervo,
            "obtido": len(arquivos),
        },
        {
            "nome": "vínculos de tema = soma dos temas por documento",
            "esperado": sum(d["temas_count"] for d in docs),
            "obtido": len(temas),
        },
        {
            "nome": "varreduras no log = fatos de varredura",
            "esperado": len(extracted.log_atualizacao),
            "obtido": len(varreduras),
        },
        {
            "nome": "ativos + excluídos = total de documentos",
            "esperado": len(docs),
            "obtido": sum(1 for d in docs if d["ativo"]) + sum(1 for d in docs if not d["ativo"]),
        },
        {
            "nome": "IDs únicos",
            "esperado": len(docs),
            "obtido": len({d["documento_id"] for d in docs}),
        },
    ]
    if varreduras and varreduras[-1]["total_no_indice"] is not None:
        checks.append(
            {
                "nome": "último 'Total no índice' do log = documentos no modelo",
                "esperado": varreduras[-1]["total_no_indice"],
                "obtido": len(docs),
            }
        )
    for check in checks:
        check["ok"] = check["esperado"] == check["obtido"]
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description="Pipeline de dados do Programa Dashboard.")
    parser.add_argument("--full", action="store_true", help="ciclo completo (padrão)")
    parser.add_argument("--validate-only", action="store_true", help="valida sem gravar")
    parser.add_argument("--reuse-cycle", metavar="CICLO", help="reprocessa um snapshot existente")
    args = parser.parse_args()
    try:
        return run(full=True, validate_only=args.validate_only, reuse_cycle=args.reuse_cycle)
    except Exception as exc:
        print(f"ERRO no pipeline: {type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
