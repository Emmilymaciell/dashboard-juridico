"""Endpoints das páginas do produto: prioridade, portfólio, linha do tempo,
destinatários e rodovias & contratos.

Camada HTTP apenas. A composição vive em `PagesService`.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.app.api.v1.router import FiltersDep, ServiceDep, get_repository
from backend.app.core.config import get_business_rules
from backend.app.repositories.analytics import AnalyticsRepository
from backend.app.schemas.common import Cobertura
from backend.app.services.pages_service import PagesService

router = APIRouter()


def get_pages_service(
    repo: Annotated[AnalyticsRepository, Depends(get_repository)],
) -> PagesService:
    return PagesService(repo, get_business_rules())


PagesDep = Annotated[PagesService, Depends(get_pages_service)]


@router.get("/response-priority", summary="Necessidade de resposta — com a ressalva do dado")
def response_priority(
    pages: PagesDep, service: ServiceDep, filters: FiltersDep
) -> dict[str, Any]:
    data = pages.response_priority(filters)
    categoria = "DADO EXISTENTE" if data["diferencia_registros"] else "NÃO DISPONÍVEL"
    return {
        "data": data,
        "meta": service.base_meta(
            filters,
            categoria=categoria,
            proveniencia="source",
            grao="documento",
            cobertura=Cobertura.build(data["total"], data["total"] - data["sem_classificacao"]),
            nota=data["aviso"]
            or "Níveis conforme a aba LISTAS_APOIO de 00 Indice.xlsx.",
        ).model_dump(),
    }


@router.get("/years", summary="Documentos por ano e participação no recorte")
def years(pages: PagesDep, service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    data = pages.year_summary(filters)
    total = sum(item["documentos"] for item in data)
    return {
        "data": data,
        "meta": service.base_meta(
            filters,
            grao="documento por ano",
            cobertura=Cobertura.build(service.repo.count_documents(filters), total),
            nota=(
                "Participação = fatia do recorte atual. NÃO é crescimento anual: 2026 "
                "ainda está em curso, então comparar os dois anos como taxa seria enganoso."
            ),
        ).model_dump(),
    }


@router.get("/portfolio", summary="Composição do acervo por natureza")
def portfolio(pages: PagesDep, service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    data = pages.portfolio(filters)
    return {
        "data": data,
        "meta": service.base_meta(
            filters,
            categoria="DADO EXISTENTE",
            proveniencia="source",
            cobertura=Cobertura.build(data["total"], data["total"]),
            nota="Contagens de tema são vínculos documento-tema, não documentos.",
        ).model_dump(),
    }


@router.get("/timeline-detail", summary="Linha do tempo com decomposição e picos")
def timeline_detail(pages: PagesDep, service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    data = pages.timeline(filters)
    mensais = sum(int(m["precisao_mensal"] or 0) for m in data["meses"])
    return {
        "data": data,
        "meta": service.base_meta(
            filters,
            grao="documento por mês",
            cobertura=Cobertura.build(
                data["total"], sum(int(m["documentos"]) for m in data["meses"])
            ),
            nota=(
                f"Eixo = data do DOCUMENTO, nunca de indexação. {mensais} documento(s) têm "
                "precisão apenas mensal, por isso não oferecemos série diária."
            ),
        ).model_dump(),
    }


@router.get("/stakeholders-detail", summary="Destinatários com naturezas e temas")
def stakeholders_detail(
    pages: PagesDep, service: ServiceDep, filters: FiltersDep
) -> dict[str, Any]:
    data = pages.stakeholders(filters)
    genericos = sum(int(d["documentos"]) for d in data["destinatarios"] if d["generico"])
    return {
        "data": data,
        "meta": service.base_meta(
            filters,
            categoria="DADO EXISTENTE",
            proveniencia="source",
            cobertura=Cobertura.build(data["total"], data["total"] - genericos),
            nota=(
                f"{genericos} documento(s) estão em destinatários genéricos "
                "(Empreiteiras, Executoras, Outros) e não identificam uma parte específica."
            ),
        ).model_dump(),
    }


@router.get("/roads-detail", summary="Rodovias & contratos com o recorte de cada rodovia")
def roads_detail(pages: PagesDep, service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    data = pages.road_detail(filters)
    com_rodovia = data["total"] - data["geral"]["documentos"]
    return {
        "data": data,
        "meta": service.base_meta(
            filters,
            categoria="DADO EXISTENTE",
            proveniencia="confirmed_business_rule",
            cobertura=Cobertura.build(data["total"], com_rodovia),
            nota=(
                "Mapa contrato→rodovia→executora confirmado pela usuária. A rodovia de cada "
                "documento é extraída do texto, campo por campo; 'RD-102' sem 'B' explícito "
                "é RD-102A por regra confirmada."
            ),
        ).model_dump(),
    }
