#!/usr/bin/env pwsh
# scripts/sqlx-prepare.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Generates the SQLx offline query cache (.sqlx/ directory) needed to build
# the API Docker image without a live database connection.
#
# Run this once, then commit the generated apps/api/.sqlx/ directory:
#   git add apps/api/.sqlx/
#   git commit -m "chore: update sqlx offline query cache"
#
# Re-run whenever you change a sqlx::query!() or sqlx::query_as!() macro.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "🦀 RustTrack — SQLx Offline Cache Generator" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if ($Clean) {
    Write-Host "🧹 Cleaning previous .sqlx/ cache..." -ForegroundColor Yellow
    $sqlxDir = Join-Path $ProjectRoot "apps\api\.sqlx"
    if (Test-Path $sqlxDir) {
        Remove-Item $sqlxDir -Recurse -Force
        Write-Host "   Removed $sqlxDir" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "1️⃣  Building sqlx-prepare Docker image..." -ForegroundColor Yellow
docker compose -f "$ProjectRoot\docker-compose.prepare.yml" build sqlx-prepare
if ($LASTEXITCODE -ne 0) { throw "Docker build failed" }

Write-Host ""
Write-Host "2️⃣  Starting postgres and running sqlx prepare..." -ForegroundColor Yellow
docker compose -f "$ProjectRoot\docker-compose.prepare.yml" run --rm sqlx-prepare
if ($LASTEXITCODE -ne 0) { throw "sqlx prepare failed" }

Write-Host ""
Write-Host "3️⃣  Stopping prepare services..." -ForegroundColor Yellow
docker compose -f "$ProjectRoot\docker-compose.prepare.yml" down -v

$sqlxDir = Join-Path $ProjectRoot "apps\api\.sqlx"
if (Test-Path $sqlxDir) {
    $fileCount = (Get-ChildItem $sqlxDir -File).Count
    Write-Host ""
    Write-Host "✅ Success! Generated $fileCount query cache files in:" -ForegroundColor Green
    Write-Host "   $sqlxDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   git add apps/api/.sqlx/"
    Write-Host "   git commit -m 'chore: update sqlx offline query cache'"
    Write-Host "   docker compose up --build"
} else {
    Write-Host ""
    Write-Host "⚠️  Warning: .sqlx/ directory not found after prepare." -ForegroundColor Red
    Write-Host "   Check Docker volume mounts in docker-compose.prepare.yml" -ForegroundColor Red
    exit 1
}
