"""Etapa 3/4 — validação de qualidade e normalização para o modelo analítico.

Tudo aqui é determinístico e reproduzível: mesmo snapshot + mesma versão de regras
produzem exatamente as mesmas tabelas.

As regras de domínio vêm de `config/regras_negocio.json` (DEC-017). Este módulo aplica
regras; não as define. Não existe constante de negócio hardcoded abaixo desta linha.
"""

from __future__ import annotations

import datetime as dt
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from backend.app.core.config import BusinessRules
from backend.pipeline.contracts import indice_v1
from backend.pipeline.steps.extract import ExtractedIndex
from backend.pipeline.steps.snapshot import Snapshot

# Proveniências (vocabulário fechado, ver config/regras_negocio.json -> proveniencias)
P_SOURCE = "source"
P_DERIVED = "derived"
P_CONFIRMED = "confirmed_business_rule"
P_INFERRED = "inferred"
P_TAXONOMY_PENDING = "taxonomy_pending"
P_MISSING = "missing"

FILENAME_PATTERN = re.compile(
    r"^(?P<yy>\d{2})(?P<mm>\d{2})(?P<dd>\d{2}) - (?P<natureza>.+?) - (?P<assunto>.+?)"
    r" - (?P<destinatario>.+?) - (?P<nr>\d+)(?: \((?P<copia>\d+)\))?\.(?P<ext>\w+)$"
)


def fold(text: Any) -> str:
    """minúsculas sem acento — para comparar 'consulta' com 'Consulta'."""
    norm = unicodedata.normalize("NFKD", str(text or ""))
    return "".join(c for c in norm if not unicodedata.combining(c)).lower().strip()


def as_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def none_if_blank(value: Any) -> str | None:
    text = as_text(value)
    return text or None


def parse_br_datetime(value: Any) -> tuple[dt.datetime | None, bool]:
    """'10/09/2026 14:17' ou '28/08/2026 10:03 (aprox.)' -> (datetime|None, aproximado)."""
    raw = as_text(value)
    if not raw:
        return None, False
    approximate = "(aprox" in raw.lower()
    clean = re.sub(r"\(aprox\.?\)", "", raw, flags=re.IGNORECASE).strip()
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(clean, fmt), approximate
        except ValueError:
            continue
    return None, approximate


def split_multi(value: Any) -> list[str]:
    return [p.strip() for p in as_text(value).split(indice_v1.DELIMITER) if p.strip()]


def to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_document_date(value: Any) -> tuple[dt.date | None, str | None]:
    """Coluna `Data` -> (data, problema). Nunca adivinha.

    Só célula de data do Excel vira data. Vazio e qualquer outra coisa — texto, número,
    prefixo de nome de arquivo como '250000' — viram None, e o problema ('vazia' ou
    'invalida') vira achado de qualidade. Sem fallback para o nome do arquivo, para a
    data de upload ou para o dia 01: ausência de data é informação.
    """
    if isinstance(value, dt.datetime):
        return value.date(), None
    if isinstance(value, dt.date):
        return value, None
    if not as_text(value):
        return None, "vazia"
    return None, "invalida"


@dataclass
class Finding:
    regra: str
    severidade: str  # high | medium | low | info
    entidade_tipo: str
    entidade_id: str
    descricao: str
    proveniencia: str = P_DERIVED

    def as_dict(self) -> dict:
        return {
            "regra_key": self.regra,
            "severidade": self.severidade,
            "entidade_tipo": self.entidade_tipo,
            "entidade_id": self.entidade_id,
            "descricao": self.descricao,
            "proveniencia": self.proveniencia,
        }


@dataclass
class Model:
    """Modelo analítico completo de um ciclo."""

    tables: dict[str, list[dict]] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)
    findings: list[Finding] = field(default_factory=list)

    def table(self, name: str) -> list[dict]:
        return self.tables.get(name, [])


