"""Contrato do índice, snapshot consistente e reconciliação fonte -> modelo.

Nenhum número de referência é fixo no código: todos vêm do snapshot em teste.
A fonte mudou de 154 para 296 linhas em uma hora — teste com número cravado passaria
a mentir (ver docs/DISCOVERY.md (removido na versão pública: perfil do acervo real) §2).
"""

from __future__ import annotations

import json

import pytest

from backend.pipeline.contracts import indice_v1
from backend.pipeline.steps import extract as extract_step
from backend.pipeline.steps import normalize as normalize_step
from backend.pipeline.steps import snapshot as snapshot_step


@pytest.fixture(scope="module")
def cycle(settings, rules, source_available):
    """Um snapshot real, capturado uma vez para todo o módulo."""
    if not source_available:
        pytest.skip("fonte indisponível")
    snap = snapshot_step.capture(settings, rules)
    extracted = extract_step.extract(snap.index_copy)
    model = normalize_step.normalize(extracted, snap, rules)
    return snap, extracted, model


# ------------------------------------------------------------------- contrato
def test_contrato_estrutural_do_indice(cycle):
    _, extracted, _ = cycle
    report = indice_v1.validate_structure(extracted.sheetnames, extracted.header, extracted.rows)
    assert report.ok, f"violações: {report.violations}"
    assert report.columns_ok
    assert report.sheets_ok


def test_contrato_detecta_coluna_faltando():
    """Se o projeto vizinho mudar o layout, o pipeline precisa abortar."""
    header = [c for c in indice_v1.EXPECTED_COLUMNS if c != "Temas"]
    report = indice_v1.validate_structure(indice_v1.EXPECTED_SHEETS, header, [])
    assert not report.ok
    assert any("colunas" in v for v in report.violations)


def test_contrato_detecta_aba_faltando():
    report = indice_v1.validate_structure(["ÍNDICE"], indice_v1.EXPECTED_COLUMNS, [])
    assert not report.ok
    assert any("abas ausentes" in v for v in report.violations)


def test_contrato_detecta_id_duplicado():
    rows = [
        {"ID": 1, "Status": "Na pasta"},
        {"ID": 1, "Status": "Na pasta"},
    ]
    report = indice_v1.validate_structure(
        indice_v1.EXPECTED_SHEETS, indice_v1.EXPECTED_COLUMNS, rows
    )
    assert not report.ok
    assert any("duplicatas" in v for v in report.violations)


def test_contrato_detecta_status_fora_do_dominio():
    rows = [{"ID": 1, "Status": "Arquivado"}]
    report = indice_v1.validate_structure(
        indice_v1.EXPECTED_SHEETS, indice_v1.EXPECTED_COLUMNS, rows
    )
    assert not report.ok
    assert any("Status" in v for v in report.violations)


# ------------------------------------------------------------------- snapshot
def test_snapshot_grava_manifest_completo(cycle):
    """DEC-020: hash, tamanho, mtime, timestamp, origem e ciclo no manifest."""
    snap, _, _ = cycle
    manifest_path = snap.directory / snapshot_step.MANIFEST_NAME
    assert manifest_path.exists()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert manifest["ciclo_id"] == snap.cycle_id
    assert manifest["captured_at"]
    assert manifest["physical_scan_as_of"]
    assert manifest["source_root"]
    assert manifest["somente_leitura"] is True
    assert len(manifest["indice"]["sha256"]) == 64
    assert manifest["indice"]["tamanho_bytes"] > 0
    assert manifest["indice"]["mtime"]
    assert manifest["indice"]["caminho_origem"]
    assert len(manifest["inventario"]["digest_sha256"]) == 64
    assert manifest["regras_negocio_versao"] >= 1


def test_snapshot_guarda_copia_do_indice_e_das_regras(cycle):
    """Sem a cópia das regras aplicadas, o ciclo não é reproduzível."""
    snap, _, _ = cycle
    assert snap.index_copy.exists()
    assert snap.index_copy.stat().st_size == snap.index_fingerprint["tamanho_bytes"]
    assert list(snap.directory.glob("regras_negocio_*.json"))
    assert list(snap.directory.glob("filesystem_*.json"))


