---
description: Roda o profiling somente-leitura da fonte Escritório Jurídico e resume os achados
---

Execute `python scripts\01_discovery.py` na raiz do projeto.

Depois:

1. Compare os numeros com `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) secao 1 e com `STATE.md`.
2. Se o codigo de saida for `2`, pare: as abas ou colunas de `00 Indice.xlsx` mudaram.
   Isso e quebra de contrato de dados — reporte e nao siga com o pipeline.
3. Liste, em portugues e de forma objetiva: o que mudou desde a ultima varredura,
   verificacoes que falharam, e achados novos de qualidade.
4. Se algum numero divergir da documentacao, o script esta certo: proponha a atualizacao
   de `docs/DISCOVERY.md` (removido na versão pública: perfil do acervo real) e `STATE.md`.

Nao commite. Nao altere nada na fonte.
