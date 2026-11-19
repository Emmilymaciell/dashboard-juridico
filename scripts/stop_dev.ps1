<#
.SYNOPSIS
    Para a API e o frontend do ambiente de desenvolvimento.

.DESCRIPTION
    Encerra o que estiver escutando nas portas 8000 (API) e 5173 (frontend).
    Nao toca em nenhum outro processo Python ou Node da maquina.
#>
[CmdletBinding()]
param(
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173
)

$ErrorActionPreference = 'Continue'

foreach ($item in @(
    @{ Port = $ApiPort; Nome = 'API' },
    @{ Port = $WebPort; Nome = 'frontend' }
)) {
    $conns = Get-NetTCPConnection -LocalPort $item.Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host "$($item.Nome) (porta $($item.Port)): nada escutando." -ForegroundColor DarkGray
        continue
    }
    foreach ($procId in ($conns.OwningProcess | Select-Object -Unique)) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "$($item.Nome) (porta $($item.Port)): $($proc.ProcessName) [$procId] encerrado." -ForegroundColor Green
        }
    }
}
