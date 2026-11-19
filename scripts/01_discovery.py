"""
01_discovery.py — Profiling SOMENTE LEITURA da fonte documental do Escritório Jurídico.

Reproduz, de forma automatizada, os números registrados em docs/DISCOVERY.md (removido na versão pública: perfil do acervo real).
A fonte e viva (OneDrive): rodar de novo pode dar numeros diferentes, e isso e
esperado. O objetivo deste script e ser a autoridade sobre "o que os dados sao
AGORA", em vez de depender de memoria de conversa.

GARANTIAS DE SEGURANCA
  - abre o workbook com openpyxl em read_only=True;
  - nunca chama save();
  - nunca escreve, cria, move ou renomeia nada dentro de PROG_SOURCE_ROOT;
  - toda saida vai para output/ dentro deste projeto.

USO
    python scripts\\01_discovery.py
    python scripts\\01_discovery.py --json-only

CONFIGURACAO
    Le, nesta ordem de precedencia:
      1. variavel de ambiente PROG_SOURCE_ROOT / PROG_INDEX_FILENAME
      2. config/config.json
      3. config/config.example.json
"""

from __future__ import annotations

import argparse
import collections
import contextlib
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.parse
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("openpyxl nao instalado. Rode: python -m pip install openpyxl")

# O console do Windows costuma vir em cp1252 e destroi acentos na saida.
for stream in (sys.stdout, sys.stderr):
    with contextlib.suppress(AttributeError, ValueError):  # pragma: no cover
        stream.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "output"

# Colunas esperadas na aba ÍNDICE. Divergencia aqui e quebra de contrato de dados.
EXPECTED_COLUMNS = [
    "ID", "Naturezas", "Data", "Assunto", "Destinatarios", "Temas",
    "Necessidade resposta", "Subido por", "Data/hora do upload",
    "Última modificação", "Modificado por", "Status", "Arquivo", "Pasta", "Link",
]
EXPECTED_SHEETS = ["ÍNDICE", "LISTAS_APOIO", "NOMENCLATURA", "LOG_ATUALIZACAO"]

MULTIVALUED_COLUMNS = ["Temas", "Destinatarios", "Naturezas"]
DELIMITER = ";"

# AAMMDD - Natureza - Assunto - Destinatario - NR[.ext], tolerando " (2)" do Office.
FILENAME_PATTERN = re.compile(
    r"^(?P<yy>\d{2})(?P<mm>\d{2})(?P<dd>\d{2}) - (?P<natureza>.+?) - (?P<assunto>.+?)"
    r" - (?P<destinatario>.+?) - (?P<nr>\d+)(?: \((?P<copia>\d+)\))?\.(?P<ext>\w+)$"
)

# Rodovia. O lookbehind (?<![A-Za-z]) impede que o "RD" final de siglas de órgão estadual
# (órgão + UF; exemplos sintéticos: MPRD / ALERD / TCE-RD) seja lido como prefixo de rodovia.
# O regex roda POR CAMPO, nunca sobre campos concatenados: "MPRD" + "251104 - ..."
# produziria o falso positivo "RD 251".
# Ver config/regras_negocio.json -> rodovias.normalizacao e docs/DECISIONS.md DEC-014.
ROAD_PATTERN = re.compile(r"(?<![A-Za-z])RD\s*-?\s*(\d{3})\s*([AB])?\b", re.IGNORECASE)
ROAD_FIELDS = ("Destinatarios", "Assunto", "Arquivo")

CONTRACT_PATTERN = re.compile(r"Contrato\s+(\d{2})(?:\s*/\s*|\s+)?(20\d{2})?", re.IGNORECASE)
OFFICE_JUNK = re.compile(r"^(~\$|\.~lock\.)|\.(tmp|temp)$", re.IGNORECASE)


