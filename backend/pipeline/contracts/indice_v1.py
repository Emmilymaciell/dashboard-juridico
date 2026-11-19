"""Contrato estrutural de `00 Indice.xlsx`.

Quebra aqui significa que o projeto vizinho (repositorio_juridico) mudou o layout
do índice. O pipeline aborta: é melhor não ter dado do que ter dado errado.

Achados de *qualidade* (valor fora da taxonomia, campo vazio, duplicidade) não abortam —
viram `fct_dq_finding` e seguem. Ver DEC-022: taxonomia divergente é estado, não erro.
"""

from __future__ import annotations

from dataclasses import dataclass

SCHEMA_VERSION = "indice_v1"

EXPECTED_SHEETS = ["ÍNDICE", "LISTAS_APOIO", "NOMENCLATURA", "LOG_ATUALIZACAO"]

EXPECTED_COLUMNS = [
    "ID",
    "Naturezas",
    "Data",
    "Assunto",
    "Destinatarios",
    "Temas",
    "Necessidade resposta",
    "Subido por",
    "Data/hora do upload",
    "Última modificação",
    "Modificado por",
    "Status",
    "Arquivo",
    "Pasta",
    "Link",
]

STATUS_DOMAIN = {"Na pasta", "Excluído"}

MULTIVALUED_COLUMNS = ["Temas"]
DELIMITER = ";"

LOG_COLUMNS = [
    "Data/hora",
    "Novos",
    "Modificados",
    "Excluídos",
    "Reaparecidos",
    "Total na pasta",
    "Total no índice",
    "Observação",
]


class ContractViolationError(RuntimeError):
    """Layout do índice divergente do contrato. Aborta o ciclo."""


@dataclass
class ContractReport:
    schema_version: str
    sheets_ok: bool
    columns_ok: bool
    violations: list[str]

    @property
    def ok(self) -> bool:
        return not self.violations


def validate_structure(
    sheetnames: list[str], header: list[str], rows: list[dict]
) -> ContractReport:
    violations: list[str] = []

    missing_sheets = [s for s in EXPECTED_SHEETS if s not in sheetnames]
    if missing_sheets:
        violations.append(f"abas ausentes em 00 Indice.xlsx: {missing_sheets}")

    if header != EXPECTED_COLUMNS:
        violations.append(
            "colunas da aba ÍNDICE divergem do contrato.\n"
            f"  esperado: {EXPECTED_COLUMNS}\n"
            f"  encontrado: {header}"
        )

    ids = [r.get("ID") for r in rows]
    if any(i is None for i in ids):
        violations.append("coluna ID com valor nulo")
    non_int = [i for i in ids if i is not None and not isinstance(i, int)]
    if non_int:
        violations.append(f"coluna ID com valor não inteiro: {non_int[:5]}")
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        violations.append(f"coluna ID com duplicatas: {duplicates[:10]}")

    bad_status = sorted(
        {str(r.get("Status")) for r in rows if str(r.get("Status")) not in STATUS_DOMAIN}
    )
    if bad_status:
        violations.append(f"coluna Status fora do domínio {sorted(STATUS_DOMAIN)}: {bad_status}")

    return ContractReport(
        schema_version=SCHEMA_VERSION,
        sheets_ok=not missing_sheets,
        columns_ok=header == EXPECTED_COLUMNS,
        violations=violations,
    )
