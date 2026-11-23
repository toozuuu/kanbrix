# Development Guide

Welcome to local development on RustTrack!

## Monorepo Layout

- `apps/api`: Axum backend in Rust.
- `apps/web`: React + Vite + TypeScript frontend.
- `packages/api-contract`: OpenAPI specification and TypeScript interface generator.
- `scripts`: Setup scripts and PostgreSQL seed scripts.
- `deploy`: Container definitions.

## Windows PowerShell Setup

If developing on Windows with PowerShell:

```powershell
# 1. Start local Postgres
docker compose up -d postgres

# 2. Run backend
cd apps/api
$env:DATABASE_URL="postgres://postgres:postgrespassword@localhost:5432/rusttrack"
cargo run

# 3. In another terminal, run frontend
cd apps/web
npm install
npm run dev
```

## Running Tests

```bash
# Rust API unit and integration tests
cd apps/api
cargo test

# Frontend typechecking and tests
cd apps/web
npm run build
```
