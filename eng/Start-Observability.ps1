#!/usr/bin/env pwsh
# Starts Jaeger (traces, http://localhost:16686) and Prometheus (metrics, http://localhost:9090) in Docker, for the
# API and worker started with -Observability. Stop them with eng/Start-Observability.ps1 -Down.
param([switch]$Down)
$ErrorActionPreference = 'Stop'
$compose = Join-Path $PSScriptRoot 'observability/compose.yaml'
$arguments = if ($Down) { @('-f', $compose, 'down') } else { @('-f', $compose, 'up', '-d', '--wait') }
# The Compose plugin (`docker compose`) where it is installed, else the standalone docker-compose.
docker compose version *> $null
if ($LASTEXITCODE -eq 0) { docker compose @arguments } else { docker-compose @arguments }
exit $LASTEXITCODE
