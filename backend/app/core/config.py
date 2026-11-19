"""Configuração centralizada. Única fonte de verdade para caminhos e parâmetros.

Precedência: variável de ambiente > config/config.json > config/config.example.json.
O caminho da fonte NUNCA é hardcoded em código de aplicação.

As regras de negócio vêm de config/regras_negocio.json — arquivo versionado e
auditável, autoridade operacional do domínio (DEC-017). Nada de regra de domínio
espalhada por funções.
"""

from __future__ import annotations

import functools
import json
import os
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONFIG_DIR = PROJECT_ROOT / "config"
BUSINESS_RULES_PATH = CONFIG_DIR / "regras_negocio.json"


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_dotenv() -> None:
    """Carrega .env sem dependência externa. Não sobrescreve o ambiente real."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


class Settings:
    """Configuração resolvida uma única vez por processo."""

    def __init__(self) -> None:
        _load_dotenv()

        raw: dict[str, Any] = {}
        for name in ("config.json", "config.example.json"):
            candidate = CONFIG_DIR / name
            if candidate.exists():
                raw = _load_json(candidate)
                self.config_file = candidate
                break
        else:  # pragma: no cover
            raise FileNotFoundError(f"Nenhum config encontrado em {CONFIG_DIR}")

        source = raw.get("source", {})
        derived = raw.get("derived", {})

        root = os.environ.get("PROG_SOURCE_ROOT") or source.get("root") or ""
        if not root:
            raise ValueError(
                "Caminho da fonte não configurado. Defina PROG_SOURCE_ROOT no .env "
                "ou source.root em config/config.json."
            )

        # Caminho relativo (ex.: a fonte fictícia em examples/) resolve a partir da raiz.
        self.source_root = self._resolve(Path(root).expanduser())
        self.index_filename = os.environ.get(
            "PROG_INDEX_FILENAME", source.get("index_filename", "00 Indice.xlsx")
        )
        self.index_sheets: dict[str, str] = source.get(
            "index_sheets",
            {
                "indice": "ÍNDICE",
                "listas_apoio": "LISTAS_APOIO",
                "nomenclatura": "NOMENCLATURA",
                "log_atualizacao": "LOG_ATUALIZACAO",
            },
        )

        self.project_root = PROJECT_ROOT
        self.data_raw = self._resolve(
            os.environ.get("PROG_DATA_RAW", derived.get("raw", "data/raw"))
        )
        self.data_processed = self._resolve(
            os.environ.get("PROG_DATA_PROCESSED", derived.get("processed", "data/processed"))
        )
        self.data_cache = self._resolve(
            os.environ.get("PROG_DATA_CACHE", derived.get("cache", "data/cache"))
        )
        self.duckdb_path = self._resolve(
            os.environ.get(
                "PROG_DUCKDB_PATH", derived.get("duckdb_path", "data/processed/prog.duckdb")
            )
        )
        self.state_dir = self._resolve("state")
        self.logs_dir = self._resolve("logs")

        self.api_host = os.environ.get("PROG_API_HOST", "127.0.0.1")
        self.api_port = int(os.environ.get("PROG_API_PORT", "8000"))
        self.log_level = os.environ.get("PROG_LOG_LEVEL", "INFO").upper()
        self.cors_origins = [
            o.strip()
            for o in os.environ.get(
                "PROG_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if o.strip()
        ]

    def _resolve(self, value: str | Path) -> Path:
        path = Path(value)
        return path if path.is_absolute() else (PROJECT_ROOT / path)

    @property
    def index_path(self) -> Path:
        return self.source_root / self.index_filename

    def ensure_derived_dirs(self) -> None:
        for path in (self.data_raw, self.data_processed, self.data_cache,
                     self.state_dir, self.logs_dir):
            path.mkdir(parents=True, exist_ok=True)


class BusinessRules:
    """Acesso tipado às regras de negócio confirmadas (config/regras_negocio.json)."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self.raw = raw
        self.version: int = raw.get("_meta", {}).get("versao", 0)
        self.confirmed_at: str | None = raw.get("_meta", {}).get("confirmado_em")

    # -- contratos ---------------------------------------------------------
    @property
    def contracts(self) -> list[dict[str, Any]]:
        return list(self.raw.get("contratos", {}).get("itens", []))

    @property
    def contracts_unmapped(self) -> list[dict[str, Any]]:
        return list(self.raw.get("contratos", {}).get("nao_mapeados", []))

    # -- rodovias ----------------------------------------------------------
    @property
    def road_regex(self) -> str:
        return self.raw["rodovias"]["normalizacao"]["regex"]

    @property
    def road_fields(self) -> list[str]:
        return list(self.raw["rodovias"]["normalizacao"]["campos_origem"])

    @property
    def road_confidence_by_field(self) -> dict[str, str]:
        return dict(self.raw["rodovias"]["normalizacao"]["confianca_por_campo"])

    @property
    def roads_canonical(self) -> list[str]:
        block = self.raw["rodovias"]
        return list(block["canonicas_com_contrato"]) + list(block["canonicas_sem_contrato"])

    @property
    def roads_false_positives(self) -> list[str]:
        return list(self.raw["rodovias"]["falsos_positivos_conhecidos"])

    # -- destinatários / taxonomia ----------------------------------------
    @property
    def confirmed_recipients(self) -> list[str]:
        return [
            item["valor"]
            for item in self.raw.get("destinatarios", {}).get(
                "validos_confirmados_fora_da_planilha", []
            )
        ]

    @property
    def generic_buckets(self) -> list[str]:
        return list(self.raw.get("destinatarios", {}).get("buckets_genericos", []))

    # -- estágio documental ------------------------------------------------
    @property
    def stage_by_nature(self) -> dict[str, str]:
        return dict(self.raw.get("estagio_documental", {}).get("por_natureza", {}))

    @property
    def stage_name_markers(self) -> list[str]:
        return list(
            self.raw.get("estagio_documental", {}).get("marcadores_no_nome_em_elaboracao", [])
        )

    @property
    def stage_labels(self) -> dict[str, str]:
        return {
            item["chave"]: item["rotulo"]
            for item in self.raw.get("estagio_documental", {}).get("valores", [])
        }

    # -- macrogrupo --------------------------------------------------------
    @property
    def macro_by_nature(self) -> dict[str, dict[str, Any]]:
        return dict(self.raw.get("macrogrupos_juridicos", {}).get("por_natureza", {}))

    @property
    def natures_without_matter(self) -> list[str]:
        return list(self.raw.get("macrogrupos_juridicos", {}).get("naturezas_sem_materia", []))

    @property
    def macro_by_theme(self) -> dict[str, dict[str, Any]]:
        block = dict(self.raw.get("macrogrupos_juridicos", {}).get("por_tema", {}))
        return {k: v for k, v in block.items() if not k.startswith("_")}

    @property
    def themes_without_signal(self) -> list[str]:
        return list(self.raw.get("macrogrupos_juridicos", {}).get("temas_sem_sinal", []))

    @property
    def macro_default(self) -> dict[str, Any]:
        return dict(
            self.raw.get("macrogrupos_juridicos", {}).get(
                "default", {"macrogrupo": "Não classificado", "status": "revisar"}
            )
        )

    # -- arquivos de controle ---------------------------------------------
    @property
    def control_file_patterns(self) -> list[str]:
        return list(self.raw.get("arquivos_controle_repositorio", {}).get("padroes", []))

    @property
    def control_files_root_only(self) -> bool:
        return bool(
            self.raw.get("arquivos_controle_repositorio", {}).get("somente_na_raiz", True)
        )

    # -- reconciliação -----------------------------------------------------
    @property
    def reconciliation_labels(self) -> dict[str, str]:
        return dict(self.raw.get("reconciliacao", {}).get("rotulos_ui", {}))


@functools.lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


@functools.lru_cache(maxsize=1)
def get_business_rules() -> BusinessRules:
    if not BUSINESS_RULES_PATH.exists():  # pragma: no cover
        raise FileNotFoundError(f"Regras de negócio não encontradas: {BUSINESS_RULES_PATH}")
    return BusinessRules(_load_json(BUSINESS_RULES_PATH))
