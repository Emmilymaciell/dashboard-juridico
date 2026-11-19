<#
.SYNOPSIS
    Sobe o dashboard localmente: API (FastAPI) + frontend (Vite).

.DESCRIPTION
    Abre duas janelas do PowerShell, uma para cada processo, e o navegador no
    frontend. Nada sai desta maquina: a API escuta apenas em 127.0.0.1.

    Se o banco analitico ainda nao existir, o script roda o pipeline antes de
    subir a API — a fonte do Escritório Jurídico e lida em modo somente leitura.

.EXAMPLE
    .\scripts\start_dev.ps1
    .\scripts\start_dev.ps1 -Refresh        # captura um snapshot novo antes de subir
    .\scripts\start_dev.ps1 -NoBrowser
.EXAMPLE
    .\scripts\stop_dev.ps1                  # para os dois processos
#>
[CmdletBinding()]
param(
    [switch]$Refresh,
    [switch]$NoBrowser,
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step { param([string]$Text) Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "    $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "    $Text" -ForegroundColor Yellow }

Write-Host ''
Write-Host 'Dashboard Jurídico - ambiente de desenvolvimento' -ForegroundColor White
Write-Host ('-' * 60) -ForegroundColor DarkGray

# --- 1. pre-requisitos ------------------------------------------------------
Write-Step 'Conferindo pre-requisitos'
$python = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $python) { throw 'Python nao encontrado no PATH.' }
Write-Ok "python: $((python --version) 2>&1)"

$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) { throw 'Node.js nao encontrado no PATH.' }
Write-Ok "node:   $(node --version)"

if (-not (Test-Path 'config\config.json')) {
    Write-Warn 'config\config.json ausente - criando a partir do exemplo.'
    Copy-Item 'config\config.example.json' 'config\config.json'
}
if (-not (Test-Path '.env')) {
    Write-Warn '.env ausente - criando a partir do exemplo.'
    Copy-Item '.env.example' '.env'
}

# --- 2. dependencias --------------------------------------------------------
$missing = python -c "import importlib,sys; mods=['fastapi','uvicorn','duckdb','pyarrow','openpyxl','pandas']; print(','.join(m for m in mods if importlib.util.find_spec(m) is None))"
if ($missing) {
    Write-Step "Instalando dependencias Python que faltam: $missing"
    python -m pip install --quiet --disable-pip-version-check fastapi "uvicorn[standard]" duckdb pyarrow openpyxl pandas pydantic
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependencias Python.' }
}
Write-Ok 'dependencias Python: ok'

if (-not (Test-Path 'frontend\node_modules')) {
    Write-Step 'Instalando dependencias do frontend (primeira vez, pode demorar)'
    Push-Location 'frontend'
    npm install --no-fund --no-audit
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw 'Falha no npm install.' }
}
Write-Ok 'dependencias do frontend: ok'

# --- 3. dados ---------------------------------------------------------------
$duckdb = 'data\processed\prog.duckdb'
if ($Refresh -or -not (Test-Path $duckdb)) {
    if ($Refresh) { Write-Step 'Capturando snapshot novo da fonte (somente leitura)' }
    else { Write-Step 'Banco analitico ausente - construindo a partir da fonte (somente leitura)' }
    python -m backend.pipeline.run --full
    if ($LASTEXITCODE -ne 0) { throw "Pipeline falhou (codigo $LASTEXITCODE). O dashboard nao sobe com dado incerto." }
} else {
    Write-Ok "banco analitico: $duckdb"
    Write-Warn 'Para capturar um estado novo da fonte: .\scripts\refresh_data.ps1'
}

# --- 4. processos -----------------------------------------------------------
Write-Step "Subindo a API em http://127.0.0.1:$ApiPort"
$apiCmd = "Set-Location '$root'; " +
          "`$host.UI.RawUI.WindowTitle = 'Programa API :$ApiPort'; " +
          "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port $ApiPort --reload"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $apiCmd | Out-Null

Write-Step "Subindo o frontend em http://127.0.0.1:$WebPort"
$webCmd = "Set-Location '$root\frontend'; " +
          "`$host.UI.RawUI.WindowTitle = 'Programa Web :$WebPort'; " +
          "npm run dev -- --port $WebPort"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $webCmd | Out-Null

# --- 5. espera a API responder ---------------------------------------------
Write-Step 'Aguardando a API responder'
$ready = $false
foreach ($attempt in 1..40) {
    Start-Sleep -Milliseconds 700
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/v1/health" -TimeoutSec 3
        if ($health.status -eq 'ok') {
            Write-Ok "API respondendo - ciclo $($health.ciclo_id), $($health.documentos) documentos"
            $ready = $true
            break
        }
    } catch { }
}
if (-not $ready) { Write-Warn 'A API ainda nao respondeu. Veja a janela "Programa API" para o erro.' }

if (-not $NoBrowser) {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:$WebPort"
}

Write-Host ''
Write-Host ('-' * 60) -ForegroundColor DarkGray
Write-Host 'Dashboard    : ' -NoNewline; Write-Host "http://127.0.0.1:$WebPort" -ForegroundColor White
Write-Host 'API          : ' -NoNewline; Write-Host "http://127.0.0.1:$ApiPort/api/v1" -ForegroundColor White
Write-Host 'Documentacao : ' -NoNewline; Write-Host "http://127.0.0.1:$ApiPort/docs" -ForegroundColor White
Write-Host ''
Write-Host 'Atualizar dados : .\scripts\refresh_data.ps1' -ForegroundColor DarkGray
Write-Host 'Parar tudo      : .\scripts\stop_dev.ps1  (ou feche as duas janelas)' -ForegroundColor DarkGray
Write-Host ''
