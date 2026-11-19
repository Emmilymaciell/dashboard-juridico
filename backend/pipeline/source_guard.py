"""source_guard — a única porta de acesso à fonte documental do Escritório Jurídico.

REGRA ABSOLUTA (CLAUDE.md §3, DEC-002): a fonte é SOMENTE LEITURA. Nenhum código
deste projeto move, renomeia, exclui, sobrescreve, edita ou cria arquivo dentro de
`PROG_SOURCE_ROOT` — nem `.tmp`, nem lock, nem cache.

Este módulo é o único que conhece o caminho da fonte. Ele expõe apenas operações de
leitura e **recusa em tempo de execução** qualquer destino de escrita que esteja sob a
raiz da fonte. A regra deixa de ser disciplina e passa a ser invariante testável.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from backend.app.core.config import BusinessRules, Settings

OFFICE_JUNK = re.compile(r"^(~\$|\.~lock\.)|\.(tmp|temp)$", re.IGNORECASE)


class SourceWriteAttemptError(RuntimeError):
    """Levantada quando algo tenta escrever dentro da fonte. Nunca deve acontecer."""


@dataclass(frozen=True)
class SourceFile:
    """Um arquivo observado na fonte, com os metadados exigidos por DEC-020."""

    folder: str
    filename: str
    size_bytes: int
    mtime: dt.datetime
    extension: str

    def as_dict(self) -> dict:
        return {
            "pasta": self.folder,
            "arquivo_nome": self.filename,
            "tamanho_bytes": self.size_bytes,
            "mtime_disco": self.mtime.isoformat(timespec="seconds"),
            "extensao": self.extension,
        }


@dataclass
class SourceInventory:
    """Inventário físico da fonte no instante da captura."""

    captured_at: dt.datetime
    source_root: str
    acervo: list[SourceFile] = field(default_factory=list)
    control_files: list[SourceFile] = field(default_factory=list)
    office_junk: list[str] = field(default_factory=list)
    empty_folders: list[str] = field(default_factory=list)

    @property
    def total_acervo(self) -> int:
        return len(self.acervo)

    def digest(self) -> str:
        """Hash do inventário: muda se qualquer arquivo, tamanho ou mtime mudar."""
        payload = "\n".join(
            f"{f.folder}/{f.filename}|{f.size_bytes}|{f.mtime.isoformat()}"
            for f in sorted(self.acervo, key=lambda x: (x.folder.lower(), x.filename.lower()))
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class SourceGuard:
    """Leitura protegida da fonte. Sem nenhum método de escrita."""

    def __init__(self, settings: Settings, rules: BusinessRules) -> None:
        self._settings = settings
        self._rules = rules
        self._root = settings.source_root.resolve()
        if not self._root.exists():
            raise FileNotFoundError(f"Fonte não encontrada: {self._root}")
        if not self._root.is_dir():
            raise NotADirectoryError(f"Fonte não é diretório: {self._root}")

    # -- proteção ----------------------------------------------------------
    @property
    def root(self) -> Path:
        return self._root

    def is_inside_source(self, candidate: str | Path) -> bool:
        try:
            resolved = Path(candidate).resolve()
        except OSError:  # pragma: no cover
            return False
        return resolved == self._root or self._root in resolved.parents

    def assert_write_target_outside_source(self, destination: str | Path) -> Path:
        """Trava obrigatória antes de qualquer escrita feita pelo pipeline."""
        target = Path(destination)
        if self.is_inside_source(target):
            raise SourceWriteAttemptError(
                "Tentativa de escrita DENTRO da fonte documental do Escritório Jurídico, bloqueada: "
                f"{target}. A fonte é somente leitura (CLAUDE.md §3, DEC-002)."
            )
        return target

    # -- leitura -----------------------------------------------------------
    @property
    def index_path(self) -> Path:
        path = self._root / self._settings.index_filename
        if not path.exists():
            raise FileNotFoundError(f"Índice não encontrado na fonte: {path}")
        return path

    def index_fingerprint(self) -> dict:
        """Hash + tamanho + mtime do índice — identidade do estado capturado."""
        path = self.index_path
        stat = path.stat()
        sha256 = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 256), b""):
                sha256.update(chunk)
        return {
            "arquivo": path.name,
            "caminho_origem": str(path),
            "sha256": sha256.hexdigest(),
            "tamanho_bytes": stat.st_size,
            "mtime": dt.datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        }

    def _is_control_file(self, folder: str, filename: str) -> bool:
        if self._rules.control_files_root_only and folder not in ("", "."):
            return False
        return any(
            re.match(pattern, filename, re.IGNORECASE)
            for pattern in self._rules.control_file_patterns
        )

    def scan_inventory(self) -> SourceInventory:
        """Varredura somente-leitura da árvore. Não abre nem toca nenhum documento."""
        inventory = SourceInventory(
            captured_at=dt.datetime.now(),
            source_root=str(self._root),
        )
        for dirpath, _dirnames, filenames in os.walk(self._root):
            rel = os.path.relpath(dirpath, self._root)
            folder = "" if rel == "." else rel
            visible = [f for f in filenames if not OFFICE_JUNK.search(f)]
            if folder and not visible:
                inventory.empty_folders.append(folder)
            for name in filenames:
                if OFFICE_JUNK.search(name):
                    inventory.office_junk.append(os.path.join(folder, name))
                    continue
                full = Path(dirpath) / name
                try:
                    stat = full.stat()
                except OSError:  # pragma: no cover - arquivo sumiu durante a varredura
                    continue
                item = SourceFile(
                    folder=folder,
                    filename=name,
                    size_bytes=stat.st_size,
                    mtime=dt.datetime.fromtimestamp(stat.st_mtime),
                    extension=name.rsplit(".", 1)[-1].lower() if "." in name else "",
                )
                if self._is_control_file(folder, name):
                    inventory.control_files.append(item)
                else:
                    inventory.acervo.append(item)
        return inventory

    def copy_index_to(self, destination: str | Path) -> Path:
        """Copia o índice para fora da fonte. O destino é validado antes."""
        target = self.assert_write_target_outside_source(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        source = self.index_path
        with source.open("rb") as src, target.open("wb") as dst:
            for chunk in iter(lambda: src.read(1024 * 256), b""):
                dst.write(chunk)
        return target
