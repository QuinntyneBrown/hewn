#!/usr/bin/env pwsh
# Starts the Hewn API on http://localhost:5200 against a local SQLite database.
# Migrations are applied explicitly with `hewn migrate`, never on API startup.
param(
    [string]$Database = 'hewn.db',
    [switch]$DevSignIn
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:ConnectionStrings__Hewn = "DataSource=$(Join-Path $root "backend/$Database")"
$env:ASPNETCORE_URLS = 'http://localhost:5200'
if ($DevSignIn) { $env:Hewn__Auth__DevSignIn = 'true' }

dotnet run --project (Join-Path $root 'backend/src/Hewn.Cli') -- migrate
if ($LASTEXITCODE) { exit $LASTEXITCODE }
dotnet run --project (Join-Path $root 'backend/src/Hewn.Api') --no-launch-profile
