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
# Short waits before each automatic retry of a failed run (30 s, 2 min, 10 min in production; L2-006 AC1).
$env:Hewn__Retry__BackoffSeconds = '2,3,4'

# A small Greenlit for stage 0 to copy from: a git repository built from e2e/fixtures/greenlit.
$greenlit = Join-Path $root 'backend/.e2e/greenlit'
Remove-Item -Recurse -Force $greenlit -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $greenlit '.claude') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $greenlit '.agents') | Out-Null
$fixture = Join-Path $root 'e2e/fixtures/greenlit'
Copy-Item -Recurse (Join-Path $fixture 'claude-skills') (Join-Path $greenlit '.claude/skills')
Copy-Item -Recurse (Join-Path $fixture 'agents-skills') (Join-Path $greenlit '.agents/skills')
Copy-Item (Join-Path $fixture 'README.md') $greenlit
git -C $greenlit init -q -b main
git -C $greenlit add .
git -C $greenlit -c user.name=Hewn -c user.email=hewn@example.invalid commit -q -m 'Greenlit fixture'
$env:HEWN_SKILLS_SOURCE = "file://$greenlit"

$cli = Join-Path $root 'backend/src/Hewn.Cli'
dotnet run --project $cli -- reset --yes
if ($LASTEXITCODE) { exit $LASTEXITCODE }
dotnet run --project $cli -- seed
if ($LASTEXITCODE) { exit $LASTEXITCODE }
dotnet run --project (Join-Path $root 'backend/src/Hewn.Api') --no-launch-profile
