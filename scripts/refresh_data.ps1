<#
.SYNOPSIS
    Captura um estado novo da fonte e reconstroi os dados derivados.

.DESCRIPTION
    Ciclo completo: snapshot consistente -> validacao -> normalizacao -> Parquet
    -> DuckDB. A fonte do Escritório Jurídico e lida em modo SOMENTE LEITURA; nada e escrito,
    movido ou renomeado nela.

    Se a fonte mudar durante o processamento, o ciclo termina com o estado que
    capturou. A proxima execucao pega o estado novo (DEC-020).

    Com a API rodando, basta recarregar o navegador depois: o backend reabre o
    banco a cada consulta.

.EXAMPLE
    .\scripts\refresh_data.ps1
    .\scripts\refresh_data.ps1 -ValidateOnly    # so valida, sem gravar nada
#>
[CmdletBinding()]
param(
    [switch]$ValidateOnly,
    [int]$ApiPort = 8000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ''
if ($ValidateOnly) {
    python -m backend.pipeline.run --validate-only
} else {
    python -m backend.pipeline.run --full
}
$code = $LASTEXITCODE

if ($code -eq 2) {
    Write-Host ''
    Write-Host 'QUEBRA DE CONTRATO: as abas ou colunas de 00 Indice.xlsx mudaram.' -ForegroundColor Red
    Write-Host 'A ingestao precisa ser revista antes de rodar. Nada foi gravado.' -ForegroundColor Red
    exit 2
}
if ($code -ne 0) {
    Write-Host ''
    Write-Host "Pipeline falhou (codigo $code). Os dados anteriores continuam intactos." -ForegroundColor Red
    exit $code
}

if (-not $ValidateOnly) {
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 3
        Write-Host ''
        Write-Host "API ja esta no ar com o ciclo $($health.ciclo_id) e $($health.documentos) documentos." -ForegroundColor Green
        Write-Host 'Recarregue o navegador para ver o estado novo.' -ForegroundColor DarkGray
    } catch {
        Write-Host ''
        Write-Host 'Dados reconstruidos. Suba a aplicacao com: .\scripts\start_dev.ps1' -ForegroundColor DarkGray
    }
}
Write-Host ''
