"""Normalização: as regras confirmadas e os casos de borda que já nos morderam."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from backend.pipeline.steps import extract as extract_step
from backend.pipeline.steps import snapshot as snapshot_step
from backend.pipeline.steps.extract import ExtractedIndex
from backend.pipeline.steps.normalize import (
    Normalizer,
    fold,
    none_if_blank,
    normalize,
    parse_br_datetime,
    parse_document_date,
    split_multi,
)
from backend.pipeline.steps.snapshot import Snapshot, SourceInventory


@pytest.fixture(scope="module")
def engine(rules):
    return Normalizer(rules)


# --------------------------------------------------------------- regra RD-102
@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("RD-102", {"RD-102A"}),
        ("RD 102", {"RD-102A"}),
        ("RD102", {"RD-102A"}),
        ("rd-102", {"RD-102A"}),
        ("RD-102A", {"RD-102A"}),
        ("RD 102 A", {"RD-102A"}),
        ("rd102a", {"RD-102A"}),
        ("RD-102B", {"RD-102B"}),
        ("RD 102 B", {"RD-102B"}),
        ("rd102b", {"RD-102B"}),
        ("RD-101", {"RD-101"}),
        ("RD 104", {"RD-104"}),
        ("RD103", {"RD-103"}),
    ],
)
def test_regra_rd102_confirmada(engine: Normalizer, texto: str, esperado: set[str]):
    """'RD-102' sem 'B' explícito é RD-102A. Regra confirmada pela usuária (DEC-010)."""
    assert set(engine.roads_for_row({"Assunto": texto})) == esperado


@pytest.mark.parametrize(
    "sigla",
    ["MPRD", "SITC ALERD", "TCE-RD", "TCE RD", "ALERD", "Órgão Contratante",
     "Ministério Público", "Comissão Legislativa", "Tribunal de Contas"],
)
def test_siglas_terminadas_em_go_nao_geram_rodovia(engine: Normalizer, sigla: str):
    """Guarda de regressão do DEC-014.

    Versão pública: os órgãos aparecem no produto como Ministério Público, Comissão Legislativa
    e Tribunal de Contas. As siglas MPRD/ALERD/TCE-RD aqui são SINTÉTICAS (órgão + UF fictícia
    'RD', igual ao prefixo das rodovias) e ficam só para manter o caso de regressão.

    O regex antigo rodava sobre campos concatenados e 'MPRD' + '251104 - ...'
    produzia 'RD 251'. Aqui provamos que a sigla sozinha não gera rodovia.
    """
    assert engine.roads_for_row({"Destinatarios": sigla}) == {}


@pytest.mark.parametrize(
    ("destinatario", "arquivo"),
    [
        ("MPRD", "251104 - Minuta - Resposta Oficio Rec 000 2025 - MPRD - 1.docx"),
        ("SITC ALERD", "260105 - Minuta - Resposta Oficio IT 000 2025 - SITC ALERD - 1.docx"),
        ("TCE-RD", "250522 - Contrato Instrumento - Termo Aditivo Exemplo - TCE-RD - 1.pdf"),
        ("TCE-RD", "260706 - Minuta - Esclarecimentos Exemplo - TCE RD - 1.docx"),
    ],
)
def test_falsos_positivos_reais_nao_reaparecem(
    engine: Normalizer, rules, destinatario: str, arquivo: str
):
    """Casos exatos que a v1 do discovery reportou como RD-251 / RD-260 / RD-250."""
    encontrados = set(engine.roads_for_row({"Destinatarios": destinatario, "Arquivo": arquivo}))
    proibidos = set(rules.roads_false_positives)
    assert not (encontrados & proibidos), (
        f"falso positivo reapareceu: {encontrados & proibidos} em {arquivo}"
    )


def test_rodovia_por_campo_registra_a_origem(engine: Normalizer):
    """A confiança depende do campo: Destinatarios é alta, Assunto é média."""
    roads = engine.roads_for_row(
        {"Destinatarios": "Executora RD102A - Beta", "Assunto": "Atraso RD 101"}
    )
    assert roads["RD-102A"] == "Destinatarios"
    assert roads["RD-101"] == "Assunto"


def test_rodovia_reconhece_multiplas_no_mesmo_documento(engine: Normalizer):
    roads = engine.roads_for_row({"Assunto": "Relatorio RD 101 e RD 103 consolidado"})
    assert set(roads) == {"RD-101", "RD-103"}


# ------------------------------------------------------------ contrato/estágio
def test_contrato_confirmado_vem_do_destinatario(engine: Normalizer):
    """Mapa contrato→rodovia→executora confirmado (DEC-010)."""
    esperado = {
        "Executora RD103 - Alfa": ("11/2025", "RD-103"),
        "Executora RD102A - Beta": ("12/2025", "RD-102A"),
        "Executora RD101 - Gama": ("13/2025", "RD-101"),
        "Executora RD104 - Delta": ("14/2025", "RD-104"),
    }
    for destinatario, (contrato, rodovia) in esperado.items():
        item = engine._contracts_by_recipient[fold(destinatario)]
        assert item["contrato"] == contrato
        assert item["rodovia"] == rodovia


def test_estagio_minuta_e_em_elaboracao(engine: Normalizer):
    """Minuta é estágio/forma, nunca matéria jurídica (DEC-019)."""
    estagio, _ = engine.stage_for("Minuta", "250718 - Minuta - Contrato - Parceiro - 1.docx")
    assert estagio == "em_elaboracao"


def test_estagio_instrumento_final_e_consolidado(engine: Normalizer):
    for natureza in ("Contrato / Instrumento", "Edital", "Advertência", "Notificação"):
        estagio, _ = engine.stage_for(natureza, "x.pdf")
        assert estagio == "consolidado", natureza


def test_estagio_usa_marcador_do_nome_quando_natureza_nao_decide(engine: Normalizer):
    estagio, proveniencia = engine.stage_for("Anexo", "250718 - Anexo - Edital com Marcas - Parceiro - 1.docx")
    assert estagio == "em_elaboracao"
    assert proveniencia == "inferred"


def test_estagio_sem_evidencia_fica_nao_determinado(engine: Normalizer):
    estagio, proveniencia = engine.stage_for(None, "arquivo qualquer.pdf")
    assert estagio == "nao_determinado"
    assert proveniencia == "missing"


# ------------------------------------------------------------------ macrogrupo
def test_macrogrupo_vem_da_natureza_quando_ela_carrega_materia(engine: Normalizer):
    macro, _, origem = engine.macro_for("Advertência", [])
    assert macro == "Sancionatório"
    assert origem == "natureza"


def test_macrogrupo_de_minuta_deriva_do_tema(engine: Normalizer):
    """Minuta não tem matéria própria: a matéria vem do tema (DEC-019)."""
    macro, _, origem = engine.macro_for("Minuta", ["Sanções / Advertência"])
    assert macro == "Sancionatório"
    assert origem == "tema"


def test_macrogrupo_nao_e_forcado_sem_evidencia(engine: Normalizer):
    """Tema genérico não determina matéria. Preferimos não saber a inventar."""
    macro, _, origem = engine.macro_for("Minuta", ["Documentação"])
    assert macro == "Não classificado"
    assert origem == "sem_evidencia"

    macro, _, origem = engine.macro_for("Minuta", [])
    assert macro == "Não classificado"
    assert origem == "sem_evidencia"


def test_macrogrupo_empate_entre_temas_resolve_para_nao_classificado(engine: Normalizer):
    """Dois sinais de peso igual e macrogrupos diferentes: não escolhemos por sorte."""
    macro, _, origem = engine.macro_for("Minuta", ["Aditivo", "Contratação"])
    assert macro == "Não classificado"
    assert origem == "sem_evidencia"


# ---------------------------------------------------------- temas multivalorados
@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("Aditivo; Contrato", ["Aditivo", "Contrato"]),
        ("Aditivo;Contrato", ["Aditivo", "Contrato"]),
        ("  Aditivo ;  Contrato ; ", ["Aditivo", "Contrato"]),
        ("Contrato", ["Contrato"]),
        ("", []),
        (None, []),
        ("ESG; Compliance; Documentação", ["ESG", "Compliance", "Documentação"]),
    ],
)
def test_split_de_temas_preserva_ordem_e_descarta_vazios(texto, esperado):
    assert split_multi(texto) == esperado


# ------------------------------------------------------------------------ datas
def test_parse_de_data_brasileira():
    valor, aproximada = parse_br_datetime("10/09/2026 14:17")
    assert valor == dt.datetime(2026, 9, 10, 14, 17)
    assert aproximada is False


def test_parse_extrai_marcador_aproximado():
    """'(aprox.)' vira flag, não quebra o parse nem é descartado silenciosamente."""
    valor, aproximada = parse_br_datetime("28/08/2026 10:03 (aprox.)")
    assert valor == dt.datetime(2026, 8, 28, 10, 3)
    assert aproximada is True


def test_parse_de_data_invalida_nao_explode():
    valor, aproximada = parse_br_datetime("qualquer coisa")
    assert valor is None
    assert aproximada is False


def test_parse_de_vazio():
    assert parse_br_datetime(None) == (None, False)
    assert parse_br_datetime("") == (None, False)


# ------------------------------------------------------------------------ fold
@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("Consulta", "consulta"),
        ("consulta", "consulta"),
        ("CONSULTA", "consulta"),
        ("Advertência", "advertencia"),
        ("Sanções / Advertência", "sancoes / advertencia"),
        ("Construtora Ágata", "construtora agata"),
        ("  Nota Técnica  ", "nota tecnica"),
    ],
)
def test_fold_remove_acento_e_caixa(entrada, esperado):
    assert fold(entrada) == esperado


def test_fold_permite_join_de_pasta_case_insensitive():
    """A coluna Pasta já veio 'consulta' minúsculo enquanto o disco tinha 'Consulta'."""
    assert fold("consulta") == fold("Consulta")


# ------------------------------------------------------------- missing values
def test_vazio_vira_none_nunca_string_sentinela():
    """Missing é informação: NULL explícito, nunca 'N/D' nem string vazia."""
    assert none_if_blank("") is None
    assert none_if_blank("   ") is None
    assert none_if_blank(None) is None
    assert none_if_blank("Parceiro") == "Parceiro"


# -------------------------------------------------- coluna Data defensiva
# A fonte de 04/10/2026 trouxe o prefixo do nome do arquivo no lugar da data
# ('250000', '51129') e o pipeline morria em `.isoformat()` sobre str. Regra: só
# célula de data vira data; o resto vira NULL + achado. Nada é adivinhado.
@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        (dt.datetime(2026, 9, 18, 0, 0), (dt.date(2026, 9, 18), None)),
        (dt.date(2025, 6, 23), (dt.date(2025, 6, 23), None)),
        (None, (None, "vazia")),
        ("", (None, "vazia")),
        ("   ", (None, "vazia")),
        ("250000", (None, "invalida")),
        ("51129", (None, "invalida")),
        (250000, (None, "invalida")),
        ("18/09/2026", (None, "invalida")),
    ],
)
def test_data_do_documento_nunca_e_adivinhada(valor, esperado):
    assert parse_document_date(valor) == esperado


def _indice_sintetico(datas: dict[int, object]):
    """Índice mínimo: uma linha por ID, só a coluna Data varia."""
    agora = dt.datetime(2026, 10, 4, 12, 0)
    linhas = [
        {
            "ID": doc_id,
            "Naturezas": "Parecer",
            "Data": data,
            "Assunto": "Assunto sintetico",
            "Destinatarios": "Parceiro",
            "Arquivo": f"250000 - Anexo sintetico {doc_id}.pdf",
            "Pasta": "Relatorio",
            "Status": "Na pasta",
            "Temas": "Contrato",
            "Data/hora do upload": "04/10/2026 10:00",
        }
        for doc_id, data in datas.items()
    ]
    extracted = ExtractedIndex(sheetnames=[], header=list(linhas[0]), rows=linhas)
    snap = Snapshot(
        cycle_id="2026-10-04T12-00-00",
        captured_at=agora,
        directory=Path("."),
        index_copy=Path("."),
        index_fingerprint={"sha256": "sintetico"},
        inventory=SourceInventory(captured_at=agora, source_root="sintetico"),
        inventory_digest="sintetico",
        source_root="sintetico",
        business_rules_version=2,
    )
    return extracted, snap


def test_normalize_mantem_documento_sem_data_e_registra_achado(rules):
    extracted, snap = _indice_sintetico(
        {1: dt.datetime(2026, 9, 18), 2: None, 3: "250000", 4: "51129"}
    )
    model = normalize(extracted, snap, rules)  # não pode explodir

    docs = {d["documento_id"]: d for d in model.table("fct_documento")}
    assert set(docs) == {1, 2, 3, 4}, "nenhum documento pode sumir"

    assert docs[1]["data_documento"] == "2026-09-18"
    for doc_id in (2, 3, 4):
        doc = docs[doc_id]
        assert doc["data_documento"] is None
        assert doc["ano"] is None and doc["mes"] is None and doc["trimestre"] is None
        # nome no padrão '250000 - ...' não pode dar precisão a uma data que não existe
        assert doc["data_documento_precisao"] is None

    achados = {
        f.entidade_id: f for f in model.findings if f.regra == "data_documento_nao_normalizada"
    }
    assert set(achados) == {"2", "3", "4"}
    assert "vazio" in achados["2"].descricao
    assert "'250000'" in achados["3"].descricao
    assert "'51129'" in achados["4"].descricao
    assert all(f.severidade == "medium" for f in achados.values())


# Regressão sobre o snapshot real em que o defeito apareceu. `data/raw/` não é
# versionado: em outra máquina o teste é pulado, e os testes acima continuam valendo.
CICLO_COM_DATA_INVALIDA = "2026-10-04T15-47-11"
CASOS_CONHECIDOS = {536: "51129", 604: "250000", 605: "250000", 606: "250000",
                    607: "250000", 608: "250000", 264: None}


@pytest.mark.skip(reason="depende de dado real do contrato — removido na versão pública")
def test_regressao_fonte_de_04_10_2026(settings, rules):
    snap = snapshot_step.load(settings, CICLO_COM_DATA_INVALIDA)
    if snap is None:
        pytest.skip(f"snapshot {CICLO_COM_DATA_INVALIDA} não está nesta máquina")
    extracted = extract_step.extract(snap.index_copy)
    model = normalize(extracted, snap, rules)

    docs = {d["documento_id"]: d for d in model.table("fct_documento")}
    assert len(docs) == len(extracted.rows)
    achados = {
        f.entidade_id: f for f in model.findings if f.regra == "data_documento_nao_normalizada"
    }
    for doc_id, bruto in CASOS_CONHECIDOS.items():
        assert doc_id in docs
        assert docs[doc_id]["data_documento"] is None
        assert str(doc_id) in achados
        if bruto:
            assert f"'{bruto}'" in achados[str(doc_id)].descricao
