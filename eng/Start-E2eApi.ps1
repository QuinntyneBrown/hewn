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
# grace is a second Owner, so the rate-limit test's submissions don't count against quinntynebrown's.
$env:HEWN_ALLOWED_GITHUB_USERS = 'quinntynebrown:Owner,ada:Viewer,grace:Owner'
$env:HEWN_GITHUB_OWNER = 'hewn-builds'
$env:HEWN_DEFAULT_BUDGET_USD = '300'
$env:HEWN_WORKER_TOKEN = 'e2e-worker-token-not-a-secret'
# Project HTML previews from another host than Mission Control's localhost (L2-011 AC2).
$env:Hewn__Preview__Origin = "http://127.0.0.1:$Port"
# Signs the webhooks e2e tests send as GitHub would (L2-037 AC2).
$env:HEWN_GITHUB_WEBHOOK_SECRET = 'e2e-webhook-secret-not-a-secret'
# Short waits before each automatic retry of a failed run (30 s, 2 min, 10 min in production; L2-006 AC1).
# The suites submit many directions as one Owner; 10 a minute (the default, proven in the backend tests) is too few.
if (-not $env:Hewn__RateLimit__DirectionsPerMinute) { $env:Hewn__RateLimit__DirectionsPerMinute = '30' }
if (-not $env:Hewn__Retry__BackoffSeconds) { $env:Hewn__Retry__BackoffSeconds = '2,3,4' }

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
