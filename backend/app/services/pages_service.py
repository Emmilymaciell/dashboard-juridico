"""Composição dos payloads de cada página do produto.

Separado de `AnalyticsService` de propósito: aqui vive o que é específico de uma
tela (Portfólio, Linha do Tempo, Destinatários, Rodovias & Contratos), enquanto
o service principal cuida das agregações e KPIs compartilhados.

Regra que atravessa todo este módulo: **nada de fabricar leitura que o dado não
sustenta.** Onde o preenchimento da fonte não diferencia os registros, o payload
diz isso em vez de inventar uma análise.
"""

from __future__ import annotations

from typing import Any

from backend.app.core.config import BusinessRules
from backend.app.repositories.analytics import (
    AnalyticsRepository,
    DocumentFilters,
    _build_where,
)

SEM_NATUREZA = "(sem natureza)"
SEM_DESTINATARIO = "(sem destinatário)"

# Rótulo do bucket de documentos sem rodovia identificável. A formulação é
# deliberada: não chamamos de "Geral" puro, porque não sabemos distinguir o
# documento deliberadamente geral do documento sem referência identificada.
ROTULO_GERAL = "Geral / não vinculado a rodovia"


class PagesService:
    def __init__(self, repo: AnalyticsRepository, rules: BusinessRules) -> None:
        self.repo = repo
        self.rules = rules

    # ------------------------------------------------------------------ util
    def _where(self, filters: DocumentFilters) -> tuple[str, list[Any]]:
        return _build_where(filters)

    def _docs_with_road(self, filters: DocumentFilters) -> int:
        where, params = self._where(filters)
        rows = self.repo.query(
            "SELECT count(DISTINCT r.documento_id) AS total FROM br_documento_rodovia r "
            f"JOIN fct_documento d ON d.documento_id = r.documento_id WHERE {where}",
            params,
        )
        return int(rows[0]["total"]) if rows else 0

    # ------------------------------------------------- prioridade de resposta
    def response_priority(self, filters: DocumentFilters) -> dict[str, Any]:
        """Distribuição por necessidade de resposta — com honestidade sobre o dado.

        A escala vem da aba `LISTAS_APOIO` (dado da fonte). O uso real vem do
        índice. Quando o preenchimento não diferencia os documentos, o payload
        devolve `diferencia_registros = false` e um aviso: a tela mostra a escala
        prevista e diz que ela ainda não discrimina, em vez de simular urgência.
        """
        where, params = self._where(filters)
        observado = self.repo.query(
            f"""
            SELECT d.necessidade_resposta AS nivel, count(*) AS documentos
            FROM fct_documento d
            WHERE {where}
            GROUP BY 1
            """,
            params,
        )
        total = sum(int(r["documentos"]) for r in observado) or 1
        por_nivel = {r["nivel"]: int(r["documentos"]) for r in observado}
        sem_classificacao = por_nivel.pop(None, 0)

        escala = self.repo.dimension("necessidade")
        niveis: list[dict[str, Any]] = []
        for item in sorted(escala, key=lambda x: int(x["nivel"])):
            nivel = int(item["nivel"])
            qtd = por_nivel.get(nivel, 0)
            niveis.append(
                {
                    "nivel": nivel,
                    "rotulo": item["rotulo"],
                    "rotulo_completo": item["rotulo_completo"],
                    "documentos": qtd,
                    "percentual": round(100 * qtd / total, 1),
                    "previsto_nao_utilizado": qtd == 0,
                }
            )

        em_uso = [n for n in niveis if n["documentos"] > 0]
        diferencia = len(em_uso) > 1

        # Enquanto o campo não diferencia, o que dá leitura de atenção é a matéria
        # jurídica — e isso é dado real, não substituto inventado.
        atencao = self.repo.query(
            f"""
            SELECT coalesce(d.natureza, '{SEM_NATUREZA}') AS chave,
                   count(*) AS documentos
            FROM fct_documento d
            WHERE {where} AND d.macrogrupo_juridico IN ('Sancionatório', 'Contratual')
            GROUP BY 1 ORDER BY documentos DESC, 1 LIMIT 6
            """,
            params,
        )
        return {
            "niveis": niveis,
            "sem_classificacao": sem_classificacao,
            "total": total,
            "niveis_previstos": len(niveis),
            "niveis_em_uso": len(em_uso),
            "diferencia_registros": diferencia,
            "aviso": None
            if diferencia
            else (
                "A escala de necessidade de resposta está prevista na LISTAS_APOIO com "
                f"{len(niveis)} níveis, mas o acervo inteiro está preenchido em um único "
                "nível. Portanto o campo ainda não diferencia os documentos, e nenhum "
                "indicador de urgência é construído sobre ele. O bloco passa a ter leitura "
                "analítica no momento em que o preenchimento na origem variar."
            ),
            "materias_de_atencao": atencao,
        }

    # ----------------------------------------------------------------- anos
    def year_summary(self, filters: DocumentFilters) -> list[dict[str, Any]]:
        """Documentos por ano e participação no recorte. NÃO é crescimento anual."""
        where, params = self._where(filters)
        rows = self.repo.query(
            f"""
            SELECT CAST(d.ano AS INTEGER) AS ano, count(*) AS documentos
            FROM fct_documento d
            WHERE {where} AND d.ano IS NOT NULL
            GROUP BY 1 ORDER BY 1
            """,
            params,
        )
        total = sum(int(r["documentos"]) for r in rows) or 1
        return [
            {
                "ano": int(r["ano"]),
                "documentos": int(r["documentos"]),
                "participacao": round(100 * int(r["documentos"]) / total, 1),
            }
            for r in rows
        ]

    # ------------------------------------------------------------- rodovias
    def roads(self, filters: DocumentFilters) -> dict[str, Any]:
        """Rodovias + o bucket honesto dos documentos sem vínculo identificável."""
        where, params = self._where(filters)
        rows = self.repo.query(
            f"""
            SELECT r.rodovia AS chave,
                   count(DISTINCT r.documento_id) AS documentos,
                   count(DISTINCT CASE WHEN r.confianca = 'alta' THEN r.documento_id END)
                       AS documentos_confianca_alta,
                   max(dr.contrato) AS contrato,
                   max(dr.executora) AS executora
            FROM br_documento_rodovia r
            JOIN fct_documento d ON d.documento_id = r.documento_id
            LEFT JOIN dim_rodovia dr ON dr.rodovia = r.rodovia
            WHERE {where}
            GROUP BY 1 ORDER BY documentos DESC, 1
            """,
            params,
        )
        total = self.repo.count_documents(filters)
        com_rodovia = self._docs_with_road(filters)
        return {
            "rodovias": rows,
            "geral": {
                "chave": ROTULO_GERAL,
                "documentos": max(0, total - com_rodovia),
                "nota": (
                    "Documentos sem rodovia identificável no destinatário, no assunto ou no "
                    "nome do arquivo. Boa parte são peças de alcance geral do programa — "
                    "regulamentos, checklists de conformidade, consultas e minutas-modelo — "
                    "mas a distinção entre 'geral por natureza' e 'sem referência "
                    "identificada' não é feita automaticamente."
                ),
            },
            "total": total,
        }

    def road_detail(self, filters: DocumentFilters) -> dict[str, Any]:
        """Cada rodovia com o seu recorte completo, para a página dedicada."""
        where, params = self._where(filters)
        base = self.repo.query(
            f"""
            SELECT r.rodovia,
                   count(DISTINCT r.documento_id) AS documentos,
                   count(DISTINCT CASE WHEN r.confianca = 'alta' THEN r.documento_id END)
                       AS documentos_confianca_alta,
                   max(dr.contrato) AS contrato,
                   max(dr.executora) AS executora,
                   CAST(min(d.data_documento) AS VARCHAR) AS primeiro,
                   CAST(max(d.data_documento) AS VARCHAR) AS ultimo
            FROM br_documento_rodovia r
            JOIN fct_documento d ON d.documento_id = r.documento_id
            LEFT JOIN dim_rodovia dr ON dr.rodovia = r.rodovia
            WHERE {where}
            GROUP BY 1 ORDER BY documentos DESC, 1
            """,
            params,
        )
        for row in base:
            rodovia = row["rodovia"]
            extra = [*params, rodovia]
            row["naturezas"] = self.repo.query(
                f"""
                SELECT coalesce(d.natureza, '{SEM_NATUREZA}') AS chave, count(*) AS documentos
                FROM fct_documento d
                JOIN br_documento_rodovia r ON r.documento_id = d.documento_id
                WHERE {where} AND r.rodovia = ?
                GROUP BY 1 ORDER BY documentos DESC, 1 LIMIT 5
                """,
                extra,
            )
            row["temas"] = self.repo.query(
                f"""
                SELECT t.tema AS chave, count(*) AS documentos
                FROM br_documento_tema t
                JOIN fct_documento d ON d.documento_id = t.documento_id
                JOIN br_documento_rodovia r ON r.documento_id = d.documento_id
                WHERE {where} AND r.rodovia = ?
                GROUP BY 1 ORDER BY documentos DESC, 1 LIMIT 5
                """,
                extra,
            )
            row["recentes"] = self.repo.query(
                f"""
                SELECT d.documento_id, CAST(d.data_documento AS VARCHAR) AS data_documento,
                       d.natureza, d.assunto, d.destinatario
                FROM fct_documento d
                JOIN br_documento_rodovia r ON r.documento_id = d.documento_id
                WHERE {where} AND r.rodovia = ?
                ORDER BY d.data_documento DESC NULLS LAST LIMIT 4
                """,
                extra,
            )
            sancao = self.repo.query(
                f"""
                SELECT count(DISTINCT d.documento_id) AS total FROM fct_documento d
                JOIN br_documento_rodovia r ON r.documento_id = d.documento_id
                WHERE {where} AND r.rodovia = ? AND d.macrogrupo_juridico = 'Sancionatório'
                """,
                extra,
            )
            row["sancionatorios"] = int(sancao[0]["total"]) if sancao else 0
            row["serie"] = self.repo.query(
                f"""
                SELECT CAST(d.mes AS VARCHAR) AS periodo,
                       count(DISTINCT d.documento_id) AS documentos
                FROM fct_documento d
                JOIN br_documento_rodovia r ON r.documento_id = d.documento_id
                WHERE {where} AND r.rodovia = ? AND d.mes IS NOT NULL
                GROUP BY 1 ORDER BY 1
                """,
                extra,
            )
        total = self.repo.count_documents(filters)
        return {
            "rodovias": base,
            "contratos": self.repo.dimension("contrato"),
            "geral": {
                "chave": ROTULO_GERAL,
                "documentos": max(0, total - self._docs_with_road(filters)),
            },
            "total": total,
        }

    # ------------------------------------------------------------ portfólio
    def portfolio(self, filters: DocumentFilters) -> dict[str, Any]:
        """Composição do acervo por natureza, cada uma com o seu recorte."""
        where, params = self._where(filters)
        naturezas = self.repo.query(
            f"""
            SELECT coalesce(d.natureza, '{SEM_NATUREZA}') AS natureza,
                   count(*) AS documentos,
                   sum(CASE WHEN d.ativo THEN 1 ELSE 0 END) AS ativos,
                   CAST(min(d.data_documento) AS VARCHAR) AS primeiro,
                   CAST(max(d.data_documento) AS VARCHAR) AS ultimo,
                   max(d.macrogrupo_juridico) AS macrogrupo,
                   count(DISTINCT d.destinatario) AS destinatarios
            FROM fct_documento d
            WHERE {where}
            GROUP BY 1 ORDER BY documentos DESC, 1
            """,
            params,
        )
        total = sum(int(n["documentos"]) for n in naturezas) or 1
        for n in naturezas:
            n["participacao"] = round(100 * int(n["documentos"]) / total, 1)
            extra = [*params, n["natureza"]]
            n["temas"] = self.repo.query(
                f"""
                SELECT t.tema AS chave, count(*) AS documentos
                FROM br_documento_tema t
                JOIN fct_documento d ON d.documento_id = t.documento_id
                WHERE {where} AND coalesce(d.natureza, '{SEM_NATUREZA}') = ?
                GROUP BY 1 ORDER BY documentos DESC, 1 LIMIT 3
                """,
                extra,
            )
            n["serie"] = self.repo.query(
                f"""
                SELECT CAST(d.mes AS VARCHAR) AS periodo, count(*) AS documentos
                FROM fct_documento d
                WHERE {where} AND d.mes IS NOT NULL
                  AND coalesce(d.natureza, '{SEM_NATUREZA}') = ?
                GROUP BY 1 ORDER BY 1
                """,
                extra,
            )
        return {
            "naturezas": naturezas,
            "macrogrupos": [
                {"chave": str(m["chave"]), "documentos": int(m["documentos"])}
                for m in self.repo.group_count("macrogrupo_juridico", filters)
            ],
            "temas": self.repo.theme_links(filters),
            "total": total,
        }

    # --------------------------------------------------------- destinatários
    def stakeholders(self, filters: DocumentFilters) -> dict[str, Any]:
        where, params = self._where(filters)
        base = self.repo.query(
            f"""
            SELECT coalesce(d.destinatario, '{SEM_DESTINATARIO}') AS destinatario,
                   count(*) AS documentos,
                   count(DISTINCT d.natureza) AS naturezas,
                   CAST(min(d.data_documento) AS VARCHAR) AS primeiro,
                   CAST(max(d.data_documento) AS VARCHAR) AS ultimo
            FROM fct_documento d
            WHERE {where}
            GROUP BY 1 ORDER BY documentos DESC, 1
            """,
            params,
        )
        genericos = {
            d["destinatario"] for d in self.repo.dimension("destinatario") if d.get("generico")
        }
        total = sum(int(b["documentos"]) for b in base) or 1
        for b in base:
            b["participacao"] = round(100 * int(b["documentos"]) / total, 1)
            b["generico"] = b["destinatario"] in genericos
            extra = [*params, b["destinatario"]]
            b["naturezas_top"] = self.repo.query(
                f"""
                SELECT coalesce(d.natureza, '{SEM_NATUREZA}') AS chave, count(*) AS documentos
                FROM fct_documento d
                WHERE {where} AND coalesce(d.destinatario, '{SEM_DESTINATARIO}') = ?
                GROUP BY 1 ORDER BY documentos DESC, 1 LIMIT 4
                """,
                extra,
            )
            b["temas_top"] = self.repo.query(
                f"""
                SELECT t.tema AS chave, count(*) AS documentos
                FROM br_documento_tema t
                JOIN fct_documento d ON d.documento_id = t.documento_id
                WHERE {where} AND coalesce(d.destinatario, '{SEM_DESTINATARIO}') = ?
                GROUP BY 1 ORDER BY documentos DESC, 1 LIMIT 4
                """,
                extra,
            )
        return {
            "destinatarios": base,
            "total": total,
            "matriz": self.repo.matrix("destinatario", "macrogrupo_juridico", filters),
        }

    # ------------------------------------------------------ linha do tempo
    def timeline(self, filters: DocumentFilters) -> dict[str, Any]:
        """Série mensal + decomposição por ano, natureza e macrogrupo."""
        where, params = self._where(filters)
        meses = self.repo.query(
            f"""
            SELECT CAST(d.mes AS VARCHAR) AS periodo,
                   count(*) AS documentos,
                   sum(CASE WHEN d.macrogrupo_juridico = 'Sancionatório' THEN 1 ELSE 0 END)
                       AS sancionatorios,
                   count(DISTINCT d.natureza) AS naturezas,
                   count(DISTINCT d.destinatario) AS destinatarios,
                   sum(CASE WHEN d.data_documento_precisao = 'mes' THEN 1 ELSE 0 END)
                       AS precisao_mensal
            FROM fct_documento d
            WHERE {where} AND d.mes IS NOT NULL
            GROUP BY 1 ORDER BY 1
            """,
            params,
        )
        por_natureza_mes = self.repo.query(
            f"""
            SELECT CAST(d.mes AS VARCHAR) AS periodo,
                   coalesce(d.natureza, '{SEM_NATUREZA}') AS natureza,
                   count(*) AS documentos
            FROM fct_documento d
            WHERE {where} AND d.mes IS NOT NULL
            GROUP BY 1, 2
            """,
            params,
        )
        picos = sorted(meses, key=lambda m: -int(m["documentos"]))[:3]
        for pico in picos:
            pico["destaques"] = self.repo.query(
                f"""
                SELECT d.documento_id, d.assunto, d.natureza, d.destinatario,
                       CAST(d.data_documento AS VARCHAR) AS data_documento
                FROM fct_documento d
                WHERE {where} AND CAST(d.mes AS VARCHAR) = ?
                ORDER BY d.data_documento DESC NULLS LAST LIMIT 3
                """,
                [*params, pico["periodo"]],
            )
        return {
            "meses": meses,
            "anos": self.year_summary(filters),
            "por_natureza_mes": por_natureza_mes,
            "picos": picos,
            "total": self.repo.count_documents(filters),
        }
