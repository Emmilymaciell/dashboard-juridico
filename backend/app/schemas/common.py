"""Contratos de saída da API. Pydantic v2 em toda fronteira.

Toda resposta agregada carrega `meta` com categoria, grão, cobertura e o snapshot que a
originou (DEC-005). Métrica sem `meta` é bug de contrato, não detalhe: é o que permite ao
frontend rotular a origem do número sem hardcode.
"""

from __future__ import annotations

from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, Field

Categoria = Literal[
    "DADO EXISTENTE", "DADO DERIVADO", "INFERÊNCIA", "HIPÓTESE", "NÃO DISPONÍVEL"
]
Proveniencia = Literal[
    "source", "derived", "confirmed_business_rule", "inferred", "taxonomy_pending", "missing"
]
Severidade = Literal["high", "medium", "low", "info"]

T = TypeVar("T")


class Cobertura(BaseModel):
    """Fração do acervo que a métrica realmente representa."""

    documentos: int = Field(description="universo considerado")
    cobertos: int = Field(description="quantos entram na métrica")
    percentual: float

    @classmethod
    def build(cls, total: int, covered: int) -> Cobertura:
        pct = round(100 * covered / total, 1) if total else 0.0
        return cls(documentos=total, cobertos=covered, percentual=pct)


class Meta(BaseModel):
    categoria: Categoria = "DADO DERIVADO"
    proveniencia: Proveniencia = "derived"
    grao: str = Field(default="documento", description="o que é uma linha do resultado")
    cobertura: Cobertura | None = None
    ciclo_id: str | None = None
    indexed_as_of: str | None = None
    physical_scan_as_of: str | None = None
    regras_negocio_versao: int | None = None
    filtros_aplicados: dict[str, Any] = Field(default_factory=dict)
    nota: str | None = None


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta


class ErroDetalhe(BaseModel):
    codigo: str
    mensagem: str
    detalhe: dict[str, Any] = Field(default_factory=dict)


class ErroResposta(BaseModel):
    erro: ErroDetalhe


class ContagemItem(BaseModel):
    chave: str
    documentos: int
    ativos: int | None = None
    vinculos: int | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class PontoTemporal(BaseModel):
    periodo: str
    documentos: int
    ativos: int
    naturezas: int | None = None
    precisao_mensal: int | None = None
    # Parcela sancionatória do período. Substitui a antiga `media_movel_3`: a
    # média móvel foi removida do produto, e deixá-la no contrato só convidava a
    # desenhá-la de novo.
    sancionatorios: int | None = None


class Kpi(BaseModel):
    chave: str
    rotulo: str
    valor: float
    unidade: Literal["contagem", "percentual"] = "contagem"
    delta: float | None = None
    delta_rotulo: str | None = None
    detalhe: str | None = None
    categoria: Categoria = "DADO DERIVADO"
    proveniencia: Proveniencia = "derived"
    drill: dict[str, Any] | None = Field(
        default=None,
        description="filtros para abrir o Document Explorer com o recorte deste KPI",
    )
    tom: Literal["neutro", "positivo", "atencao"] = "neutro"


class DocumentoResumo(BaseModel):
    documento_id: int
    data_documento: str | None = None
    data_documento_precisao: str | None = None
    natureza: str | None = None
    assunto: str | None = None
    destinatario: str | None = None
    temas_texto: str | None = None
    temas_count: int = 0
    rodovia_principal: str | None = None
    contrato: str | None = None
    estagio_documental: str | None = None
    macrogrupo_juridico: str | None = None
    status: str
    ativo: bool
    arquivo_extensao: str | None = None
    arquivo_nome: str
    pasta: str | None = None
    link_disponivel: bool = False


class DocumentoDetalhe(DocumentoResumo):
    link_url: str | None = None
    necessidade_resposta: int | None = None
    data_indexacao: str | None = None
    data_indexacao_aproximada: bool = False
    data_ultima_modificacao: str | None = None
    pessoa_upload: str | None = None
    pessoa_modificacao: str | None = None
    nome_conforme_padrao: bool = True
    nome_assunto: str | None = None
    nome_destinatario_curto: str | None = None
    destinatario_status_taxonomia: str | None = None
    contrato_origem: str | None = None
    executora: str | None = None
    macrogrupo_status: str | None = None
    macrogrupo_origem: str | None = None
    estagio_proveniencia: str | None = None
    contrato_proveniencia: str | None = None
    rodovia_proveniencia: str | None = None
    temas: list[dict[str, Any]] = Field(default_factory=list)
    rodovias: list[dict[str, Any]] = Field(default_factory=list)
    relacionados: list[dict[str, Any]] = Field(default_factory=list)


class ListaDocumentos(BaseModel):
    itens: list[DocumentoResumo]
    total: int
    limite: int
    offset: int
    ordenar_por: str
    ordem: str


class Achado(BaseModel):
    regra_key: str
    severidade: Severidade
    entidade_tipo: str
    entidade_id: str
    descricao: str
    proveniencia: str


class BlocoGovernanca(BaseModel):
    chave: str
    titulo: str
    descricao: str
    itens: list[dict[str, Any]] = Field(default_factory=list)


class MetaSnapshot(BaseModel):
    ciclo_id: str
    schema_version: str
    regras_negocio_versao: int
    regras_confirmadas_em: str | None = None
    indexed_as_of: str | None = None
    physical_scan_as_of: str
    pending_reconciliation_count: int
    indexing_gap_count: int
    documentos_indexados: int
    documentos_ativos: int
    documentos_excluidos: int
    acervo_fisico: int
    arquivos_controle: int
    vinculos_tema: int
    docs_com_rodovia: int
    docs_com_contrato: int
    indice_sha256: str | None = None
    inventario_digest: str | None = None
    achados_por_severidade: dict[str, int] = Field(default_factory=dict)
    rotulos_reconciliacao: dict[str, str] = Field(default_factory=dict)
    relogios_divergentes: bool = False
