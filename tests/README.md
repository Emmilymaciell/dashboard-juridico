# tests/

```
tests/
├── pipeline/   ingestão: proteção da fonte, contratos, normalização, reconciliação
├── backend/    API: endpoints, schemas, meta, filtros, erros
└── frontend/   (os testes de UI vivem em frontend/src/**/*.test.tsx, com Vitest)
```

**Status:** 134 testes Python + 28 no frontend, todos passando.
Configuração em `pyproject.toml` (raiz) e `frontend/vitest.config.mts`.

```powershell
python -m pytest tests -q
cd frontend; npm run test
```

---

## Os quatro testes que importam mais

### 1. Imutabilidade da fonte — `tests/pipeline/test_source_guard.py`

O teste mais importante do projeto. Verifica que:

- o inventário da fonte (nomes, tamanhos, mtimes) é **idêntico** antes e depois de uma
  execução completa do pipeline;
- qualquer destino de escrita sob a raiz da fonte levanta exceção;
- o workbook é aberto em modo leitura e `save()` nunca é chamado sobre a fonte;
- nenhum arquivo novo aparece na fonte (nem `.tmp`, nem lock).

Ver `DEC-002`.

### 2. Contrato do índice — `tests/pipeline/test_contracts.py`

As 4 abas, as 15 colunas na ordem exata, `ID` inteiro/único/não nulo, `Data` parseável
em 100% das linhas, `Status` no domínio esperado. Falha aqui **aborta** o pipeline: o
projeto vizinho mudou o layout e a ingestão precisa ser revista.

### 3. Reconciliação — `tests/pipeline/test_reconciliation.py`

Responde "o dashboard está certo?". Para cada número que a UI mostra, compara o valor
do modelo com o valor calculado **direto do snapshot**, por caminho independente
(`docs/DATA_MODEL.md` §9).

Os números de referência vêm do **snapshot em teste**, nunca de constantes fixas no
código — a fonte muda, e um teste com número cravado passaria a mentir.

### 4. Normalização — `tests/pipeline/test_normalize.py`

Casos de borda reais, tirados do discovery:

| Caso | Esperado |
|---|---|
| `"Aditivo; Contrato"` | 2 vínculos, ordem preservada |
| `"28/08/2026 10:03 (aprox.)"` | datetime + flag `aproximada = True` |
| nome com dia `00` (`260300 - ...`) | `precisao = 'mes'`, data no dia 1º |
| `Pasta = "consulta"` vs pasta `Consulta/` | `fold()` faz o join |
| `"... - 1 (2).pdf"` | `arquivo_copia_office = True` |
| IDs 97 e 102 (fora do padrão) | `nome_conforme_padrao = False`, sem exceção |
| `Destinatarios = NULL` (2 linhas) | `NULL`, não `"N/D"` nem `""` |
| `"Executora RD102A - Beta"` | rodovia `RD-102A` + executora `Beta` |

---

## Princípios

- Teste que depende da fonte usa um **snapshot fixo** em `tests/fixtures/`, gerado a
  partir de dados reais mas com nomes de pessoas anonimizados — dado pessoal de
  terceiro não entra no Git (`CLAUDE.md` §5).
- Nenhum teste faz rede.
- Nenhum teste escreve fora de `tmp_path`.
- Todo endpoint tem teste. Todo bug corrigido ganha um teste que o reproduz.
