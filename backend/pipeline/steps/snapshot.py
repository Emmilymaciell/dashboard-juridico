"""Etapa 1 — snapshot consistente do ciclo (DEC-020).

A fonte é viva: em 10/09/2026 o acervo passou por 215 -> 259 -> 291 -> 324 documentos
em uma tarde. Ler a fonte em pontos diferentes do processamento produziria números de
momentos diferentes na mesma tela.

Por isso todo processamento acontece dentro de um CICLO identificado, sobre um snapshot
imutável capturado no início. Se a fonte mudar durante o ciclo, o ciclo termina com o
que capturou; a próxima execução pega o estado novo.
"""

from __future__ import annotations

import datetime as dt
import json
import shutil
from dataclasses import dataclass
from pathlib import Path

from backend.app.core.config import BusinessRules, Settings
from backend.pipeline.source_guard import SourceGuard, SourceInventory

MANIFEST_NAME = "manifest.json"


def new_cycle_id(moment: dt.datetime | None = None) -> str:
    return (moment or dt.datetime.now()).strftime("%Y-%m-%dT%H-%M-%S")


@dataclass
class Snapshot:
    """Um estado consistente da fonte, com identidade verificável."""

    cycle_id: str
    captured_at: dt.datetime
    directory: Path
    index_copy: Path
    index_fingerprint: dict
    inventory: SourceInventory
    inventory_digest: str
    source_root: str
    business_rules_version: int

    @property
    def physical_scan_as_of(self) -> dt.datetime:
        """Até quando o inventário físico foi observado (DEC-021)."""
        return self.captured_at

    def manifest(self) -> dict:
        return {
            "ciclo_id": self.cycle_id,
            "captured_at": self.captured_at.isoformat(timespec="seconds"),
            "physical_scan_as_of": self.physical_scan_as_of.isoformat(timespec="seconds"),
            "source_root": self.source_root,
            "indice": self.index_fingerprint,
            "inventario": {
                "digest_sha256": self.inventory_digest,
                "total_acervo": self.inventory.total_acervo,
                "total_controle": len(self.inventory.control_files),
                "office_junk_ignorado": len(self.inventory.office_junk),
                "pastas_vazias": self.inventory.empty_folders,
                "por_pasta": _count_by_folder(self.inventory),
                "por_extensao": _count_by_extension(self.inventory),
            },
            "regras_negocio_versao": self.business_rules_version,
            "somente_leitura": True,
            "_nota": (
                "Snapshot imutável do ciclo. Nenhuma etapa posterior reabre a fonte: "
                "todas trabalham sobre esta cópia (DEC-020)."
            ),
        }


def _count_by_folder(inventory: SourceInventory) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in inventory.acervo:
        counts[item.folder] = counts.get(item.folder, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[0].lower()))


def _count_by_extension(inventory: SourceInventory) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in inventory.acervo:
        counts[item.extension] = counts.get(item.extension, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: -kv[1]))


def capture(
    settings: Settings,
    rules: BusinessRules,
    cycle_id: str | None = None,
    keep_last: int = 12,
) -> Snapshot:
    """Captura o estado atual da fonte. Ordem importa: primeiro o índice, depois a árvore.

    O índice é copiado antes da varredura para que a cópia seja de um instante anterior
    ou igual ao inventário — nunca posterior. Se o robô gravar o índice no meio, o
    fingerprint gravado no manifest é o do arquivo que efetivamente copiamos.
    """
    guard = SourceGuard(settings, rules)
    settings.ensure_derived_dirs()

    cid = cycle_id or new_cycle_id()
    directory = guard.assert_write_target_outside_source(settings.data_raw / cid)
    directory.mkdir(parents=True, exist_ok=True)

    fingerprint = guard.index_fingerprint()
    index_copy = guard.copy_index_to(directory / f"00_Indice_{cid}.xlsx")
    inventory = guard.scan_inventory()

    snapshot = Snapshot(
        cycle_id=cid,
        captured_at=inventory.captured_at,
        directory=directory,
        index_copy=index_copy,
        index_fingerprint=fingerprint,
        inventory=inventory,
        inventory_digest=inventory.digest(),
        source_root=str(guard.root),
        business_rules_version=rules.version,
    )

    (directory / MANIFEST_NAME).write_text(
        json.dumps(snapshot.manifest(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (directory / f"filesystem_{cid}.json").write_text(
        json.dumps(
            {
                "captured_at": inventory.captured_at.isoformat(timespec="seconds"),
                "acervo": [f.as_dict() for f in inventory.acervo],
                "controle": [f.as_dict() for f in inventory.control_files],
                "pastas_vazias": inventory.empty_folders,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    # Cópia das regras aplicadas: sem isso não é possível reproduzir o ciclo depois.
    shutil.copy2(
        settings.project_root / "config" / "regras_negocio.json",
        directory / f"regras_negocio_{cid}.json",
    )

    _prune(settings.data_raw, keep_last)
    return snapshot


def load(settings: Settings, cycle_id: str) -> Snapshot | None:
    """Recarrega um snapshot já capturado (para reprocessar sem tocar a fonte)."""
    directory = settings.data_raw / cycle_id
    manifest_path = directory / MANIFEST_NAME
    if not manifest_path.exists():
        return None
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    index_copy = next(directory.glob("00_Indice_*.xlsx"), None)
    if index_copy is None:  # pragma: no cover
        return None
    inventory = SourceInventory(
        captured_at=dt.datetime.fromisoformat(manifest["captured_at"]),
        source_root=manifest["source_root"],
    )
    return Snapshot(
        cycle_id=manifest["ciclo_id"],
        captured_at=inventory.captured_at,
        directory=directory,
        index_copy=index_copy,
        index_fingerprint=manifest["indice"],
        inventory=inventory,
        inventory_digest=manifest["inventario"]["digest_sha256"],
        source_root=manifest["source_root"],
        business_rules_version=manifest.get("regras_negocio_versao", 0),
    )


def latest_cycle_id(settings: Settings) -> str | None:
    candidates = sorted(
        (p.name for p in settings.data_raw.glob("*") if (p / MANIFEST_NAME).exists()),
        reverse=True,
    )
    return candidates[0] if candidates else None


def _prune(root: Path, keep_last: int) -> None:
    """Mantém os últimos N snapshots. Dado derivado é descartável (DEC-013)."""
    if keep_last <= 0:
        return
    cycles = sorted((p for p in root.glob("*") if (p / MANIFEST_NAME).exists()), reverse=True)
    for stale in cycles[keep_last:]:
        shutil.rmtree(stale, ignore_errors=True)
