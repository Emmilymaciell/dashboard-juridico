"""Compara a fonte documental com o último ciclo do pipeline. SOMENTE LEITURA.

Responde uma pergunta só: o `00 Indice.xlsx` que está na fonte agora é o mesmo
que o último ciclo processou? Se não for, todo número de `STATE.md` e da tela
descreve uma fonte que já não existe.

- caminho da fonte: o mesmo `get_settings()` da aplicação (`.env` / `config.json`),
  nunca hardcoded;
- abre o índice só em `rb`, para o hash; não lê o workbook, não grava nada;
- rodar com `python -B` para nem o bytecode ser gravado no projeto.

Saída em texto. Código de saída sempre 0: divergência é informação, não erro.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RAIZ))


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def main() -> None:
    ciclo_path = RAIZ / "state" / "last_cycle.json"
    if not ciclo_path.exists():
        print("ciclo: NAO DISPONIVEL nesta maquina (state/ nao e versionado)")
        ciclo = {}
    else:
        ciclo = json.loads(ciclo_path.read_text(encoding="utf-8")).get("meta", {})
        print(f"ciclo: {ciclo.get('ciclo_id')}  indexed_as_of={ciclo.get('indexed_as_of')}"
              f"  physical_scan_as_of={ciclo.get('physical_scan_as_of')}")
        print(f"ciclo: documentos_indexados={ciclo.get('documentos_indexados')}"
              f"  pendentes={ciclo.get('pending_reconciliation_count')}"
              f"  lacunas={ciclo.get('indexing_gap_count')}")

    try:
        from backend.app.core.config import get_settings

        indice = get_settings().index_path
    except Exception as exc:  # config ausente numa maquina nova
        print(f"fonte: NAO CONFIGURADA ({type(exc).__name__}: {exc})")
        return

    if not indice.exists():
        print("fonte: indice NAO ENCONTRADO no caminho configurado (OneDrive fora do ar?)")
        return

    st = indice.stat()
    atual = _sha256(indice)
    mtime = dt.datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")
    print(f"fonte: indice  tamanho={st.st_size}  mtime={mtime}  sha256={atual[:12]}")

    anterior = ciclo.get("indice_sha256")
    if not anterior:
        print("veredito: SEM REFERENCIA - nao ha ciclo para comparar")
    elif anterior == atual:
        print("veredito: IGUAL - o ultimo ciclo processou este indice")
    else:
        print(f"veredito: DIVERGENTE - o ciclo processou {anterior[:12]}; "
              "a fonte mudou depois do ultimo processamento")


if __name__ == "__main__":
    main()
