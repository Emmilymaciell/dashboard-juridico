# Sanitização desta versão pública

Cópia sanitizada de um projeto em uso real. Nada aqui é dado de cliente ou de terceiro: o que aparece como exemplo é inventado. Detalhe completo da sanitização: relatório interno da autora.

## O que foi removido

Índice e documentos reais do escritório; imagens de parecer real (trocadas por placeholders gerados); metadados de gravação dos vídeos (removidos).

## O que foi trocado

Escritório, programa, parceiro, órgãos (`Ministério Público`, `Tribunal de Contas`, `Comissão Legislativa`) e rodovias → genéricos; links → `contoso.sharepoint.com`.

## O que é fictício

`examples/demandas_ficticias.json` → `examples/gerar_fonte_ficticia.py` gera a fonte; o `conftest` gera fonte e banco analítico se faltarem.

## Como verificar

```bat
py -3.12 -m pytest tests -q        # 149 testes; frontend: cd frontend && npm ci && npm test
```

Varreduras (2026-11-19): gitleaks `dir` só com falsos positivos justificados; busca por caminho local, e-mail, nomes do cliente e links privados sem ocorrências reais.