# --------------------------------------------------------------------------- #
# configuracao
# --------------------------------------------------------------------------- #
def load_business_rules() -> dict:
    """Regras de negocio confirmadas pela usuaria. Nada disto e hardcoded aqui."""
    path = PROJECT_ROOT / "config" / "regras_negocio.json"
    if not path.exists():
        sys.exit(f"Regras de negocio nao encontradas: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_config() -> dict:
    cfg: dict = {}
    for name in ("config.json", "config.example.json"):
        path = PROJECT_ROOT / "config" / name
        if path.exists():
            cfg = json.loads(path.read_text(encoding="utf-8"))
            cfg["_config_file"] = str(path)
            break
    source = cfg.setdefault("source", {})
    source["root"] = os.environ.get("PROG_SOURCE_ROOT", source.get("root", ""))
    source["index_filename"] = os.environ.get(
        "PROG_INDEX_FILENAME", source.get("index_filename", "00 Indice.xlsx")
    )
    if not source["root"]:
        sys.exit("Caminho da fonte nao configurado. Defina PROG_SOURCE_ROOT ou config/config.json.")
    return cfg


def fold(text: str) -> str:
    """minusculas sem acento — para comparar 'consulta' com 'Consulta'."""
    norm = unicodedata.normalize("NFKD", str(text))
    return "".join(c for c in norm if not unicodedata.combining(c)).lower().strip()


def as_text(value) -> str:
    return "" if value is None else str(value).strip()


def parse_br_datetime(value):
    """'10/09/2026 14:17' ou '28/08/2026 10:03 (aprox.)' -> (datetime|None, aproximado)."""
    raw = as_text(value)
    if not raw:
        return None, False
    approx = "(aprox" in raw.lower()
    clean = re.sub(r"\(aprox\.?\)", "", raw, flags=re.IGNORECASE).strip()
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(clean, fmt), approx
        except ValueError:
            continue
    return None, approx


def split_multi(value) -> list[str]:
    return [p.strip() for p in as_text(value).split(DELIMITER) if p.strip()]


def normalize_roads(row: dict) -> dict[str, str]:
    """Rodovias de uma linha -> {rodovia_canonica: campo_de_origem}.

    REGRA DE NEGOCIO CONFIRMADA (usuaria, 10/09/2026):
        'RD-102' sem 'B' explicito  ->  RD-102A
        'RD-102B' (B explicito)     ->  RD-102B
    Tolera espaco, hifen e caixa. Roda campo por campo — nunca sobre a concatenacao.
    """
    found: dict[str, str] = {}
    for field in ROAD_FIELDS:
        for match in ROAD_PATTERN.finditer(as_text(row.get(field))):
            numero, letra = match.group(1), (match.group(2) or "").upper()
            key = "RD-102B" if (numero == "102" and letra == "B") else (
                "RD-102A" if numero == "102" else f"RD-{numero}{letra}"
            )
            found.setdefault(key, field)  # primeiro campo vence: Destinatarios > Assunto > Arquivo
    return found


def is_repo_control_file(folder: str, filename: str, rules: dict) -> bool:
    """Artefato de controle do repositorio (00 Indice.xlsx, 00 Nomenclatura...), nao acervo."""
    block = rules.get("arquivos_controle_repositorio", {})
    if block.get("somente_na_raiz", True) and folder not in ("", "."):
        return False
    return any(re.match(p, filename, re.IGNORECASE) for p in block.get("padroes", []))


# --------------------------------------------------------------------------- #
# leitura da fonte (SOMENTE LEITURA)
# --------------------------------------------------------------------------- #
def scan_filesystem(root: Path, index_filename: str, rules: dict) -> dict:
    files, junk, folders = [], [], collections.Counter()
    control: list[str] = []
    for dirpath, _dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        rel_dir = "" if rel_dir == "." else rel_dir
        for name in filenames:
            if name == index_filename:
                continue
            if OFFICE_JUNK.search(name):
                junk.append(os.path.join(rel_dir, name))
                continue
            if is_repo_control_file(rel_dir, name, rules):
                control.append(os.path.join(rel_dir, name))
                continue
            full = Path(dirpath) / name
            try:
                stat = full.stat()
                size, mtime = stat.st_size, dt.datetime.fromtimestamp(stat.st_mtime)
            except OSError:
                size, mtime = None, None
            files.append({
                "folder": rel_dir, "filename": name, "size": size,
                "mtime": mtime.isoformat(timespec="seconds") if mtime else None,
                "ext": name.rsplit(".", 1)[-1].lower() if "." in name else "",
            })
            folders[rel_dir] += 1
    return {
        "scanned_at": dt.datetime.now().isoformat(timespec="seconds"),
        "total_files": len(files),
        "files_by_folder": dict(sorted(folders.items(), key=lambda kv: fold(kv[0]))),
        "files_by_ext": dict(collections.Counter(f["ext"] for f in files).most_common()),
        "office_junk_ignored": junk,
        "repo_control_files_excluded": control,
        "files": files,
    }


def read_workbook(path: Path) -> dict:
    """Le as quatro abas. read_only=True: openpyxl nunca grava neste modo."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        result = {"sheetnames": list(wb.sheetnames)}

        ws = wb["ÍNDICE"]
        rows_iter = ws.iter_rows(values_only=True)
        header = [as_text(c) for c in next(rows_iter)]
        records = []
        for values in rows_iter:
            if values is None or all(v is None for v in values):
                continue
            records.append(dict(zip(header, values, strict=False)))
        result["indice_header"] = header
        result["indice"] = records

        ws = wb["LISTAS_APOIO"]
        rows_iter = ws.iter_rows(values_only=True)
        header = [as_text(c) for c in next(rows_iter)]
        listas: dict[str, list[str]] = {h: [] for h in header if h}
        for values in rows_iter:
            for h, v in zip(header, values, strict=False):
                if h and v not in (None, ""):
                    listas[h].append(as_text(v))
        result["listas_apoio"] = listas

        result["nomenclatura"] = [
            [as_text(v) for v in row if v not in (None, "")]
            for row in wb["NOMENCLATURA"].iter_rows(values_only=True)
            if any(v not in (None, "") for v in row)
        ]

        ws = wb["LOG_ATUALIZACAO"]
        rows_iter = ws.iter_rows(values_only=True)
        header = [as_text(c) for c in next(rows_iter)]
        result["log_atualizacao"] = [
            dict(zip(header, values, strict=False))
            for values in rows_iter
            if any(v is not None for v in values)
        ]
        return result
    finally:
        wb.close()


def read_hyperlinks(path: Path) -> dict[int, str]:
    """Hyperlinks nao vem no modo read_only; leitura normal, sem save()."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=False)
    try:
        ws = wb["ÍNDICE"]
        header = [as_text(c.value) for c in ws[1]]
        col = header.index("Link") + 1
        id_col = header.index("ID") + 1
        links: dict[int, str] = {}
        for row in range(2, ws.max_row + 1):
            doc_id = ws.cell(row=row, column=id_col).value
            cell = ws.cell(row=row, column=col)
            if doc_id is not None and cell.hyperlink is not None:
                links[int(doc_id)] = cell.hyperlink.target
        return links
    finally:
        wb.close()


# --------------------------------------------------------------------------- #
# profiling
# --------------------------------------------------------------------------- #
def profile(book: dict, links: dict[int, str], fs: dict, source_root: str, rules: dict) -> dict:
    rows = book["indice"]
    report: dict = {
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "source_root": source_root,
        "business_rules_version": rules.get("_meta", {}).get("versao"),
        "checks": [],
    }

    def check(name: str, ok: bool, detail: str = "") -> None:
        report["checks"].append({"check": name, "ok": bool(ok), "detail": detail})

    # ---- contrato estrutural ------------------------------------------------
    check("abas esperadas presentes",
          all(s in book["sheetnames"] for s in EXPECTED_SHEETS),
          f"encontradas={book['sheetnames']}")
    check("colunas da aba ÍNDICE inalteradas",
          book["indice_header"] == EXPECTED_COLUMNS,
          f"encontradas={book['indice_header']}")

    report["row_count"] = len(rows)

    # ---- coluna a coluna ----------------------------------------------------
    columns = {}
    for col in book["indice_header"]:
        values = [r.get(col) for r in rows]
        columns[col] = {
            "nulls": sum(1 for v in values if v is None or as_text(v) == ""),
            "distinct": len({as_text(v) for v in values}),
            "types": dict(collections.Counter(type(v).__name__ for v in values)),
        }
    report["columns"] = columns

    # ---- IDs ----------------------------------------------------------------
    ids = [r.get("ID") for r in rows]
    int_ids = [i for i in ids if isinstance(i, int)]
    dups = sorted(k for k, v in collections.Counter(ids).items() if v > 1)
    gaps = sorted(set(range(1, max(int_ids) + 1)) - set(int_ids)) if int_ids else []
    report["ids"] = {"min": min(int_ids) if int_ids else None,
                     "max": max(int_ids) if int_ids else None,
                     "duplicates": dups, "gaps": gaps}
    check("ID sem duplicatas", not dups, f"duplicados={dups}")
    check("ID sem lacunas", not gaps, f"lacunas={gaps[:20]}")

    # ---- categorias ---------------------------------------------------------
    report["value_counts"] = {
        col: dict(collections.Counter(as_text(r.get(col)) or "(vazio)" for r in rows).most_common())
        for col in ("Naturezas", "Destinatarios", "Status", "Pasta",
                    "Necessidade resposta", "Subido por", "Modificado por")
    }

    # ---- multivalorados -----------------------------------------------------
    multi = {}
    for col in MULTIVALUED_COLUMNS:
        counter, multi_rows = collections.Counter(), 0
        for r in rows:
            parts = split_multi(r.get(col))
            if len(parts) > 1:
                multi_rows += 1
            counter.update(parts)
        multi[col] = {"rows_with_multiple": multi_rows,
                      "atomic_values": len(counter),
                      "counts": dict(counter.most_common())}
    report["multivalued"] = multi

    # ---- vocabulario: LISTAS_APOIO + regras de negocio confirmadas -----------
    # Valor pode estar fora da planilha e ainda assim ser VALIDO, se a usuaria
    # confirmou (ex.: 'Empreiteiras'). Nesse caso e diferenca planilha-vs-regra,
    # nao erro de classificacao.
    listas = book["listas_apoio"]
    confirmed_extra = {
        fold(item["valor"]): item
        for item in rules.get("destinatarios", {}).get("validos_confirmados_fora_da_planilha", [])
    }
    off_taxonomy, confirmed_gap = {}, {}
    for col, lista_key in (("Naturezas", "Naturezas"), ("Destinatarios", "Destinatarios"),
                           ("Temas", "Temas")):
        allowed = {fold(v) for v in listas.get(lista_key, [])}
        used = set()
        for r in rows:
            used.update(split_multi(r.get(col)))
        missing = [v for v in sorted(used) if fold(v) not in allowed]
        if col == "Destinatarios":
            confirmed_gap[col] = [v for v in missing if fold(v) in confirmed_extra]
            missing = [v for v in missing if fold(v) not in confirmed_extra]
        off_taxonomy[col] = missing
    report["off_taxonomy"] = off_taxonomy
    report["taxonomy_confirmed_gap"] = {
        "_nota": ("Valores VALIDOS por regra de negocio confirmada que ainda nao constam da "
                  "aba LISTAS_APOIO. Nao sao erro de classificacao. Correcao da planilha, se "
                  "houver, e do projeto repositorio_juridico — este projeto nao escreve no Excel."),
        "valores": {k: v for k, v in confirmed_gap.items() if v},
        "documentos_afetados": {
            v: sum(1 for r in rows if fold(r.get("Destinatarios")) == fold(v))
            for v in confirmed_gap.get("Destinatarios", [])
        },
    }
    check("todo valor usado existe na LISTAS_APOIO ou em regra confirmada",
          not any(off_taxonomy.values()), json.dumps(off_taxonomy, ensure_ascii=False))

    # ---- datas --------------------------------------------------------------
    doc_dates = [r.get("Data") for r in rows if isinstance(r.get("Data"), (dt.datetime, dt.date))]
    now = dt.datetime.now()
    uploads = [parse_br_datetime(r.get("Data/hora do upload")) for r in rows]
    mods = [parse_br_datetime(r.get("Última modificação")) for r in rows]
    report["dates"] = {
        "Data": {
            "parsed": len(doc_dates),
            "min": min(doc_dates).isoformat() if doc_dates else None,
            "max": max(doc_dates).isoformat() if doc_dates else None,
            "in_future": sum(1 for d in doc_dates
                             if (d if isinstance(d, dt.datetime) else dt.datetime.combine(d, dt.time())) > now),
            "by_month": dict(sorted(collections.Counter(d.strftime("%Y-%m") for d in doc_dates).items())),
            "by_year": dict(sorted(collections.Counter(d.year for d in doc_dates).items())),
        },
        "Data/hora do upload": {
            "distinct_raw": sorted({as_text(r.get("Data/hora do upload")) for r in rows}),
            "unparsed": sum(1 for d, _ in uploads if d is None),
            "flagged_approximate": sum(1 for _, a in uploads if a),
        },
        "Última modificação": {
            "distinct_raw": len({as_text(r.get("Última modificação")) for r in rows}),
            "unparsed": sum(1 for d, _ in mods if d is None),
        },
    }
    check("nenhuma data de documento no futuro", report["dates"]["Data"]["in_future"] == 0,
          f"{report['dates']['Data']['in_future']} linha(s)")

    anachronisms = []
    for r in rows:
        data, mod = r.get("Data"), parse_br_datetime(r.get("Última modificação"))[0]
        if isinstance(data, (dt.datetime, dt.date)) and mod:
            data_dt = data if isinstance(data, dt.datetime) else dt.datetime.combine(data, dt.time())
            if data_dt > mod:
                anachronisms.append(r.get("ID"))
    report["anachronisms_data_after_modification"] = anachronisms
    check("Data do documento nunca posterior a Última modificação", not anachronisms,
          f"IDs={anachronisms[:20]}")

    # ---- nomenclatura -------------------------------------------------------
    non_conforming, month_level, name_date_mismatch = [], [], []
    for r in rows:
        filename = as_text(r.get("Arquivo"))
        match = FILENAME_PATTERN.match(filename)
        if not match:
            non_conforming.append({"id": r.get("ID"), "arquivo": filename})
            continue
        yy, mm, dd = (int(match.group("yy")), int(match.group("mm")), int(match.group("dd")))
        if dd == 0:
            month_level.append(r.get("ID"))
        try:
            expected = dt.date(2000 + yy, mm, dd if dd else 1)
        except ValueError:
            non_conforming.append({"id": r.get("ID"), "arquivo": filename, "motivo": "data invalida no nome"})
            continue
        data = r.get("Data")
        actual = data.date() if isinstance(data, dt.datetime) else data
        if actual != expected:
            name_date_mismatch.append({"id": r.get("ID"), "nome": expected.isoformat(),
                                       "coluna_data": str(actual)})
    report["nomenclature"] = {
        "conforming": len(rows) - len(non_conforming),
        "non_conforming": non_conforming,
        "month_level_dates_ids": month_level,
        "name_vs_data_mismatch": name_date_mismatch,
    }
    check("Data da coluna coincide com a data do nome do arquivo", not name_date_mismatch,
          f"{len(name_date_mismatch)} divergencia(s)")

    # ---- hyperlinks ---------------------------------------------------------
    with_link = {i: t for i, t in links.items() if t}
    hosts = collections.Counter(
        re.sub(r"^(https?://[^/]+).*", r"\1", t) for t in with_link.values()
    )
    dup_targets = [t for t, c in collections.Counter(with_link.values()).items() if c > 1]
    filename_mismatch, folder_mismatch = [], []
    by_id = {r.get("ID"): r for r in rows}
    for doc_id, target in with_link.items():
        decoded = urllib.parse.unquote(target)
        row = by_id.get(doc_id, {})
        if as_text(row.get("Arquivo")) and as_text(row.get("Arquivo")) not in decoded:
            filename_mismatch.append(doc_id)
        m = re.search(r"/Escritório Jurídico/([^/]+)/", decoded)
        if m and fold(m.group(1)) != fold(row.get("Pasta")):
            folder_mismatch.append({"id": doc_id, "url": m.group(1), "coluna": as_text(row.get("Pasta"))})
    missing = [
        {"id": r.get("ID"), "status": as_text(r.get("Status")), "arquivo": as_text(r.get("Arquivo"))}
        for r in rows if not links.get(r.get("ID"))
    ]
    report["hyperlinks"] = {
        "with_link": len(with_link),
        "without_link": len(missing),
        "without_link_rows": missing,
        "hosts": dict(hosts),
        "duplicate_targets": len(dup_targets),
        "filename_mismatch_ids": filename_mismatch,
        "folder_mismatch": folder_mismatch,
    }
    check("todo documento 'Na pasta' tem hyperlink",
          all(as_text(m["status"]) != "Na pasta" for m in missing),
          f"sem link e 'Na pasta': {[m['id'] for m in missing if m['status'] == 'Na pasta']}")
    check("hyperlink aponta para o arquivo da coluna Arquivo", not filename_mismatch,
          f"IDs={filename_mismatch[:20]}")
    check("pasta na URL coincide com a coluna Pasta", not folder_mismatch,
          f"{len(folder_mismatch)} divergencia(s)")

    # ---- pasta x natureza ---------------------------------------------------
    report["folder_vs_nature"] = {
        f"{p} | {n}": c for (p, n), c in sorted(
            collections.Counter((as_text(r.get("Pasta")), as_text(r.get("Naturezas"))) for r in rows).items()
        )
    }

    # ---- fisico x indice ----------------------------------------------------
    phys_by_folder = {fold(k): v for k, v in fs["files_by_folder"].items()}
    idx_by_folder: collections.Counter = collections.Counter()
    for r in rows:
        idx_by_folder[fold(r.get("Pasta"))] += 1
    idx_present = collections.Counter()
    for r in rows:
        if as_text(r.get("Status")) == "Na pasta":
            idx_present[fold(r.get("Pasta"))] += 1

    comparison = []
    for folder in sorted(set(phys_by_folder) | set(idx_by_folder)):
        comparison.append({
            "folder": folder,
            "physical": phys_by_folder.get(folder, 0),
            "index_rows": idx_by_folder.get(folder, 0),
            "index_na_pasta": idx_present.get(folder, 0),
            "delta_physical_minus_na_pasta": phys_by_folder.get(folder, 0) - idx_present.get(folder, 0),
        })
    phys_names = {f["filename"] for f in fs["files"]}
    idx_names = {as_text(r.get("Arquivo")) for r in rows}

    # Arquivo no disco e ausente do indice tem DUAS causas muito diferentes:
    #   - PENDENTE: chegou DEPOIS da ultima varredura do robo -> normal, o indexador
    #     (repositorio_juridico) ainda nao rodou. Nao e defeito do dado.
    #   - LACUNA:   ja existia antes da ultima varredura e nao foi indexado -> achado real.
    # Sem essa distincao a verificacao oscila a cada arquivo novo e perde utilidade.
    log_rows = book["log_atualizacao"]
    last_scan = None
    for entry in log_rows:
        parsed, _ = parse_br_datetime(entry.get("Data/hora"))
        if parsed and (last_scan is None or parsed > last_scan):
            last_scan = parsed
    by_filename = {f["filename"]: f for f in fs["files"]}
    pendentes, lacunas = [], []
    for name in sorted(phys_names - idx_names):
        info = by_filename.get(name, {})
        mtime = info.get("mtime")
        item = {"arquivo": name, "pasta": info.get("folder"), "mtime_disco": mtime}
        if last_scan and mtime and dt.datetime.fromisoformat(mtime) > last_scan:
            pendentes.append(item)
        else:
            lacunas.append(item)

    report["physical_vs_index"] = {
        "physical_total": fs["total_files"],
        "index_rows": len(rows),
        "index_na_pasta": sum(1 for r in rows if as_text(r.get("Status")) == "Na pasta"),
        "index_excluido": sum(1 for r in rows if as_text(r.get("Status")) == "Excluído"),
        "by_folder": comparison,
        "ultima_varredura_do_robo": last_scan.isoformat() if last_scan else None,
        "physical_not_in_index": sorted(phys_names - idx_names),
        "pendentes_de_varredura": pendentes,
        "lacunas_de_indexacao": lacunas,
        "_nota": ("'pendente' = arquivo criado/modificado depois da ultima varredura do "
                  "robo; e comportamento normal, nao achado. 'lacuna' = arquivo anterior "
                  "a ultima varredura e nao indexado; esse e achado real."),
        "index_without_physical": [
            {"arquivo": n, "status": as_text(next(r for r in rows if as_text(r.get("Arquivo")) == n).get("Status"))}
            for n in sorted(idx_names - phys_names)
        ],
    }
    check("nenhuma lacuna de indexacao (arquivo antigo fora do indice)",
          not lacunas,
          f"{len(lacunas)} arquivo(s): {[x['arquivo'][:45] for x in lacunas[:5]]}")
    if pendentes:
        check(f"aviso: {len(pendentes)} arquivo(s) aguardando a proxima varredura do robo",
              True,
              f"chegaram depois de {last_scan.strftime('%d/%m/%Y %H:%M') if last_scan else '?'}"
              " — rodar a atualizacao em repositorio_juridico")
    check("linha sem arquivo fisico esta marcada como Excluído",
          all(x["status"] == "Excluído" for x in report["physical_vs_index"]["index_without_physical"]),
          "")

    # ---- rodovias (regra confirmada) e contratos ----------------------------
    roads, contracts, rows_without_road = collections.Counter(), collections.Counter(), 0
    road_source = collections.Counter()
    for r in rows:
        found = normalize_roads(r)
        if not found:
            rows_without_road += 1
        roads.update(found.keys())
        for field in found.values():
            road_source[field] += 1
        blob = " ".join(as_text(r.get(c)) for c in ("Assunto", "Arquivo"))
        for num, year in CONTRACT_PATTERN.findall(blob):
            contracts[f"Contrato {num}" + (f"/{year}" if year else "")] += 1

    known_fp = set(rules.get("rodovias", {}).get("falsos_positivos_conhecidos", []))
    regressions = sorted(k for k in roads if k in known_fp)
    canon = set(rules.get("rodovias", {}).get("canonicas_com_contrato", [])) | \
        set(rules.get("rodovias", {}).get("canonicas_sem_contrato", []))
    report["roads"] = {
        "_proveniencia": "confirmed_business_rule (regra RD-102) + derived (extracao do texto)",
        "counts": dict(roads.most_common()),
        "rows_with_road": len(rows) - rows_without_road,
        "rows_without_road": rows_without_road,
        "coverage_pct": round(100 * (len(rows) - rows_without_road) / len(rows), 1) if rows else 0,
        "por_campo_de_origem": dict(road_source),
        "fora_das_canonicas": sorted(k for k in roads if k not in canon),
        "falsos_positivos_reincidentes": regressions,
    }
    check("nenhum falso positivo conhecido de rodovia (RD-250/251/260) reapareceu",
          not regressions, f"reapareceram: {regressions}")

    # ---- contrato -> rodovia -> executora (CONFIRMADO pela usuaria) ---------
    itens = rules.get("contratos", {}).get("itens", [])
    by_dest = {fold(i["destinatario_indice"]): i for i in itens}
    mapped = collections.Counter()
    for r in rows:
        item = by_dest.get(fold(r.get("Destinatarios")))
        if item:
            mapped[item["contrato"]] += 1
    report["contract_map"] = {
        "_proveniencia": "confirmed_business_rule",
        "_confirmado_em": rules.get("contratos", {}).get("_confirmado_em"),
        "itens": [
            {**{k: v for k, v in i.items() if not k.startswith("_")},
             "docs_por_destinatario": mapped.get(i["contrato"], 0),
             "docs_por_rodovia": roads.get(i["rodovia"], 0)}
            for i in itens
        ],
        "docs_com_contrato_confirmado": sum(mapped.values()),
        "coverage_pct": round(100 * sum(mapped.values()) / len(rows), 1) if rows else 0,
        "mencoes_de_contrato_no_texto": dict(contracts.most_common()),
    }
    faltando = [i["destinatario_indice"] for i in itens if not mapped.get(i["contrato"])]
    check("todo contrato confirmado tem destinatario correspondente no indice",
          not faltando, f"sem documentos: {faltando}")

    # ---- macrogrupo juridico (camada analitica derivada) --------------------
    mg = rules.get("macrogrupos_juridicos", {})
    mapa = {fold(k): v for k, v in mg.get("mapa", {}).items()}
    default = mg.get("default", {"macrogrupo": "Não classificado", "status": "revisar"})
    grupos, revisar = collections.Counter(), collections.Counter()
    for r in rows:
        nat = as_text(r.get("Naturezas"))
        entry = mapa.get(fold(nat), default)
        grupos[entry["macrogrupo"]] += 1
        if entry.get("status") == "revisar":
            revisar[nat or "(vazio)"] += 1
    nao_class = grupos.get("Não classificado", 0)
    report["macrogrupos"] = {
        "_proveniencia": "analytical_derived",
        "_status": mg.get("_status"),
        "_nota": ("Classificacao ANALITICA configuravel em config/regras_negocio.json. "
                  "Nao e dado original do Escritório Jurídico."),
        "counts": dict(grupos.most_common()),
        "nao_classificados": nao_class,
        "nao_classificados_pct": round(100 * nao_class / len(rows), 1) if rows else 0,
        "naturezas_a_revisar": dict(revisar.most_common()),
        "cobertura_classificada_pct": round(100 * (len(rows) - nao_class) / len(rows), 1) if rows else 0,
    }

    # ---- duplicidade semantica ---------------------------------------------
    key_counter = collections.Counter(
        (str(r.get("Data"))[:10], as_text(r.get("Assunto")), as_text(r.get("Destinatarios")))
        for r in rows
    )
    report["semantic_duplicates"] = [
        {"data": k[0], "assunto": k[1], "destinatario": k[2], "count": c}
        for k, c in sorted(key_counter.items()) if c > 1
    ]

    # ---- log de atualizacao -------------------------------------------------
    log = book["log_atualizacao"]
    report["log_atualizacao"] = {
        "entries": len(log),
        "first": as_text(log[0].get("Data/hora")) if log else None,
        "last": as_text(log[-1].get("Data/hora")) if log else None,
        "totals_last": {k: log[-1].get(k) for k in ("Total na pasta", "Total no índice")} if log else {},
        "sum_novos": sum(int(e.get("Novos") or 0) for e in log),
        "sum_modificados": sum(int(e.get("Modificados") or 0) for e in log),
        "sum_excluidos": sum(int(e.get("Excluídos") or 0) for e in log),
        "rows": log,
    }

    report["listas_apoio"] = {k: len(v) for k, v in listas.items()}
    report["listas_apoio_values"] = listas
    report["filesystem"] = {k: v for k, v in fs.items() if k != "files"}
    return report


# --------------------------------------------------------------------------- #
def render_summary(report: dict) -> str:
    out: list[str] = []
    add = out.append
    add("=" * 78)
    add("DISCOVERY — dashboard_juridico (leitura da fonte, sem escrita)")
    add("=" * 78)
    add(f"gerado em      : {report['generated_at']}")
    add(f"fonte          : {report['source_root']}")
    fsx = report["filesystem"]
    add(f"varredura em   : {fsx['scanned_at']}")
    add("")
    add(f"regras de negocio   : config/regras_negocio.json v{report.get('business_rules_version')}")
    add("")
    add(f"acervo no disco     : {fsx['total_files']}")
    pvi = report["physical_vs_index"]
    add(f"linhas no indice    : {pvi['index_rows']}  "
        f"(Na pasta={pvi['index_na_pasta']}, Excluído={pvi['index_excluido']})")
    add(f"fora do indice      : {len(pvi['physical_not_in_index'])} arquivo(s)"
        f"  -> {len(pvi.get('lacunas_de_indexacao') or [])} lacuna(s) real(is)"
        f", {len(pvi.get('pendentes_de_varredura') or [])} aguardando varredura")
    if pvi.get("ultima_varredura_do_robo"):
        add(f"ultima varredura    : {pvi['ultima_varredura_do_robo']} (LOG_ATUALIZACAO)")
    ctrl = fsx.get("repo_control_files_excluded") or []
    add(f"controle do repo    : {len(ctrl)} arquivo(s) fora do acervo"
        + (f" -> {', '.join(ctrl)}" if ctrl else ""))
    add("")
    add("-- pasta a pasta " + "-" * 60)
    add(f"{'pasta':22}{'disco':>8}{'indice':>8}{'na pasta':>10}{'delta':>8}")
    for entry in pvi["by_folder"]:
        add(f"{entry['folder']:22}{entry['physical']:>8}{entry['index_rows']:>8}"
            f"{entry['index_na_pasta']:>10}{entry['delta_physical_minus_na_pasta']:>8}")
    add("")
    add("-- verificacoes " + "-" * 61)
    for c in report["checks"]:
        add(f"[{'OK ' if c['ok'] else 'FAIL'}] {c['check']}"
            + (f"\n        {c['detail']}" if not c["ok"] and c["detail"] else ""))
    failed = sum(1 for c in report["checks"] if not c["ok"])
    add("")
    add(f"{len(report['checks']) - failed} de {len(report['checks'])} verificacoes passaram.")
    add("")
    add("-- naturezas " + "-" * 64)
    for k, v in list(report["value_counts"]["Naturezas"].items())[:10]:
        add(f"  {v:>4}  {k}")
    add("-- temas (atomizados) " + "-" * 55)
    for k, v in list(report["multivalued"]["Temas"]["counts"].items())[:10]:
        add(f"  {v:>4}  {k}")
    add(f"  ({report['multivalued']['Temas']['rows_with_multiple']} linhas multivaloradas, "
        f"{report['multivalued']['Temas']['atomic_values']} temas atomicos)")
    add("-- completude " + "-" * 63)
    for col, stats in report["columns"].items():
        if stats["nulls"]:
            pct = 100 * stats["nulls"] / report["row_count"]
            add(f"  {col:24} {stats['nulls']:>4} vazios ({pct:.0f}%)")
    add("-- rodovias (regra RD-102 confirmada) " + "-" * 39)
    rd = report["roads"]
    for k, v in rd["counts"].items():
        flag = "  <- fora das canonicas" if k in rd["fora_das_canonicas"] else ""
        add(f"  {v:>4}  {k}{flag}")
    add(f"  cobertura: {rd['rows_with_road']}/{report['row_count']} = {rd['coverage_pct']}%"
        f"  |  sem rodovia: {rd['rows_without_road']}")
    add("-- contrato -> rodovia -> executora (CONFIRMADO) " + "-" * 28)
    for i in report["contract_map"]["itens"]:
        add(f"  Contrato {i['contrato']}  ->  {i['rodovia']:9} ->  {i['executora']:18}"
            f"  docs(dest)={i['docs_por_destinatario']:>3}  docs(rodovia)={i['docs_por_rodovia']:>3}")
    cm = report["contract_map"]
    add(f"  documentos com contrato confirmado: {cm['docs_com_contrato_confirmado']} "
        f"({cm['coverage_pct']}%)")
    add("-- macrogrupo juridico (derivado, PROPOSTA) " + "-" * 33)
    for k, v in report["macrogrupos"]["counts"].items():
        add(f"  {v:>4}  {k}")
    mgr = report["macrogrupos"]
    add(f"  classificado: {mgr['cobertura_classificada_pct']}%  |  "
        f"nao classificado: {mgr['nao_classificados']} ({mgr['nao_classificados_pct']}%)")
    if mgr["naturezas_a_revisar"]:
        add("  naturezas a revisar: " + ", ".join(
            f"{k} ({v})" for k, v in mgr["naturezas_a_revisar"].items()))
    tcg = report.get("taxonomy_confirmed_gap", {}).get("valores") or {}
    if tcg:
        add("-- diferenca planilha vs regra confirmada " + "-" * 35)
        for col, vals in tcg.items():
            for v in vals:
                n = report["taxonomy_confirmed_gap"]["documentos_afetados"].get(v, "?")
                add(f"  {col}: '{v}' valido por regra confirmada, ausente da LISTAS_APOIO ({n} docs)")
    add("=" * 78)
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Profiling somente-leitura da fonte Escritório Jurídico.")
    parser.add_argument("--json-only", action="store_true", help="nao imprime o resumo")
    args = parser.parse_args()

    cfg = load_config()
    rules = load_business_rules()
    source_root = Path(cfg["source"]["root"])
    index_path = source_root / cfg["source"]["index_filename"]
    if not index_path.exists():
        sys.exit(f"Indice nao encontrado: {index_path}")

    fs = scan_filesystem(source_root, cfg["source"]["index_filename"], rules)
    book = read_workbook(index_path)
    links = read_hyperlinks(index_path)
    report = profile(book, links, fs, str(source_root), rules)

    OUTPUT_DIR.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y-%m-%d_%H%M%S")
    json_path = OUTPUT_DIR / f"discovery_{stamp}.json"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    latest = OUTPUT_DIR / "discovery_latest.json"
    latest.write_text(json.dumps(report, ensure_ascii=False, indent=1, default=str), encoding="utf-8")

    if not args.json_only:
        summary = render_summary(report)
        try:
            print(summary)
        except UnicodeEncodeError:
            print(summary.encode("utf-8", "replace").decode("utf-8"))
        print(f"\nJSON completo : {json_path}")
        print(f"Atalho        : {latest}")

    # Codigo de saida:
    #   0 = contrato estrutural intacto (achados de qualidade de dado sao esperados)
    #   2 = QUEBRA DE CONTRATO: abas ou colunas do indice mudaram -> pipeline precisa
    #       ser revisto antes de rodar.
    structural = {"abas esperadas presentes", "colunas da aba ÍNDICE inalteradas"}
    broken = [c for c in report["checks"] if c["check"] in structural and not c["ok"]]
    if broken:
        print("\n*** QUEBRA DE CONTRATO ESTRUTURAL DO INDICE — revise a ingestao. ***")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