def test_snapshot_pode_ser_recarregado(cycle, settings):
    """Reprocessar um ciclo antigo não deve tocar a fonte de novo."""
    snap, _, _ = cycle
    recarregado = snapshot_step.load(settings, snap.cycle_id)
    assert recarregado is not None
    assert recarregado.cycle_id == snap.cycle_id
    assert recarregado.index_fingerprint["sha256"] == snap.index_fingerprint["sha256"]


def test_ciclo_id_e_ordenavel(settings, cycle):
    """O id do ciclo precisa ordenar lexicograficamente na ordem do tempo.

    Depende de `cycle`: `latest_cycle_id` só existe depois de um snapshot capturado (antes,
    dependia da ordem de execução dos testes do módulo)."""
    ids = [snapshot_step.new_cycle_id() for _ in range(2)]
    assert ids == sorted(ids)
    assert snapshot_step.latest_cycle_id(settings) is not None


# --------------------------------------------------------------- reconciliação
def test_reconciliacao_fonte_para_modelo(cycle):
    """Cada número do modelo confere com a fonte, por caminho independente."""
    snap, extracted, model = cycle
    from backend.pipeline.run import reconcile

    checks = reconcile(model, snap, extracted)
    falhas = [c for c in checks if not c["ok"]]
    assert not falhas, f"reconciliação falhou: {falhas}"
    assert len(checks) >= 7


def test_todos_os_temas_viram_vinculos(cycle):
    """Temas N:N: a ponte tem exatamente a soma dos temas por documento."""
    _, _, model = cycle
    docs = model.table("fct_documento")
    links = model.table("br_documento_tema")
    assert len(links) == sum(d["temas_count"] for d in docs)
    # Um documento com mais de um tema aparece mais de uma vez na ponte.
    multivalorados = [d for d in docs if d["temas_count"] > 1]
    if multivalorados:
        assert len(links) > len(docs)


def test_ids_do_modelo_sao_unicos_e_nao_nulos(cycle):
    _, _, model = cycle
    ids = [d["documento_id"] for d in model.table("fct_documento")]
    assert all(i is not None for i in ids)
    assert len(set(ids)) == len(ids)


def test_ativos_mais_excluidos_igual_ao_total(cycle):
    _, _, model = cycle
    docs = model.table("fct_documento")
    ativos = sum(1 for d in docs if d["ativo"])
    excluidos = sum(1 for d in docs if not d["ativo"])
    assert ativos + excluidos == len(docs)
    assert model.meta["documentos_ativos"] == ativos
    assert model.meta["documentos_excluidos"] == excluidos


def test_link_ausente_apenas_em_documento_excluido(cycle):
    """As linhas sem hyperlink são exatamente as marcadas como Excluído."""
    _, _, model = cycle
    sem_link = [d for d in model.table("fct_documento") if not d["link_disponivel"]]
    assert all(not d["ativo"] for d in sem_link), (
        f"documento ativo sem link: {[d['documento_id'] for d in sem_link if d['ativo']]}"
    )


def test_hyperlink_nunca_e_reconstruido(cycle):
    """DEC-008: o link é preservado literal, com o nome do arquivo dentro dele."""
    import urllib.parse

    _, _, model = cycle
    for doc in model.table("fct_documento"):
        if doc["link_url"]:
            decodificado = urllib.parse.unquote(doc["link_url"])
            assert doc["arquivo_nome"] in decodificado


# ------------------------------------------------------------------ dois relógios
def test_meta_expoe_os_dois_relogios(cycle):
    """DEC-021: indexed_as_of, physical_scan_as_of e a contagem de pendentes."""
    _, _, model = cycle
    meta = model.meta
    for campo in ("indexed_as_of", "physical_scan_as_of", "pending_reconciliation_count"):
        assert campo in meta
    assert isinstance(meta["pending_reconciliation_count"], int)
    assert isinstance(meta["indexing_gap_count"], int)


