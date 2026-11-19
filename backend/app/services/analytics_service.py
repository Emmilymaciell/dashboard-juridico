"""Regra de negócio da apresentação: KPIs, séries, cortes e rótulos de proveniência.

O frontend não recalcula nada disto. Ele desenha.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from backend.app.core.config import BusinessRules
from backend.app.repositories.analytics import AnalyticsRepository, DocumentFilters
from backend.app.schemas.common import (
    Achado,
    BlocoGovernanca,
    Cobertura,
    ContagemItem,
    DocumentoDetalhe,
    DocumentoResumo,
    Kpi,
    Meta,
    MetaSnapshot,
    PontoTemporal,
)

# Rótulo devolvido pelo repositório quando a dimensão é nula.
NAO_INFORMADO = "(não informado)"


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository, rules: BusinessRules) -> None:
        self.repo = repo
        self.rules = rules

    # ------------------------------------------------------------------ meta
    def snapshot_meta(self) -> MetaSnapshot:
        raw = self.repo.meta()
        indexed = raw.get("indexed_as_of")
        physical = raw.get("physical_scan_as_of")
        divergent = bool(indexed and physical and indexed[:16] != physical[:16])
        return MetaSnapshot(
            ciclo_id=raw["ciclo_id"],
            schema_version=raw["schema_version"],
            regras_negocio_versao=raw["regras_negocio_versao"],
            regras_confirmadas_em=raw.get("regras_confirmadas_em"),
            indexed_as_of=indexed,
            physical_scan_as_of=physical,
            pending_reconciliation_count=raw.get("pending_reconciliation_count", 0),
            indexing_gap_count=raw.get("indexing_gap_count", 0),
            documentos_indexados=raw["documentos_indexados"],
            documentos_ativos=raw["documentos_ativos"],
            documentos_excluidos=raw["documentos_excluidos"],
            acervo_fisico=raw["acervo_fisico"],
            arquivos_controle=raw["arquivos_controle"],
            vinculos_tema=raw["vinculos_tema"],
            docs_com_rodovia=raw["docs_com_rodovia"],
            docs_com_contrato=raw["docs_com_contrato"],
            indice_sha256=raw.get("indice_sha256"),
            inventario_digest=raw.get("inventario_digest"),
            achados_por_severidade=raw.get("achados_por_severidade") or {},
            rotulos_reconciliacao=raw.get("rotulos_reconciliacao") or {},
            relogios_divergentes=divergent,
        )

    def base_meta(
        self,
        filters: DocumentFilters | None = None,
        *,
        categoria: str = "DADO DERIVADO",
        proveniencia: str = "derived",
        grao: str = "documento",
        cobertura: Cobertura | None = None,
        nota: str | None = None,
    ) -> Meta:
        raw = self.repo.meta()
        return Meta(
            categoria=categoria,  # type: ignore[arg-type]
            proveniencia=proveniencia,  # type: ignore[arg-type]
            grao=grao,
            cobertura=cobertura,
            ciclo_id=raw["ciclo_id"],
            indexed_as_of=raw.get("indexed_as_of"),
            physical_scan_as_of=raw.get("physical_scan_as_of"),
            regras_negocio_versao=raw.get("regras_negocio_versao"),
            filtros_aplicados=filters.as_dict() if filters else {},
            nota=nota,
        )

    # ------------------------------------------------------------------ kpis
    def overview_kpis(self, filters: DocumentFilters) -> list[Kpi]:
        meta = self.repo.meta()
        total = self.repo.count_documents(filters)

        active_filters = DocumentFilters(**{**filters.__dict__, "somente_ativos": True})
        active = self.repo.count_documents(active_filters)

        naturezas = [
            r
            for r in self.repo.group_count("natureza", filters)
            if r["chave"] != NAO_INFORMADO
        ]
        destinatarios = [
            r
            for r in self.repo.group_count("destinatario", filters)
            if r["chave"] != NAO_INFORMADO
        ]
        roads = self.repo.road_links(filters)
        docs_with_road = self._docs_with_road(filters) if roads else 0
        contratos = [
            r
            for r in self.repo.group_count("contrato", filters)
            if r["chave"] != NAO_INFORMADO
        ]
        docs_with_contract = sum(r["documentos"] for r in contratos)

        completeness = {r["campo"]: r for r in self.repo.completeness()}
        subido = completeness.get("Subido por", {"total": 0, "preenchidos": 0})
        cobertura_meta = (
            round(100 * subido["preenchidos"] / subido["total"], 1) if subido["total"] else 0.0
        )

        series = self.timeline(filters, "mes")
        current = series[-1].documentos if series else 0
        previous = series[-2].documentos if len(series) > 1 else None
        delta = None
        if previous:
            delta = round(100 * (current - previous) / previous, 1)

        sancionatorio = self._sanction_count(filters)

        kpis: list[Kpi] = [
            Kpi(
                chave="documentos_indexados",
                rotulo="Documentos indexados",
                valor=total,
                detalhe="Linhas da fonte estruturada no recorte atual",
                categoria="DADO EXISTENTE",
                proveniencia="source",
                drill={},
            ),
            Kpi(
                chave="documentos_ativos",
                rotulo="Ativos na pasta",
                valor=active,
                detalhe=f"{total - active} marcado(s) como excluído",
                categoria="DADO EXISTENTE",
                proveniencia="source",
                drill={"status": ["Na pasta"]},
            ),
            Kpi(
                chave="producao_periodo",
                rotulo=f"Produção em {series[-1].periodo}" if series else "Produção no período",
                valor=current,
                delta=delta,
                delta_rotulo="vs. mês anterior" if delta is not None else None,
                detalhe="Documentos por data do documento",
                drill={"data_inicio": f"{series[-1].periodo}-01"} if series else {},
                tom=(
                    "positivo"
                    if (delta or 0) > 0
                    else ("atencao" if (delta or 0) < 0 else "neutro")
                ),
            ),
            Kpi(
                chave="exposicao_sancionatoria",
                rotulo="Exposição sancionatória",
                valor=sancionatorio["documentos"],
                detalhe=f"{sancionatorio['vinculos']} vínculo(s) ao tema Sanções / Advertência",
                drill={"macrogrupo": ["Sancionatório"]},
                tom="atencao" if sancionatorio["documentos"] else "neutro",
            ),
            Kpi(
                chave="naturezas",
                rotulo="Naturezas em uso",
                valor=len(naturezas),
                detalhe="Tipos documentais distintos no recorte",
                drill={},
            ),
            Kpi(
                chave="stakeholders",
                rotulo="Stakeholders",
                valor=len(destinatarios),
                detalhe="Destinatários distintos",
                drill={},
            ),
            Kpi(
                chave="rodovias",
                rotulo="Rodovias identificadas",
                valor=len({r["chave"] for r in roads}),
                detalhe=(
                    f"{docs_with_road} de {total} documentos "
                    f"({100 * docs_with_road / total if total else 0:.0f}%) mencionam rodovia"
                ),
                categoria="DADO DERIVADO",
                drill={},
            ),
            Kpi(
                chave="contratos",
                rotulo="Contratos confirmados",
                valor=len(contratos),
                detalhe=f"{docs_with_contract} documento(s) vinculados",
                categoria="DADO EXISTENTE",
                proveniencia="confirmed_business_rule",
                drill={},
            ),
            Kpi(
                chave="cobertura_metadados",
                rotulo="Completude de responsável",
                valor=cobertura_meta,
                unidade="percentual",
                detalhe="Documentos com 'Subido por' preenchido",
                tom="atencao" if cobertura_meta < 80 else "neutro",
            ),
            Kpi(
                chave="cobertura_indice",
                rotulo="Cobertura do índice",
                valor=(
                    round(
                        100
                        * (
                            meta["acervo_fisico"]
                            - meta["pending_reconciliation_count"]
                            - meta["indexing_gap_count"]
                        )
                        / meta["acervo_fisico"],
                        1,
                    )
                    if meta["acervo_fisico"]
                    else 0.0
                ),
                unidade="percentual",
                detalhe=(
                    f"{meta['pending_reconciliation_count']} aguardando varredura, "
                    f"{meta['indexing_gap_count']} lacuna(s)"
                ),
                tom="atencao" if meta["indexing_gap_count"] else "neutro",
            ),
        ]
        return kpis

    def _docs_with_road(self, filters: DocumentFilters) -> int:
        rows = self.repo.query(
            "SELECT count(DISTINCT r.documento_id) AS total FROM br_documento_rodovia r "
            "JOIN fct_documento d ON d.documento_id = r.documento_id "
            "WHERE " + self._where_only(filters)[0],
            self._where_only(filters)[1],
        )
        return int(rows[0]["total"]) if rows else 0

    def _where_only(self, filters: DocumentFilters):
        from backend.app.repositories.analytics import _build_where

        return _build_where(filters)

    def _sanction_count(self, filters: DocumentFilters) -> dict[str, int]:
        where, params = self._where_only(filters)
        docs = self.repo.query(
            f"SELECT count(*) AS total FROM fct_documento d "
            f"WHERE {where} AND d.macrogrupo_juridico = 'Sancionatório'",
            params,
        )
        links = self.repo.query(
            f"SELECT count(*) AS total FROM br_documento_tema t "
            f"JOIN fct_documento d ON d.documento_id = t.documento_id "
            f"WHERE {where} AND t.tema = 'Sanções / Advertência'",
            params,
        )
        return {
            "documentos": int(docs[0]["total"]) if docs else 0,
            "vinculos": int(links[0]["total"]) if links else 0,
        }

    # -------------------------------------------------------------- séries
    def timeline(self, filters: DocumentFilters, granularidade: str = "mes") -> list[PontoTemporal]:
        rows = self.repo.timeline(filters, granularidade)
        points = [
            PontoTemporal(
                periodo=str(r["periodo"]),
                documentos=int(r["documentos"]),
                ativos=int(r["ativos"] or 0),
                naturezas=int(r["naturezas"] or 0),
                precisao_mensal=int(r["precisao_mensal"] or 0),
                sancionatorios=int(r["sancionatorios"] or 0),
            )
            for r in rows
        ]
        return points

    # -------------------------------------------------------------- cortes
    def counts(
        self, dimension: str, filters: DocumentFilters, limit: int | None = None
    ) -> list[ContagemItem]:
        if dimension == "tema":
            rows = self.repo.theme_links(filters, limit)
            return [
                ContagemItem(
                    chave=r["chave"],
                    documentos=int(r["documentos"]),
                    vinculos=int(r["vinculos"]),
                )
                for r in rows
            ]
        if dimension == "rodovia":
            rows = self.repo.road_links(filters)
            items = [
                ContagemItem(
                    chave=r["chave"],
                    documentos=int(r["documentos"]),
                    extra={
                        "contrato": r.get("contrato"),
                        "executora": r.get("executora"),
                        "documentos_confianca_alta": int(r.get("documentos_confianca_alta") or 0),
                    },
                )
                for r in rows
            ]
            return items[:limit] if limit else items

        column = {
            "natureza": "natureza",
            "destinatario": "destinatario",
            "status": "status",
            "pasta": "pasta",
            "estagio": "estagio_documental",
            "macrogrupo": "macrogrupo_juridico",
            "contrato": "contrato",
            "executora": "executora",
            "extensao": "arquivo_extensao",
            "responsavel": "pessoa_upload",
        }.get(dimension)
        if column is None:
            raise ValueError(f"dimensão desconhecida: {dimension}")
        rows = self.repo.group_count(column, filters, limit)
        return [
            ContagemItem(
                chave=str(r["chave"]),
                documentos=int(r["documentos"]),
                ativos=int(r["ativos"] or 0),
            )
            for r in rows
        ]

    # ----------------------------------------------------------- documentos
    def documents(
        self,
        filters: DocumentFilters,
        limit: int,
        offset: int,
        order_by: str,
        order_dir: str,
    ) -> tuple[list[DocumentoResumo], int]:
        total = self.repo.count_documents(filters)
        rows = self.repo.documents(filters, limit, offset, order_by, order_dir)
        return [DocumentoResumo(**_pick(r, DocumentoResumo)) for r in rows], total

    def document_detail(self, documento_id: int) -> DocumentoDetalhe | None:
        row = self.repo.document(documento_id)
        if row is None:
            return None
        detail = DocumentoDetalhe(**_pick(row, DocumentoDetalhe))
        detail.temas = self.repo.document_themes(documento_id)
        detail.rodovias = self.repo.document_roads(documento_id)
        detail.relacionados = self.repo.related_documents(documento_id)
        return detail

    # ----------------------------------------------------------- governança
    def governance(self) -> tuple[list[BlocoGovernanca], list[Achado], dict[str, Any]]:
        meta = self.repo.meta()
        findings_raw = self.repo.findings()
        findings = [Achado(**_pick(f, Achado)) for f in findings_raw]

        severity_counts: dict[str, int] = {"high": 0, "medium": 0, "low": 0, "info": 0}
        for finding in findings:
            severity_counts[finding.severidade] = severity_counts.get(finding.severidade, 0) + 1

        completeness = self.repo.completeness()
        total_docs = meta["documentos_indexados"] or 1

        blocks = [
            BlocoGovernanca(
                chave="cobertura",
                titulo="Cobertura do índice",
                descricao=(
                    "Comparação entre o inventário físico e a fonte estruturada. "
                    "Documento que chegou depois da última varredura não é falha de "
                    "qualidade — é defasagem entre dois relógios."
                ),
                itens=self.repo.folder_coverage(),
            ),
            BlocoGovernanca(
                chave="completude",
                titulo="Completude de metadados",
                descricao="Quanto do acervo cada campo realmente cobre.",
                itens=[
                    {
                        "campo": r["campo"],
                        "total": int(r["total"]),
                        "preenchidos": int(r["preenchidos"] or 0),
                        "percentual": round(100 * (r["preenchidos"] or 0) / r["total"], 1)
                        if r["total"]
                        else 0.0,
                    }
                    for r in completeness
                ],
            ),
            BlocoGovernanca(
                chave="taxonomia",
                titulo="Aderência à taxonomia",
                descricao=(
                    "Valor fora da LISTAS_APOIO pode ser válido por regra confirmada "
                    "(estado) ou aguardar validação (achado). Nunca é reclassificado "
                    "automaticamente, e a fonte nunca é alterada."
                ),
                itens=self.repo.taxonomy_status(),
            ),
            BlocoGovernanca(
                chave="reconciliacao",
                titulo="Pendências de reconciliação",
                descricao=(
                    f"Documentos no disco posteriores a {meta.get('indexed_as_of')}, "
                    "aguardando a próxima varredura do indexador."
                ),
                itens=self.repo.physical_files("pendente_de_varredura", limit=400),
            ),
            BlocoGovernanca(
                chave="distribuicao",
                titulo="Distribuição dos achados",
                descricao="Onde a atenção deve ir primeiro.",
                itens=[
                    {"severidade": key, "achados": value}
                    for key, value in severity_counts.items()
                    if value
                ],
            ),
        ]

        resumo = {
            "achados_total": len(findings),
            "por_severidade": severity_counts,
            "documentos": meta["documentos_indexados"],
            "acervo_fisico": meta["acervo_fisico"],
            "pendentes_reconciliacao": meta["pending_reconciliation_count"],
            "lacunas_indexacao": meta["indexing_gap_count"],
            "score_completude": round(
                sum(
                    (r["preenchidos"] or 0) / r["total"] for r in completeness if r["total"]
                )
                / max(len(completeness), 1)
                * 100,
                1,
            ),
            "formula_score": (
                "média simples do percentual de preenchimento dos campos monitorados "
                f"({len(completeness)} campos). Score sem fórmula visível é opinião."
            ),
            "documentos_total_para_percentuais": total_docs,
        }
        return blocks, findings, resumo

    # ---------------------------------------------------------- repositório
    def repository_activity(self) -> dict[str, Any]:
        scans = self.repo.scans()
        meta = self.repo.meta()
        return {
            "varreduras": scans,
            "resumo": {
                "execucoes": len(scans),
                "novos_acumulados": sum(int(s["novos"] or 0) for s in scans),
                "modificados_acumulados": sum(int(s["modificados"] or 0) for s in scans),
                "excluidos_no_log": sum(int(s["excluidos"] or 0) for s in scans),
                "excluidos_no_indice": meta["documentos_excluidos"],
                "aviso_log": (
                    "LOG_ATUALIZACAO.Excluídos e .Modificados acumulam zero apesar de "
                    "existirem exclusões no índice. A contagem de exclusões vem do campo "
                    "Status, nunca do log."
                ),
                "indexed_as_of": meta.get("indexed_as_of"),
                "physical_scan_as_of": meta.get("physical_scan_as_of"),
                "pendentes": meta.get("pending_reconciliation_count"),
            },
            "operadores": self.repo.dimension("pessoa"),
        }


def _pick(row: dict, model: type) -> dict:
    """Filtra a linha para os campos do schema — evita erro por coluna extra."""
    fields = set(model.model_fields.keys())  # type: ignore[attr-defined]
    return {k: v for k, v in row.items() if k in fields}


def parse_iso_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError as exc:  # pragma: no cover
        raise ValueError(f"data inválida (use AAAA-MM-DD): {value}") from exc
