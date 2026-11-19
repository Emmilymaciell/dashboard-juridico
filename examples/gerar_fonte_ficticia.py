"""Gera a fonte documental FICTICIA usada pela versao publica do dashboard.

    python examples/gerar_fonte_ficticia.py            # gera examples/fonte-ficticia/
    python examples/gerar_fonte_ficticia.py --destino X

Le `examples/demandas_ficticias.json` e escreve, no mesmo layout que o pipeline
espera da fonte real (contrato `indice_v1`):

    <destino>/00 Indice.xlsx          abas INDICE, LISTAS_APOIO, NOMENCLATURA, LOG_ATUALIZACAO
    <destino>/<Pasta>/<arquivo>.pdf   um arquivo-placeholder por demanda "Na pasta"

Os "documentos" sao arquivos de texto com extensao .pdf: o pipeline so inventaria
nome, pasta, tamanho e mtime - nunca abre o conteudo. Tudo aqui e inventado.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
from pathlib import Path

import openpyxl

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))  # permite rodar como script a partir da raiz

from backend.pipeline.contracts import indice_v1  # noqa: E402

DATASET = AQUI / "demandas_ficticias.json"
DESTINO_PADRAO = AQUI / "fonte-ficticia"
BASE_LINK = "https://contoso.sharepoint.com/sites/exemplo/Documentos"
FMT_BR = "%d/%m/%Y %H:%M"


def _dt(texto: str) -> dt.datetime:
    return dt.datetime.strptime(texto, "%Y-%m-%d %H:%M")


def _nome_arquivo(d: dict) -> str:
    data = dt.date.fromisoformat(d["data"])
    return f"{data:%y%m%d} - {d['natureza'].replace(' / ', ' ')} - {d['assunto']} - {d['destinatario']} - 1.pdf"


def gerar(destino: Path) -> Path:
    dados = json.loads(DATASET.read_text(encoding="utf-8"))
    destino.mkdir(parents=True, exist_ok=True)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = indice_v1.EXPECTED_SHEETS[0]
    ws.append(indice_v1.EXPECTED_COLUMNS)
    col_link = indice_v1.EXPECTED_COLUMNS.index("Link") + 1

    for d in dados["demandas"]:
        status = d.get("status", "Na pasta")
        arquivo = _nome_arquivo(d)
        upload = _dt(d["upload"])
        ultima = upload + dt.timedelta(hours=2) if d.get("modificado_por") else upload
        ws.append([
            d["id"],
            d["natureza"],
            dt.datetime.fromisoformat(d["data"]),
            d["assunto"],
            d["destinatario"],
            d["temas"],
            d["resposta"],
            d["subido_por"],
            upload.strftime(FMT_BR),
            ultima.strftime(FMT_BR),
            d.get("modificado_por"),
            status,
            arquivo,
            d["pasta"],
            "Abrir" if status == "Na pasta" else None,
        ])
        if status != "Na pasta":
            continue
        url = f"{BASE_LINK}/{urllib.parse.quote(d['pasta'])}/{urllib.parse.quote(arquivo)}"
        ws.cell(row=ws.max_row, column=col_link).hyperlink = url

        pasta = destino / d["pasta"]
        pasta.mkdir(parents=True, exist_ok=True)
        alvo = pasta / arquivo
        alvo.write_text(f"Documento ficticio #{d['id']} - {d['assunto']}\n", encoding="utf-8")
        ts = ultima.timestamp()
        os.utime(alvo, (ts, ts))

    listas = wb.create_sheet("LISTAS_APOIO")
    nomes = list(dados["listas_apoio"])
    listas.append(nomes)
    maior = max(len(v) for v in dados["listas_apoio"].values())
    for i in range(maior):
        listas.append([
            dados["listas_apoio"][n][i] if i < len(dados["listas_apoio"][n]) else None
            for n in nomes
        ])

    nomenclatura = wb.create_sheet("NOMENCLATURA")
    for linha in dados["nomenclatura"]:
        nomenclatura.append(linha)

    log = wb.create_sheet("LOG_ATUALIZACAO")
    log.append(indice_v1.LOG_COLUMNS)
    total_indice = total_excluidos = 0
    for e in dados["log_atualizacao"]:
        total_indice += e["novos"]
        total_excluidos += e["excluidos"]
        log.append([
            _dt(e["data_hora"]).strftime(FMT_BR),
            e["novos"], e["modificados"], e["excluidos"], e["reaparecidos"],
            total_indice - total_excluidos, total_indice, e["observacao"],
        ])

    indice = destino / "00 Indice.xlsx"
    wb.save(indice)
    return indice


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--destino", type=Path, default=DESTINO_PADRAO)
    args = parser.parse_args()
    indice = gerar(args.destino)
    print(f"fonte ficticia gerada: {indice}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
