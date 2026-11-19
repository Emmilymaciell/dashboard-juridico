"""Aplicação FastAPI. Roda em localhost; nada sai da máquina.

Sem telemetria, sem serviço externo, sem envio de conteúdo documental.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.v1.pages import router as pages_router
from backend.app.api.v1.router import router as v1_router
from backend.app.core.config import get_settings
from backend.app.repositories.analytics import ModelNotBuiltError

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
logger = logging.getLogger("prog.api")

app = FastAPI(
    title="Dashboard Jurídico — API",
    description=(
        "Legal Intelligence do acervo jurídico do Escritório Jurídico no contexto Programa/Fundo.\n\n"
        "A fonte documental é somente leitura. Esta API lê apenas o banco analítico "
        "construído pelo pipeline, nunca a fonte."
    ),
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(ModelNotBuiltError)
async def model_not_built_handler(_: Request, exc: ModelNotBuiltError) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "erro": {
                "codigo": "MODELO_NAO_CONSTRUIDO",
                "mensagem": str(exc),
                "detalhe": {"acao": "python -m backend.pipeline.run --full"},
            }
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"erro": {"codigo": "PARAMETRO_INVALIDO", "mensagem": str(exc), "detalhe": {}}},
    )


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:  # pragma: no cover
    logger.exception("erro não tratado em %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "erro": {
                "codigo": "ERRO_INTERNO",
                "mensagem": "Falha ao processar a requisição.",
                "detalhe": {"tipo": type(exc).__name__},
            }
        },
    )


app.include_router(v1_router, prefix="/api/v1")
app.include_router(pages_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def root() -> dict[str, Any]:
    return {
        "produto": "Dashboard Jurídico",
        "api": "/api/v1",
        "documentacao": "/docs",
        "health": "/api/v1/health",
    }
