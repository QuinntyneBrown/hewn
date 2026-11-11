#!/usr/bin/env pwsh
# Starts the Hewn API on http://localhost:5200 against a local SQLite database.
# Migrations are applied explicitly with `hewn migrate`, never on API startup.
param(
    [string]$Database = 'hewn.db',
    [switch]$DevSignIn,
    # Send traces to the local Jaeger and open /metrics to the local Prometheus (eng/Start-Observability.ps1).
    [switch]$Observability
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:ConnectionStrings__Hewn = "DataSource=$(Join-Path $root "backend/$Database")"
$env:ASPNETCORE_URLS = 'http://localhost:5200'
if ($DevSignIn) { $env:Hewn__Auth__DevSignIn = 'true' }
if ($Observability) {
    $env:OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
    $env:OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf'
    # The token eng/observability/compose.yaml's Prometheus scrapes with; a local value, not a secret.
    $env:HEWN_METRICS_TOKEN = 'local-metrics-token-not-a-secret'
}

dotnet run --project (Join-Path $root 'backend/src/Hewn.Cli') -- migrate
if ($LASTEXITCODE) { exit $LASTEXITCODE }
dotnet run --project (Join-Path $root 'backend/src/Hewn.Api') --no-launch-profile