class Normalizer:
    def __init__(self, rules: BusinessRules) -> None:
        self.rules = rules
        self.road_pattern = re.compile(rules.road_regex, re.IGNORECASE)
        self._contracts_by_recipient = {
            fold(item["destinatario_indice"]): item for item in rules.contracts
        }
        self._contract_by_road = {item["rodovia"]: item for item in rules.contracts}
        self._stage_by_nature = {fold(k): v for k, v in rules.stage_by_nature.items()}
        self._macro_by_nature = {fold(k): v for k, v in rules.macro_by_nature.items()}
        self._macro_by_theme = {fold(k): v for k, v in rules.macro_by_theme.items()}
        self._natures_without_matter = {fold(n) for n in rules.natures_without_matter}
        self._themes_without_signal = {fold(t) for t in rules.themes_without_signal}
        self._confirmed_recipients = {fold(v) for v in rules.confirmed_recipients}
        self._generic_buckets = {fold(v) for v in rules.generic_buckets}

    # ------------------------------------------------------------------ roads
    def roads_for_row(self, row: dict) -> dict[str, str]:
        """Rodovias de uma linha -> {rodovia_canonica: campo_de_origem}.

        REGRA CONFIRMADA (DEC-010): 'RD-102' sem 'B' explícito é RD-102A.
        Roda CAMPO POR CAMPO — concatenar campos gera falso positivo, porque siglas
        de órgão estadual terminadas na UF 'RD' (sintéticas: MPRD, ALERD, TCE-RD) colam no prefixo de data do nome do
        arquivo e produzem 'RD 251' / 'RD 260' / 'RD 250'. Ver DEC-014.
        """
        found: dict[str, str] = {}
        for field_name in self.rules.road_fields:
            for match in self.road_pattern.finditer(as_text(row.get(field_name))):
                numero, letra = match.group(1), (match.group(2) or "").upper()
                if numero == "102":
                    key = "RD-102B" if letra == "B" else "RD-102A"
                else:
                    key = f"RD-{numero}{letra}"
                found.setdefault(key, field_name)
        return found

    # ------------------------------------------------------------------ stage
    def stage_for(self, natureza: str | None, arquivo: str) -> tuple[str, str]:
        """(estagio, proveniencia). Conservador: sem evidência -> nao_determinado."""
        mapped = self._stage_by_nature.get(fold(natureza)) if natureza else None
        if mapped and mapped != "nao_determinado":
            return mapped, P_DERIVED
        name = fold(arquivo)
        for marker in self.rules.stage_name_markers:
            if fold(marker) in name:
                return "em_elaboracao", P_INFERRED
        return "nao_determinado", P_MISSING

    # ------------------------------------------------------------------ macro
    def macro_for(self, natureza: str | None, temas: list[str]) -> tuple[str, str, str]:
        """(macrogrupo, status, origem). Nunca força classificação (DEC-019)."""
        key = fold(natureza)
        if key and key in self._macro_by_nature:
            entry = self._macro_by_nature[key]
            return entry["macrogrupo"], entry.get("status", "proposto"), "natureza"

        if key in self._natures_without_matter or not key:
            scores: dict[str, int] = defaultdict(int)
            for tema in temas:
                tkey = fold(tema)
                if tkey in self._themes_without_signal:
                    continue
                entry = self._macro_by_theme.get(tkey)
                if entry:
                    scores[entry["macrogrupo"]] += int(entry.get("peso", 1))
            if scores:
                ordered = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
                # Empate resolve para "Não classificado": preferimos não saber a inventar.
                if len(ordered) == 1 or ordered[0][1] > ordered[1][1]:
                    return ordered[0][0], "derivado_do_tema", "tema"

        default = self.rules.macro_default
        return default["macrogrupo"], default.get("status", "revisar"), "sem_evidencia"


