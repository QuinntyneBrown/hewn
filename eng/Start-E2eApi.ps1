#!/usr/bin/env pwsh
# Starts the API for Playwright: a fresh SQLite database, a seeded allow list, dev sign-in,
# and fake GitHub (and, as later slices add them, a fake worker, model and Magic Patterns).
param(
    [int]$Port = 5300
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$db = Join-Path $root 'backend/e2e.db'

$env:ConnectionStrings__Hewn = "DataSource=$db"
$env:ASPNETCORE_URLS = "http://localhost:$Port"
$env:ASPNETCORE_ENVIRONMENT = 'E2e'
$env:Hewn__Auth__DevSignIn = 'true'
$env:Hewn__Fakes__Enabled = 'true'
$env:Hewn__Fakes__GitHub__NoAccess = 'northwind/handover'
$env:Hewn__Fakes__GitHub__NotFound = 'northwind/missing'
$env:HEWN_ALLOWED_GITHUB_USERS = 'quinntynebrown:Owner,ada:Viewer'
$env:HEWN_GITHUB_OWNER = 'hewn-builds'
$env:HEWN_DEFAULT_BUDGET_USD = '300'
$env:HEWN_WORKER_TOKEN = 'e2e-worker-token-not-a-secret'

$cli = Join-Path $root 'backend/src/Hewn.Cli'
dotnet run --project $cli -- reset --yes
if ($LASTEXITCODE) { exit $LASTEXITCODE }
dotnet run --project $cli -- seed
if ($LASTEXITCODE) { exit $LASTEXITCODE }
dotnet run --project (Join-Path $root 'backend/src/Hewn.Api') --no-launch-profile
