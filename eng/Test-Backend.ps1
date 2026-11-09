#!/usr/bin/env pwsh
# Builds the backend and runs its tests as CI does. No database server needed (in-memory SQLite).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $root 'backend')
try {
    dotnet restore ./Hewn.sln
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
    dotnet build ./Hewn.sln --no-restore --configuration Release -warnaserror
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
    dotnet test ./Hewn.sln --no-build --configuration Release --logger 'console;verbosity=normal'
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
