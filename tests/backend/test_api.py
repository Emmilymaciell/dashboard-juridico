"""API: contratos, filtros e — o mais importante — reconciliação dos KPIs.

O objetivo é impedir que o frontend mostre número silenciosamente errado. Cada
KPI é comparado com o total calculado por caminho independente.
"""

from __future__ import annotations

import pytest

BASE = "/api/v1"


# --------------------------------------------------------------------- health
def test_health_responde(client):
    response = client.get(f"{BASE}/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["modelo_construido"] is True
    assert body["documentos"] > 0


# ----------------------------------------------------------------------- meta
def test_meta_expoe_os_dois_relogios(client):
    """DEC-021: a aplicação sabe comunicar as duas datas."""
    body = client.get(f"{BASE}/meta").json()
    data = body["data"]
    assert data["indexed_as_of"]
    assert data["physical_scan_as_of"]
    assert isinstance(data["pending_reconciliation_count"], int)
    assert isinstance(data["relogios_divergentes"], bool)
    assert data["ciclo_id"]
    assert len(data["indice_sha256"]) == 64


def test_meta_traz_rotulos_de_ui(client):
    """Os rótulos vêm das regras de negócio, não hardcoded no frontend."""
    data = client.get(f"{BASE}/meta").json()["data"]
    rotulos = data["rotulos_reconciliacao"]
    assert "indexed_as_of" in rotulos
    assert "physical_scan_as_of" in rotulos


def test_regras_de_negocio_expostas(client):
    body = client.get(f"{BASE}/meta/rules").json()
    assert body["versao"] >= 2
    assert len(body["contratos"]) == 4
    assert body["regra_rd102"]["ambigua"] is False
    assert "Empreiteiras" in body["destinatarios_confirmados"]
    assert "Parceiro" in body["exibir_sem_expansao"]
    assert "Comissão Legislativa" in body["exibir_sem_expansao"]


# ------------------------------------------------------------------- envelope
@pytest.mark.parametrize(
    "path",
    ["/overview", "/timeline", "/natures", "/themes", "/stakeholders", "/roads", "/contracts"],
)
def test_toda_resposta_agregada_tem_meta(client, path):
    """Métrica sem `meta` é bug de contrato (DEC-005), não detalhe."""
    body = client.get(f"{BASE}{path}").json()
    assert "meta" in body, f"{path} sem meta"
    meta = body["meta"]
    assert meta["categoria"]
    assert meta["proveniencia"]
    assert meta["grao"]
    assert meta["ciclo_id"]


def test_tema_declara_o_grao_como_vinculo(client):
    """Contagem de tema conta vínculos, e a API diz isso."""
    body = client.get(f"{BASE}/themes").json()
    assert "vínculo" in body["meta"]["grao"]
    assert body["meta"]["nota"]


def test_rodovia_declara_cobertura_parcial(client):
    """Rodovia não cobre 100% do acervo, e a cobertura é declarada."""
    body = client.get(f"{BASE}/roads").json()
    cobertura = body["meta"]["cobertura"]
    assert cobertura is not None
    assert cobertura["cobertos"] <= cobertura["documentos"]
    assert 0 <= cobertura["percentual"] <= 100
    assert "recebem atribuição" in body["meta"]["nota"].lower()


def test_contrato_e_regra_confirmada(client):
    body = client.get(f"{BASE}/contracts").json()
    assert body["meta"]["proveniencia"] == "confirmed_business_rule"
    assert len(body["dimensao"]) == 4


# -------------------------------------------------------- reconciliação de KPI
def test_kpi_documentos_indexados_bate_com_meta_e_com_documents(client):
    """fonte -> modelo -> API: os três precisam dar o mesmo número."""
    meta = client.get(f"{BASE}/meta").json()["data"]
    overview = client.get(f"{BASE}/overview").json()["data"]
    documents = client.get(f"{BASE}/documents?limite=1").json()["data"]

    kpi = next(k for k in overview["kpis"] if k["chave"] == "documentos_indexados")
    assert kpi["valor"] == meta["documentos_indexados"] == documents["total"]


def test_kpi_ativos_bate_com_filtro_de_status(client):
    overview = client.get(f"{BASE}/overview").json()["data"]
    kpi = next(k for k in overview["kpis"] if k["chave"] == "documentos_ativos")
    filtrado = client.get(f"{BASE}/documents?somente_ativos=true&limite=1").json()["data"]
    assert kpi["valor"] == filtrado["total"]


def test_serie_diaria_exclui_quem_nao_tem_dia_na_fonte(client):
    """A granularidade de dia não pode inventar data.

    Documento com precisão apenas mensal fica gravado como `AAAA-MM-01` no
    modelo. Agrupá-lo por dia o colocaria no primeiro do mês como se aquela
    fosse a data real — em março/2026 seriam oito documentos num dia que a
    fonte nunca afirmou. A série por dia exclui esses casos e **declara** a
    lacuna na cobertura.
    """
    resposta = client.get(f"{BASE}/timeline", params={"granularidade": "dia"}).json()
    serie, meta = resposta["data"], resposta["meta"]

    # Todo período é um dia completo, nunca um mês.
    for ponto in serie:
        assert len(ponto["periodo"]) == 10, ponto["periodo"]

    soma = sum(p["documentos"] for p in serie)
    assert meta["cobertura"]["cobertos"] == soma
    # A lacuna é declarada, não escondida.
    assert meta["cobertura"]["documentos"] >= soma
    assert "dia" in meta["nota"].lower()

    # Nenhum documento de precisão mensal sobreviveu ao agrupamento diário:
    # a série mensal de referência contabiliza mais do que a diária.
    mensal = client.get(f"{BASE}/timeline").json()["data"]
    assert sum(p["documentos"] for p in mensal) >= soma


def test_granularidade_invalida_e_recusada(client):
    resposta = client.get(f"{BASE}/timeline", params={"granularidade": "semana"})
    assert resposta.status_code == 422


def test_soma_da_serie_temporal_bate_com_o_total(client):
    """Todo documento com data aparece na série mensal, e só uma vez."""
    serie = client.get(f"{BASE}/timeline").json()["data"]
    soma = sum(p["documentos"] for p in serie)
    total = client.get(f"{BASE}/documents?limite=1").json()["data"]["total"]
    sem_data = client.get(f"{BASE}/governance").json()["data"]["achados"]
    faltando_data = sum(
        1 for a in sem_data if a["regra_key"] == "campo_ausente_data_documento"
    )
    # Documentos sem data não entram na série — e existe achado registrando isso.
    assert soma <= total
    if faltando_data == 0:
        assert soma == total


def test_soma_por_natureza_bate_com_o_total(client):
    naturezas = client.get(f"{BASE}/natures").json()["data"]
    total = client.get(f"{BASE}/documents?limite=1").json()["data"]["total"]
    assert sum(item["documentos"] for item in naturezas) == total


def test_vinculos_de_tema_excedem_o_total_de_documentos(client):
    """Comportamento esperado de campo N:N — e o teste garante que continua assim."""
    temas = client.get(f"{BASE}/themes").json()["data"]
    total = client.get(f"{BASE}/documents?limite=1").json()["data"]["total"]
    vinculos = sum(item["vinculos"] for item in temas)
    documentos_distintos = max(item["documentos"] for item in temas)
    assert vinculos >= total
    assert documentos_distintos <= total


def test_kpi_de_rodovia_bate_com_a_cobertura_declarada(client):
    overview = client.get(f"{BASE}/overview").json()["data"]
    meta = client.get(f"{BASE}/meta").json()["data"]
    roads = client.get(f"{BASE}/roads").json()
    kpi = next(k for k in overview["kpis"] if k["chave"] == "rodovias")
    assert kpi["valor"] == len(roads["data"])
    assert roads["meta"]["cobertura"]["cobertos"] == meta["docs_com_rodovia"]


# ------------------------------------------------------------------- filtros
def test_filtro_por_natureza(client):
    naturezas = client.get(f"{BASE}/natures").json()["data"]
    alvo = naturezas[0]
    filtrado = client.get(
        f"{BASE}/documents", params={"natureza": alvo["chave"], "limite": 5}
    ).json()["data"]
    assert filtrado["total"] == alvo["documentos"]
    assert all(item["natureza"] == alvo["chave"] for item in filtrado["itens"])


def test_filtro_por_tema_usa_a_ponte(client):
    temas = client.get(f"{BASE}/themes").json()["data"]
    alvo = temas[0]
    filtrado = client.get(f"{BASE}/documents", params={"tema": alvo["chave"], "limite": 5}).json()[
        "data"
    ]
    assert filtrado["total"] == alvo["documentos"]


def test_filtro_por_rodovia(client):
    roads = client.get(f"{BASE}/roads").json()["data"]
    alvo = roads[0]
    filtrado = client.get(
        f"{BASE}/documents", params={"rodovia": alvo["chave"], "limite": 5}
    ).json()["data"]
    assert filtrado["total"] == alvo["documentos"]


def test_filtros_combinados_reduzem_o_conjunto(client):
    naturezas = client.get(f"{BASE}/natures").json()["data"]
    temas = client.get(f"{BASE}/themes").json()["data"]
    so_natureza = client.get(
        f"{BASE}/documents", params={"natureza": naturezas[0]["chave"], "limite": 1}
    ).json()["data"]["total"]
    combinado = client.get(
        f"{BASE}/documents",
        params={"natureza": naturezas[0]["chave"], "tema": temas[0]["chave"], "limite": 1},
    ).json()["data"]["total"]
    assert combinado <= so_natureza


def test_filtro_de_multiplos_valores_e_uniao(client):
    naturezas = client.get(f"{BASE}/natures").json()["data"][:2]
    if len(naturezas) < 2:
        pytest.skip("acervo com uma única natureza")
    total = client.get(
        f"{BASE}/documents",
        params=[("natureza", naturezas[0]["chave"]), ("natureza", naturezas[1]["chave"])],
    ).json()["data"]["total"]
    assert total == naturezas[0]["documentos"] + naturezas[1]["documentos"]


def test_busca_ignora_acento_e_caixa(client):
    com_acento = client.get(f"{BASE}/documents", params={"busca": "Advertência"}).json()["data"]
    sem_acento = client.get(f"{BASE}/documents", params={"busca": "advertencia"}).json()["data"]
    maiuscula = client.get(f"{BASE}/documents", params={"busca": "ADVERTENCIA"}).json()["data"]
    assert com_acento["total"] == sem_acento["total"] == maiuscula["total"] > 0


def test_busca_por_id(client):
    """A busca aceita o ID exato do documento, além do texto.

    A versão anterior deste teste buscava `"1"` e exigia o documento 1 na
    primeira página. Passava só porque o acervo era pequeno: `"1"` casa por
    substring com praticamente todo assunto e nome de arquivo, e hoje devolve
    396 dos 397 documentos — o documento 1 sai da primeira página sem que nada
    esteja errado. A asserção agora usa o documento mais recente, que a
    ordenação padrão coloca em primeiro tanto no acervo inteiro quanto em
    qualquer recorte que o contenha.
    """
    topo = client.get(f"{BASE}/documents", params={"por_pagina": 1}).json()["data"]
    if not topo["itens"]:
        pytest.skip("acervo vazio")
    doc_id = topo["itens"][0]["documento_id"]

    body = client.get(f"{BASE}/documents", params={"busca": str(doc_id)}).json()["data"]
    assert body["total"] >= 1
    assert body["itens"][0]["documento_id"] == doc_id


def test_filtro_de_periodo(client):
    serie = client.get(f"{BASE}/timeline").json()["data"]
    if not serie:
        pytest.skip("série vazia")
    periodo = serie[-1]["periodo"]
    body = client.get(
        f"{BASE}/documents", params={"data_inicio": f"{periodo}-01", "limite": 1}
    ).json()["data"]
    assert body["total"] >= serie[-1]["documentos"]


def test_ordenacao_asc_e_desc_invertem_o_primeiro(client):
    desc = client.get(
        f"{BASE}/documents", params={"ordenar_por": "documento_id", "ordem": "desc", "limite": 1}
    ).json()["data"]["itens"]
    asc = client.get(
        f"{BASE}/documents", params={"ordenar_por": "documento_id", "ordem": "asc", "limite": 1}
    ).json()["data"]["itens"]
    assert desc[0]["documento_id"] > asc[0]["documento_id"]


def test_paginacao_nao_repete_documento(client):
    primeira = client.get(f"{BASE}/documents", params={"limite": 10, "offset": 0}).json()["data"]
    segunda = client.get(f"{BASE}/documents", params={"limite": 10, "offset": 10}).json()["data"]
    ids_1 = {i["documento_id"] for i in primeira["itens"]}
    ids_2 = {i["documento_id"] for i in segunda["itens"]}
    assert not (ids_1 & ids_2)


def test_filtro_sem_resultado_devolve_lista_vazia_nao_erro(client):
    body = client.get(f"{BASE}/documents", params={"busca": "zzzz-nao-existe-zzzz"}).json()["data"]
    assert body["total"] == 0
    assert body["itens"] == []


# ----------------------------------------------------------------- documentos
def test_detalhe_de_documento_traz_temas_rodovias_e_relacionados(client):
    primeiro = client.get(f"{BASE}/documents?limite=1").json()["data"]["itens"][0]
    body = client.get(f"{BASE}/documents/{primeiro['documento_id']}").json()
    doc = body["data"]
    assert doc["documento_id"] == primeiro["documento_id"]
    assert isinstance(doc["temas"], list)
    assert isinstance(doc["rodovias"], list)
    assert isinstance(doc["relacionados"], list)
    assert "ABRIR DOCUMENTO" in body["meta"]["nota"]


def test_documento_inexistente_devolve_404(client):
    response = client.get(f"{BASE}/documents/999999")
    assert response.status_code == 404


def test_documento_excluido_nao_tem_link(client):
    body = client.get(f"{BASE}/documents", params={"status": "Excluído", "limite": 5}).json()[
        "data"
    ]
    for item in body["itens"]:
        assert item["link_disponivel"] is False


def test_export_csv(client):
    response = client.get(f"{BASE}/documents/export/csv?limite=5")
    assert response.status_code == 200
    linhas = response.text.strip().splitlines()
    assert len(linhas) >= 2
    assert "documento_id" in linhas[0]


# ----------------------------------------------------------------- governança
def test_governanca_classifica_severidade(client):
    body = client.get(f"{BASE}/governance").json()["data"]
    severidades = {a["severidade"] for a in body["achados"]}
    assert severidades <= {"high", "medium", "low", "info"}
    assert body["resumo"]["formula_score"], "score sem fórmula visível é opinião"


def test_taxonomia_pendente_nao_e_severidade_alta(client):
    """DEC-022: CMA é taxonomia pendente, não erro grave."""
    achados = client.get(f"{BASE}/governance").json()["data"]["achados"]
    pendentes = [a for a in achados if a["regra_key"] == "taxonomia_pendente_de_validacao"]
    for achado in pendentes:
        assert achado["severidade"] == "low"
        assert achado["proveniencia"] == "taxonomy_pending"


def test_empreiteiras_e_estado_confirmado_nao_erro(client):
    achados = client.get(f"{BASE}/governance").json()["data"]["achados"]
    confirmados = [a for a in achados if a["regra_key"] == "taxonomia_planilha_vs_regra"]
    for achado in confirmados:
        assert achado["severidade"] == "info"
        assert achado["proveniencia"] == "confirmed_business_rule"


def test_governanca_tem_todos_os_blocos(client):
    blocos = {b["chave"] for b in client.get(f"{BASE}/governance").json()["data"]["blocos"]}
    assert {"cobertura", "completude", "taxonomia", "reconciliacao", "distribuicao"} <= blocos


def test_repositorio_avisa_sobre_o_log_inconsistente(client):
    body = client.get(f"{BASE}/repository-activity").json()
    resumo = body["data"]["resumo"]
    assert "Status" in resumo["aviso_log"]
    assert "NUNCA" in body["meta"]["nota"] or "nunca" in body["meta"]["nota"]


# -------------------------------------------------------------------- filtros
def test_opcoes_de_filtro_cobrem_as_dimensoes(client):
    body = client.get(f"{BASE}/filters/options").json()
    for chave in ("natureza", "tema", "destinatario", "rodovia", "contrato", "status", "estagio"):
        assert body[chave], f"opções vazias para {chave}"


def test_matriz_aceita_tema_por_natureza(client):
    body = client.get(f"{BASE}/matrix", params={"linhas": "tema", "colunas": "natureza"}).json()
    assert body["data"]
    assert {"linha", "coluna", "documentos"} <= set(body["data"][0])


def test_matriz_rejeita_dimensao_invalida(client):
    response = client.get(f"{BASE}/matrix", params={"linhas": "inexistente", "colunas": "natureza"})
    assert response.status_code == 400


def test_dimensao_invalida_devolve_400(client):
    assert client.get(f"{BASE}/dimensions/inexistente").status_code == 400
