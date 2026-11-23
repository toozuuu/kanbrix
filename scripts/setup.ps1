# RustTrack Local Development Setup Script (PowerShell)
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  RustTrack Local Environment Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Environment file check
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
} else {
    Write-Host ".env file already exists." -ForegroundColor Green
}

# 2. Check Docker
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Starting PostgreSQL container via docker compose..." -ForegroundColor Yellow
    docker compose up -d postgres
} else {
    Write-Host "Docker not found in PATH. Please ensure PostgreSQL is running on port 5432." -ForegroundColor Red
}

# 3. Web dependencies
Write-Host "Installing web frontend dependencies..." -ForegroundColor Yellow
Set-Location "apps\web"
npm install
Set-Location "..\.."

Write-Host "`nSetup complete! To run the application:" -ForegroundColor Green
Write-Host "  Terminal 1 (Backend):  cd apps/api; cargo run" -ForegroundColor White
Write-Host "  Terminal 2 (Frontend): cd apps/web; npm run dev" -ForegroundColor White
Write-Host "  Or all-in-one:         docker compose up --build`n" -ForegroundColor White
