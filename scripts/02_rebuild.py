"""Atalho para o ciclo completo do pipeline.

    python scripts/02_rebuild.py

Equivalente a `python -m backend.pipeline.run --full`. Existe para quem prefere
chamar por caminho de arquivo em vez de por modulo.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.pipeline.run import main

if __name__ == "__main__":
    raise SystemExit(main())
