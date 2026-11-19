"""Fixtures compartilhadas.

Na versão pública, os testes rodam sobre a fonte FICTÍCIA gerada por
`examples/gerar_fonte_ficticia.py`, em modo somente leitura. Nada aqui escreve na
pasta do Escritório Jurídico — e há um teste dedicado a provar isso.
"""

from __future__ import annotations

import pytest

from backend.app.core.config import PROJECT_ROOT, get_business_rules, get_settings
from backend.pipeline.source_guard import SourceGuard

FONTE_FICTICIA = PROJECT_ROOT / "examples" / "fonte-ficticia"


def pytest_sessionstart(session):
    """Gera a fonte fictícia (examples/fonte-ficticia) e o banco analítico, se faltarem.

    Os .xlsx/.pdf são ignorados pelo Git (.gitignore), então um clone novo não traz a fonte:
    ela é derivada de examples/demandas_ficticias.json. Só gera quando a fonte configurada É a
    fictícia — nunca escreve numa fonte real apontada por PROG_SOURCE_ROOT.
    """
    if get_settings().source_root.resolve() != FONTE_FICTICIA.resolve():
        return
    if not (FONTE_FICTICIA / "00 Indice.xlsx").exists():
        _gerar_fonte_ficticia()
    # Banco analítico derivado da fonte fictícia (data/processed, ignorado pelo Git): sem ele os
    # testes da API seriam pulados num clone novo. Ciclo completo leva poucos segundos.
    if not get_settings().duckdb_path.exists():
        from backend.pipeline.run import run

        if run(full=True) != 0:
            raise RuntimeError("pipeline sobre a fonte fictícia falhou — ver logs/")


def _gerar_fonte_ficticia() -> None:
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "gerar_fonte_ficticia", PROJECT_ROOT / "examples" / "gerar_fonte_ficticia.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.gerar(FONTE_FICTICIA)


@pytest.fixture(scope="session")
def settings():
    return get_settings()


@pytest.fixture(scope="session")
def rules():
    return get_business_rules()


@pytest.fixture(scope="session")
def guard(settings, rules):
    return SourceGuard(settings, rules)


@pytest.fixture(scope="session")
def source_available(settings) -> bool:
    return settings.index_path.exists()


@pytest.fixture(scope="session")
def model_available(settings) -> bool:
    return settings.duckdb_path.exists()


@pytest.fixture(scope="session")
def repository(settings, model_available):
    if not model_available:
        pytest.skip("banco analítico não construído — rode python -m backend.pipeline.run --full")
    from backend.app.repositories.analytics import AnalyticsRepository

    return AnalyticsRepository(settings)


@pytest.fixture(scope="session")
def client(model_available):
    if not model_available:
        pytest.skip("banco analítico não construído")
    from fastapi.testclient import TestClient

    from backend.app.main import app

    with TestClient(app) as test_client:
        yield test_client
