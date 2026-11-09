#!/usr/bin/env pwsh
# Starts a local worker with the scripted executor against the local API (eng/Start-Api.ps1).
# Set HEWN_WORKER_TOKEN to the same value for both processes; it is read from the environment, never a file.
param(
    [string]$ApiUrl = 'http://localhost:5200',
    [int]$StepMs = 1000,
    [int]$Count = 1
)
$ErrorActionPreference = 'Stop'
if (-not $env:HEWN_WORKER_TOKEN) { throw 'Set HEWN_WORKER_TOKEN (the API must be started with the same value).' }
$root = Split-Path -Parent $PSScriptRoot
$env:HEWN_API_URL = $ApiUrl
$env:HEWN_LOCATION = 'Local'
$env:HEWN_EXECUTOR = 'scripted'
$env:HEWN_SCRIPTED_STEP_MS = "$StepMs"
$main = Join-Path $root 'worker/src/main.ts'
$jobs = 1..$Count | ForEach-Object {
    $env:HEWN_WORKER_NAME = "local-worker-$_"
    Start-Process -FilePath node -ArgumentList $main -NoNewWindow -PassThru
}
try { $jobs | Wait-Process } finally { $jobs | Where-Object { -not $_.HasExited } | Stop-Process }