def normalize(
    extracted: ExtractedIndex,
    snapshot: Snapshot,
    rules: BusinessRules,
) -> Model:
    engine = Normalizer(rules)
    model = Model()
    findings: list[Finding] = []
    rows = extracted.rows

    # ---------------------------------------------------------------- relógios
    scan_datetimes = [
        parse_br_datetime(entry.get("Data/hora"))[0] for entry in extracted.log_atualizacao
    ]
    indexed_as_of = max([d for d in scan_datetimes if d], default=None)
    physical_scan_as_of = snapshot.physical_scan_as_of

    # ------------------------------------------------------------- taxonomia
    listas = extracted.listas_apoio
    allowed = {
        "Naturezas": {fold(v) for v in listas.get("Naturezas", [])},
        "Destinatarios": {fold(v) for v in listas.get("Destinatarios", [])},
        "Temas": {fold(v) for v in listas.get("Temas", [])},
    }

    def taxonomy_status(column: str, value: str | None) -> tuple[str, str]:
        """(status_taxonomia, proveniencia) — divergência é estado, não erro (DEC-022)."""
        if not value:
            return "ok", P_MISSING
        key = fold(value)
        if key in allowed.get(column, set()):
            return "ok", P_SOURCE
        if column == "Destinatarios" and key in engine._confirmed_recipients:
            return "confirmado_por_regra", P_CONFIRMED
        return "pendente_de_validacao", P_TAXONOMY_PENDING

    # ------------------------------------------------------------ documentos
    documentos: list[dict] = []
    br_tema: list[dict] = []
    br_rodovia: list[dict] = []

    for row in rows:
        doc_id = to_int(row.get("ID"))
        natureza = none_if_blank(row.get("Naturezas"))
        assunto = none_if_blank(row.get("Assunto"))
        destinatario = none_if_blank(row.get("Destinatarios"))
        arquivo = as_text(row.get("Arquivo"))
        pasta = as_text(row.get("Pasta"))
        status = as_text(row.get("Status"))
        temas = split_multi(row.get("Temas"))

        data_documento, problema_data = parse_document_date(row.get("Data"))
        indexacao, indexacao_aprox = parse_br_datetime(row.get("Data/hora do upload"))
        ultima_mod, _ = parse_br_datetime(row.get("Última modificação"))

        match = FILENAME_PATTERN.match(arquivo)
        nome_conforme = match is not None
        # Precisão descreve uma data; sem data não há precisão, mesmo com nome no padrão.
        precisao = None
        if data_documento and match:
            dia = int(match.group("dd"))
            precisao = "mes" if dia == 0 else "dia"
        elif data_documento:
            precisao = "dia"

        roads = engine.roads_for_row(row)
        contrato = engine._contracts_by_recipient.get(fold(destinatario))
        if contrato is None:
            # Fallback: rodovia confirmada leva ao contrato confirmado, com origem própria.
            for road in roads:
                if road in engine._contract_by_road:
                    contrato = engine._contract_by_road[road]
                    contrato_origem = "rodovia"
                    break
            else:
                contrato_origem = None
        else:
            contrato_origem = "destinatario"

        estagio, estagio_prov = engine.stage_for(natureza, arquivo)
        macro, macro_status, macro_origem = engine.macro_for(natureza, temas)
        tax_status_dest, tax_prov_dest = taxonomy_status("Destinatarios", destinatario)
        link_url = extracted.hyperlinks.get(doc_id) if doc_id is not None else None

        documentos.append(
            {
                "documento_id": doc_id,
                "natureza": natureza,
                "natureza_proveniencia": P_SOURCE if natureza else P_MISSING,
                "assunto": assunto,
                "destinatario": destinatario,
                "destinatario_status_taxonomia": tax_status_dest,
                "destinatario_proveniencia": tax_prov_dest,
                "destinatario_generico": fold(destinatario) in engine._generic_buckets,
                "temas_texto": as_text(row.get("Temas")) or None,
                "temas_count": len(temas),
                "necessidade_resposta": to_int(row.get("Necessidade resposta")),
                "status": status,
                "ativo": status == "Na pasta",
                "arquivo_nome": arquivo,
                "arquivo_extensao": arquivo.rsplit(".", 1)[-1].lower() if "." in arquivo else None,
                "arquivo_copia_office": bool(re.search(r" \(\d+\)\.[A-Za-z0-9]+$", arquivo)),
                "pasta": pasta,
                "pasta_norm": fold(pasta),
                "link_url": link_url,
                "link_disponivel": bool(link_url),
                "data_documento": data_documento.isoformat() if data_documento else None,
                "data_documento_precisao": precisao,
                "ano": data_documento.year if data_documento else None,
                "mes": data_documento.strftime("%Y-%m") if data_documento else None,
                "trimestre": (
                    f"{data_documento.year}-T{(data_documento.month - 1) // 3 + 1}"
                    if data_documento
                    else None
                ),
                "data_indexacao": indexacao.isoformat(timespec="seconds") if indexacao else None,
                "data_indexacao_aproximada": indexacao_aprox,
                "data_ultima_modificacao": (
                    ultima_mod.isoformat(timespec="seconds") if ultima_mod else None
                ),
                "pessoa_upload": none_if_blank(row.get("Subido por")),
                "pessoa_modificacao": none_if_blank(row.get("Modificado por")),
                "nome_conforme_padrao": nome_conforme,
                "nome_assunto": match.group("assunto") if match else None,
                "nome_destinatario_curto": match.group("destinatario") if match else None,
                "rodovias_texto": "; ".join(sorted(roads)) or None,
                "rodovia_principal": sorted(roads)[0] if roads else None,
                "rodovias_count": len(roads),
                "rodovia_proveniencia": (
                    P_DERIVED if roads else P_MISSING
                ),
                "contrato": contrato["contrato"] if contrato else None,
                "contrato_origem": contrato_origem,
                # O mapa contrato->rodovia->executora é confirmado (DEC-010), mas o
                # CAMINHO até ele muda a confiança: pela coluna Destinatarios é
                # confirmado; pela rodovia extraída do texto é apenas derivado.
                "contrato_proveniencia": (
                    P_CONFIRMED
                    if contrato_origem == "destinatario"
                    else (P_DERIVED if contrato else P_MISSING)
                ),
                "executora": contrato["executora"] if contrato else None,
                "estagio_documental": estagio,
                "estagio_proveniencia": estagio_prov,
                "macrogrupo_juridico": macro,
                "macrogrupo_status": macro_status,
                "macrogrupo_origem": macro_origem,
                "ciclo_id": snapshot.cycle_id,
            }
        )

        if problema_data:
            # O valor bruto fica no achado (e na cópia em data/raw), não numa coluna nova.
            origem = (
                "campo 'Data' vazio"
                if problema_data == "vazia"
                else f"campo 'Data' com '{as_text(row.get('Data'))}', que não é uma data"
            )
            findings.append(
                Finding(
                    "data_documento_nao_normalizada",
                    "medium",
                    "documento",
                    str(doc_id),
                    f"{arquivo}: {origem}. Documento mantido no acervo sem data; "
                    "fica fora das séries temporais.",
                    P_MISSING,
                )
            )

        for ordem, tema in enumerate(temas, start=1):
            tax_status_tema, tax_prov_tema = taxonomy_status("Temas", tema)
            br_tema.append(
                {
                    "documento_id": doc_id,
                    "tema": tema,
                    "ordem": ordem,
                    "status_taxonomia": tax_status_tema,
                    "proveniencia": tax_prov_tema,
                    "ciclo_id": snapshot.cycle_id,
                }
            )

        for road, origin_field in sorted(roads.items()):
            br_rodovia.append(
                {
                    "documento_id": doc_id,
                    "rodovia": road,
                    "campo_origem": origin_field,
                    "confianca": rules.road_confidence_by_field.get(origin_field, "media"),
                    "proveniencia": P_DERIVED,
                    "ciclo_id": snapshot.cycle_id,
                }
            )

    model.tables["fct_documento"] = documentos
    model.tables["br_documento_tema"] = br_tema
    model.tables["br_documento_rodovia"] = br_rodovia

    # ------------------------------------------------------------- dimensões
    total_docs = len(documentos)

    nature_counts = Counter(d["natureza"] or "(sem natureza)" for d in documentos)
    model.tables["dim_natureza"] = [
        {
            "natureza": name,
            "natureza_norm": fold(name),
            "em_listas_apoio": fold(name) in allowed["Naturezas"],
            "docs_count": count,
            "macrogrupo_juridico": engine.macro_for(
                None if name == "(sem natureza)" else name, []
            )[0],
            "estagio_padrao": engine.stage_for(
                None if name == "(sem natureza)" else name, ""
            )[0],
        }
        for name, count in nature_counts.most_common()
    ]

    theme_counts = Counter(link["tema"] for link in br_tema)
    theme_docs = defaultdict(set)
    for link in br_tema:
        theme_docs[link["tema"]].add(link["documento_id"])
    model.tables["dim_tema"] = [
        {
            "tema": name,
            "tema_norm": fold(name),
            "em_listas_apoio": fold(name) in allowed["Temas"],
            "tema_generico": fold(name) in engine._themes_without_signal,
            "vinculos_count": count,
            "docs_count": len(theme_docs[name]),
        }
        for name, count in theme_counts.most_common()
    ]

    recipient_counts = Counter(d["destinatario"] or "(sem destinatário)" for d in documentos)
    model.tables["dim_destinatario"] = [
        {
            "destinatario": name,
            "destinatario_norm": fold(name),
            "status_taxonomia": taxonomy_status(
                "Destinatarios", None if name == "(sem destinatário)" else name
            )[0],
            "generico": fold(name) in engine._generic_buckets,
            "docs_count": count,
        }
        for name, count in recipient_counts.most_common()
    ]

    people: Counter = Counter()
    people_mod: Counter = Counter()
    for doc in documentos:
        if doc["pessoa_upload"]:
            people[doc["pessoa_upload"]] += 1
        if doc["pessoa_modificacao"]:
            people_mod[doc["pessoa_modificacao"]] += 1
    model.tables["dim_pessoa"] = [
        {
            "pessoa": name,
            "uploads_count": people.get(name, 0),
            "modificacoes_count": people_mod.get(name, 0),
        }
        for name in sorted(set(people) | set(people_mod))
    ]

    physical_by_folder = Counter(item.folder for item in snapshot.inventory.acervo)
    index_by_folder = Counter(d["pasta_norm"] for d in documentos)
    active_by_folder = Counter(d["pasta_norm"] for d in documentos if d["ativo"])
    folders = sorted(
        {fold(f) for f in physical_by_folder} | set(index_by_folder) | {
            fold(f) for f in snapshot.inventory.empty_folders
        }
    )
    physical_folded = Counter()
    for folder, count in physical_by_folder.items():
        physical_folded[fold(folder)] += count
    model.tables["dim_pasta"] = [
        {
            "pasta_norm": folder,
            "arquivos_disco": physical_folded.get(folder, 0),
            "linhas_indice": index_by_folder.get(folder, 0),
            "ativos_indice": active_by_folder.get(folder, 0),
            "delta": physical_folded.get(folder, 0) - active_by_folder.get(folder, 0),
            "vazia": physical_folded.get(folder, 0) == 0,
        }
        for folder in folders
        if folder
    ]

    status_counts = Counter(d["status"] for d in documentos)
    model.tables["dim_status"] = [
        {"status": name, "ativo": name == "Na pasta", "docs_count": count}
        for name, count in status_counts.most_common()
    ]

    road_docs = defaultdict(set)
    for link in br_rodovia:
        road_docs[link["rodovia"]].add(link["documento_id"])
    canonical = set(rules.roads_canonical)
    model.tables["dim_rodovia"] = [
        {
            "rodovia": name,
            "docs_count": len(docs),
            "canonica": name in canonical,
            "contrato": engine._contract_by_road.get(name, {}).get("contrato"),
            "executora": engine._contract_by_road.get(name, {}).get("executora"),
            "proveniencia": P_CONFIRMED if name in engine._contract_by_road else P_DERIVED,
        }
        for name, docs in sorted(road_docs.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    ]

    contract_docs = Counter(d["contrato"] for d in documentos if d["contrato"])
    model.tables["dim_contrato"] = [
        {
            "contrato": item["contrato"],
            "numero": item["numero"],
            "ano": item["ano"],
            "rodovia": item["rodovia"],
            "executora": item["executora"],
            "destinatario_indice": item["destinatario_indice"],
            "docs_count": contract_docs.get(item["contrato"], 0),
            "docs_por_rodovia": len(road_docs.get(item["rodovia"], set())),
            "proveniencia": P_CONFIRMED,
            "confirmado_em": rules.confirmed_at,
        }
        for item in rules.contracts
    ]

    model.tables["dim_executora"] = [
        {
            "executora": item["executora"],
            "rodovia": item["rodovia"],
            "contrato": item["contrato"],
            "docs_count": contract_docs.get(item["contrato"], 0),
            "proveniencia": P_CONFIRMED,
        }
        for item in rules.contracts
    ]

    stage_counts = Counter(d["estagio_documental"] for d in documentos)
    model.tables["dim_estagio"] = [
        {
            "estagio": key,
            "rotulo": rules.stage_labels.get(key, key),
            "docs_count": stage_counts.get(key, 0),
        }
        for key in rules.stage_labels
    ]

    # A escala de necessidade de resposta vem da própria LISTAS_APOIO: os rótulos são
    # dado da fonte, não invenção nossa. Guardamos a escala prevista lado a lado com o
    # uso real — é o que permite dizer honestamente que o campo não diferencia.
    response_labels = listas.get("Necessidade resposta", [])
    response_used = Counter(
        d["necessidade_resposta"] for d in documentos if d["necessidade_resposta"] is not None
    )
    niveis = []
    for label in response_labels:
        match_level = re.match(r"\s*(\d+)\s*-\s*(.+)", label)
        if not match_level:
            continue
        nivel = int(match_level.group(1))
        niveis.append(
            {
                "nivel": nivel,
                "rotulo": match_level.group(2).strip(),
                "rotulo_completo": label,
                "docs_count": response_used.get(nivel, 0),
                "previsto_nao_utilizado": response_used.get(nivel, 0) == 0,
            }
        )
    model.tables["dim_necessidade_resposta"] = niveis

    macro_counts = Counter(d["macrogrupo_juridico"] for d in documentos)
    model.tables["dim_macrogrupo"] = [
        {"macrogrupo": name, "docs_count": count}
        for name, count in macro_counts.most_common()
    ]

    months = sorted({d["mes"] for d in documentos if d["mes"]})
    month_counts = Counter(d["mes"] for d in documentos if d["mes"])
    model.tables["dim_calendario"] = [
        {
            "mes": month,
            "ano": int(month[:4]),
            "mes_numero": int(month[5:7]),
            "trimestre": f"{month[:4]}-T{(int(month[5:7]) - 1) // 3 + 1}",
            "docs_count": month_counts.get(month, 0),
        }
        for month in months
    ]

    # --------------------------------------------------- fatos de repositório
    varreduras: list[dict] = []
    for entry in extracted.log_atualizacao:
        moment, _ = parse_br_datetime(entry.get("Data/hora"))
        varreduras.append(
            {
                "data_varredura": moment.isoformat(timespec="seconds") if moment else None,
                "novos": to_int(entry.get("Novos")) or 0,
                "modificados": to_int(entry.get("Modificados")) or 0,
                "excluidos": to_int(entry.get("Excluídos")) or 0,
                "reaparecidos": to_int(entry.get("Reaparecidos")) or 0,
                "total_na_pasta": to_int(entry.get("Total na pasta")),
                "total_no_indice": to_int(entry.get("Total no índice")),
                "observacao": none_if_blank(entry.get("Observação")),
                "ciclo_id": snapshot.cycle_id,
            }
        )
    model.tables["fct_varredura"] = varreduras

    indexed_names = {d["arquivo_nome"] for d in documentos}
    arquivos: list[dict] = []
    pendentes = 0
    lacunas = 0
    for item in snapshot.inventory.acervo:
        is_indexed = item.filename in indexed_names
        if is_indexed:
            situacao = "indexado"
        elif indexed_as_of and item.mtime > indexed_as_of:
            situacao = "pendente_de_varredura"
            pendentes += 1
        else:
            situacao = "lacuna_de_indexacao"
            lacunas += 1
        arquivos.append(
            {
                **item.as_dict(),
                "pasta_norm": fold(item.folder),
                "indexado": is_indexed,
                "situacao_indexacao": situacao,
                "ciclo_id": snapshot.cycle_id,
            }
        )
    model.tables["fct_arquivo_fisico"] = arquivos

    model.tables["fct_arquivo_controle"] = [
        {**item.as_dict(), "papel": "controle do repositório", "ciclo_id": snapshot.cycle_id}
        for item in snapshot.inventory.control_files
    ]

    # ------------------------------------------------------------- findings
    findings.extend(_build_findings(documentos, br_tema, arquivos, varreduras,
                                    snapshot, rules, allowed, engine, model))
    model.findings = findings
    model.tables["fct_dq_finding"] = [
        {
            **f.as_dict(),
            "ciclo_id": snapshot.cycle_id,
            "detectado_em": physical_scan_as_of.isoformat(timespec="seconds"),
        }
        for f in findings
    ]

    # ------------------------------------------------------------------ meta
    active = sum(1 for d in documentos if d["ativo"])
    severity_counts = Counter(f.severidade for f in findings)
    model.meta = {
        "ciclo_id": snapshot.cycle_id,
        "schema_version": indice_v1.SCHEMA_VERSION,
        "regras_negocio_versao": rules.version,
        "regras_confirmadas_em": rules.confirmed_at,
        "indexed_as_of": indexed_as_of.isoformat(timespec="seconds") if indexed_as_of else None,
        "physical_scan_as_of": physical_scan_as_of.isoformat(timespec="seconds"),
        "pending_reconciliation_count": pendentes,
        "indexing_gap_count": lacunas,
        "documentos_indexados": total_docs,
        "documentos_ativos": active,
        "documentos_excluidos": total_docs - active,
        "acervo_fisico": snapshot.inventory.total_acervo,
        "arquivos_controle": len(snapshot.inventory.control_files),
        "vinculos_tema": len(br_tema),
        "docs_com_rodovia": len({link["documento_id"] for link in br_rodovia}),
        "docs_com_contrato": sum(1 for d in documentos if d["contrato"]),
        "indice_sha256": snapshot.index_fingerprint.get("sha256"),
        "inventario_digest": snapshot.inventory_digest,
        "source_root": snapshot.source_root,
        "achados_por_severidade": dict(severity_counts),
        "rotulos_reconciliacao": rules.reconciliation_labels,
    }
    model.tables["meta_ciclo"] = [model.meta]
    return model


def _build_findings(
    documentos: list[dict],
    br_tema: list[dict],
    arquivos: list[dict],
    varreduras: list[dict],
    snapshot: Snapshot,
    rules: BusinessRules,
    allowed: dict[str, set[str]],
    engine: Normalizer,
    model: Model,
) -> list[Finding]:
    """Achados de qualidade. Limitação conhecida NÃO é erro crítico (DEC-022)."""
    out: list[Finding] = []
    total = len(documentos) or 1

    # cobertura do índice
    lacunas = [a for a in arquivos if a["situacao_indexacao"] == "lacuna_de_indexacao"]
    pendentes = [a for a in arquivos if a["situacao_indexacao"] == "pendente_de_varredura"]
    for item in lacunas:
        out.append(
            Finding(
                "lacuna_de_indexacao",
                "high",
                "arquivo",
                f"{item['pasta']}/{item['arquivo_nome']}",
                "Arquivo anterior à última varredura e ausente do índice.",
            )
        )
    if pendentes:
        out.append(
            Finding(
                "pendente_de_reconciliacao",
                "info",
                "acervo",
                "inventario",
                f"{len(pendentes)} documento(s) no disco aguardando a próxima varredura do "
                "indexador. Defasagem normal entre dois relógios, não falha de qualidade.",
            )
        )

    # completude
    for column, label, severity in (
        ("pessoa_upload", "Subido por", "medium"),
        ("pessoa_modificacao", "Modificado por", "medium"),
        ("destinatario", "Destinatarios", "low"),
        ("natureza", "Naturezas", "low"),
        ("data_documento", "Data", "low"),
    ):
        missing = [d for d in documentos if not d[column]]
        if missing:
            out.append(
                Finding(
                    f"campo_ausente_{column}",
                    severity,
                    "campo",
                    label,
                    f"{len(missing)} de {total} documento(s) sem '{label}' "
                    f"({100 * len(missing) / total:.0f}%).",
                    P_MISSING,
                )
            )

    # taxonomia
    pending_recipients = sorted(
        {
            d["destinatario"]
            for d in documentos
            if d["destinatario_status_taxonomia"] == "pendente_de_validacao"
            and d["destinatario"]
        }
    )
    for value in pending_recipients:
        count = sum(1 for d in documentos if d["destinatario"] == value)
        out.append(
            Finding(
                "taxonomia_pendente_de_validacao",
                "low",
                "destinatario",
                value,
                f"Valor observado '{value}' em {count} documento(s), fora da LISTAS_APOIO e "
                "sem regra confirmada. Preservado exatamente como está na fonte.",
                P_TAXONOMY_PENDING,
            )
        )
    confirmed_gap = sorted(
        {
            d["destinatario"]
            for d in documentos
            if d["destinatario_status_taxonomia"] == "confirmado_por_regra"
            and d["destinatario"]
        }
    )
    for value in confirmed_gap:
        count = sum(1 for d in documentos if d["destinatario"] == value)
        out.append(
            Finding(
                "taxonomia_planilha_vs_regra",
                "info",
                "destinatario",
                value,
                f"'{value}' é destinatário válido por regra confirmada ({count} documentos), "
                "mas ainda não consta da LISTAS_APOIO. Diferença de estado, não erro.",
                P_CONFIRMED,
            )
        )
    pending_themes = sorted(
        {link["tema"] for link in br_tema if link["status_taxonomia"] == "pendente_de_validacao"}
    )
    for value in pending_themes:
        out.append(
            Finding("taxonomia_pendente_de_validacao", "low", "tema", value,
                    f"Tema '{value}' fora da LISTAS_APOIO.", P_TAXONOMY_PENDING)
        )

    # nomenclatura
    off_pattern = [d for d in documentos if not d["nome_conforme_padrao"]]
    for doc in off_pattern:
        out.append(
            Finding(
                "nome_fora_do_padrao",
                "low",
                "documento",
                str(doc["documento_id"]),
                f"Nome fora da regra de nomenclatura: {doc['arquivo_nome']}",
            )
        )

    # campo previsto e não utilizado
    response_values = {
        d["necessidade_resposta"] for d in documentos if d["necessidade_resposta"] is not None
    }
    if len(response_values) <= 1:
        out.append(
            Finding(
                "campo_previsto_nao_utilizado",
                "medium",
                "campo",
                "Necessidade resposta",
                "A LISTAS_APOIO prevê 5 níveis de necessidade de resposta, mas a coluna tem "
                f"variância zero (valor único {sorted(response_values)}). Sem poder analítico: "
                "nenhum KPI de urgência, SLA ou prazo é construído sobre ela.",
            )
        )

    # log inconsistente
    if varreduras:
        excluded_in_log = sum(v["excluidos"] for v in varreduras)
        excluded_in_index = sum(1 for d in documentos if not d["ativo"])
        if excluded_in_index and not excluded_in_log:
            out.append(
                Finding(
                    "log_excluidos_inconsistente",
                    "medium",
                    "log",
                    "LOG_ATUALIZACAO.Excluídos",
                    f"O índice tem {excluded_in_index} documento(s) com Status='Excluído', mas o "
                    f"log acumula 0 exclusões em {len(varreduras)} varreduras. A contagem de "
                    "exclusões vem do Status, nunca do log.",
                )
            )

    # duplicidade semântica
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for doc in documentos:
        groups[(doc["data_documento"], fold(doc["assunto"]), fold(doc["destinatario"]))].append(doc)
    for key, docs in groups.items():
        if len(docs) < 2:
            continue
        extensions = {d["arquivo_extensao"] for d in docs}
        has_copy = any(d["arquivo_copia_office"] for d in docs)
        if has_copy:
            kind, severity = "copia_office", "medium"
        elif len(extensions) > 1 and len(docs) == len(extensions):
            kind, severity = "par_formato", "info"
        else:
            kind, severity = "variante_ou_versao", "low"
        out.append(
            Finding(
                f"duplicidade_{kind}",
                severity,
                "grupo",
                " | ".join(str(k) for k in key),
                f"{len(docs)} documentos com mesma data, assunto e destinatário "
                f"(IDs {[d['documento_id'] for d in docs]}). Classificação: {kind}.",
            )
        )

    # precisão de data / indexação aproximada
    month_precision = [d for d in documentos if d["data_documento_precisao"] == "mes"]
    if month_precision:
        out.append(
            Finding(
                "data_precisao_mensal",
                "info",
                "campo",
                "Data",
                f"{len(month_precision)} documento(s) de periodicidade mensal (dia '00' no "
                "nome). Série diária os excluiria; série mensal os inclui.",
            )
        )
    approximate = [d for d in documentos if d["data_indexacao_aproximada"]]
    if approximate:
        out.append(
            Finding(
                "data_indexacao_aproximada",
                "info",
                "campo",
                "Data/hora do upload",
                f"{len(approximate)} documento(s) com data de indexação aproximada "
                "(inventário inicial). Não é data de upload real.",
            )
        )

    # macrogrupo não classificado
    unclassified = [d for d in documentos if d["macrogrupo_origem"] == "sem_evidencia"]
    if unclassified:
        out.append(
            Finding(
                "macrogrupo_nao_classificado",
                "low",
                "campo",
                "macrogrupo_juridico",
                f"{len(unclassified)} de {total} documento(s) sem evidência suficiente para "
                f"determinar a matéria jurídica ({100 * len(unclassified) / total:.0f}%). "
                "Camada analítica derivada, não dado da fonte — e não é KPI do Overview.",
                P_DERIVED,
            )
        )

    # pasta vazia — categoria existente, não problema (DEC-022)
    for row in model.tables.get("dim_pasta", []):
        if row["vazia"] and row["linhas_indice"] == 0:
            out.append(
                Finding(
                    "categoria_sem_documentos",
                    "info",
                    "pasta",
                    row["pasta_norm"],
                    "Categoria existente, atualmente sem documentos.",
                )
            )

    # links
    missing_links = [d for d in documentos if d["ativo"] and not d["link_disponivel"]]
    if missing_links:
        out.append(
            Finding(
                "link_ausente_em_documento_ativo",
                "medium",
                "campo",
                "Link",
                f"{len(missing_links)} documento(s) 'Na pasta' sem hyperlink.",
            )
        )

    # guarda de regressão da extração de rodovia (DEC-014)
    false_positives = set(rules.roads_false_positives)
    regressions = sorted(
        {row["rodovia"] for row in model.tables.get("dim_rodovia", [])} & false_positives
    )
    if regressions:
        out.append(
            Finding(
                "regressao_extracao_rodovia",
                "high",
                "modelo",
                ", ".join(regressions),
                "Falsos positivos conhecidos de rodovia reapareceram. A extração regrediu: "
                "o regex provavelmente voltou a rodar sobre campos concatenados (DEC-014).",
            )
        )

    return out
