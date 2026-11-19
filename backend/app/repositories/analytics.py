"""Única camada que fala SQL. Consulta o DuckDB gerado pelo pipeline.

Se um dia trocarmos DuckDB por outra coisa (DEC-003), a mudança é localizada aqui.
Nenhuma outra parte da aplicação conhece SQL.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

import duckdb

from backend.app.core.config import Settings

_LOCK = threading.Lock()


class ModelNotBuiltError(RuntimeError):
    """O DuckDB ainda não foi construído. Rode o pipeline."""


@dataclass
class DocumentFilters:
    """Filtros compartilhados por praticamente todo endpoint analítico."""

    data_inicio: str | None = None
    data_fim: str | None = None
    natureza: list[str] | None = None
    tema: list[str] | None = None
    destinatario: list[str] | None = None
    rodovia: list[str] | None = None
    contrato: list[str] | None = None
    status: list[str] | None = None
    estagio: list[str] | None = None
    macrogrupo: list[str] | None = None
    busca: str | None = None
    somente_ativos: bool = False

    def is_empty(self) -> bool:
        return not any(
            [
                self.data_inicio,
                self.data_fim,
                self.natureza,
                self.tema,
                self.destinatario,
                self.rodovia,
                self.contrato,
                self.status,
                self.estagio,
                self.macrogrupo,
                self.busca,
                self.somente_ativos,
            ]
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            k: v
            for k, v in {
                "data_inicio": self.data_inicio,
                "data_fim": self.data_fim,
                "natureza": self.natureza,
                "tema": self.tema,
                "destinatario": self.destinatario,
                "rodovia": self.rodovia,
                "contrato": self.contrato,
                "status": self.status,
                "estagio": self.estagio,
                "macrogrupo": self.macrogrupo,
                "busca": self.busca,
                "somente_ativos": self.somente_ativos or None,
            }.items()
            if v
        }


def _build_where(filters: DocumentFilters) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []

    if filters.data_inicio:
        clauses.append("d.data_documento >= ?")
        params.append(filters.data_inicio)
    if filters.data_fim:
        clauses.append("d.data_documento <= ?")
        params.append(filters.data_fim)
    if filters.somente_ativos:
        clauses.append("d.ativo = TRUE")

    for column, values in (
        ("d.natureza", filters.natureza),
        ("d.destinatario", filters.destinatario),
        ("d.status", filters.status),
        ("d.estagio_documental", filters.estagio),
        ("d.macrogrupo_juridico", filters.macrogrupo),
        ("d.contrato", filters.contrato),
    ):
        if values:
            placeholders = ", ".join("?" for _ in values)
            clauses.append(f"{column} IN ({placeholders})")
            params.extend(values)

    # Tema é N:N: filtrar por existência na ponte, não por texto concatenado.
    if filters.tema:
        placeholders = ", ".join("?" for _ in filters.tema)
        clauses.append(
            "EXISTS (SELECT 1 FROM br_documento_tema t "
            f"WHERE t.documento_id = d.documento_id AND t.tema IN ({placeholders}))"
        )
        params.extend(filters.tema)

    if filters.rodovia:
        placeholders = ", ".join("?" for _ in filters.rodovia)
        clauses.append(
            "EXISTS (SELECT 1 FROM br_documento_rodovia r "
            f"WHERE r.documento_id = d.documento_id AND r.rodovia IN ({placeholders}))"
        )
        params.extend(filters.rodovia)

    if filters.busca:
        # Busca sem acento e sem caixa nos campos textuais úteis.
        clauses.append(
            "(strip_accents(lower(coalesce(d.assunto, ''))) LIKE ? "
            "OR strip_accents(lower(coalesce(d.arquivo_nome, ''))) LIKE ? "
            "OR strip_accents(lower(coalesce(d.temas_texto, ''))) LIKE ? "
            "OR strip_accents(lower(coalesce(d.destinatario, ''))) LIKE ? "
            "OR strip_accents(lower(coalesce(d.natureza, ''))) LIKE ? "
            "OR CAST(d.documento_id AS VARCHAR) = ?)"
        )
        needle = f"%{_fold_sql(filters.busca)}%"
        params.extend([needle] * 5)
        params.append(filters.busca.strip())

    where = " AND ".join(clauses) if clauses else "TRUE"
    return where, params


def _fold_sql(text: str) -> str:
    import unicodedata

    norm = unicodedata.normalize("NFKD", text)
    return "".join(c for c in norm if not unicodedata.combining(c)).lower().strip()


class AnalyticsRepository:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection: duckdb.DuckDBPyConnection | None = None

    # -- conexão -----------------------------------------------------------
    def _connect(self) -> duckdb.DuckDBPyConnection:
        if self._connection is None:
            path = self._settings.duckdb_path
            if not path.exists():
                raise ModelNotBuiltError(
                    f"Banco analítico não encontrado em {path}. "
                    "Rode: python -m backend.pipeline.run --full"
                )
            self._connection = duckdb.connect(str(path), read_only=True)
        return self._connection

    def reload(self) -> None:
        """Reabre a conexão — usado depois de um refresh de dados."""
        with _LOCK:
            if self._connection is not None:
                self._connection.close()
                self._connection = None

    def available(self) -> bool:
        return self._settings.duckdb_path.exists()

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict]:
        with _LOCK:
            connection = self._connect()
            cursor = connection.execute(sql, params or [])
            columns = [c[0] for c in cursor.description]
            return [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]

    def query_one(self, sql: str, params: list[Any] | None = None) -> dict | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    # -- meta --------------------------------------------------------------
    def meta(self) -> dict:
        row = self.query_one("SELECT * FROM meta_ciclo LIMIT 1")
        if row is None:  # pragma: no cover
            raise ModelNotBuiltError("meta_ciclo vazio — o pipeline não concluiu.")
        return row

    # -- documentos --------------------------------------------------------
    def count_documents(self, filters: DocumentFilters) -> int:
        where, params = _build_where(filters)
        row = self.query_one(
            f"SELECT count(*) AS total FROM fct_documento d WHERE {where}", params
        )
        return int(row["total"]) if row else 0

    def documents(
        self,
        filters: DocumentFilters,
        limit: int = 50,
        offset: int = 0,
        order_by: str = "data_documento",
        order_dir: str = "desc",
    ) -> list[dict]:
        allowed_order = {
            "data_documento",
            "documento_id",
            "natureza",
            "assunto",
            "destinatario",
            "status",
            "pasta",
            "rodovia_principal",
            "contrato",
        }
        column = order_by if order_by in allowed_order else "data_documento"
        direction = "ASC" if order_dir.lower() == "asc" else "DESC"
        where, params = _build_where(filters)
        return self.query(
            f"""
            SELECT * FROM fct_documento d
            WHERE {where}
            ORDER BY {column} {direction} NULLS LAST, documento_id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        )

    def document(self, documento_id: int) -> dict | None:
        return self.query_one(
            "SELECT * FROM fct_documento WHERE documento_id = ?", [documento_id]
        )

    def document_themes(self, documento_id: int) -> list[dict]:
        return self.query(
            "SELECT tema, ordem, status_taxonomia, proveniencia "
            "FROM br_documento_tema WHERE documento_id = ? ORDER BY ordem",
            [documento_id],
        )

    def document_roads(self, documento_id: int) -> list[dict]:
        return self.query(
            "SELECT rodovia, campo_origem, confianca, proveniencia "
            "FROM br_documento_rodovia WHERE documento_id = ? ORDER BY rodovia",
            [documento_id],
        )

    def related_documents(self, documento_id: int, limit: int = 8) -> list[dict]:
        return self.query(
            """
            WITH alvo AS (SELECT * FROM fct_documento WHERE documento_id = ?)
            SELECT d.documento_id, d.data_documento, d.natureza, d.assunto,
                   d.destinatario, d.status, d.arquivo_extensao,
                   CASE
                     WHEN lower(coalesce(d.assunto,'')) = lower(coalesce(a.assunto,''))
                          AND d.data_documento = a.data_documento THEN 'mesmo documento lógico'
                     WHEN lower(coalesce(d.assunto,'')) = lower(coalesce(a.assunto,''))
                          THEN 'mesmo assunto em outra data'
                     ELSE 'mesmo destinatário e natureza'
                   END AS relacao
            FROM fct_documento d, alvo a
            WHERE d.documento_id <> a.documento_id
              AND (
                lower(coalesce(d.assunto,'')) = lower(coalesce(a.assunto,''))
                OR (d.destinatario = a.destinatario AND d.natureza = a.natureza)
              )
            ORDER BY relacao, d.data_documento DESC
            LIMIT ?
            """,
            [documento_id, limit],
        )

    # -- agregações --------------------------------------------------------
    def group_count(
        self,
        column: str,
        filters: DocumentFilters,
        limit: int | None = None,
    ) -> list[dict]:
        allowed = {
            "natureza",
            "destinatario",
            "status",
            "pasta",
            "estagio_documental",
            "macrogrupo_juridico",
            "contrato",
            "executora",
            "rodovia_principal",
            "arquivo_extensao",
            "mes",
            "ano",
            "trimestre",
            "pessoa_upload",
            "pessoa_modificacao",
        }
        if column not in allowed:
            raise ValueError(f"coluna não permitida em agregação: {column}")
        where, params = _build_where(filters)
        sql = f"""
            SELECT coalesce(CAST(d.{column} AS VARCHAR), '(não informado)') AS chave,
                   count(*) AS documentos,
                   sum(CASE WHEN d.ativo THEN 1 ELSE 0 END) AS ativos
            FROM fct_documento d
            WHERE {where}
            GROUP BY 1
            ORDER BY documentos DESC, chave
        """
        if limit:
            sql += f" LIMIT {int(limit)}"
        return self.query(sql, params)

    def theme_links(self, filters: DocumentFilters, limit: int | None = None) -> list[dict]:
        where, params = _build_where(filters)
        sql = f"""
            SELECT t.tema AS chave,
                   count(*) AS vinculos,
                   count(DISTINCT t.documento_id) AS documentos
            FROM br_documento_tema t
            JOIN fct_documento d ON d.documento_id = t.documento_id
            WHERE {where}
            GROUP BY 1
            ORDER BY vinculos DESC, chave
        """
        if limit:
            sql += f" LIMIT {int(limit)}"
        return self.query(sql, params)

    def road_links(self, filters: DocumentFilters) -> list[dict]:
        where, params = _build_where(filters)
        return self.query(
            f"""
            SELECT r.rodovia AS chave,
                   count(DISTINCT r.documento_id) AS documentos,
                   max(dr.contrato) AS contrato,
                   max(dr.executora) AS executora,
                   count(DISTINCT CASE WHEN r.confianca = 'alta' THEN r.documento_id END)
                       AS documentos_confianca_alta
            FROM br_documento_rodovia r
            JOIN fct_documento d ON d.documento_id = r.documento_id
            LEFT JOIN dim_rodovia dr ON dr.rodovia = r.rodovia
            WHERE {where}
            GROUP BY 1
            ORDER BY documentos DESC, chave
            """,
            params,
        )

    def timeline(self, filters: DocumentFilters, granularidade: str = "mes") -> list[dict]:
        column = {
            "dia": "data_documento",
            "mes": "mes",
            "trimestre": "trimestre",
            "ano": "ano",
        }.get(granularidade, "mes")
        where, params = _build_where(filters)

        # Na granularidade de DIA, documento com precisão apenas mensal fica de
        # fora. O modelo grava `AAAA-MM-01` para ele, e contá-lo no dia 1º o
        # apresentaria com uma data que a fonte não sustenta — em março/2026
        # seriam 8 documentos inventados num único dia. A contagem do mês
        # continua íntegra; só a leitura diária os exclui.
        guarda = " AND d.data_documento_precisao = 'dia'" if granularidade == "dia" else ""

        return self.query(
            f"""
            SELECT CAST(d.{column} AS VARCHAR) AS periodo,
                   count(*) AS documentos,
                   sum(CASE WHEN d.ativo THEN 1 ELSE 0 END) AS ativos,
                   count(DISTINCT d.natureza) AS naturezas,
                   sum(CASE WHEN d.macrogrupo_juridico = 'Sancionatório' THEN 1 ELSE 0 END)
                       AS sancionatorios,
                   sum(CASE WHEN d.data_documento_precisao = 'mes' THEN 1 ELSE 0 END)
                       AS precisao_mensal
            FROM fct_documento d
            WHERE {where} AND d.{column} IS NOT NULL{guarda}
            GROUP BY 1
            ORDER BY 1
            """,
            params,
        )

    def matrix(self, rows_dim: str, cols_dim: str, filters: DocumentFilters) -> list[dict]:
        """Heatmap. Tema exige a ponte; as outras dimensões saem do fato."""
        where, params = _build_where(filters)
        if rows_dim == "tema" and cols_dim in {"natureza", "destinatario", "macrogrupo_juridico"}:
            return self.query(
                f"""
                SELECT t.tema AS linha,
                       coalesce(d.{cols_dim}, '(não informado)') AS coluna,
                       count(DISTINCT d.documento_id) AS documentos
                FROM br_documento_tema t
                JOIN fct_documento d ON d.documento_id = t.documento_id
                WHERE {where}
                GROUP BY 1, 2
                ORDER BY documentos DESC, 1, 2
                """,
                params,
            )
        allowed = {"natureza", "destinatario", "estagio_documental", "macrogrupo_juridico", "pasta"}
        if rows_dim not in allowed or cols_dim not in allowed:
            raise ValueError("combinação de dimensões não suportada na matriz")
        return self.query(
            f"""
            SELECT coalesce(d.{rows_dim}, '(não informado)') AS linha,
                   coalesce(d.{cols_dim}, '(não informado)') AS coluna,
                   count(*) AS documentos
            FROM fct_documento d
            WHERE {where}
            GROUP BY 1, 2
            ORDER BY documentos DESC, 1, 2
            """,
            params,
        )

    # -- repositório e governança ------------------------------------------
    def scans(self) -> list[dict]:
        return self.query("SELECT * FROM fct_varredura ORDER BY data_varredura")

    def folder_coverage(self) -> list[dict]:
        return self.query("SELECT * FROM dim_pasta ORDER BY arquivos_disco DESC, pasta_norm")

    def physical_files(self, situacao: str | None = None, limit: int = 200) -> list[dict]:
        if situacao:
            return self.query(
                "SELECT * FROM fct_arquivo_fisico WHERE situacao_indexacao = ? "
                "ORDER BY mtime_disco DESC LIMIT ?",
                [situacao, limit],
            )
        return self.query(
            "SELECT * FROM fct_arquivo_fisico ORDER BY mtime_disco DESC LIMIT ?", [limit]
        )

    def findings(self, severidade: str | None = None) -> list[dict]:
        order = (
            "CASE severidade WHEN 'high' THEN 0 WHEN 'medium' THEN 1 "
            "WHEN 'low' THEN 2 ELSE 3 END, regra_key, entidade_id"
        )
        if severidade:
            return self.query(
                f"SELECT * FROM fct_dq_finding WHERE severidade = ? ORDER BY {order}",
                [severidade],
            )
        return self.query(f"SELECT * FROM fct_dq_finding ORDER BY {order}")

    def completeness(self) -> list[dict]:
        return self.query(
            """
            SELECT 'Naturezas' AS campo,
                   count(*) AS total,
                   count(natureza) AS preenchidos FROM fct_documento
            UNION ALL SELECT 'Data', count(*), count(data_documento) FROM fct_documento
            UNION ALL SELECT 'Destinatarios', count(*), count(destinatario) FROM fct_documento
            UNION ALL SELECT 'Temas', count(*), count(temas_texto) FROM fct_documento
            UNION ALL SELECT 'Subido por', count(*), count(pessoa_upload) FROM fct_documento
            UNION ALL SELECT 'Modificado por', count(*), count(pessoa_modificacao)
                      FROM fct_documento
            UNION ALL SELECT 'Link', count(*), sum(CASE WHEN link_disponivel THEN 1 ELSE 0 END)
                      FROM fct_documento
            UNION ALL SELECT 'Nome conforme padrão', count(*),
                      sum(CASE WHEN nome_conforme_padrao THEN 1 ELSE 0 END) FROM fct_documento
            ORDER BY 1
            """
        )

    def taxonomy_status(self) -> list[dict]:
        return self.query(
            """
            SELECT 'destinatario' AS dimensao, status_taxonomia, count(*) AS valores,
                   sum(docs_count) AS documentos
            FROM dim_destinatario GROUP BY 1, 2
            UNION ALL
            SELECT 'tema', CASE WHEN em_listas_apoio THEN 'ok'
                                ELSE 'pendente_de_validacao' END,
                   count(*), sum(docs_count)
            FROM dim_tema GROUP BY 1, 2
            UNION ALL
            SELECT 'natureza', CASE WHEN em_listas_apoio THEN 'ok'
                                    ELSE 'pendente_de_validacao' END,
                   count(*), sum(docs_count)
            FROM dim_natureza GROUP BY 1, 2
            ORDER BY 1, 2
            """
        )

    def dimension(self, name: str) -> list[dict]:
        allowed = {
            "natureza": "dim_natureza",
            "tema": "dim_tema",
            "destinatario": "dim_destinatario",
            "pessoa": "dim_pessoa",
            "pasta": "dim_pasta",
            "status": "dim_status",
            "rodovia": "dim_rodovia",
            "contrato": "dim_contrato",
            "executora": "dim_executora",
            "estagio": "dim_estagio",
            "macrogrupo": "dim_macrogrupo",
            "calendario": "dim_calendario",
            "necessidade": "dim_necessidade_resposta",
            "arquivo_fisico": "fct_arquivo_fisico",
        }
        table = allowed.get(name)
        if table is None:
            raise ValueError(f"dimensão desconhecida: {name}")
        return self.query(f"SELECT * FROM {table}")
