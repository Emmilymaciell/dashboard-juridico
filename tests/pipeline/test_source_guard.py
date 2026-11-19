"""O teste mais importante do projeto: a fonte do Escritório Jurídico é intocável.

Se algum destes testes falhar, o projeto tem um defeito grave — não um bug de
conveniência. Ver CLAUDE.md §3 e DEC-002.
"""

from __future__ import annotations

import pytest

from backend.pipeline.source_guard import SourceGuard, SourceWriteAttemptError


def _inventory_signature(guard: SourceGuard) -> set[tuple[str, str, int, str]]:
    """Assinatura completa da fonte: nome, tamanho e mtime de cada arquivo."""
    inventory = guard.scan_inventory()
    return {
        (item.folder, item.filename, item.size_bytes, item.mtime.isoformat())
        for item in [*inventory.acervo, *inventory.control_files]
    }


def test_guard_rejeita_escrita_dentro_da_fonte(guard: SourceGuard):
    """Qualquer destino sob a raiz da fonte é recusado em tempo de execução."""
    alvos = [
        guard.root / "arquivo.txt",
        guard.root / "Advertencia" / "novo.docx",
        guard.root / "subpasta" / "profunda" / "x.tmp",
        guard.root,
    ]
    for alvo in alvos:
        with pytest.raises(SourceWriteAttemptError):
            guard.assert_write_target_outside_source(alvo)


def test_guard_aceita_destino_fora_da_fonte(guard: SourceGuard, settings, tmp_path):
    """data/raw e tmp são destinos legítimos."""
    assert guard.assert_write_target_outside_source(tmp_path / "x.json")
    assert guard.assert_write_target_outside_source(settings.data_raw / "x.xlsx")


def test_is_inside_source_reconhece_a_arvore(guard: SourceGuard, tmp_path):
    assert guard.is_inside_source(guard.root)
    assert guard.is_inside_source(guard.root / "Advertencia")
    assert not guard.is_inside_source(tmp_path)
    assert not guard.is_inside_source(guard.root.parent)


def test_guard_nao_expoe_metodo_de_escrita(guard: SourceGuard):
    """A superfície pública do guard não tem operação de escrita na fonte."""
    proibidos = {"write", "save", "delete", "remove", "move", "rename", "mkdir", "unlink"}
    publicos = {name for name in dir(guard) if not name.startswith("_")}
    assert not (publicos & proibidos), f"método de escrita exposto: {publicos & proibidos}"


def test_copia_do_indice_vai_para_fora_da_fonte(guard: SourceGuard, tmp_path, source_available):
    if not source_available:
        pytest.skip("fonte indisponível")
    destino = tmp_path / "copia.xlsx"
    resultado = guard.copy_index_to(destino)
    assert resultado.exists()
    assert resultado.stat().st_size == guard.index_path.stat().st_size
    assert not guard.is_inside_source(resultado)


def test_copia_do_indice_para_dentro_da_fonte_e_bloqueada(guard: SourceGuard, source_available):
    if not source_available:
        pytest.skip("fonte indisponível")
    with pytest.raises(SourceWriteAttemptError):
        guard.copy_index_to(guard.root / "copia_indevida.xlsx")


def test_pipeline_completo_nao_altera_a_fonte(guard: SourceGuard, settings, rules, source_available):
    """Inventário idêntico antes e depois de um ciclo completo de ingestão.

    Esta é a invariante que transforma a regra em controle: não basta o código
    "não pretender" escrever — ele precisa provar que não escreveu.
    """
    if not source_available:
        pytest.skip("fonte indisponível")

    antes = _inventory_signature(guard)
    mtime_indice_antes = guard.index_path.stat().st_mtime

    from backend.pipeline.run import run

    codigo = run(validate_only=True)
    assert codigo == 0, "pipeline falhou por outro motivo — investigar antes de confiar no teste"

    depois = _inventory_signature(guard)
    mtime_indice_depois = guard.index_path.stat().st_mtime

    novos = depois - antes
    removidos = antes - depois
    assert not removidos, f"arquivos DESAPARECERAM da fonte: {sorted(removidos)[:5]}"
    # A fonte é viva: arquivo novo pode chegar do OneDrive durante o teste. O que não
    # pode é a assinatura de um arquivo existente mudar, nem o índice ser regravado.
    assert mtime_indice_antes == mtime_indice_depois, "00 Indice.xlsx foi modificado"
    if novos:
        nomes_antes = {(pasta, nome) for pasta, nome, _, _ in antes}
        for pasta, nome, _, _ in novos:
            assert (pasta, nome) not in nomes_antes, (
                f"arquivo existente teve tamanho/mtime alterado: {pasta}/{nome}"
            )


def test_varredura_ignora_lixo_do_office(guard: SourceGuard, source_available):
    if not source_available:
        pytest.skip("fonte indisponível")
    inventory = guard.scan_inventory()
    for item in inventory.acervo:
        assert not item.filename.startswith("~$"), f"lixo do Office no acervo: {item.filename}"
        assert not item.filename.lower().endswith(".tmp")


def test_arquivos_de_controle_ficam_fora_do_acervo(guard: SourceGuard, source_available):
    """00 Indice.xlsx e 00 Nomenclatura são instrumento, não objeto medido (DEC-015)."""
    if not source_available:
        pytest.skip("fonte indisponível")
    inventory = guard.scan_inventory()
    nomes_acervo = {item.filename for item in inventory.acervo}
    assert "00 Indice.xlsx" not in nomes_acervo
    for item in inventory.control_files:
        assert item.folder in ("", ".")


def test_fingerprint_do_indice_tem_os_campos_exigidos(guard: SourceGuard, source_available):
    """DEC-020 exige hash, tamanho, mtime e caminho de origem no manifest."""
    if not source_available:
        pytest.skip("fonte indisponível")
    fingerprint = guard.index_fingerprint()
    for campo in ("sha256", "tamanho_bytes", "mtime", "caminho_origem", "arquivo"):
        assert campo in fingerprint and fingerprint[campo] is not None
    assert len(fingerprint["sha256"]) == 64


def test_digest_do_inventario_e_estavel(guard: SourceGuard, source_available):
    if not source_available:
        pytest.skip("fonte indisponível")
    primeiro = guard.scan_inventory()
    segundo = guard.scan_inventory()
    if primeiro.total_acervo == segundo.total_acervo:
        assert primeiro.digest() == segundo.digest()
