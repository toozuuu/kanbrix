#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  RustTrack Local Environment Setup (Unix)"
echo "=========================================="

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

if command -v docker &> /dev/null; then
    echo "Starting PostgreSQL with Docker Compose..."
    docker compose up -d postgres
fi

echo "Installing web frontend dependencies..."
cd apps/web && npm install && cd ../..

echo "Setup complete! To run the application:"
echo "  Backend:  cd apps/api && cargo run"
echo "  Frontend: cd apps/web && npm run dev"
