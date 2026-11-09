#!/usr/bin/env pwsh
# Resets and seeds a SQLite database, then starts the API (http://localhost:5200) and
# Mission Control (http://localhost:4200). Stop with Ctrl+C.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:ConnectionStrings__Hewn = "DataSource=$(Join-Path $root 'backend/hewn.db')"
if (-not $env:HEWN_ALLOWED_GITHUB_USERS) { $env:HEWN_ALLOWED_GITHUB_USERS = (git config user.name) -replace '\s', '' }
$env:Hewn__Auth__DevSignIn = 'true'

$cli = Join-Path $root 'backend/src/Hewn.Cli'
dotnet run --project $cli -- reset --yes
dotnet run --project $cli -- seed

$api = Start-Process pwsh -ArgumentList '-NoProfile', '-File', (Join-Path $PSScriptRoot 'Start-Api.ps1'), '-DevSignIn' -PassThru -NoNewWindow
try {
    Push-Location (Join-Path $root 'frontend')
    npm start
}
finally {
    Pop-Location
    Stop-Process -Id $api.Id -ErrorAction SilentlyContinue
}
