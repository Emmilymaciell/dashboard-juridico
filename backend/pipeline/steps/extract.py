"""Etapa 2 — extração das abas e dos hyperlinks a partir da CÓPIA do snapshot.

Nenhuma leitura aqui toca a fonte: tudo vem de `data/raw/<ciclo>/00_Indice_*.xlsx`.
É o que garante que o ciclo inteiro veja um único estado (DEC-020).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

from backend.pipeline.contracts import indice_v1


@dataclass
class ExtractedIndex:
    sheetnames: list[str]
    header: list[str]
    rows: list[dict] = field(default_factory=list)
    hyperlinks: dict[int, str] = field(default_factory=dict)
    listas_apoio: dict[str, list[str]] = field(default_factory=dict)
    nomenclatura: list[list[str]] = field(default_factory=list)
    log_atualizacao: list[dict] = field(default_factory=list)


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def extract(index_copy: Path) -> ExtractedIndex:
    workbook = openpyxl.load_workbook(index_copy, data_only=True, read_only=False)
    try:
        sheet_indice = indice_v1.EXPECTED_SHEETS[0]
        if sheet_indice not in workbook.sheetnames:
            raise indice_v1.ContractViolationError(
                f"aba '{sheet_indice}' ausente em {index_copy.name}"
            )

        worksheet = workbook[sheet_indice]
        header = [_text(cell.value) for cell in worksheet[1]]
        link_col = header.index("Link") + 1 if "Link" in header else None
        id_col = header.index("ID") + 1 if "ID" in header else None

        rows: list[dict] = []
        hyperlinks: dict[int, str] = {}
        for row_idx in range(2, worksheet.max_row + 1):
            values = [worksheet.cell(row=row_idx, column=c + 1).value for c in range(len(header))]
            if all(v is None for v in values):
                continue
            rows.append(dict(zip(header, values, strict=False)))
            if link_col and id_col:
                doc_id = worksheet.cell(row=row_idx, column=id_col).value
                cell = worksheet.cell(row=row_idx, column=link_col)
                if doc_id is not None and cell.hyperlink is not None:
                    hyperlinks[int(doc_id)] = cell.hyperlink.target

        listas: dict[str, list[str]] = {}
        if "LISTAS_APOIO" in workbook.sheetnames:
            sheet = workbook["LISTAS_APOIO"]
            lista_header = [_text(cell.value) for cell in sheet[1]]
            listas = {name: [] for name in lista_header if name}
            for values in sheet.iter_rows(min_row=2, values_only=True):
                for name, value in zip(lista_header, values, strict=False):
                    if name and value not in (None, ""):
                        listas[name].append(_text(value))

        nomenclatura: list[list[str]] = []
        if "NOMENCLATURA" in workbook.sheetnames:
            for values in workbook["NOMENCLATURA"].iter_rows(values_only=True):
                cleaned = [_text(v) for v in values if v not in (None, "")]
                if cleaned:
                    nomenclatura.append(cleaned)

        log: list[dict] = []
        if "LOG_ATUALIZACAO" in workbook.sheetnames:
            sheet = workbook["LOG_ATUALIZACAO"]
            log_header = [_text(cell.value) for cell in sheet[1]]
            for values in sheet.iter_rows(min_row=2, values_only=True):
                if any(v is not None for v in values):
                    log.append(dict(zip(log_header, values, strict=False)))

        return ExtractedIndex(
            sheetnames=list(workbook.sheetnames),
            header=header,
            rows=rows,
            hyperlinks=hyperlinks,
            listas_apoio=listas,
            nomenclatura=nomenclatura,
            log_atualizacao=log,
        )
    finally:
        workbook.close()