def test_pendente_e_lacuna_sao_situacoes_distintas(cycle):
    """DEC-018: arquivo novo é pendente; arquivo antigo fora do índice é lacuna."""
    _, _, model = cycle
    situacoes = {a["situacao_indexacao"] for a in model.table("fct_arquivo_fisico")}
    assert situacoes <= {"indexado", "pendente_de_varredura", "lacuna_de_indexacao"}

    pendentes = [
        a for a in model.table("fct_arquivo_fisico")
        if a["situacao_indexacao"] == "pendente_de_varredura"
    ]
    indexed_as_of = model.meta["indexed_as_of"]
    if pendentes and indexed_as_of:
        for arquivo in pendentes:
            assert arquivo["mtime_disco"] > indexed_as_of, (
                "arquivo classificado como pendente é anterior à última varredura — "
                "deveria ser lacuna"
            )


def test_arquivo_indexado_nunca_conta_como_achado(cycle):
    _, _, model = cycle
    indexados = [a for a in model.table("fct_arquivo_fisico") if a["indexado"]]
    for arquivo in indexados:
        assert arquivo["situacao_indexacao"] == "indexado"


# --------------------------------------------------------------- proveniência
def test_proveniencia_esta_no_vocabulario_fechado(cycle):
    permitidas = {
        normalize_step.P_SOURCE,
        normalize_step.P_DERIVED,
        normalize_step.P_CONFIRMED,
        normalize_step.P_INFERRED,
        normalize_step.P_TAXONOMY_PENDING,
        normalize_step.P_MISSING,
    }
    _, _, model = cycle
    for doc in model.table("fct_documento"):
        for campo in (
            "natureza_proveniencia",
            "destinatario_proveniencia",
            "estagio_proveniencia",
            "contrato_proveniencia",
            "rodovia_proveniencia",
        ):
            assert doc[campo] in permitidas, f"{campo}={doc[campo]}"


def test_contrato_via_destinatario_e_confirmado_via_rodovia_e_derivado(cycle):
    """O mapa é confirmado, mas o CAMINHO até ele muda a confiança."""
    _, _, model = cycle
    for doc in model.table("fct_documento"):
        if doc["contrato_origem"] == "destinatario":
            assert doc["contrato_proveniencia"] == normalize_step.P_CONFIRMED
        elif doc["contrato_origem"] == "rodovia":
            assert doc["contrato_proveniencia"] == normalize_step.P_DERIVED


def test_taxonomia_divergente_e_estado_nao_erro(cycle):
    """DEC-022: 'Empreiteiras' é confirmado por regra; nada é reclassificado."""
    _, _, model = cycle
    status = {
        d["destinatario_status_taxonomia"] for d in model.table("fct_documento")
    }
    assert status <= {"ok", "confirmado_por_regra", "pendente_de_validacao"}

    achados = [f for f in model.findings if f.regra == "taxonomia_pendente_de_validacao"]
    for achado in achados:
        assert achado.severidade == "low", "taxonomia pendente não é erro crítico"


def test_categoria_vazia_e_informativa(cycle):
    """DEC-022: pasta existente e vazia não é problema de qualidade."""
    _, _, model = cycle
    for achado in model.findings:
        if achado.regra == "categoria_sem_documentos":
            assert achado.severidade == "info"


def test_sem_regressao_de_rodovia_no_modelo(cycle, rules):
    """Guarda de regressão do DEC-014 no modelo inteiro, não só na função."""
    _, _, model = cycle
    rodovias = {r["rodovia"] for r in model.table("dim_rodovia")}
    proibidas = set(rules.roads_false_positives)
    assert not (rodovias & proibidas), f"falso positivo no modelo: {rodovias & proibidas}"


def test_nenhum_achado_de_severidade_alta_inesperado(cycle):
    """Severidade alta é reservada a lacuna real e regressão de extração."""
    _, _, model = cycle
    altos = [f for f in model.findings if f.severidade == "high"]
    permitidos = {"lacuna_de_indexacao", "regressao_extracao_rodovia"}
    assert all(f.regra in permitidos for f in altos), [f.regra for f in altos]


# ---------------------------------------------------------------- idempotência
def test_pipeline_e_idempotente_sobre_o_mesmo_snapshot(cycle, rules):
    """Mesmo snapshot + mesmas regras = mesma saída, byte a byte."""
    snap, extracted, model = cycle
    novamente = normalize_step.normalize(extracted, snap, rules)
    for nome, linhas in model.tables.items():
        if nome == "meta_ciclo":
            continue
        assert linhas == novamente.tables[nome], f"tabela {nome} não é determinística"
