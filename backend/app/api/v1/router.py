"""Endpoints v1. Camada HTTP apenas: recebe, delega ao service, devolve.

Nenhuma agregação acontece aqui, e nenhuma acontece no frontend.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from backend.app.core.config import get_business_rules, get_settings
from backend.app.repositories.analytics import (
    AnalyticsRepository,
    DocumentFilters,
    ModelNotBuiltError,
)
from backend.app.schemas.common import (
    Cobertura,
    DocumentoDetalhe,
    Envelope,
    ListaDocumentos,
    MetaSnapshot,
)
from backend.app.services.analytics_service import AnalyticsService

router = APIRouter()

_repository: AnalyticsRepository | None = None


def get_repository() -> AnalyticsRepository:
    global _repository
    if _repository is None:
        _repository = AnalyticsRepository(get_settings())
    return _repository


def get_service(
    repo: Annotated[AnalyticsRepository, Depends(get_repository)],
) -> AnalyticsService:
    return AnalyticsService(repo, get_business_rules())


ServiceDep = Annotated[AnalyticsService, Depends(get_service)]


def filters_dep(
    data_inicio: str | None = Query(None, description="AAAA-MM-DD"),
    data_fim: str | None = Query(None, description="AAAA-MM-DD"),
    natureza: list[str] | None = Query(None),
    tema: list[str] | None = Query(None),
    destinatario: list[str] | None = Query(None),
    rodovia: list[str] | None = Query(None),
    contrato: list[str] | None = Query(None),
    status: list[str] | None = Query(None),
    estagio: list[str] | None = Query(None),
    macrogrupo: list[str] | None = Query(None),
    busca: str | None = Query(None, description="busca textual sem acento e sem caixa"),
    somente_ativos: bool = Query(False),
) -> DocumentFilters:
    return DocumentFilters(
        data_inicio=data_inicio,
        data_fim=data_fim,
        natureza=natureza,
        tema=tema,
        destinatario=destinatario,
        rodovia=rodovia,
        contrato=contrato,
        status=status,
        estagio=estagio,
        macrogrupo=macrogrupo,
        busca=busca,
        somente_ativos=somente_ativos,
    )


FiltersDep = Annotated[DocumentFilters, Depends(filters_dep)]


# --------------------------------------------------------------------- health
@router.get("/health", summary="Liveness e prontidão do modelo")
def health(repo: Annotated[AnalyticsRepository, Depends(get_repository)]) -> dict[str, Any]:
    settings = get_settings()
    ready = repo.available()
    payload: dict[str, Any] = {
        "status": "ok" if ready else "modelo_ausente",
        "modelo_construido": ready,
        "duckdb_path": str(settings.duckdb_path),
    }
    if ready:
        try:
            meta = repo.meta()
            payload["ciclo_id"] = meta["ciclo_id"]
            payload["documentos"] = meta["documentos_indexados"]
        except ModelNotBuiltError:  # pragma: no cover
            payload["status"] = "modelo_incompleto"
    else:
        payload["acao"] = "python -m backend.pipeline.run --full"
    return payload


# ----------------------------------------------------------------------- meta
@router.get("/meta", response_model=Envelope[MetaSnapshot], summary="Estado do ciclo atual")
def meta(service: ServiceDep) -> Envelope[MetaSnapshot]:
    snapshot = service.snapshot_meta()
    return Envelope(
        data=snapshot,
        meta=service.base_meta(
            categoria="DADO EXISTENTE",
            proveniencia="source",
            grao="ciclo",
            nota=(
                "indexed_as_of = até quando a fonte estruturada está atualizada; "
                "physical_scan_as_of = até quando o inventário físico foi observado."
            ),
        ),
    )


@router.get("/meta/rules", summary="Regras de negócio confirmadas em vigor")
def rules() -> dict[str, Any]:
    business = get_business_rules()
    return {
        "versao": business.version,
        "confirmado_em": business.confirmed_at,
        "contratos": business.contracts,
        "regra_rd102": business.raw["rodovias"]["regra_rd102"],
        "destinatarios_confirmados": business.confirmed_recipients,
        "estagios": business.stage_labels,
        "macrogrupos": business.raw["macrogrupos_juridicos"]["valores"],
        "exibir_sem_expansao": business.raw["destinatarios"]["exibir_sem_expansao"],
    }


# ------------------------------------------------------------------- overview
@router.get("/overview", summary="KPIs e cortes da Visao Geral")
def overview(service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    # Import local para evitar ciclo: pages.py importa deste modulo.
    from backend.app.services.pages_service import PagesService

    pages = PagesService(service.repo, get_business_rules())
    total = service.repo.count_documents(filters)
    kpis = service.overview_kpis(filters)
    series = service.timeline(filters, "mes")
    return {
        "data": {
            "kpis": [k.model_dump() for k in kpis],
            "serie_mensal": [p.model_dump() for p in series],
            "naturezas": [c.model_dump() for c in service.counts("natureza", filters, 9)],
            "temas": [c.model_dump() for c in service.counts("tema", filters, 10)],
            "destinatarios": [c.model_dump() for c in service.counts("destinatario", filters, 8)],
            "rodovias": pages.roads(filters),
            "prioridade": pages.response_priority(filters),
            "anos": pages.year_summary(filters),
            "recentes": [
                d.model_dump()
                for d in service.documents(filters, 8, 0, "data_documento", "desc")[0]
            ],
        },
        "meta": service.base_meta(
            filters,
            cobertura=Cobertura.build(total, total),
            nota=(
                "Contagens de tema são VÍNCULOS documento-tema, não documentos. "
                "Rodovia é derivada do texto, com cobertura declarada."
            ),
        ).model_dump(),
    }


# ------------------------------------------------------------------- timeline
@router.get("/timeline", summary="Série temporal da produção jurídica")
def timeline(
    service: ServiceDep,
    filters: FiltersDep,
    granularidade: str = Query("mes", pattern="^(dia|mes|trimestre|ano)$"),
) -> dict[str, Any]:
    series = service.timeline(filters, granularidade)
    total = service.repo.count_documents(filters)
    cobertos = sum(p.documentos for p in series)
    monthly_precision = sum(p.precisao_mensal or 0 for p in series)

    if granularidade == "dia":
        # A série diária exclui, de propósito, quem só tem precisão mensal:
        # contá-lo no dia 1º inventaria uma data. A cobertura declara a lacuna.
        nota = (
            f"Série por dia. {total - cobertos} documento(s) ficam de fora por não terem "
            "dia definido na fonte — a fonte informa apenas o mês, e atribuí-los ao dia 1º "
            "seria inventar data. Eixo = data do DOCUMENTO, nunca data de indexação."
        )
    else:
        nota = (
            f"{monthly_precision} documento(s) têm precisão apenas mensal (dia '00' no "
            "nome). Eixo = data do DOCUMENTO, nunca data de indexação."
        )

    return {
        "data": [p.model_dump() for p in series],
        "meta": service.base_meta(
            filters,
            grao=f"documento por {granularidade}",
            cobertura=Cobertura.build(total, cobertos),
            nota=nota,
        ).model_dump(),
    }


# ----------------------------------------------------------------- dimensões
@router.get("/natures", summary="Documentos por natureza")
def natures(service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    items = service.counts("natureza", filters)
    total = service.repo.count_documents(filters)
    return {
        "data": [i.model_dump() for i in items],
        "dimensao": service.repo.dimension("natureza"),
        "meta": service.base_meta(
            filters, categoria="DADO EXISTENTE", proveniencia="source",
            cobertura=Cobertura.build(total, sum(i.documentos for i in items)),
        ).model_dump(),
    }


@router.get("/themes", summary="Vínculos documento-tema")
def themes(service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    items = service.counts("tema", filters)
    total = service.repo.count_documents(filters)
    return {
        "data": [i.model_dump() for i in items],
        "dimensao": service.repo.dimension("tema"),
        "meta": service.base_meta(
            filters,
            grao="vínculo documento-tema",
            cobertura=Cobertura.build(total, sum(i.documentos for i in items)),
            nota="A soma de vínculos é maior que o número de documentos — é esperado.",
        ).model_dump(),
    }


@router.get("/stakeholders", summary="Documentos por destinatário")
def stakeholders(service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    items = service.counts("destinatario", filters)
    total = service.repo.count_documents(filters)
    generic = [d for d in service.repo.dimension("destinatario") if d.get("generico")]
    return {
        "data": [i.model_dump() for i in items],
        "dimensao": service.repo.dimension("destinatario"),
        "meta": service.base_meta(
            filters,
            categoria="DADO EXISTENTE",
            proveniencia="source",
            cobertura=Cobertura.build(total, sum(i.documentos for i in items)),
            nota=(
                f"{sum(int(d['docs_count']) for d in generic)} documento(s) em buckets "
                "genéricos (sem stakeholder identificável)."
            ),
        ).model_dump(),
    }


@router.get("/roads", summary="Documentos por rodovia (regra RD-102 confirmada)")
def roads(service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    items = service.counts("rodovia", filters)
    total = service.repo.count_documents(filters)
    return {
        "data": [i.model_dump() for i in items],
        "dimensao": service.repo.dimension("rodovia"),
        "meta": service.base_meta(
            filters,
            cobertura=Cobertura.build(total, service._docs_with_road(filters)),
            nota=(
                "Rodovia extraída do texto, campo por campo. 'RD-102' sem 'B' explícito é "
                "RD-102A por regra confirmada. Documentos sem menção NÃO recebem atribuição."
            ),
        ).model_dump(),
    }


@router.get("/contracts", summary="Contratos confirmados e suas executoras")
def contracts(service: ServiceDep, filters: FiltersDep) -> dict[str, Any]:
    items = service.counts("contrato", filters)
    total = service.repo.count_documents(filters)
    return {
        "data": [i.model_dump() for i in items],
        "dimensao": service.repo.dimension("contrato"),
        "executoras": service.repo.dimension("executora"),
        "meta": service.base_meta(
            filters,
            categoria="DADO EXISTENTE",
            proveniencia="confirmed_business_rule",
            cobertura=Cobertura.build(total, sum(i.documentos for i in items)),
            nota="Mapa contrato→rodovia→executora confirmado pela usuária em 10/09/2026.",
        ).model_dump(),
    }


@router.get("/matrix", summary="Matriz de duas dimensões (heatmap)")
def matrix(
    service: ServiceDep,
    filters: FiltersDep,
    linhas: str = Query("tema"),
    colunas: str = Query("natureza"),
) -> dict[str, Any]:
    try:
        rows = service.repo.matrix(linhas, colunas, filters)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    total = service.repo.count_documents(filters)
    return {
        "data": rows,
        "meta": service.base_meta(
            filters, grao=f"{linhas} x {colunas}", cobertura=Cobertura.build(total, total)
        ).model_dump(),
    }


# ------------------------------------------------------------------ documentos
@router.get("/documents", response_model=Envelope[ListaDocumentos], summary="Document Explorer")
def documents(
    service: ServiceDep,
    filters: FiltersDep,
    limite: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ordenar_por: str = Query("data_documento"),
    ordem: str = Query("desc", pattern="^(asc|desc)$"),
) -> Envelope[ListaDocumentos]:
    items, total = service.documents(filters, limite, offset, ordenar_por, ordem)
    return Envelope(
        data=ListaDocumentos(
            itens=items,
            total=total,
            limite=limite,
            offset=offset,
            ordenar_por=ordenar_por,
            ordem=ordem,
        ),
        meta=service.base_meta(
            filters,
            categoria="DADO EXISTENTE",
            proveniencia="source",
            cobertura=Cobertura.build(service.repo.count_documents(DocumentFilters()), total),
        ),
    )


@router.get(
    "/documents/{documento_id}",
    response_model=Envelope[DocumentoDetalhe],
    summary="Detalhe de um documento",
)
def document(service: ServiceDep, documento_id: int) -> Envelope[DocumentoDetalhe]:
    detail = service.document_detail(documento_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"documento {documento_id} não encontrado")
    return Envelope(
        data=detail,
        meta=service.base_meta(
            categoria="DADO EXISTENTE",
            proveniencia="source",
            grao="documento",
            nota="O botão ABRIR DOCUMENTO usa o hyperlink original do SharePoint, literal.",
        ),
    )


@router.get("/documents/export/csv", response_class=PlainTextResponse, summary="Exportar visão")
def export_csv(
    service: ServiceDep,
    filters: FiltersDep,
    limite: int = Query(2000, ge=1, le=20000),
) -> str:
    import csv
    import io

    items, _ = service.documents(filters, limite, 0, "data_documento", "desc")
    buffer = io.StringIO()
    if items:
        writer = csv.DictWriter(
            buffer, fieldnames=list(items[0].model_dump().keys()), delimiter=";"
        )
        writer.writeheader()
        for item in items:
            writer.writerow(item.model_dump())
    return buffer.getvalue()


# ------------------------------------------------------------------ governança
@router.get("/governance", summary="Qualidade do acervo e achados")
def governance(service: ServiceDep) -> dict[str, Any]:
    blocks, findings, resumo = service.governance()
    return {
        "data": {
            "resumo": resumo,
            "blocos": [b.model_dump() for b in blocks],
            "achados": [f.model_dump() for f in findings],
        },
        "meta": service.base_meta(
            grao="achado de qualidade",
            nota=(
                "Limitação conhecida não é erro crítico. Taxonomia divergente pode ser "
                "estado (regra confirmada) ou achado (pendente de validação)."
            ),
        ).model_dump(),
    }


@router.get("/repository-activity", summary="Atividade do indexador (não é atividade jurídica)")
def repository_activity(service: ServiceDep) -> dict[str, Any]:
    return {
        "data": service.repository_activity(),
        "meta": service.base_meta(
            grao="varredura",
            categoria="DADO EXISTENTE",
            proveniencia="source",
            nota=(
                "Atividade de repositório (varredura, indexação) NUNCA se soma à atividade "
                "jurídica (produção de documentos). São eixos diferentes."
            ),
        ).model_dump(),
    }


@router.get("/dimensions/{nome}", summary="Dimensão bruta")
def dimension(service: ServiceDep, nome: str) -> dict[str, Any]:
    try:
        return {
            "data": service.repo.dimension(nome),
            "meta": service.base_meta(grao=nome).model_dump(),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/filters/options", summary="Valores disponíveis para os filtros")
def filter_options(service: ServiceDep) -> dict[str, Any]:
    def keys(rows: list[dict], column: str) -> list[str]:
        return [str(r[column]) for r in rows if r.get(column)]

    return {
        "natureza": keys(service.repo.dimension("natureza"), "natureza"),
        "tema": keys(service.repo.dimension("tema"), "tema"),
        "destinatario": keys(service.repo.dimension("destinatario"), "destinatario"),
        "rodovia": keys(service.repo.dimension("rodovia"), "rodovia"),
        "contrato": keys(service.repo.dimension("contrato"), "contrato"),
        "status": keys(service.repo.dimension("status"), "status"),
        "estagio": [
            {"chave": r["estagio"], "rotulo": r["rotulo"]}
            for r in service.repo.dimension("estagio")
        ],
        "macrogrupo": keys(service.repo.dimension("macrogrupo"), "macrogrupo"),
    }
